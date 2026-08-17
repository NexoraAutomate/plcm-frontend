# PLCM QA Audit Report

**Product:** PLCM (Project / Hierarchy / Inventory Lifecycle Management)  
**Audit date:** 17 August 2026  
**Auditor role:** Independent QA (API + database + specification mapping)  
**Application under test:** Running frontend `http://127.0.0.1:3000` and backend `http://127.0.0.1:8000`  
**Database:** PostgreSQL `localhost:5432/postgres` (pre-existing business data present; QA used `QA_TEST_*` records only)  
**Rule followed:** No application source, schema, configuration, or specification files were modified.

Supporting evidence:

- [TEST_EXECUTION_LOG.md](./TEST_EXECUTION_LOG.md) — every live test row (TC-001 … TC-128)
- [qa_live_results.json](./qa_live_results.json) — raw execution payload
- [USER_MANUAL_ROLE_BASED_SCENARIOS.md](./USER_MANUAL_ROLE_BASED_SCENARIOS.md)
- [MANUAL_VERIFICATION_CHECKLIST.md](./MANUAL_VERIFICATION_CHECKLIST.md)
- [QA_FINAL_SUMMARY.md](./QA_FINAL_SUMMARY.md)

---

# Executive Summary

The workflow specifications in `docs/workflow-specs` (Specs 00–13) are implemented in the running application. A full happy path was **behaviorally executed** against the live API and verified in PostgreSQL:

`Admin config → HM draft → Admin approve → Generate hierarchy → Reserve → Assign developer → Request → Signed issue → 24h install-in-progress job → Install/test/complete → HM verify → Progress → Shortage/FCFS → Reservation expiry job → Defect/rework → Cancel/recall → Configuration change → Audit trail`

Core lifecycle behavior matched the specifications in almost all executed cases.

Two product defects remain **HIGH**:

1. Concurrent Generate Hierarchy requests can both return HTTP 200 (race; Spec 03 requires no duplicate trees).
2. Workflow Inventory Manager (`InventoryManager`) cannot see warehouse reserved serials on `GET /inventory/?search=…` because backend `is_inventory_manager()` treats only Admin/SubAdmin as warehouse managers. Frontend treats `InventoryManager` as a warehouse manager. Spec 06 requires IM to see Reserved serials and still issue them.

A third live FAIL (`CRUD-ORD-01`) was a **harness payload error**. Retest with required `order_number`, `title`, and `order_date` **passed** (server still auto-assigns `ORD-YYYY-NNN`).

| Metric | Count |
|--------|------:|
| Specification markdown files reviewed | 16 |
| Identifiable requirements mapped | 96 |
| Requirements behaviorally tested (live API/DB) | 82 |
| Requirements static / not testable in this run | 14 |
| Live test cases executed (primary run) | 128 |
| PASS (primary run) | 124 |
| FAIL (primary run) | 3 |
| PARTIAL (primary run) | 1 |
| Follow-up retests | 2 (order create PASS; leftover QA user/config cleanup PASS) |
| Remaining product FAILs | 2 |
| Critical issues | 0 |
| High issues | 2 |
| Medium issues | 1 (API order create requires fields the server then overwrites) |
| Low issues | 1 (implementation roadmap still marks Specs 05–13 incomplete) |

**Overall assessment:** READY WITH MINOR ISSUES — core Spec 00–13 workflows work on the happy path and most negatives; fix concurrent generate locking and IM warehouse list scoping before production stress.

---

# Specification inventory

