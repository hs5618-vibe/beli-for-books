import type { BookSummary } from '../types/book';
import { supabase } from '../lib/supabase';

type GoogleBooksResponse = {
  items?: Array<{
    id: string;
    volumeInfo?: {
      title?: string;
      authors?: string[];
      imageLinks?: {
        thumbnail?: string;
        smallThumbnail?: string;
      };
    };
  }>;
};

const GOOGLE_BOOKS_API_BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const GOOGLE_BOOKS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;
const SEARCH_LIMIT = 20;

type DbBookRow = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
};

function normalizeCoverUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  return url.replace(/^http:\/\//i, 'https://');
}

function mapGoogleBookToSummary(item: NonNullable<GoogleBooksResponse['items']>[number]): BookSummary | null {
  if (!item.id) {
    return null;
  }

  const title = item.volumeInfo?.title?.trim();
  if (!title) {
    return null;
  }

  const author = item.volumeInfo?.authors?.join(', ')?.trim() || 'Unknown Author';
  const coverUrl = normalizeCoverUrl(
    item.volumeInfo?.imageLinks?.thumbnail ?? item.volumeInfo?.imageLinks?.smallThumbnail,
  );

  return {
    id: item.id,
    title,
    author,
    coverUrl,
  };
}

function mapDbBookToSummary(row: DbBookRow): BookSummary {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    coverUrl: row.cover_url ?? undefined,
  };
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function rankBook(query: string, book: BookSummary, indexBias: number): number {
  const normalizedQuery = normalizeText(query);
  const title = normalizeText(book.title);
  const author = normalizeText(book.author);
  const tokens = normalizedQuery.split(' ').filter((token) => token.length > 1);

  let score = 0;

  if (title === normalizedQuery) {
    score += 1000;
  } else if (title.startsWith(normalizedQuery)) {
    score += 750;
  } else if (title.includes(normalizedQuery)) {
    score += 500;
  }

  if (author === normalizedQuery) {
    score += 320;
  } else if (author.startsWith(normalizedQuery)) {
    score += 240;
  } else if (author.includes(normalizedQuery)) {
    score += 160;
  }

  for (const token of tokens) {
    if (title.includes(token)) {
      score += 40;
    }
    if (author.includes(token)) {
      score += 20;
    }
  }

  return score + indexBias;
}

function sortByRelevance(query: string, books: BookSummary[]): BookSummary[] {
  return [...books]
    .map((book, index) => ({
      book,
      score: rankBook(query, book, Math.max(0, 30 - index)),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.book);
}

async function searchBooksFromLocalCache(query: string): Promise<BookSummary[]> {
  const escaped = query.trim().replace(/[%_]/g, '');
  if (!escaped) {
    return [];
  }

  const { data, error } = await supabase
    .from('books')
    .select('id,title,author,cover_url')
    .or(`title.ilike.%${escaped}%,author.ilike.%${escaped}%`)
    .limit(SEARCH_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DbBookRow[]).map(mapDbBookToSummary);
}

export async function searchBooks(query: string): Promise<BookSummary[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const params = new URLSearchParams({
    q: query.trim(),
    maxResults: String(SEARCH_LIMIT),
    printType: 'books',
    orderBy: 'relevance',
    projection: 'lite',
  });

  if (GOOGLE_BOOKS_API_KEY) {
    params.set('key', GOOGLE_BOOKS_API_KEY);
  }

  const response = await fetch(`${GOOGLE_BOOKS_API_BASE_URL}?${params.toString()}`);

  if (!response.ok) {
    const localResults = await searchBooksFromLocalCache(query);
    if (localResults.length > 0) {
      return localResults;
    }

    if (response.status === 429) {
      throw new Error('Search is temporarily rate-limited. Please try again in a minute.');
    }

    throw new Error(`Book search failed (${response.status})`);
  }

  const payload = (await response.json()) as GoogleBooksResponse;
  const items = payload.items ?? [];
  const apiResults = items
    .map(mapGoogleBookToSummary)
    .filter((book): book is BookSummary => Boolean(book));

  const localResults = await searchBooksFromLocalCache(query);
  const deduped = new Map<string, BookSummary>();

  for (const book of apiResults) {
    deduped.set(book.id, book);
  }
  for (const book of localResults) {
    if (!deduped.has(book.id)) {
      deduped.set(book.id, book);
    }
  }

  return sortByRelevance(query, [...deduped.values()]).slice(0, SEARCH_LIMIT);
}
