# Current Feature: Frontend OOM — Safety Caps (Phase 4)

## Status

Complete

## Goals

- Lower absolute paginated-fetch safety valve (still above normal workloads)
- Cap status list fetch (replace hard-coded 5000)
- Align workflow poll intervals with React Query `staleTime` (stop 12s vs 30s fights)
- Shorten unused shadcn toast remove delay; unify QueryClient singleton + slightly tighter `gcTime`
- Cap silent hierarchy merges so store arrays cannot grow past `HIERARCHY_TYPE_CAP`
- Do not use Node heap increases as the fix

## Notes

- Frontend-only; builds on Phases 1–3 on `main`
- Keep `HIERARCHY_TYPE_CAP` at 500 (tree correctness)
- Auth session poll stays at 15s (security)

## History

<!-- Completed features (append only) -->

### Frontend OOM — Compile Graph (Phase 3)
`next/dynamic` for Settings, Recharts, XYFlow, Ant Charts; dead module cleanup; merged as `179fd52`.

### Frontend OOM — DataStore (Phase 2)
Split domain/hierarchy contexts; list-page hierarchy slices; merged as `c0252ad`.

### Frontend OOM — Resolution History (Phase 1)
Scoped resolution-history loads; LRU caches; concurrency caps; merged as `aabc935`.