| Spec ID | File | Scope |
|---------|------|--------|
| INDEX | `00-README.md` | End-to-end index, roles, status chains |
| SPEC-00 | `00-roles-status-foundations.md` | 5 roles, statuses, transition matrix, permissions |
| SPEC-01 | `01-hierarchy-configuration.md` | Admin Smart SDLS configs |
| SPEC-02 | `02-project-creation-approval.md` | PD assign, HM draft, Admin approve |
| SPEC-03 | `03-hierarchy-generation.md` | Generate tree, ready for inventory |
| SPEC-04 | `04-inventory-reservation.md` | AVAILABLE → RESERVED lock |
| SPEC-05 | `05-shortage-handling.md` | Shortage + FCFS auto-reserve |
| SPEC-06 | `06-reservation-expiry.md` | 30d reminder + 7d grace auto-release |
| SPEC-07 | `07-issue-to-developer.md` | Assign, request, signed issue, 24h |
| SPEC-08 | `08-install-test-verify.md` | Install, pass/fail, HM verify |
| SPEC-09 | `09-project-progress-calculation.md` | Weighted automatic progress |
| SPEC-10 | `10-defect-rework-loop.md` | Fail → return → inspect → re-issue |
| SPEC-11 | `11-inventory-recall.md` | Cancel, release reserved, recall issued |
| SPEC-12 | `12-configuration-change.md` | No in-place edit; successor project |
| SPEC-13 | `13-audit-trail.md` | Immutable workflow audit |
| ROADMAP | `IMPLEMENTATION-ROADMAP.md` | Delivery checklist (stale vs code) |

`_md_to_docx.py` is a converter, not a requirement source.

---

# Implemented system inventory (as found)

## Roles (workflow)

| Code | DB role name | Live permissions smoke |
|------|----------------|------------------------|
| ADMIN | Admin | All workflow keys including `project.approve`, `hierarchy_config.manage`, `audit.read` |
| PD | ProjectDirector | `project.assign_hm`, `project.cancel` |
| HM | HierarchyManager | draft, generate, reserve, assign, verify, cancel, config-change request |
| IM | InventoryManager | receive, issue, inspect |
| DEV | Developer | `item.request`, `item.install_test` |

Legacy roles also exist: SubAdmin, ProjectManager, Technician, Maintenance, Viewer.

## Major entities

Users, Roles, Permissions, Customers, Orders, Projects, Flights, SDLS, Systems, Subsystems, Modules, Units, Components, Hierarchy configurations, Inventory catalog + serial instances, Reservations, Shortages, Item requests, Issuances, Rework cases, Recall tasks, Config-change requests, Workflow audit events, Notifications (shortage / expiry / installer / return).

## Workflows executed

Project lifecycle, inventory reservation, shortage FCFS, expiry job, issue-to-developer, install/test/verify, progress, defect/rework, cancel/recall, configuration change, audit.

---

# Requirement traceability

Statuses: **PASS** = behaviorally verified in this audit. **FAIL** = executed and did not match spec. **PARTIAL** = implemented but incomplete vs spec or mixed evidence. **NOT TESTABLE** = could not be executed safely/practically (called out). **STATIC** = confirmed by code/API existence only (not counted as PASS).

