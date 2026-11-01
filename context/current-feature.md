# Current Feature: Inventory OEM Refs, Warranty & Shelf-Life Expiry

## Status

Complete

## Goals

- [x] On Add Stock / Add Inventory, capture OEM Part Number and OEM Serial Number for reference (`original_part_number` / `original_serial_number`)
- [x] Add a supplier-warranty toggle; when on, capture warranty end date and persist it on stock units
- [x] Ensure shelf-life expiry date is captured on Add Stock and stored on units
- [x] Highlight and/or filter inventory rows whose shelf life or warranty is expired or nearing expiry
- [x] Persist warranty fields in backend (model, schema, migration, create/update paths)

## Notes

- OEM PN/SN map to existing `original_part_number` / `original_serial_number` (reference only; PLCM identities stay auto-generated)
- Warranty: toggle + `warranty_expires_at` date (null when toggle off / not provided)
- Shelf life already has `shelf_life_expires_at`; surface clearly on Add Stock and keep on instances
- Expiry UX: row highlighting + filter control on `/inventory` table (expired + within ~30 days)
- Add Stock currently uses the full Add Inventory dialog via `restockInventoryId`

## History

<!-- Completed features (append only) -->

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
