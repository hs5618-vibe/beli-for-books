# Beli Books — Product Context

Beli Books is a mobile-first social book discovery app inspired by Beli and Goodreads.

Core concept:
Users discover books through trusted people, not algorithms.

Primary features:
- Users rate books using 3 sentiment levels:
  - Loved
  - Liked
  - Okay

- Each book receives a numeric score (0–10) derived from pairwise comparisons, similar to Beli.

- Users can:
  - Follow other users
  - View a feed of book rankings from people they follow
  - Search books using Google Books API
  - View book detail pages
  - View user profiles

Core screens:
- FeedScreen
- SearchScreen
- BookDetailScreen
- ProfileScreen
- OnboardingScreen

Tech stack:
- Expo
- React Native
- TypeScript
- Supabase (backend)
- Google Books API (book data)

Design style:
- Minimal
- Fast
- Modern
- Similar UX to Beli app

Architecture principles:
- Clean folder structure
- Reusable components
- Strong typing
- Scalable backend integration

Goal:
Ship MVP quickly, then iterate.

## Recommendation Engine (Non-AI)

The app now uses collaborative filtering for instant post-rating recommendations via:
`public.get_recommendations_for_user(target_user_id uuid)`.

Primary tuning knobs live in:
`supabase/migrations/20260227_recommendations_cf.sql`

- Neighbor count `K`: currently `20`
- Minimum overlap: currently `3` shared rated books
- Minimum taste match: currently `60%`
- Positive ratings only:
  - categorical: `Loved` and `Liked`
  - numeric fallback: `numeric_score >= 7`
- Rating weights:
  - `Loved = 1.0`
  - `Liked = 0.6`
  - numeric fallback: `numeric_score / 10`

Output is top `3` unrated books with an explainable reason.
If user data is sparse or no qualified neighbors exist, fallback is trending (last 14 days) with reason `Popular this week`.
