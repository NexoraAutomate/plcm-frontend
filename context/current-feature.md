# Current Feature: Installation, Testing & Verification

## Status

In Progress

## Goals

- Developer records installation activity on an assigned item that is `INSTALLATION_IN_PROGRESS`
- Developer records test/inspect outcome Pass or Fail
- While Dev tests/reviews, status is `UNDER_TESTING_REVIEW`
- Pass path: Dev reports installation complete → HM verifies → `INSTALLED_VERIFIED`
- `INSTALLED_VERIFIED` only after testing + HM verification (no skip, no force-verify)
- Fail never reaches `INSTALLED_VERIFIED`; marks defect pending / rework hook for Spec 10
- Only the assigned Developer (or authorized role) may mark install/test for that item
- HM cannot verify until Dev has reported complete
- All transitions come from recorded events (no free-form status editing)
- UI: Dev workspace (Install / Test Pass-Fail / Report complete), HM verification queue, status badges; Fail deep-link/stub to Spec 10

## Notes

- Depends on Spec 07 (item at Issued / Installation in Progress)
- Out of scope: weighted progress math (Spec 09 — emit events only); full defect/repair loop (Spec 10); project completion gate UI polish
- Status chain (pass): `INSTALLATION_IN_PROGRESS` → `UNDER_TESTING_REVIEW` → (complete reported) → `INSTALLED_VERIFIED`
- Backend APIs: start/complete install, submit test Pass/Fail, report installation complete, HM verify
- Permissions: `item.install_test`, `item.verify`
- Handoff: each `INSTALLED_VERIFIED` (and intermediate lifecycle events) must feed Spec 09 weighted progress
- Source path: `docs/workflow-specs/08-install-test-verify.md`

## History

<!-- Completed features (append only) -->

### Shortage Handling & FCFS Auto-Reserve
Spec 05: create shortages on unavailable reserve, notify HM and IM (PN, Qty, Flight, SDLS, LRU), keep an open list, and FCFS auto-reserve on IM receipt into Spec 04 `RESERVED` lock. Partial receipts decrement remaining qty; auto-reserve is audited as shortage fulfillment.

### Reservation Expiry (Deadlock Prevention)
Spec 06: idle `RESERVED` stock reminds the reserving HM after 30 days, then auto-releases to `AVAILABLE` after a 7-day grace with reason `AUTO_RELEASE_EXPIRY`. Issued units are skipped. Inventory serials show Reserved with hold details; IM can still Issue reserved stock. List search returns matches on page 1 with in-content loading.

### Issue Inventory to Developer
Spec 07: HM assigns hierarchy items to a Developer (Assigned badge; reassign until IM issues). HM sees only owned/created/assigned projects. Developer requests IM handover (one, all, or reserved-only). IM issues reserved stock with a signature to `ISSUED`, then `INSTALLATION_IN_PROGRESS` after 24h. Releasing a reservation unassigns the developer. Hierarchy tree nodes show Assigned, Reserved, and Shortage badges.
