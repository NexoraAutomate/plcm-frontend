# QA Final Summary

**Product:** PLCM  
**Audit date:** 17 August 2026  
**Method:** Specification review + live API execution + PostgreSQL verification. Browser click-paths were not automated.  
**Source code:** **Not modified.** Specifications, schema, and configuration were not modified.

---

## Overall Assessment

**READY WITH MINOR ISSUES**

Core Spec 00–13 workflows are implemented and were executed successfully on the running system: configuration, draft/approve, hierarchy generation, reservation, shortage FCFS, expiry job, signed issue, 24h install-in-progress, install/test/verify, automatic progress, rework repair loop, cancel/release, configuration-change successor project, and immutable audit.

Two HIGH defects remain (concurrent generate race; Inventory Manager warehouse list scoping). They do not block a careful single-user happy path, but they should be fixed before concurrent production use.

---

## Statistics

| Category | Count |
|----------|------:|
| Specification files reviewed | 16 |
| Requirements identified | 96 |
| Requirements behaviorally tested | 82 |
| Test cases generated (live + manual catalogue) | 200+ |
| Scenarios actually executed (live API/DB) | 128 (+ 2 follow-ups) |
| Passed (primary live run) | 124 |
| Failed (primary live run) | 3 |
| Partial (primary live run) | 1 |
| Not implemented (executed workflows) | 0 |
| Not testable / not executed this run | 14 requirement gaps (UI, email, scrap/replace, concurrent reserve, pytest suite) |
| Product defects remaining after retest | 2 |
| Critical | 0 |
| High | 2 |
| Medium | 1 |
| Low | 1 |

Follow-up: order create **PASS** with valid payload; leftover QA users/configs **deleted**. Workflow audit rows for QA actions **retained** (append-only).

---

## Top 10 Issues

1. **HIGH — Concurrent Generate Hierarchy** both return 200 (Spec 03 duplicate-tree risk).
2. **HIGH — Workflow IM cannot list/search reserved warehouse serials** (`is_inventory_manager()` is Admin/SubAdmin only; frontend includes InventoryManager).
3. **MEDIUM — Order create schema requires `order_number`** even though the server overwrites it with `ORD-YYYY-NNN`.
4. **LOW — Implementation roadmap still marks Specs 05–13 incomplete** while they are present in code and passed live tests.
5. **Gap — No HTTP trigger for the 24h issue-progress job** (expiry job has `/run/`).
6. **Gap — Email notifications** not verified (in-app notices passed).
7. **Gap — Scrap and replace rework branches** not fully executed this run (repair path passed).
8. **Gap — Issued-item recall** (Dev return + IM disposition on cancel) not fully executed (reserved-not-issued cancel passed).
9. **Gap — Uneven-tree progress weighting** not live-tested (equal templates used).
10. **Gap — Full UI/browser** (dialogs, badges, double-click) not executed; use the role-based manual.

---

## Recommended Fix Priority

1. Lock hierarchy generation (transaction + uniqueness) so a double submit cannot duplicate the tree.
2. Treat Spec 00 Inventory Manager as a warehouse manager in inventory list/search (align backend with frontend and Spec 06).
3. Make generated `order_number` optional on create.
4. Add an Admin-only issue-progress job run endpoint or document the operational procedure.
5. Extend automated tests for concurrency and IM list search.
6. Refresh the implementation roadmap document (docs only).

**Do not treat this list as a change request executed in this audit — no code was changed.**

---

## Test data cleanup

| Item | Status |
|------|--------|
| QA projects / inventory / configs | Removed |
| QA role users (`QA_TEST_20260816_52531E28_*`) | Removed on follow-up |
| Workflow audit events for QA actions | Left in place (Spec 13) |
| Pre-existing business data | Untouched |

---

## Generated files

1. `docs/qa-audit/QA_AUDIT_REPORT.md`
2. `docs/qa-audit/USER_MANUAL_ROLE_BASED_SCENARIOS.md`
3. `docs/qa-audit/MANUAL_VERIFICATION_CHECKLIST.md`
4. `docs/qa-audit/QA_FINAL_SUMMARY.md`
5. `docs/qa-audit/TEST_EXECUTION_LOG.md`
6. `docs/qa-audit/qa_live_results.json`

Supporting harness scripts in the same folder are evidence only; they did not change application source.
