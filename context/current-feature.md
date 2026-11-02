# Current Feature: Maintenance Lookup Entity Stock Detail

## Status

In Progress

## Goals

- [x] Clicking a faulty/matched hardware entity in Maintenance Entity Lookup opens a detail view
- [x] Detail shows stocking-equivalent fields: OEM, PN/SN, OEM PN/SN, warranty, installer, install dates
- [x] Detail shows test reports / attachments and BoM for that inventory when available
- [x] Nested view does not close the parent lookup dialog unexpectedly
- [x] Restyle as sliding side sheet with AnimatedPillTabs
- [x] Add Fault History tab: same/different OEM counts, list, last fault, clickable detail

## Notes

- Entry point: Maintenance Entity Lookup Dialog (`/maintenance` → Lookup)
- UI: right Sheet (`sm:max-w-xl`) + AnimatedPillTabs (ID / Install / Files / BoM / Faults)
- Backend: `GET /faulty-entities/product-fault-history/?part_number=&oem_name=`
- Component: `components/maintenance/maintenance-entity-stock-detail-dialog.tsx`

## History

<!-- Completed features (append only) -->

### Prevent Duplicate Open Maintenance Cases
Backend rejects duplicate open cases for the same entity; frontend surfaces API error on create.

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

### Orders Repeat, Production Support & Dialog UI
Repeat Order; production support date; shared OrderFormDialog layout.
