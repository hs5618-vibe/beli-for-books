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
