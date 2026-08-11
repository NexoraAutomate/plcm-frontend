# Spec 12 — Configuration Change After Hierarchy / Reservation

**Sequence:** 12 of 13  
**Workflow source:** Page 02 — Configuration Change Workflow (CC-1 … CC-6) + CONTROL RULE  
**Depends on:** Specs 01–05; return/inspect capabilities from Specs 10–11

---

## Goal

Allow HM to move to a **different approved hierarchy configuration** after hierarchy setup or reservation **without editing the existing project configuration in place**. Prior project stays traceable; desired config is applied via a **new approved Project/Flight**.

---

## Actors

| Actor | Actions |
|-------|---------|
| HM | Request change; return inventory; submit change request; create new project after approve |
| IM | Inspect returns; restore inventory to Available (or appropriate status) |
| Admin | Approve configuration change |
| System | Enforce no in-place config mutate after setup/reservation |

---

## In scope

1. CC-1 HM requests configuration change after hierarchy setup / reservation.
2. CC-2 Return **ALL** project inventory to IM (Reserved + Issued + related items).
3. CC-3 IM inspects and releases/restores inventory to Available (or appropriate status).
4. CC-4 HM submits Change Request with desired **approved** configuration.
5. CC-5 Admin reviews & approves configuration change.
6. CC-6 Create **NEW** Project / Flight using approved configuration → new hierarchy + new reservation.
7. CONTROL RULE (must implement):

   > Existing project configuration is **NOT** edited in place after hierarchy setup / reservation.  
   > The previous project remains **traceable**; the desired configuration is implemented through a **new approved Project / Flight**.

---

## Out of scope

- Mutating Admin template configs that are unused (Spec 01 still owns template CRUD).
- Soft field edits that do not change hierarchy structure (name, notes) — allowed if not config structure.

---

## Detailed flow

```
CC-1 HM requests configuration change
        ↓
CC-2 Return ALL project inventory to IM
     (Reserved + Issued + related)
        ↓
CC-3 IM inspects returned items;
     releases / restores to Available or appropriate status
        ↓
CC-4 HM submits Change Request with desired approved configuration
        ↓
CC-5 Admin reviews & approves configuration change
        ↓
CC-6 Create NEW Project / Flight using approved configuration
     → new hierarchy + new reservation
```

---

## Business rules

1. **No in-place edit** of configuration id / structure on a hierarchy-generated or inventory-touched project.
2. Old project remains in system for history; prefer status such as `SUPERSEDED` / `CANCELLED` / `CLOSED_FOR_CONFIG_CHANGE` — pick one and document (recommend: open change request closes inventory ops; after new project created, old marked `SUPERSEDED` with link to successor).
3. Inventory return uses same mechanical paths as Spec 11 (release + recall + inspect) but driven by config-change, not necessarily PD cancel semantics.
4. Change request must reference:
   - source project  
   - target configuration (available/approved)  
   - reason remarks  
5. Admin approval of CR is required before new project creation from CR (or creates draft that still needs Spec 02 style approval—diagram shows Admin approval then new project; may combine with project approval).
6. New project follows Specs 02–04 afresh (draft/approval/generate/reserve as applicable).

---

## Functional requirements

### Backend

1. Block PATCH of `configuration_id` on projects past hierarchy generation / first reservation.
2. Config change request entity + state machine: REQUESTED → INVENTORY_RETURNED → SUBMITTED → APPROVED → NEW_PROJECT_CREATED.
3. Enforce inventory clearance before Admin approve or before new project create.
4. Link `successor_project_id` / `predecessor_project_id`.
5. Permission: `config_change.request`, `config_change.approve`.

### Frontend

1. HM “Request configuration change” entry on project locked for structural edit.
2. Wizard steps matching CC-1…CC-6 with progress checklist.
3. Hard UI disable of in-place config selector on sealed projects + explanatory CONTROL RULE banner.
4. After approve, CTA: create new Project/Flight prefilled with target config and scope edits.

---

## Acceptance criteria

- [ ] Cannot change configuration field in place after hierarchy setup / reservation.
- [ ] Change path requires full inventory return and IM restore.
- [ ] Admin must approve CR.
- [ ] New project created with new config; old project remains readable/traceable with link.
- [ ] New hierarchy generated and ready for new reservation independently.

---

## Test checklist

1. Attempt direct update of sealed project config → rejected.
2. Complete CC flow; verify inventory available on other projects.
3. Old project audit trail + identity preserved.
4. New project starts Spec 02/03 cleanly.

---

## Handoff to next (Spec 13)

All CC actions (request, return, approve, create) and every earlier lifecycle action must appear in the **immutable audit trail**.