# Current Feature: Inventory Recall (Project Cancelled)

## Status

Not Started

## Goals

- When PD/HM cancels a project, recall issued (and related) inventory from Developers, IM inspects, and disposition stock as Reusable → back to stock, Repairable → repair, or Scrapped.
- Cancel sets project `CANCELLED` and blocks new inventory ops (reserve/issue/generate).
- Reserved (never issued) stock auto-releases to `AVAILABLE` with no physical return.
- Issued / in-progress / testing units require recall/return then IM inspection.
- Three dispositions update statuses correctly: Reusable → `AVAILABLE`; Repairable → `REPAIRABLE`; Scrapped → `SCRAPPED`.
- Open shortages for the project (Spec 05) are cancelled/closed.
- Hierarchy remains viewable (read-only) for audit/trace.
- Frontend: cancel action with strong confirmation + inventory impact summary; recall task lists for Dev and IM; three-outcome disposition UI; cancelled project read-only banner.

## Notes

- Spec: `docs/workflow-specs/11-inventory-recall.md` (sequence 11 of 13).
- Workflow source: Page 05 — Side process “Inventory Recall (project cancelled)”.
- Depends on: Specs 04–08 (items may be reserved/issued/in progress).
- Actors: PD/HM (cancel, initiate recall); Developer (return issued items); IM (inspect, disposition); System (release reserved stock, set `CANCELLED`).
- Flow: PD/HM cancels → recall issued items from Developer → IM inspects → Reusable / Repairable / Scrapped. In parallel: reserved-not-issued units release to `AVAILABLE`.
- Business rules: cancel permission per Spec 00 (`project.cancel`); always require explicit confirmation (blocked/confirm if critical path unfinished); all project inventory enters return/release pipeline; scrapped never returns to Available without new serial induction.
- Backend: cancel API with cascade (cancel shortages, auto-release reservations, create recall tasks); Dev confirm return / force admin recovery if unresponsive; IM inspect + disposition APIs; block ops on cancelled projects.
- Out of scope: Spec 10 defect rework on active project; Spec 12 configuration-change forced return (may reuse recall/return services).
- Acceptance: cancel + block ops; reserved → Available without physical return; issued require recall then inspect; three dispositions; shortages closed; hierarchy still viewable.
- Tests: mix of 2 reserved + 2 issued + 1 under test all accounted; reusable unit free for another project; scrapped unavailable; unauthorised role cannot cancel.

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
Spec 10: Fail opens a rework case; Dev remove/return; IM inspect/disposition; signed re-issue (repair same serial or replace); loop until HM verify → `INSTALLED_VERIFIED`. Attempt history preserved; open rework excluded from Spec 09 verified progress.
