# Current Feature: Audit Trail (System-Wide)

## Status

In Progress

## Goals

- Record **immutable** audit logs for every meaningful hierarchy and inventory action: who, role, date/time, IP/device, old→new, remarks.
- Append-only audit store; application APIs cannot update or delete audit rows.
- Required envelope: id, occurred_at (UTC), actor_user_id, actor_role, action, entity_type, entity_id, optional project_id, old_value/new_value JSON, remarks, ip_address, user_agent/device, correlation_id.
- Minimum action catalog: RESERVED, RELEASED, ISSUED, INSTALLATION_IN_PROGRESS, UNDER_TESTING, INSTALLED_VERIFIED, RETURNED, RE_ISSUED, MODIFIED, DELETED, PROJECT_CREATED/APPROVED/HIERARCHY_GENERATED/CANCELLED, CONFIG_CHANGE_*, SHORTAGE_*/AUTO_RESERVE, AUTO_RELEASE_EXPIRY.
- Query filters: entity, user, role, action, date range, project.
- Backend: audit service + persistence; middleware for IP/user-agent; domain services call writer; Admin listing API; optional CSV export; DB grants INSERT + SELECT only.
- Frontend: Admin audit trail page; optional entity drawer “History”; human-readable action labels.
- Permission: `audit.read`.
- System jobs (24h flip, expiry) log with system actor and role `SYSTEM`.
- Status-changing ops: prefer writing audit in the same transaction (fail the business op or alert critically if audit write fails).

## Notes

Spec: `docs/workflow-specs/13-audit-trail.md` (sequence 13 of 13). Loaded from `13-audit-trial.md` (filename typo). Depends on Specs 00–12.

This spec **observes** workflows; it does not change business rules. Completes: (1) central audit writer, (2) backfill hooks on existing services if gaps remain, (3) read UI + `audit.read`.

Actors: System (append-only on each domain action); Admin (query/export); other roles may view audits for entities they own (optional policy).

Out of scope: external SIEM export; changing business workflows.

Acceptance: Spec 04–12 status-changing actions create audit rows with required fields; auto jobs use system actor; API cannot update/delete; Admin can filter by project, actor, action, date; sample E2E leaves reconstructable history.

Handoff: no further workflow specs. Optional later: reporting, notification preferences, external integrations.

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

### Configuration Change After Hierarchy / Reservation
Spec 12: HM requests a CR after hierarchy or reservation without editing config in place; return all inventory via Spec 11 paths; IM inspects; HM submits a different approved configuration, product type, and reason; Admin approves; a new draft Project/Flight is created and the old project is `SUPERSEDED` with successor/predecessor links. Generate, reserve, and issue stay blocked while the CR is open.
