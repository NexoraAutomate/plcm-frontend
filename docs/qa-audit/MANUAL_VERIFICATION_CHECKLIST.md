# Manual Verification Checklist

Derived from [USER_MANUAL_ROLE_BASED_SCENARIOS.md](./USER_MANUAL_ROLE_BASED_SCENARIOS.md).  
Tick when the scenario has been executed in the UI by a human tester.

**Environment:** __________________  
**Build/date:** __________________  
**Tester:** __________________

Known defects (still tick Fail if observed):

- [ ] Concurrent Generate Hierarchy can succeed twice (HIGH)
- [ ] Inventory Manager warehouse search may not show Reserved serials (HIGH)

---

## Administrator

- [ ] ADMIN-001 Login
- [ ] ADMIN-002 Logout
- [ ] ADMIN-003 Dashboard and navigation
- [ ] ADMIN-004 Create user
- [ ] ADMIN-005 Assign role
- [ ] ADMIN-006 Create hierarchy configuration (SSDLS-1/2, 8-level template)
- [ ] ADMIN-007 Mark configuration unavailable (HM list excludes it)
- [ ] ADMIN-008 Approve draft project
- [ ] ADMIN-009 Approve configuration change
- [ ] ADMIN-010 Audit trail list, filter, CSV (no delete)
- [ ] ADMIN-011 Statuses and roles vocabulary
- [ ] ADMIN-012 Customers and orders CRUD
- [ ] ADMIN-013 Cannot assign Admin role to another user
- [ ] ADMIN-020 Invalid login rejected

## Project Director

- [ ] PD-001 Login and dashboard
- [ ] PD-002 Assign Hierarchy Manager
- [ ] PD-003 Cannot create draft / cannot approve
- [ ] PD-004 Cancel project with confirmation (preview, reserved stock released)
- [ ] PD-005 View automatic progress (no manual %)

## Hierarchy Manager

- [ ] HM-001 Login
- [ ] HM-002 Create draft project from available config
- [ ] HM-003 Create project validation (missing/unavailable config)
- [ ] HM-004 Cannot approve project
- [ ] HM-005 Generate hierarchy after approval (counts; second generate blocked)
- [ ] HM-006 Structural freeze after approve
- [ ] HM-007 Reserve available inventory
- [ ] HM-008 Release unused reservation
- [ ] HM-009 Shortage when stock is missing (notices to HM and IM)
- [ ] HM-010 Assign developer
- [ ] HM-011 Verify installation (only after Dev complete)
- [ ] HM-012 Progress and completion gate
- [ ] HM-013 Project list isolation (other HM hidden)
- [ ] HM-014 Reservation expiry reminder / auto-release (test env)
- [ ] HM-015 Cancel project
- [ ] HM-016 Configuration change (return inventory, Admin approve, successor project)
- [ ] HM-020 Cannot manage hierarchy configurations

## Inventory Manager

- [ ] IM-001 Login and queues (Inventory, Issue, Inspect, Shortages)
- [ ] IM-002 Receive stock
- [ ] IM-003 FCFS auto-reserve (first shortage wins)
- [ ] IM-004 Wrong part number does not close shortage
- [ ] IM-005 Issue to developer with signature (unsigned blocked)
- [ ] IM-006 Cannot reserve or assign developer
- [ ] IM-007 Inspect rework/recall disposition (Reusable / Repairable / Scrapped)
- [ ] IM-008 Reserved serial visibility and issue still allowed

## Developer

- [ ] DEV-001 Login and My Assignments
- [ ] DEV-002 Request item from IM
- [ ] DEV-003 Install after issue
- [ ] DEV-004 Test Pass, report complete (not verified until HM)
- [ ] DEV-005 Test Fail, remove, return (rework; never verified)
- [ ] DEV-006 Recall return on cancelled project
- [ ] DEV-007 Cannot approve / reserve / issue
- [ ] DEV-008 Cannot act on another developer’s item

## Cross-role / errors

- [ ] X-001 Unauthenticated access
- [ ] X-002 Non-existent record does not crash

## End-to-end (optional combined run)

- [ ] E2E-01 Admin config → HM draft → Admin approve → Generate → Reserve → Assign → Request → Issue → Install → Pass → Verify
- [ ] E2E-02 Shortage → IM receipt → FCFS
- [ ] E2E-03 Fail → rework → re-issue → Pass → Verify
- [ ] E2E-04 Cancel → reserved stock Available; hierarchy read-only
- [ ] E2E-05 Config change → successor project; old Superseded
- [ ] E2E-06 Audit contains the above actions

## Database spot-checks (optional)

- [ ] After reserve: instance status `RESERVED`
- [ ] After issue: instance status `ISSUED`
- [ ] After 24h job: `INSTALLATION_IN_PROGRESS`
- [ ] After HM verify: `INSTALLED_VERIFIED`
- [ ] After cancel of never-issued reserve: `AVAILABLE`
- [ ] After config change: old project `SUPERSEDED`
- [ ] Audit rows cannot be edited/deleted in the UI
