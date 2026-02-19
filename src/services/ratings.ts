import { supabase } from '../lib/supabase';
import type { BookSummary } from '../types/book';
import type { ReadingStatus, Sentiment } from '../types/feed';
import { getAppUserId } from './userProfile';

export type RatingInput = {
  authUserId: string;
  book: BookSummary;
  sentiment: Sentiment;
  note?: string;
  isNotePrivate: boolean;
  readingStatus?: ReadingStatus;
};

export type RatingRecord = {
  id: string;
  userId: string;
  book: BookSummary;
  sentiment: Sentiment;
  note?: string;
  isNotePrivate: boolean;
  readingStatus?: ReadingStatus;
  numericScore: number;
  createdAt: string;
};

export type BookRatingState = {
  sentiment?: Sentiment;
  note: string;
  isNotePrivate: boolean;
  readingStatus?: ReadingStatus;
  numericScore?: number;
};

export type PairwiseComparisonPrompt = {
  id: string;
  leftBook: BookSummary;
  rightBook: BookSummary;
};

export type ComparisonSelection = 'left' | 'right' | 'tie';

type DbRatingRow = {
  id: string;
  user_id: string;
  book_id: string;
  sentiment: Sentiment;
  numeric_score: number;
  note: string | null;
  is_note_private: boolean;
  created_at: string;
};

function baseScoreForSentiment(sentiment: Sentiment): number {
  switch (sentiment) {
    case 'Loved':
      return 9;
    case 'Liked':
      return 7;
    case 'Okay':
      return 5;
    default:
      return 5;
  }
}

