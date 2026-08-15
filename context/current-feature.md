# Current Feature: Issue Inventory to Developer

## Status

In Progress

## Goals

- HM assigns a hierarchy node (module/subsystem/unit/…) to a Developer; Assigned badge shows until IM issues
- HM can revert or reassign Developer X → Y until IM physically issues; locked after issue
- HM project list/detail is limited to projects owned, created, or assigned to that HM
- Project/entity cards expose Assign developer against each hierarchy item
- Developer account lists HM-assigned items and can request IM handover one-by-one, all, or reserved-only
- Developer requests the assigned/reserved item from IM
- IM issues inventory only with a signature (digital required; hard-copy attestation optional)
- Issue is allowed only for stock reserved to the same project/hierarchy
- On successful issue, status auto-updates to `ISSUED` (no manual status toggle)
- 24 hours after issue timestamp, a job auto-updates status to `INSTALLATION_IN_PROGRESS`
- Other projects cannot issue the same reserved unit
- UI: HM assign-dev dialog, Dev request action, IM issue queue with signature pad / hard-copy ack, ISSUED and INSTALLATION IN PROGRESS badges
- HM release of reserved inventory (with confirmation) also removes the item from the Developer account
- Hierarchy tree nodes show Assigned, Reserved, and Shortage badges

## Notes

- Depends on Spec 04 reserved records against hierarchy
- Out of scope: pass/fail testing and HM verify (Spec 08); defect return (Spec 10); weighted progress (Spec 09)
- Status chain: `RESERVED` → `ISSUED` → `INSTALLATION_IN_PROGRESS` (+24h)
- Backend: `hierarchy.assign_developer`, `item.request` queue, `inventory.issue` with signature, atomic ledger, hourly/minute job for the 24h flip, HM/Dev/IM permissions
- Issuance fields: hierarchy node, developer, serial, project/flight/SDLS, issued-by IM, signature type/payload, issued_at
- Developer assignee must be an app user (diagram role: Developer)
- Source path: `docs/workflow-specs/07-issue-to-developer.md`
- Releasing a reservation clears `assigned_developer_id` unless the unit is already physically issued, and cancels pending item requests
- Tree badges: Assigned from `assigned_developer_id`; Reserved/Shortage from project inventory flags

## History

<!-- Completed features (append only) -->

### Shortage Handling & FCFS Auto-Reserve
Spec 05: create shortages on unavailable reserve, notify HM and IM (PN, Qty, Flight, SDLS, LRU), keep an open list, and FCFS auto-reserve on IM receipt into Spec 04 `RESERVED` lock. Partial receipts decrement remaining qty; auto-reserve is audited as shortage fulfillment.

### Reservation Expiry (Deadlock Prevention)
Spec 06: idle `RESERVED` stock reminds the reserving HM after 30 days, then auto-releases to `AVAILABLE` after a 7-day grace with reason `AUTO_RELEASE_EXPIRY`. Issued units are skipped. Inventory serials show Reserved with hold details; IM can still Issue reserved stock. List search returns matches on page 1 with in-content loading.