| Requirement ID | Specification | Implemented feature | Location | Tests | Result | Remarks |
|----------------|---------------|---------------------|----------|-------|--------|---------|
| SPEC00-R01 | 00 Five roles | Role master + workflow roles | `workflow_roles.py`, `/api/auth/roles` | TC-007 | PASS | Also legacy roles |
| SPEC00-R02 | 00 Role users | Create/login per role | `/api/users/`, `/api/auth/assign-role` | TC-014 | PASS | |
| SPEC00-P01–P06 | 00 Permission matrix | Dotted workflow permissions | `workflow_permissions.py` | TC-015–020 | PASS | |
| SPEC00-S01 | 00 Status vocabulary | Status master `inventory` / `projects` | `/api/statuses/` | TC-008 | PASS | |
| SPEC00-T01–T05 | 00 Transition matrix | `can_transition` | `status_transitions.py` | TC-009–013 | PASS | Domain helper |
| SPEC00-AUTH | Auth | Login/logout/me | `/api/auth/*` | TC-002–006, TC-126 | PASS | |
| SPEC01-F01/F02 | 01 Fixed 8 levels | Config meta | `/hierarchy-configurations/meta` | TC-021–022 | PASS | |
| SPEC01-C01/C02 | 01 Multiple configs | Create A/B | POST configs | TC-023–024 | PASS | |
| SPEC01-C03/C04 | 01 Non-admin denied | 403 | POST configs | TC-025–026 | PASS | |
| SPEC01-A01/A02 | 01 Available filter | Patch availability | PATCH + `/available` | TC-027–028 | PASS | |
| SPEC01-C05/C06 | 01 List gates | Admin all / HM forbidden | GET configs | TC-029–030 | PASS | |
| SPEC01-C07 | 01 Unique code | Duplicate rejected | POST | TC-031 | PASS | |
| SPEC02-D01 | 02 PD cannot draft | 403 | POST `/projects/draft/` | TC-032 | PASS | |
| SPEC02-D02 | 02 HM draft DRAFT | 201 DRAFT | POST draft | TC-033 | PASS | |
| SPEC02-D03/D04 | 02 Validation | Missing/unavailable config | POST draft | TC-034–035 | PASS | |
| SPEC02-G01 | 02 Generate disabled on draft | 4xx | generate-hierarchy | TC-036 | PASS | |
| SPEC02-A01/A02 | 02 Only Admin approves | 403 HM/PD | approve | TC-037–038 | PASS | |
| SPEC02-A03 | 02 PD assign HM | 200 | assign-hm | TC-039 | PASS | |
| SPEC02-A04 | 02 Admin approve | APPROVED | approve | TC-040 | PASS | |
| SPEC02-F01 | 02 Structural freeze | Rejected/unchanged | PUT project | TC-041 | PASS | |
| SPEC02-F02 | 02 Non-structural edit | Description update | PUT | TC-042 | PASS | |
| SPEC03-G01 | 03 Non-HM cannot generate | 403 | generate | TC-043 | PASS | |
| SPEC03-G02 | 03 Generate on APPROVED | READY_FOR_INVENTORY | generate | TC-044 | PASS | |
| SPEC03-T01 | 03 Flight×SDLS counts | 2×2=4 SDLS | hierarchy-tree | TC-045 | PASS | |
| SPEC03-T02 | 03 Same template per SDLS | Equal system counts | tree | TC-046 | PASS | |
| SPEC03-G03 | 03 Second generate blocked | 4xx sequential | generate | TC-047 | PASS | Sequential only |
| SPEC03-C01 | 03 Concurrent generate | One success | parallel POST | TC-049 | **FAIL** | Both returned 200 |
| SPEC04-R01–R03 | 04 Reserve lock | RESERVED + DB metadata | reservations + SQL | TC-053–055 | PASS | |
| SPEC04-R04 | 04 No double reserve serial | Fail/shortage | second project | TC-056 | PASS | |
| SPEC04-R05 | 04 Not ready cannot reserve | 4xx DRAFT | reserve | TC-057 | PASS | |
| SPEC04-R06 | 04 IM cannot reserve | 403 | reserve | TC-058 | PASS | |
| SPEC06-U01 | 06 IM sees Reserved serial | List/search Reserved | GET `/inventory/?search=` | TC-059 | **FAIL** | IM list installer-scoped |
| SPEC07-A01/A02 | 07 Assign developer | HM yes / IM no | assign-developer | TC-060–061 | PASS | |
| SPEC07-Q01 | 07 Dev request | 201 | item-requests | TC-062 | PASS | |
| SPEC07-I01 | 07 Signature required | 4xx without payload | issue | TC-063 | PASS | |
| SPEC07-I02/I03 | 07 Issue → ISSUED | API + DB | issue | TC-064–065 | PASS | |
| SPEC07-T01 | 07 +24h → INSTALLATION_IN_PROGRESS | Job after backdated `issued_at` | `evaluate_issue_progress` | TC-066 | PASS | No public HTTP job endpoint |
| SPEC08-I01 | 08 Start install | 200 | item-install/start | TC-067 | PASS | |
| SPEC08-V01 | 08 Verify before complete rejected | 4xx | verify | TC-068 | PASS | |
| SPEC08-T01/T02 | 08 Pass / under testing | 200 | test | TC-069–070 | PASS | |
| SPEC08-C01 | 08 Report complete | 200 | complete | TC-071 | PASS | |
| SPEC08-V02–V04 | 08 HM verify → INSTALLED_VERIFIED | Queue + DB | verify | TC-072–074 | PASS | |
| SPEC09-P01 | 09 Auto progress | GET progress | `/projects/{id}/progress/` | TC-075 | PASS | |
| SPEC09-P02 | 09 No manual % | No field on draft | schema | TC-076 | PASS | |
| SPEC09-G01 | 09 Completion gate | Not COMPLETED with unfinished nodes | PUT | TC-077 | PASS | |
| SPEC05-S01 | 05 Shortage on zero stock | outcome=shortage | reserve | TC-078 | PASS | |
| SPEC05-N01 | 05 Notify HM & IM | Notices present | shortage-notices | TC-079 | PASS | In-app; email not verified |
| SPEC05-F01 | 05 FCFS first waiter wins | Project A got first serial | receipt + DB | TC-080 | PASS | |
| SPEC05-F02 | 05 Wrong PN does not close | B remains | receipt | TC-081 | PASS | |
| SPEC06-J01/J02 | 06 Auto-release after idle | Job + AVAILABLE | expiry/run + backdated dates | TC-082–083 | PASS | Time-travel via DB then job API |
| SPEC06-J03 | 06 Issued not expired | Verified serial not AVAILABLE | SQL | TC-084 | PASS | |
| SPEC06-N01 | 06 HM expiry notices | List 200 | expiry-notices | TC-085 | PASS | |
| SPEC10-F01–F03 | 10 Fail creates rework, not verified | test FAIL | install/test + rework list | TC-086–088 | PASS | |
| SPEC10-L01–L06 | 10 Remove/return/inspect/repair/reissue | Rework APIs | item-rework | TC-089–094 | PASS | Repair path; replace/scrap not fully looped |
| SPEC10-H01 | 10 Attempt history | GET rework detail | item-rework/{id} | TC-095 | PASS | |
| SPEC11-A01–A04 | 11 Cancel confirm + CANCELLED | cancel APIs | cancel | TC-096–099 | PASS | |
| SPEC11-R01 | 11 Reserved released | AVAILABLE | SQL | TC-100 | PASS | |
| SPEC11-B01/B02 | 11 Block reserve/generate | 4xx | cancelled project | TC-101–102 | PASS | |
| SPEC11-V01 | 11 Hierarchy still viewable | 200 tree | hierarchy-tree | TC-103 | PASS | |
| SPEC12-C01 | 12 No in-place config edit | 4xx PUT | project PUT | TC-104 | PASS | |
| SPEC12-C02–C08 | 12 CR return/submit/approve/successor/SUPERSEDED | config-change APIs + SQL | TC-105–111 | PASS | |
| SPEC13-Q01–Q03 | 13 List/filter/CSV | `/api/audit/` | TC-112–114 | PASS | |
| SPEC13-I01/I02 | 13 Immutable | DELETE/PUT 4xx | TC-115–116 | PASS | |
| SPEC13-A01 | 13 Viewer cannot read | 403 | TC-117 | PASS | |
| SPEC13-F01 | 13 Envelope fields | who/when/action | TC-118 | PASS | |
| CRUD-CUS-01 | Customers | Create | `/customers/` | TC-119 | PASS | Follow-up delete also worked |
| CRUD-ORD-01 | Orders | Create | `/orders/` | TC-120 then retest | PASS after retest | First FAIL was incomplete body |
| NEG-ID-01/02 | Invalid IDs | 404/4xx | projects | TC-121–122 | PASS | |
| SPEC07-ISO-01 | HM project isolation | Other HM 404 | GET project | TC-123 | PASS | |
| UI-LOGIN-01 | Login page | HTTP 200 | `/login` | TC-124 | PASS | Page fetch only |
| UI-GATE-01 | Unauth projects URL | 200/redirect | `/projects` | TC-125 | PASS | Next.js client gate; not a full UI auth test |
| CLEANUP | Test data | QA rows removed | SQL | TC-127 then follow-up | PASS after follow-up | Audit rows retained by Spec 13 |

