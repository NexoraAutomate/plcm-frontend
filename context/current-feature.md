# Current Feature: Sibling Node Groups

## Status

In Progress

## Goals

- [x] Persist sibling groups (`sibling_group_id` + `sibling_group_name`) on hierarchy config nodes (backend + frontend)
- [x] Allow multi-select of two or more sibling nodes on the config tree canvas
- [x] User can create a group with a custom name, rename, and ungroup
- [x] Visual group frame on the canvas around grouped siblings

## Notes

- Groups are visual/organizational among siblings only — they do not change hierarchy parent/child levels
- Multi-select limited to nodes that share the same `parent_client_key`
- Ctrl/Cmd+click to add/remove siblings from selection

## History

<!-- Completed features (append only) -->

### Inventory Reports Cleanup & Selectable Columns
Trim report modes; location tree filter; adaptive columns; shared column visibility.

### Frontend OOM — Safety Caps (Phase 4)
Lower absolute paginated-fetch safety valve; status list cap; poll intervals; toast/gcTime; hierarchy merge cap.

### Frontend OOM — Compile Graph (Phase 3)
`next/dynamic` for Settings, Recharts, XYFlow, Ant Charts; dead module cleanup; merged as `179fd52`.

### Frontend OOM — DataStore (Phase 2)
Split domain/hierarchy contexts; list-page hierarchy slices; merged as `c0252ad`.

### Frontend OOM — Resolution History (Phase 1)
Scoped resolution-history loads; LRU caches; concurrency caps; merged as `aabc935`.

### Project Delete — Revert vs Discard
Anyone with `delete_projects` can delete via revert or discard; inventory disposition + notifications.
