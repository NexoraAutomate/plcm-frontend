# Spec 02 — Project Creation & Approval

**Sequence:** 02 of 13  
**Workflow source:** Page 02 — Section 2 (steps 2.1–2.3) + project status DRAFT → APPROVED  
**Depends on:** Spec 00, Spec 01

---

## Goal

Allow PD to assign work to HM, allow HM to create a **Draft** Project/Flight from an **approved configuration**, and require **Admin approval** before any hierarchy generation or inventory work.

---

## Actors

| Actor | Actions |
|-------|---------|
| PD | Assign Project/Flight responsibility to HM (customer order defines product scope) |
| HM | Select configuration; create Project/Flight as `DRAFT` |
| Admin | Review and approve → `APPROVED` |

---

## In scope

1. PD assignment of project/flight to an HM (or equivalent ownership field).
2. HM creates Project/Flight:
   - Selects approved hierarchy configuration from Settings.
   - Captures product scope as required by customer order (product type, flights count, SDLS per flight parameters as applicable).
   - Status starts as **`DRAFT`**.
3. Admin review + approve → **`APPROVED`**.
4. Guard: **Generate Hierarchy is disabled** while not approved (button/API both blocked). Full enablement is completed in Spec 03, but Spec 02 must leave generation disabled for drafts.

---

## Out of scope

- Generate Hierarchy execution (Spec 03)
- Inventory reservation (Spec 04)
- Configuration change after setup (Spec 12)

---

## Detailed flow

```
2.1 Project / Flight assigned to HM by PD
    (Customer order defines product scope)
        ↓
2.2 HM selects approved configuration from Settings
    and creates Project / Flight
    Status: DRAFT
        ↓
2.3 Admin reviews Project / Flight creation and approves
    Status: APPROVED
```

Status chain after Spec 02 completes:

```
DRAFT  ──Admin approval──►  APPROVED
```

Generate Hierarchy remains **disabled** until Spec 03 runs after approval.

---

## Business rules

1. Only approved/available configurations (Spec 01) may be selected.
2. Project without Admin approval **cannot** generate hierarchy and **cannot** reserve inventory.
3. HM owns the draft; Admin is the sole approver for creation (per diagram).
4. Customer order defines product scope (type, flights, SDLS counts) — fields must be captured on create/edit in draft.
5. Editing material scope fields after approve may require re-approval (decide and document; default: freeze config selection and core counts at approval, allow only non-structural fields unless Admin reopens).

---

## Data model (minimum fields)

| Field | Owner | Notes |
|-------|-------|-------|
| Project / Flight number or name | HM | Unique identifier |
| Assigned HM | PD | User id |
| Configuration id (+ snapshot if used) | HM | From Spec 01 |
| Product type | HM / from order | e.g. SSDLS-1 |
| Flight count / SDLS counts | HM / from order | Instance sizing |
| Status | System | `DRAFT` \| `APPROVED` … |
| Created by / approved by / timestamps | System | Audit-friendly |

---

## Functional requirements

### Backend

1. Create draft project API (`project.create_draft`).
2. Assign HM API or field set by PD (`project.assign_hm`).
3. Approve project API (`project.approve`) — only Admin.
4. Reject transitions: draft → hierarchy generate without approve → **403/422**.
5. Validation: configuration must be available; required scope fields present.

### Frontend

1. PD: assign HM UI.
2. HM: create project form with configuration selector + scope fields; shows status badge `DRAFT`.
3. Admin: approval queue / detail action **Approve**.
4. Generate Hierarchy button visible but **disabled** (or hidden) for non-approved projects with tooltip: approval required.

---

## Acceptance criteria

- [ ] PD can assign an HM to a project context.
- [ ] HM can create a project in `DRAFT` with a selected Spec 01 configuration.
- [ ] Only Admin can move status to `APPROVED`.
- [ ] Non-Admin approve attempts fail.
- [ ] Generate Hierarchy cannot succeed for `DRAFT` (API + UI).
- [ ] Approved project still does not auto-generate hierarchy until Spec 03 action.

---

## Test checklist

1. HM creates draft with Config A → status `DRAFT`.
2. Attempt generate hierarchy as HM → blocked.
3. Admin approves → `APPROVED`.
4. Second user without Admin cannot approve.
5. Create with missing config → validation error.
6. Create with unavailable config → validation error.

---

## Handoff to next (Spec 03)

On `APPROVED`, enable **Generate Hierarchy**. Generated tree must materialize Flight → SDLS → System → … from config + project scope counts, then move toward `HIERARCHY_GENERATED` / `READY_FOR_INVENTORY`.