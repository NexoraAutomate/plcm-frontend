# Spec 03 — Hierarchy Generation for Approved Projects

**Sequence:** 03 of 13  
**Workflow source:** Page 02 — Section 2 (steps 2.4–2.6) + status READY FOR INVENTORY  
**Depends on:** Spec 02

---

## Goal

After Admin approval, HM generates the **project-specific Smart SDLS hierarchy** from the selected configuration and project scope. Project becomes ready for inventory assignment and reservation.

---

## Actors

| Actor | Actions |
|-------|---------|
| HM | Click / invoke Generate Hierarchy after approval |
| System | Auto-generates tree; updates project status |
| Admin | No structural redesign at this step (config already chosen) |

---

## In scope

1. Enable **Generate Hierarchy** only when project status is `APPROVED` (and generation not already done).
2. System auto-generates hierarchy for Flight → SDLS → System → Subsystem → Module → Unit → Component according to:
   - Selected configuration template (Spec 01)
   - Project scope counts / product type (Spec 02)
3. Project status → `HIERARCHY_GENERATED`, then `READY_FOR_INVENTORY` (may be one step if “generated implies ready”).
4. Hierarchical navigation / view of the generated tree for the project.
5. Hard gate: before approval, Generate remains disabled (re-confirm Spec 02 control).

---

## Out of scope

- Reserving inventory (Spec 04)
- Editing configuration of the live project in place (Spec 12)
- Progress percentage engine (Spec 09)

---

## Detailed flow

```
2.4 Generate Hierarchy button DISABLED before Admin approval;
    ENABLED after approval
        ↓
2.5 System auto-generates selected Smart SDLS hierarchy
    Hierarchy READY → status HIERARCHY_GENERATED
        ↓
2.6 Project / Flight ready for inventory assignment & reservation
    status READY_FOR_INVENTORY
```

```
APPROVED  ──Generate hierarchy──►  HIERARCHY_GENERATED  ──►  READY_FOR_INVENTORY
```

---

## Business rules

1. Generation is **idempotent-safe**: either one-shot only, or re-generate blocked once leaf nodes have inventory ties (prefer one-shot until Spec 12).
2. Generated lower tree for each SDLS must match Admin template (“same lower-level hierarchy for every SDLS”).
3. HM does not redesign structure during generation; only parameters already on the project apply.
4. Warning from diagram remains valid until approval:

   > BEFORE ADMIN APPROVAL → “Generate Hierarchy” remains DISABLED.  
   > Only APPROVED projects can proceed to hierarchy generation and subsequent inventory reservation.

5. After generation, project is **ready for inventory assignment & reservation** (Spec 04 input).

---

## Functional requirements

### Backend

1. `POST` generate hierarchy endpoint gated by:
   - Role: HM (permission `hierarchy.generate`)
   - Status: `APPROVED`
   - Not already generated (or explicit regenerate policy)
2. Create child entities for the full tree with parent links and stable codes/names.
3. Transition project status via Spec 00 matrix to `HIERARCHY_GENERATED` / `READY_FOR_INVENTORY`.
4. Return tree summary / counts for UI confirmation.

### Frontend

1. Enable Generate Hierarchy only for `APPROVED`.
2. Confirmation dialog: scopes + config name before generate.
3. Progress/loading for long trees.
4. Project detail shows generated hierarchy (tree or nested tables matching existing PLCM UI patterns).
5. After success, show status ready for inventory.

---

## Acceptance criteria

- [ ] Generate is disabled for `DRAFT` projects (UI + API).
- [ ] Generate succeeds for `APPROVED` and creates full level tree.
- [ ] Flight count and SDLS-per-flight match project scope fields.
- [ ] Each SDLS has the same System→…→Component template structure from config.
- [ ] Project ends in `READY_FOR_INVENTORY` (or `HIERARCHY_GENERATED` then ready).
- [ ] Second generate is blocked unless explicitly designed otherwise.
- [ ] Non-HM cannot generate.

---

## Test checklist

1. Approve project with 2 flights, 3 SDLS each → expect 6 SDLS nodes and multiplied lower nodes as per template.
2. SSDLS-1 vs SSDLS-2 projects use correct templates if configs differ.
3. Concurrent double-click generate → no duplicate trees.
4. Navigate project detail: tree visible bottom-up and top-down.

---

## Handoff to next (Spec 04)

Project in `READY_FOR_INVENTORY` exposes hierarchy leaves (or reservable nodes) that HM can reserve inventory against: **Flight → SDLS → hierarchy items (LRU-level)**.