### Requirements not fully executed (honest gaps)

| Requirement ID | Spec | Disposition | Why |
|----------------|------|-------------|-----|
| SPEC03-UI-01 | 03 Confirmation dialog / loading | NOT TESTABLE | No browser automation |
| SPEC06-UI-02 | 06 Click Reserved badge dialog | NOT TESTABLE | UI-only; API hold payload exists on instances when manager-scoped |
| SPEC06-EMAIL | 06 Email reminder | NOT TESTABLE | In-app notices only verified |
| SPEC07-JOB-HTTP | 07 Public 24h job trigger | PARTIAL | Job exists; no HTTP run endpoint (expiry has `/inventory/reservations/expiry/run/`) |
| SPEC08-DEV-ISO | 08 Non-assigned Dev blocked | NOT TESTABLE this run | Second developer not created for that case |
| SPEC09-UNEVEN | 09 Uneven tree weighting math | STATIC / unit tests exist | Live tree used equal SDLS templates |
| SPEC10-REPLACE | 10 Replace with new serial | NOT TESTABLE this run | Repair path executed instead |
| SPEC10-SCRAP | 10 Scrap cannot re-issue | NOT TESTABLE this run | REPAIRABLE used |
| SPEC11-ISSUED-RECALL | 11 Issued units need Dev return | PARTIAL | Cancel test used reserved-not-issued stock |
| SPEC13-DB-GRANTS | 13 DB role no UPDATE/DELETE on audit | NOT TESTABLE | App API immutability verified; DB grants not inspected |
| CONCUR-RESERVE | Two users reserve same unit at once | NOT TESTED — REQUIRES CONTROLLED CONCURRENT ENVIRONMENT | Sequential competition passed |
| BROWSER-E2E | Full UI click-path | NOT TESTABLE | No browser MCP; sidebar/permissions inspected statically |
| PYTEST-SUITE | Backend pytest vs live DB | NOT EXECUTED | Automated suite not run in this audit |

