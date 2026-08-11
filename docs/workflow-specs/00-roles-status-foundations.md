# Spec 00 — Roles, Permissions & Inventory Status Foundations

**Sequence:** 00 of 13  
**Workflow source:** Overview (roles, inventory status model); Page 06 (role summary)  
**Depends on:** nothing (first implementable block)

---

## Goal

Establish the **role matrix** and **canonical item/project status vocabulary** used by every later workflow step. Without this, later features will diverge on status names and access control.

---

## Actors

All five roles exist as first-class system roles:

| Role | Code | Purpose in later specs |
|------|------|------------------------|
| Admin | `ADMIN` | Configs, project approval, config-change approval |
| Project Director | `PD` | Assign HM, cancel / recall |
| Hierarchy Manager | `HM` | Project draft, hierarchy, reserve, assign, verify |
| Inventory Manager | `IM` | Stock, issue, inspect, shortage receipt |
| Developer | `DEV` | Request, install, test, report |

---

## In scope

1. Define (or map existing) application roles to the five workflow roles above.
2. Define **permission codes** required by later specs (can be stubs that enforce later).
3. Define **canonical inventory / item lifecycle statuses** (enum or status master data).
4. Define **project workflow statuses** used through Spec 03.
5. Document status transition **matrix rules** (allowed edges only).
6. Provide read/display badges or shared helpers for statuses (optional UI polish, required if any status is shown).

---

## Out of scope

- Creating hierarchy configurations (Spec 01)
- Project create/approve (Spec 02)
- Any reservation, issue, install, rework, recall logic
- Full audit log UI (Spec 13) — but leave room for actor id / role on mutations later

---

## Inventory / item statuses (happy path)

| Status | Meaning |
|--------|---------|
| `AVAILABLE` | In stock, free for reservation |
| `RESERVED` | Locked to a Flight → SDLS / hierarchy node until used, released, or auto-released |
| `ISSUED` | Physically issued to a Developer |
| `INSTALLATION_IN_PROGRESS` | Auto after issue dwell, or during active install work |
| `UNDER_TESTING_REVIEW` | Installed and under test / review |
| `INSTALLED_VERIFIED` | Pass + HM verification complete (terminal happy path) |

## Return / inspection branch statuses

| Status | Meaning |
|--------|---------|
| `RETURNED` | Back to IM from Dev / project (not yet dispositioned) |
| `INSPECTION` | IM is inspecting returned item |
| `REUSABLE` | Inspection outcome; item may return to stock |
| `REPAIRABLE` | Needs repair before any reuse |
| `SCRAPPED` | Not usable; out of stock permanently for that unit |

## Project statuses (through hierarchy generation)

| Status | Meaning |
|--------|---------|
| `DRAFT` | HM created project/flight; waiting Admin approval |
| `APPROVED` | Admin approved; Generate Hierarchy enabled |
| `HIERARCHY_GENERATED` | Tree materialised from selected configuration |
| `READY_FOR_INVENTORY` | May reserve / assign inventory |

Additional project statuses (cancel, completed, etc.) appear in later specs but should be reserved in the enum now if practical:

| Status (later) | Introduced by |
|----------------|---------------|
| `CANCELLED` | Spec 11 |
| `COMPLETED` / `READY_TO_DELIVER` | Spec 09 |

---

## Allowed status transitions (foundation)

### Item (happy path)

```
AVAILABLE → RESERVED → ISSUED → INSTALLATION_IN_PROGRESS
  → UNDER_TESTING_REVIEW → INSTALLED_VERIFIED
```

### Item (return path — mid and late lifecycle)

```
ISSUED | INSTALLATION_IN_PROGRESS | UNDER_TESTING_REVIEW  →  RETURNED → INSPECTION
  → REUSABLE → AVAILABLE
  → REPAIRABLE  (later rework / re-issue may return to ISSUED or similar)
  → SCRAPPED
```

Enforce transitions in a **single domain helper** used by services in later specs. Spec 00 delivers the matrix; later specs call it.

### Project

```
DRAFT → APPROVED → HIERARCHY_GENERATED → READY_FOR_INVENTORY
```

Later: `READY_FOR_INVENTORY` (and mid-life states) may go to `CANCELLED` (Spec 11).

---

## Permission sketch (seed list)

| Permission key | Primary role(s) | Used by |
|----------------|-----------------|---------|
| `hierarchy_config.manage` | Admin | Spec 01 |
| `project.assign_hm` | PD | Spec 02 |
| `project.create_draft` | HM | Spec 02 |
| `project.approve` | Admin | Spec 02 |
| `hierarchy.generate` | HM | Spec 03 |
| `inventory.reserve` | HM | Spec 04–05 |
| `inventory.release` | HM / System | Spec 04–06 |
| `inventory.receive` | IM | Spec 05 |
| `inventory.issue` | IM | Spec 07 |
| `hierarchy.assign_developer` | HM | Spec 07 |
| `item.request` | Dev | Spec 07 |
| `item.install_test` | Dev | Spec 08 |
| `item.verify` | HM | Spec 08–10 |
| `item.inspect` | IM | Spec 10–12 |
| `project.cancel` | PD / HM | Spec 11 |
| `config_change.request` | HM | Spec 12 |
| `config_change.approve` | Admin | Spec 12 |
| `audit.read` | Admin (+ limited others) | Spec 13 |

---

## Functional requirements

### Backend

1. Roles exist and can be assigned to users.
2. Status master / enum values match names above (stable codes for APIs).
3. Central `can_transition(entity_type, from, to, actor_role)` (or equivalent) defined for item + project.
4. Seed data or migration for statuses if the system uses DB-driven status names.

### Frontend

1. Role-aware gates can hide/show actions (at least shell for later buttons).
2. Shared status badge / label mapping for the new statuses.
3. Do not invent parallel status labels (e.g. avoid “In Stock” vs `AVAILABLE` inconsistency).

---

## Acceptance criteria

- [ ] Five roles are distinguishable in auth/RBAC for a test user matrix.
- [ ] All happy-path and return-path item statuses exist and display consistently.
- [ ] Project statuses `DRAFT`, `APPROVED`, `HIERARCHY_GENERATED`, `READY_FOR_INVENTORY` exist.
- [ ] Illegal transition is rejected by domain helper in unit tests (even if no UI yet).
- [ ] Permission keys listed above exist or are documented as stubs for Spec 01+.

---

## Test checklist

1. Seed users: one per role; confirm permission matrix smoke checks.
2. Unit tests: allowed vs disallowed status transitions for item and project.
3. UI smoke: status badge renders each status without fallback “unknown”.

---

## Handoff to next (Spec 01)

Admin can be authorized to manage hierarchy configurations; product-type enums and hierarchy level names used next must match:

`Product Type → Flight → SDLS → System → Subsystem → Module → Unit → Component`
