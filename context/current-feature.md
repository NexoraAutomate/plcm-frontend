# Current Feature: Frontend OOM — DataStore (Phase 2)

## Status

Complete

## Goals

- Stop dual-writing React Query cache and DataStore state on bootstrap refresh
- Split DataStore into domain vs hierarchy contexts so hierarchy loads do not re-render domain-only consumers
- Replace full 5-type eager hierarchy loads on list pages with adjacent-type slice loads
- Remove inventory page eager `ensureHierarchyLoaded` (use API `total_used` / page data)
- Preserve detail/dashboard/search full hierarchy behavior and list child-count UX

## Notes

- Frontend-only; builds on Phase 1 (`aabc935`)
- `useDataStore()` remains for full access; prefer `useDataStoreDomain()` / `useDataStoreHierarchy()` when possible

## History

<!-- Completed features (append only) -->

### Frontend OOM — Resolution History (Phase 1)
Scoped resolution-history loads to project cases + entity IDs; LRU caches; concurrency caps; merged to main as `aabc935`.

### HM Installation Accept / Reject
Rename Verify → Accept; add Reject with reason; status `INSTALLATION_REJECTED`; rejection history for Dev/HM/Admin; merged to main.
