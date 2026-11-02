# Current Feature: Prevent Duplicate Open Maintenance Cases

## Status

Complete

## Goals

- [x] Backend rejects creating a maintenance case when an open/active case already exists for the same entity (serial)
- [x] Frontend shows a clear error popup/toast with the API message when a duplicate is attempted
- [x] New cases remain allowed after the previous case is resolved or closed

## Notes

- Match on `entity_id` + `entity_type` stored on the case (serial is used for lookup only at create time)
- Active statuses: `open`, `under_inspection`, `under_repair`
- Primary UX path: `/maintenance` serial lookup → Create Maintenance Case
- Surface API `detail` via `formatMaintenanceApiError` in the create toast

## History

<!-- Completed features (append only) -->

### Inventory OEM Refs, Warranty & Shelf-Life Expiry
OEM PN/SN refs; warranty toggle + expiry; shelf-life capture; inventory expiry highlight/filter.

### Sibling Node Groups
Persist sibling groups on hierarchy config; multi-select; create/rename/ungroup; visual frame.

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
