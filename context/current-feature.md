# Current Feature: Configuration Change After Hierarchy / Reservation

## Status

In Progress

## Goals

- HM can request a configuration change after hierarchy setup or reservation without editing the existing project configuration in place.
- Return **all** project inventory to IM (Reserved + Issued + related items); IM inspects and restores stock to Available (or the appropriate status).
- HM submits a Change Request with source project, target **approved** configuration, and reason remarks.
- Admin reviews and approves the CR; inventory must be cleared before approve / new project create.
- After approve, create a **new** Project/Flight prefilled with the target config; generate a new hierarchy ready for independent reservation.
- Old project stays readable/traceable (recommend `SUPERSEDED` with `successor_project_id` / `predecessor_project_id` link).
- Block in-place PATCH of `configuration_id` (and structural config edits) on projects past hierarchy generation / first reservation.
- Config change request state machine: REQUESTED → INVENTORY_RETURNED → SUBMITTED → APPROVED → NEW_PROJECT_CREATED.
- Permissions: `config_change.request`, `config_change.approve`.
- Frontend: HM entry on sealed projects, CC-1…CC-6 wizard/checklist, hard-disable in-place config selector + CONTROL RULE banner, post-approve create-new CTA.

## Notes

Spec: `docs/workflow-specs/12-configuration-change.md` (sequence 12 of 13). Depends on Specs 01–05 and return/inspect from Specs 10–11.

CONTROL RULE: existing project configuration is **not** edited in place after hierarchy setup / reservation. Desired config is applied via a **new approved Project/Flight**.

Actors: HM (request, return inventory, submit CR, create new project after approve); IM (inspect returns, restore inventory); Admin (approve CR); System (enforce no in-place mutate).

Out of scope: mutating unused Admin template configs (Spec 01); soft field edits that do not change hierarchy structure (name, notes).

Inventory return uses Spec 11 mechanical paths (release + recall + inspect) driven by config-change, not PD cancel. New project follows Specs 02–04 afresh (draft/approval/generate/reserve).

Acceptance: cannot change config in place after hierarchy/reservation; full inventory return + IM restore required; Admin must approve CR; new project with new config; old project remains with link; new hierarchy generated independently.

Handoff: Spec 13 (audit trail) must capture all CC actions.

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

### Inventory Recall (Project Cancelled)
Spec 11: PD/HM cancel with confirmation sets `CANCELLED`, releases reserved stock to `AVAILABLE`, opens recall tasks for issued/in-progress units, closes shortages, and blocks reserve/issue/generate. Dev return or force-return; IM inspects Reusable → `AVAILABLE`, Repairable, or Scrapped. Hierarchy stays viewable and read-only.
