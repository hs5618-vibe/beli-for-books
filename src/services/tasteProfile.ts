import { supabase } from '../lib/supabase';
import type { BookSummary } from '../types/book';
import { getTasteMatchBetweenAppUsers } from './tasteMatch';
import { getAppUserId } from './userProfile';

const GOOGLE_BOOKS_API_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const GOOGLE_BOOKS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;
const ENABLE_REMOTE_GENRE_LOOKUP = process.env.EXPO_PUBLIC_ENABLE_GOOGLE_GENRE_LOOKUP === 'true';
const MAX_GENRE_SAMPLE_BOOKS = 12;

const genreCache = new Map<string, string[]>();

export type TasteProfileBook = BookSummary & {
  numericScore: number;
};

export type TasteProfileData = {
  topBooks: TasteProfileBook[];
  averageRatingScore: number | null;
  ratingsCount: number;
  favoriteGenres: string[];
  viewerTasteMatchPercentage: number | null;
};

type RatingRow = {
  book_id: string;
  numeric_score: number;
};

type BookRow = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
};

type GoogleBookDetailResponse = {
  volumeInfo?: {
    categories?: string[];
  };
};

async function fetchGenresForBook(bookId: string): Promise<string[]> {
  const cached = genreCache.get(bookId);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({ projection: 'lite' });
  if (GOOGLE_BOOKS_API_KEY) {
    params.set('key', GOOGLE_BOOKS_API_KEY);
  }

  try {
    const response = await fetch(`${GOOGLE_BOOKS_API_BASE_URL}/${encodeURIComponent(bookId)}?${params.toString()}`);
    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as GoogleBookDetailResponse;
    const categories = (payload.volumeInfo?.categories ?? [])
      .map((item) => item.trim())
      .filter((item) => Boolean(item));
    genreCache.set(bookId, categories);
    return categories;
  } catch {
    return [];
  }
}

export async function getTasteProfile(params: {
  targetAppUserId: string;
  viewerAuthUserId?: string;
}): Promise<TasteProfileData> {
  const ratingsQuery = supabase
    .from('ratings')
    .select('book_id,numeric_score')
    .eq('user_id', params.targetAppUserId)
    .order('numeric_score', { ascending: false })
    .limit(200);
  const ratingsCountQuery = supabase
    .from('ratings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', params.targetAppUserId);

  const [ratingsResult, ratingsCountResult] = await Promise.all([ratingsQuery, ratingsCountQuery]);

  if (ratingsResult.error) {
    throw new Error(ratingsResult.error.message);
  }
  if (ratingsCountResult.error) {
    throw new Error(ratingsCountResult.error.message);
  }

  const ratingRows = (ratingsResult.data ?? []) as RatingRow[];
  const ratingsCount = ratingsCountResult.count ?? ratingRows.length;

  const uniqueBookIds = [...new Set(ratingRows.map((row) => row.book_id))];
  if (uniqueBookIds.length === 0) {
    return {
      topBooks: [],
      averageRatingScore: null,
      ratingsCount,
      favoriteGenres: [],
      viewerTasteMatchPercentage: null,
    };
  }

  const booksResult = await supabase
    .from('books')
    .select('id,title,author,cover_url')
    .in('id', uniqueBookIds);

  if (booksResult.error) {
    throw new Error(booksResult.error.message);
  }

  const booksById = new Map<string, BookRow>((booksResult.data ?? []).map((row) => [row.id, row as BookRow]));

  const topBooks: TasteProfileBook[] = [];
  for (const row of ratingRows.slice(0, 5)) {
    const book = booksById.get(row.book_id);
    if (!book) {
      continue;
    }

    topBooks.push({
      id: book.id,
      title: book.title,
      author: book.author,
      coverUrl: book.cover_url ?? undefined,
      numericScore: Number(row.numeric_score),
    });
  }

  const averageRatingScore =
    ratingRows.length === 0
      ? null
      : Number((ratingRows.reduce((sum, row) => sum + Number(row.numeric_score), 0) / ratingRows.length).toFixed(1));

  const genreSampleIds = ratingRows.slice(0, MAX_GENRE_SAMPLE_BOOKS).map((row) => row.book_id);
  const genreLists = ENABLE_REMOTE_GENRE_LOOKUP
    ? await Promise.all(genreSampleIds.map((bookId) => fetchGenresForBook(bookId)))
    : [];
  const genreCounts = new Map<string, number>();
  for (const genres of genreLists) {
    for (const genre of genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }

  const favoriteGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre]) => genre);

  let viewerTasteMatchPercentage: number | null = null;
  if (params.viewerAuthUserId) {
    const viewerAppUserId = await getAppUserId(params.viewerAuthUserId);
    if (viewerAppUserId !== params.targetAppUserId) {
      const tasteMatch = await getTasteMatchBetweenAppUsers(viewerAppUserId, params.targetAppUserId);
      viewerTasteMatchPercentage = tasteMatch.percentage;
    }
  }

  return {
    topBooks,
    averageRatingScore,
    ratingsCount,
    favoriteGenres,
    viewerTasteMatchPercentage,
  };
}
