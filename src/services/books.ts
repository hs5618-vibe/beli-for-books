import type { BookSummary } from '../types/book';

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

export async function searchBooks(query: string): Promise<BookSummary[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const params = new URLSearchParams({
    q: query.trim(),
    maxResults: '20',
    printType: 'books',
    orderBy: 'relevance',
    projection: 'lite',
  });

  if (GOOGLE_BOOKS_API_KEY) {
    params.set('key', GOOGLE_BOOKS_API_KEY);
  }

  const response = await fetch(`${GOOGLE_BOOKS_API_BASE_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Book search failed (${response.status})`);
  }

  const payload = (await response.json()) as GoogleBooksResponse;
  const items = payload.items ?? [];

  return items
    .map(mapGoogleBookToSummary)
    .filter((book): book is BookSummary => Boolean(book));
}
