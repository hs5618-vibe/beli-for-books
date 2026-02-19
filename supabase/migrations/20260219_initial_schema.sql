-- Initial schema for Beli Books MVP.

create extension if not exists pgcrypto;

create type sentiment_value as enum ('Loved', 'Liked', 'Okay');
create type reading_status_value as enum ('WantToRead', 'Reading', 'Read');
create type activity_type_value as enum ('Rated', 'StatusChanged', 'Added');
create type comparison_winner_value as enum ('left', 'right', 'tie');

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id text primary key,
  title text not null,
  author text not null,
  cover_url text,
  source text not null default 'google_books',
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references public.users(id) on delete cascade,
  followee_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_no_self check (follower_id <> followee_id)
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  sentiment sentiment_value not null,
  numeric_score numeric(3,1) not null,
  note text,
  is_note_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id),
  constraint rating_score_range check (numeric_score >= 0 and numeric_score <= 10)
);

create table if not exists public.book_statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  status reading_status_value not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create table if not exists public.pairwise_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  left_book_id text not null references public.books(id) on delete cascade,
  right_book_id text not null references public.books(id) on delete cascade,
  winner comparison_winner_value not null,
  created_at timestamptz not null default now(),
  constraint pairwise_book_distinct check (left_book_id <> right_book_id)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.users(id) on delete cascade,
  book_id text not null references public.books(id) on delete cascade,
  activity_type activity_type_value not null,
  rating_id uuid references public.ratings(id) on delete set null,
  status_id uuid references public.book_statuses(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_follows_followee on public.follows (followee_id);
create index if not exists idx_ratings_user_created on public.ratings (user_id, created_at desc);
create index if not exists idx_status_user_created on public.book_statuses (user_id, created_at desc);
create index if not exists idx_activities_actor_created on public.activities (actor_user_id, created_at desc);
create index if not exists idx_activities_created on public.activities (created_at desc);
