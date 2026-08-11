# Spec 11 — Inventory Recall (Project Cancelled)

**Sequence:** 11 of 13  
**Workflow source:** Page 05 — Side process “Inventory Recall (project cancelled)”  
**Depends on:** Specs 04–08 (items may be reserved/issued/in progress)

---

## Goal

When PD/HM **cancels a project**, recall issued (and related) inventory from Developers, IM inspects, and disposition stock as **Reusable → back to stock**, **Repairable → repair**, or **Scrapped**.

---

## Actors

| Actor | Actions |
|-------|---------|
| PD / HM | Cancel project; initiate recall |
| Developer | Return issued items when recall requested |
| IM | Inspect returns; set final disposition |
| System | Release reserved stock; project status `CANCELLED` |

---

## In scope

1. Cancel project by PD/HM.
2. Recall issued items from Developers.
3. Also release pure `RESERVED` stock still held (not physically issued)—return to `AVAILABLE`.
4. IM inspects returned items.
5. Disposition branches:
   - Reusable → back to stock (`AVAILABLE`)
   - Repairable → sent to repair (`REPAIRABLE`)
   - Scrapped → not usable (`SCRAPPED`)
6. Project flagged cancelled; further reserve/issue blocked.

---

## Out of scope

- Defect rework on active project (Spec 10)
- Configuration change forced return sequence (Spec 12) — similar mechanics may **reuse** recall/return services

---

## Detailed flow

```
PD/HM cancels project
        ↓
Recall issued items from Developer
        ↓
IM inspects
        ├── Reusable → back to stock
        ├── Repairable → sent to repair
        └── Scrapped → not usable
```

Also in parallel/as part of cancel:

- Reserved-not-issued units: release reservation → `AVAILABLE` (no Dev return needed).

---

## Business rules

1. Cancel permission: PD and/or HM per Spec 00 (`project.cancel`).
2. Cancel is blocked or needs confirm if critical path unfinished—always require explicit confirmation.
3. All project inventory (reserved + issued + in-progress/testing) must enter return/release pipeline.
4. Inspection dispositions match Overview return branch.
5. Scrapped never returns to Available without new serial induction.
6. Project status `CANCELLED`; hierarchy remains for traceability (read-only).
7. Open shortages for project (Spec 05) cancelled.

---

## Functional requirements

### Backend

1. Cancel project API with cascade plan:
   - cancel open shortages  
   - auto-release reservations  
   - create recall tasks for issued/in-progress units  
2. Dev confirm return / force admin recovery path if Dev unresponsive (document policy).
3. IM inspect + disposition APIs.
4. Block reserve/issue/generate on cancelled projects.

### Frontend

1. Cancel project action with strong confirmation + inventory impact summary.
2. Recall task lists for Dev and IM.
3. Disposition UI matching three outcomes.
4. Project read-only banner when cancelled.

---

## Acceptance criteria

- [ ] Cancel sets project `CANCELLED` and blocks new inventory ops.
- [ ] Reserved stock returns to Available without physical return when never issued.
- [ ] Issued items require recall/return then inspection.
- [ ] Three dispositions update statuses correctly.
- [ ] Shortages closed for the project.
- [ ] Hierarchy remains viewable for audit/trace.

---

## Test checklist

1. Project with mix: 2 reserved, 2 issued, 1 under test → all accounted after cancel.
2. Reusable unit free for another project.
3. Scrapped unit unavailable.
4. Unauthorised role cannot cancel.

---

## Handoff to next (Spec 12)

Configuration change after hierarchy/reservation **requires returning all project inventory** (like cancel return) then new Project/Flight with new config—reuse return/inspect services where possible.