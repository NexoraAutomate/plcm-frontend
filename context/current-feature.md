# Current Feature: HM Installation Accept / Reject

## Status

In Progress

## Goals

- Rename HM **Verify** action to **Accept** on Verify Installations and related UI
- Add HM **Reject** beside Accept; open **Reject Installation** dialog with required reason
- On reject: set item status to **Installation Rejected**, clear complete/test so developer can Pass/Fail again
- Developer sees **Rejection Reasons** (history of reasons) and can Pass → Report complete again
- Persist rejection history via issuance events + workflow audit

## Notes

- Endpoint: `POST /item-verifications/{issuance_id}/reject/` with required `notes`
- New status: `INSTALLATION_REJECTED`
- Accept keeps existing verify endpoint (label-only rename in UI)

## History

<!-- Completed features (append only) -->

### Shortage Handling & FCFS Auto-Reserve
Spec 05: create shortages on unavailable reserve, notify HM and IM (PN, Qty, Flight, SDLS, LRU), keep an open list, and FCFS auto-reserve on IM receipt into Spec 04 `RESERVED` lock. Partial receipts decrement remaining qty; auto-reserve is audited as shortage fulfillment.

### Reservation Expiry (Deadlock Prevention)
Spec 06: idle `RESERVED` stock reminds the reserving HM after 30 days, then auto-releases to `AVAILABLE` after a 7-day grace with reason `AUTO_RELEASE_EXPIRY`. Issued units are skipped. Inventory serials show Reserved with hold details; IM can still Issue reserved stock. List search returns matches on page 1 with in-content loading.

### Issue Inventory to Developer
Spec 07: HM assigns hierarchy items to a Developer (Assigned badge; reassign until IM issues). HM sees only owned/created/assigned projects. Developer requests IM handover (one, all, or reserved-only). IM issues reserved stock with a signature to `ISSUED`, then `INSTALLATION_IN_PROGRESS` after 24h. Releasing a reservation unassigns the developer. Hierarchy tree nodes show Assigned, Reserved, and Shortage badges.

### Installation, Testing & Verification
Spec 08: Developer records install and Pass/Fail test on issued items (`UNDER_TESTING_REVIEW`). Pass requires report complete then HM verify to reach `INSTALLED_VERIFIED`. Fail never verifies and marks a Spec 10 defect-pending hook. Dev workspace and HM verify queue drive the flow; transitions come from recorded events only.

### Automatic Project Progress Calculation
Spec 09: weighted progress from the Smart SDLS tree and lifecycle events—no manual %. Leaf-count weights roll up Flight → SDLS → System; dashboard shows overall % plus bottlenecks. Project `COMPLETED` only when all required items are `INSTALLED_VERIFIED`; fail/open defects do not count.

### Defect / Rework Loop
Spec 10: Fail opens a rework case; Dev remove/return; IM inspects/disposition; signed re-issue (repair same serial or replace); loop until HM verify → `INSTALLED_VERIFIED`. Attempt history preserved; open rework excluded from Spec 09 verified progress.

### Inventory Recall (Project Cancelled)
Spec 11: PD/HM cancel with confirmation sets `CANCELLED`, releases reserved stock to `AVAILABLE`, opens recall tasks for issued/in-progress units, closes shortages, and blocks reserve/issue/generate. Dev return or force-return; IM inspects Reusable → `AVAILABLE`, Repairable, or Scrapped. Hierarchy stays viewable and read-only.

### Configuration Change After Hierarchy / Reservation
Spec 12: HM requests a CR after hierarchy or reservation without editing config in place; return all inventory via Spec 11 paths; IM inspects; HM submits a different approved configuration, product type, and reason; Admin approves; a new draft Project/Flight is created and the old project is `SUPERSEDED` with successor/predecessor links. Generate, reserve, and issue stay blocked while the CR is open.

### Audit Trail (System-Wide)
Spec 13: append-only workflow audit (who, role, when, IP/device, old→new) for hierarchy and inventory actions. Admin list/CSV with actor, entity, action, role, project, and date filters; entity History drawer; `audit.read`; system actor for jobs. APIs and DB grants cannot update or delete rows.
