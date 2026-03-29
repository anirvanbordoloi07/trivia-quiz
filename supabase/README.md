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
4. Verify the `trivia` schema appears with:
   - `games`
   - `game_players`
   - `game_rounds`
   - `game_events`
5. Verify Realtime is enabled for:
   - `trivia.games`
   - `trivia.game_players`
   - `trivia.game_rounds`

## Important note

This migration prepares the persistent data layer. The existing deployed app is still using the Socket.IO / in-memory backend until the frontend and gameplay logic are migrated to Supabase-backed reads and writes.
