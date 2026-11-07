# Current Feature: Maintenance Occurrence Report + Dual-Track Replacement

## Status

In Progress

## Goals

- [x] P0: CaseStatus untouched; ME/FSE/IE roles + maintenance.* permissions wired; unit tests updated
- [x] P1: Occurrence Report schema/API/UI (occurrence_date, attachments, officers, fault_type, confirmation, NFF); occurrence_recorded notify
- [x] P2: ReplacementRequest model + APIs; dual-track wiring; awaiting_faulty_arrival; dual-track board skeleton
- [ ] P3: Track A — IM issue, Replaced badge, RED notify, ME custody, AIT upload/gate, reject loop
- [ ] P4: Track B — reception, IE assign/handover, disposition, PD repair verify, restock/discard
- [ ] P5: Dual-track close gate; notification matrix; Discarded badge; clear RED

## Notes

- Spec: `plcm-backend/docs/specs/maintenance-occurrence-replacement/01-functional-specification.md`
- Baseline: existing CaseStatus spine + field-service onsite outcome preserved; augmentation only
- Permission stubs: `maintenance.occurrence_report`, `maintenance.replacement_request` (also granted to HM), `maintenance.ait_upload`, `maintenance.inspection_disposition`
- Stay on `main` (no feature branch)
- **This slice complete through P2.** CTA creates ReplacementRequest; dual-track board on case detail.
- Migrations: `m4e5f6a7b8_occurrence_report_p1.py`, `n5f6a7b8c9_replacement_request_p2.py`
- P2 APIs: create / assign-me / reserve / pd-decision / dual-track board; Track B `awaiting_faulty_arrival` on PD approve

## History

<!-- Completed features (append only) -->

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
