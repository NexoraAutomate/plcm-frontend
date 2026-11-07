# Current Feature

## Status

Not Started

## Goals

<!-- Goals will be populated when a feature is loaded -->

## Notes

<!-- Additional context from the feature spec -->

## History

<!-- Completed features (append only) -->

### Maintenance Occurrence Report + Dual-Track Replacement
P0–P6 complete. Occurrence Report + ReplacementRequest dual-track (Track A AIT / Track B IE) + close gate. CR-MHD-20261107 **Approved with deviations** (GAP-07 customer ack, GAP-08 never-returned SLA, GAP-11 QR custody). Evidence: `plcm-backend/reports/TR-MHD-20261107-P6.md`, `plcm-backend/reports/CR-MHD-20261107.md`; matrix Must Satisfied.

### Maintenance Lookup Entity Stock Detail
Clicking a faulty/matched hardware entity in Maintenance Entity Lookup opens a sliding side sheet with ID / Install / Files / BoM / Faults tabs.

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
