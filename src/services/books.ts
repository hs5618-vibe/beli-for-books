import type { BookSummary } from '../types/book';

const MOCK_SEARCH_BOOKS: BookSummary[] = [
  {
    id: 'book-1',
    title: 'Tomorrow, and Tomorrow, and Tomorrow',
    author: 'Gabrielle Zevin',
  },
  {
    id: 'book-2',
    title: 'The Thursday Murder Club',
    author: 'Richard Osman',
  },
  {
    id: 'book-3',
    title: 'The Rabbit Hutch',
    author: 'Tess Gunty',
  },
  {
    id: 'book-4',
    title: 'Piranesi',
    author: 'Susanna Clarke',
  },
  {
    id: 'book-5',
    title: 'The Secret History',
    author: 'Donna Tartt',
  },
];

export async function searchBooks(query: string): Promise<BookSummary[]> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return MOCK_SEARCH_BOOKS.filter((book) => {
    const haystack = `${book.title} ${book.author}`.toLowerCase();
    return haystack.includes(normalized);
  });
}
