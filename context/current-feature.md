# Current Feature: Inventory Reports Cleanup & Selectable Columns

## Status

In Progress

## Goals

- [x] Trim inventory report modes to significant ones only (drop stubs/duplicates)
- [x] Remove redundant Part Number / Serial Number filters and report columns (and Part/Serial Lookup mode)
- [x] Location filter/entry uses saved location tree dropdown (Room→Cabinet→Rack), linked to inventory records
- [x] Report table columns adapt by report type
- [x] Selectable column visibility works across application tables (shared control + persistence)

## Notes

- Keep inventory master fields for part/serial in create/edit if still used for unit identity; remove from reports UI as redundant with search/SKU
- Redundant modes today: by_project/by_system/by_location/lookup ≡ current; issued ≡ reserved; valuation is stub
- Keep: current, low, out, available, one open-issuance mode, movements
- Location master: `inventory_location_tree` + `CascadingLocationSelects`
- No shared DataTable today — add reusable column-visibility hook/UI and wire into EntityTable, ReportTable, and major list pages

## History

<!-- Completed features (append only) -->

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
