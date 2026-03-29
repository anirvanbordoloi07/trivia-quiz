# Supabase Setup For Trivia Quiz

This app should use a separate `trivia` schema inside your existing Supabase project.

## Files

- `migrations/20260329_000001_trivia_schema.sql`
  Creates the dedicated `trivia` schema, core tables, indexes, realtime publication entries, and the first RPC functions.

## Project values

- Project URL: `https://rmpilrdqjjznozafrwpv.supabase.co`
- Publishable key: `sb_publishable_hZcLWier91MPw2ma0r0qIw_nCOuXGO4`

## Manual execution path

1. Open Supabase SQL Editor for project `rmpilrdqjjznozafrwpv`.
2. Paste the migration SQL from `migrations/20260329_000001_trivia_schema.sql`.
3. Run it once.
4. Paste the gameplay SQL from `migrations/20260329_000002_trivia_gameplay.sql`.
5. Run it once.
6. In `Project Settings` → `Data API` → `Settings`, add `trivia` to the exposed schemas list and save.
7. Verify the `trivia` schema appears with:
   - `games`
   - `game_players`
   - `game_rounds`
   - `game_events`
8. Verify Realtime is enabled for:
   - `trivia.games`
   - `trivia.game_players`
   - `trivia.game_rounds`

## Frontend environment values

Set these in your frontend host before the next deploy:

- `VITE_SUPABASE_URL=https://rmpilrdqjjznozafrwpv.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_hZcLWier91MPw2ma0r0qIw_nCOuXGO4`

## Important note

After the gameplay migration and a fresh frontend deploy, the app can use Supabase-backed room state and realtime sync instead of depending on the old in-memory Socket.IO flow.