---

# Test coverage

| Area | Coverage | Evidence |
|------|----------|----------|
| Requirement (workflow specs) | High for API/DB; low for pixel UI | RTM above |
| Module | Auth, config, project, hierarchy, inventory, reservation, shortage, expiry, issue, install, progress, rework, recall, config-change, audit | Live modules in execution log |
| Entity CRUD | Project workflow CRUD strong; customer create PASS; order create PASS on retest; hierarchy entities generated not hand-CRUD’d | |
| Workflow E2E | Executed | Primary project + side projects |
| Role | Admin, PD, HM, HM2, IM, Dev, Viewer | Dedicated QA users |
| API | Primary method | httpx against live server |
| Database | After reserve/issue/verify/FCFS/expiry/cancel/CC | SQL SELECT |
| Security | Unauth 401, role 403s, HM isolation | PASS |
| UI | Login page GET only | Not a substitute for manual UI |

---

# Failed tests

## TC-049 — SPEC03-C01 — Concurrent generate (HIGH)

- **Preconditions:** Approved project, two simultaneous `POST /projects/{id}/generate-hierarchy/` as HM.
- **Expected:** One success; second 4xx; or both idempotent with a single tree.
- **Actual:** Both returned HTTP 200 with `ok: True` and `READY_FOR_INVENTORY`.
- **Suspected cause:** `assert_can_generate_hierarchy` checks status/flights without a transaction lock; both requests read `APPROVED` before either commits.
- **Recommendation:** SELECT FOR UPDATE / unique constraint on project flights / status CAS so only one generate commits. Do not rely on UI disable alone.
- **Page/API:** `POST /api/projects/{id}/generate-hierarchy/`

## TC-059 — SPEC06-U01 — IM inventory list search (HIGH)

- **Preconditions:** Serial `QA_TEST_…-SN-001` reserved; IM lists inventory with `search=<serial>`.
- **Expected:** Row visible as Reserved (Spec 06).
- **Actual:** `200 []`.
- **Suspected cause:** `app/auth.py` `is_inventory_manager()` is Admin/SubAdmin only. `GET /inventory/` then scopes non-managers to `inventory_ids_issued_to_user`. Workflow `InventoryManager` therefore sees an empty warehouse list. Frontend `isInventoryManager()` **does** include `InventoryManager` — UI/API mismatch.
- **Recommendation:** Treat workflow IM as warehouse manager in `_scoped_inventory_filter` / `is_inventory_manager`, or add an explicit `view_warehouse_inventory` permission granted to IM.
- **Page/API:** `GET /api/inventory/?search=`

## TC-120 — CRUD-ORD-01 — Create order (retested PASS)