async function ensureBook(book: BookSummary): Promise<void> {
  const { error } = await supabase.from('books').upsert(
    {
      id: book.id,
      title: book.title,
      author: book.author,
      cover_url: book.coverUrl ?? null,
    },
    {
      onConflict: 'id',
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function comparisonAdjustment(appUserId: string, bookId: string): Promise<number> {
  const { data, error } = await supabase
    .from('pairwise_comparisons')
    .select('left_book_id,right_book_id,winner')
    .eq('user_id', appUserId)
    .or(`left_book_id.eq.${bookId},right_book_id.eq.${bookId}`);

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    return 0;
  }

  let wins = 0;
  let losses = 0;

  for (const comparison of data) {
    if (comparison.winner === 'tie') {
      continue;
    }

    const wonLeft = comparison.winner === 'left' && comparison.left_book_id === bookId;
    const wonRight = comparison.winner === 'right' && comparison.right_book_id === bookId;

    if (wonLeft || wonRight) {
      wins += 1;
    } else {
      losses += 1;
    }
  }

  const raw = (wins - losses) * 0.2;
  return Math.max(-1, Math.min(1, raw));
}

async function deriveNumericScore(appUserId: string, sentiment: Sentiment, bookId: string): Promise<number> {
  const base = baseScoreForSentiment(sentiment);
  const adjusted = base + (await comparisonAdjustment(appUserId, bookId));
  return Math.max(0, Math.min(10, Number(adjusted.toFixed(1))));
}

async function upsertReadingStatus(params: {
  appUserId: string;
  bookId: string;
  readingStatus?: ReadingStatus;
}): Promise<void> {
  if (!params.readingStatus) {
    const { error: deleteError } = await supabase
      .from('book_statuses')
      .delete()
      .eq('user_id', params.appUserId)
      .eq('book_id', params.bookId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return;
  }

  const { error } = await supabase.from('book_statuses').upsert(
    {
      user_id: params.appUserId,
      book_id: params.bookId,
      status: params.readingStatus,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id,book_id',
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function writeActivity(params: {
  appUserId: string;
  bookId: string;
  activityType: 'Rated' | 'StatusChanged';
  ratingId?: string;
}): Promise<void> {
  const { error } = await supabase.from('activities').insert({
    actor_user_id: params.appUserId,
    book_id: params.bookId,
    activity_type: params.activityType,
    rating_id: params.ratingId ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function mapRatingRecord(params: {
  row: DbRatingRow;
  book: BookSummary;
  readingStatus?: ReadingStatus;
}): RatingRecord {
  return {
    id: params.row.id,
    userId: params.row.user_id,
    book: params.book,
    sentiment: params.row.sentiment,
    note: params.row.note ?? undefined,
    isNotePrivate: params.row.is_note_private,
    readingStatus: params.readingStatus,
    numericScore: params.row.numeric_score,
    createdAt: params.row.created_at,
  };
}

export async function getBookRatingState(authUserId: string, bookId: string): Promise<BookRatingState> {
  const appUserId = await getAppUserId(authUserId);

  const [ratingResponse, statusResponse] = await Promise.all([
    supabase
      .from('ratings')
      .select('sentiment,numeric_score,note,is_note_private')
      .eq('user_id', appUserId)
      .eq('book_id', bookId)
      .maybeSingle(),
    supabase
      .from('book_statuses')
      .select('status')
      .eq('user_id', appUserId)
      .eq('book_id', bookId)
      .maybeSingle(),
  ]);

  if (ratingResponse.error) {
    throw new Error(ratingResponse.error.message);
  }

  if (statusResponse.error) {
    throw new Error(statusResponse.error.message);
  }

  return {
    sentiment: ratingResponse.data?.sentiment,
    note: ratingResponse.data?.note ?? '',
    isNotePrivate: ratingResponse.data?.is_note_private ?? false,
    readingStatus: statusResponse.data?.status,
    numericScore: ratingResponse.data?.numeric_score,
  };
}

export async function upsertRating(input: RatingInput): Promise<RatingRecord> {
  const appUserId = await getAppUserId(input.authUserId);

  await ensureBook(input.book);

  const numericScore = await deriveNumericScore(appUserId, input.sentiment, input.book.id);

  const ratingResponse = await supabase
    .from('ratings')
    .upsert(
      {
        user_id: appUserId,
        book_id: input.book.id,
        sentiment: input.sentiment,
        numeric_score: numericScore,
        note: input.note ?? null,
        is_note_private: input.isNotePrivate,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,book_id',
      },
    )
    .select('id,user_id,book_id,sentiment,numeric_score,note,is_note_private,created_at')
    .single();

  if (ratingResponse.error || !ratingResponse.data) {
    throw new Error(ratingResponse.error?.message ?? 'Failed to save rating');
  }

  await upsertReadingStatus({
    appUserId,
    bookId: input.book.id,
    readingStatus: input.readingStatus,
  });

  await writeActivity({
    appUserId,
    bookId: input.book.id,
    activityType: 'Rated',
    ratingId: ratingResponse.data.id,
  });

  if (input.readingStatus) {
    await writeActivity({
      appUserId,
      bookId: input.book.id,
      activityType: 'StatusChanged',
    });
  }

  return mapRatingRecord({
    row: ratingResponse.data,
    book: input.book,
    readingStatus: input.readingStatus,
  });
}

export async function getPairwisePrompts(
  authUserId: string,
  currentBook: BookSummary,
): Promise<PairwiseComparisonPrompt[]> {
  const appUserId = await getAppUserId(authUserId);

  const ratingsResponse = await supabase
    .from('ratings')
    .select('book_id')
    .eq('user_id', appUserId)
    .neq('book_id', currentBook.id)
    .order('created_at', { ascending: false })
    .limit(2);

  if (ratingsResponse.error) {
    throw new Error(ratingsResponse.error.message);
  }

  const candidateBookIds = (ratingsResponse.data ?? []).map((row) => row.book_id);
  if (candidateBookIds.length === 0) {
    return [];
  }

  const booksResponse = await supabase
    .from('books')
    .select('id,title,author,cover_url')
    .in('id', candidateBookIds);

  if (booksResponse.error) {
    throw new Error(booksResponse.error.message);
  }

  const booksById = new Map<string, BookSummary>();
  for (const row of booksResponse.data ?? []) {
    booksById.set(row.id, {
      id: row.id,
      title: row.title,
      author: row.author,
      coverUrl: row.cover_url ?? undefined,
    });
  }

  return candidateBookIds
    .map((bookId) => booksById.get(bookId))
    .filter((book): book is BookSummary => Boolean(book))
    .map((book) => ({
      id: `cmp-${currentBook.id}-${book.id}`,
      leftBook: currentBook,
      rightBook: book,
    }));
}

export async function submitComparisonResult(params: {
  prompt: PairwiseComparisonPrompt;
  authUserId: string;
  selection: ComparisonSelection;
}): Promise<void> {
  const appUserId = await getAppUserId(params.authUserId);

  await ensureBook(params.prompt.leftBook);
  await ensureBook(params.prompt.rightBook);

  const { error } = await supabase.from('pairwise_comparisons').insert({
    user_id: appUserId,
    left_book_id: params.prompt.leftBook.id,
    right_book_id: params.prompt.rightBook.id,
    winner: params.selection,
  });

  if (error) {
    throw new Error(error.message);
  }
}
