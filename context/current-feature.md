# Current Feature: Issue Queue — Multi-Item Issue / Mark Back

## Status

In Progress

## Goals

- [x] Inventory Manager can select multiple pending Issue Queue rows for the **same developer** and Issue or Mark Back them together
- [x] Multi-item Issue uses **one shared digital signature** applied to all selected requests
- [x] For hard-copy confirmation: generate a **simple printable report** listing all selected items (part number, serial number, and related details) with a blank developer signature box
- [x] After printing/signing, IM can scan the filled form and attach it to the bulk issue instance (proforma upload)
- [x] Multi-item Mark Back uses one shared remarks reason for all selected requests
- [x] Backend supports bulk issue and bulk mark-back (same developer validation; shared signature / notes)

## Notes

- Route: `/issue-queue` → `components/inventory/issue-queue-panel.tsx`
- Bulk APIs: `POST /item-requests/issue-bulk/`, `POST /item-requests/mark-back-bulk/` (same developer required)
- Single-item APIs unchanged; FE uses single endpoints for one row, bulk for 2+
- HARD_COPY: `lib/download-multi-issuance-form.ts` downloads a jsPDF form; scanned file uploaded to each issuance via `uploadIssuanceProformaToManyIfNeeded`
- Selection constraint: only rows with the same `assigned_developer_id` may be batched

## History

<!-- Completed features (append only) -->

### My Assignments — BHD / MMHD Sub-tabs
Sidebar My Assignments group with BHD / MMHD children; MMHD personal list endpoint; dual-track inline actions; pending badges. Pending: manual UI check on localhost.

### My Assignments Tabs & Cleanup
Three lifecycle tabs (New / Under Process / Completed); removed Projects & Item Category filters; regrouped status chips; Assigned items tooltip; Admin delete completed only. Pending: manual UI check.

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