- First attempt sent `{customer_id, name}` → 422 missing `order_number`, `title`, `order_date`.
- Retest with those fields returned 200 and generated `ORD-2026-054`; delete succeeded.
- **Residual MEDIUM/LOW:** schema still requires client-supplied `order_number` even though the router overwrites it.

## TC-127 — CLEANUP PARTIAL (follow-up PASS)

- First cleanup hit FKs (`hierarchyconfigproducttype`, `entitystatushistory`).
- Follow-up deleted configs and QA users. Workflow audit rows kept (Spec 13 append-only).

---

# Critical / High findings

| ID | Severity | Finding |
|----|----------|---------|
| F-01 | HIGH | Concurrent Generate Hierarchy is not concurrency-safe. |
| F-02 | HIGH | Workflow Inventory Manager is excluded from warehouse inventory list/search; Spec 06 Reserved visibility fails for IM. Frontend and backend disagree on who is an “inventory manager”. |

No CRITICAL (system-down, auth bypass, or destructive unconstrained delete of production data) was observed in executed tests.

---

# Database integrity findings

- Happy-path reserve/issue/verify persisted correct instance `status_name` values.
- FCFS linked the first received serial to the earlier shortage project.
- Cancel released never-issued reserved stock to `AVAILABLE`.
- Configuration change marked source project `SUPERSEDED`.
- **Risk:** concurrent generate may duplicate Flight/SDLS/system rows (not re-counted after cleanup).
- Pre-existing DB already contained substantial business data (`project` count 203, `inventoryinstance` 629 at snapshot). QA did not modify those rows.

---

# Authorization / security findings

**Passed:** unauthenticated `/auth/me` → 401; invalid password → 401; Viewer/HM cannot manage configs; non-Admin cannot approve; IM cannot reserve or assign developer; Viewer cannot cancel or read workflow audit; HM isolation hides other HM’s project (404); audit DELETE/PUT rejected.

**Failed / mismatch:** workflow IM warehouse list scoping (F-02).

**Not tested:** JWT tampering, CSRF, rate-limit lockout exhaustion against real accounts, SQL injection payloads.

---

# Workflow findings

| Workflow | Result |
|----------|--------|
| Spec 01–04 happy path | PASS |
| Spec 05 shortage + FCFS | PASS |
| Spec 06 expiry job (time-travel) | PASS except IM list visibility |
| Spec 07–08 issue/install/verify | PASS |
| Spec 09 progress + completion gate | PASS (equal-weight tree) |
| Spec 10 rework repair loop | PASS through signed re-issue |
| Spec 11 cancel reserved stock | PASS |
| Spec 12 config change successor | PASS |
| Spec 13 audit | PASS |

Roadmap file still shows Specs 05–13 unchecked; implementation and live tests show they are present. Documentation drift only.

---

# Recommendations (do not implement in this audit)

1. Add a DB-level uniqueness/lock around hierarchy generation.
2. Align `is_inventory_manager()` with Spec 00 IM (and the frontend helper).
3. Make `OrderCreate.order_number` optional if the server generates it.
4. Expose or document an Admin-only issue-progress job endpoint symmetric with expiry `/run/`.
5. Add API tests for concurrent generate and IM warehouse search.
6. Update `IMPLEMENTATION-ROADMAP.md` to match shipped specs (separate docs change).

---

# Untested areas

- Full browser/UI (buttons, dialogs, toasts, double-click in the browser).
- Email delivery.
- Wall-clock 24h and 37-day waits (jobs were tested with backdated timestamps).
- Concurrent two-client reservation of one serial.
- Scrap / replace rework branches; issued-item recall return/inspect/disposition.
- Uneven progress-weight trees.
- DB privilege grants on `workflowauditevent`.
- Maintenance module, reporting dossiers, backup/restore, password policy lockout (outside workflow specs 00–13 except as incidental CRUD).

---

# Test data

Prefix: `QA_TEST_20260816_52531E28`

Removed: QA projects, inventory serials, configs, QA role users (after FK cleanup).  
Retained by design: `workflowauditevent` rows for those actions (immutable audit).  
Production/business rows were not deleted.
