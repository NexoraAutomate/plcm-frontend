# Current Feature: Project Delete — Revert vs Discard

## Status

Complete

## Goals

- Anyone with `delete_projects` can delete past reserve/assign via revert or discard
- Revert: release reserved stock, open recall tasks, mark delete requested; hard-delete only after inventory cleared
- Discard: immediate hard-delete of project + purge ledger; leave InventoryItem rows untouched
- Audit who/when and inventory disposition (reverted vs discarded vs released)
- Notify Inventory Manager on delete request and on final delete; notify requester when ready to finalize

## Notes

- Reuses Spec 11 `clear_project_inventory` cascade for revert path
- Permission: `delete_projects` (not Admin-only)
- No auto hard-delete when recalls finish — user clicks Delete again once cleared

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
