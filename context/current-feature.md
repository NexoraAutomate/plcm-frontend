# Current Feature: Frontend OOM — Compile Graph (Phase 3)

## Status

Complete

## Goals

- `next/dynamic` Settings panels so Users/Roles do not compile XYFlow Definitions editors
- Dynamic Ant Charts on executive grid; avoid fat executive barrel on the page
- Dynamic Recharts mini-dashboards on list pages
- Dynamic XYFlow islands (hierarchy dashboard, system hierarchy, inventory dialog, maintenance lookup, location tree)
- Split location/config tree libs so normalize/helpers do not pull dagre/xyflow
- Delete dead duplicate modules (dashboard hierarchy-dashboard fork, dead toast, unused editors)

## Notes

- Frontend-only; builds on Phase 1–2 on `main`
- Do not remove npm packages without approval
- Preserve settings tab/`?section=` behavior and flow dialog UX

## History

<!-- Completed features (append only) -->

### Frontend OOM — DataStore (Phase 2)
Split domain/hierarchy contexts; stop Query dual-write; list-page hierarchy slices; merged as `c0252ad`.

### Frontend OOM — Resolution History (Phase 1)
Scoped resolution-history loads; LRU caches; concurrency caps; merged as `aabc935`.
