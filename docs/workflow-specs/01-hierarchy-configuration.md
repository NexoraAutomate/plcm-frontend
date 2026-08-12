# Spec 01 — Smart SDLS Hierarchy Configuration (Admin)

**Sequence:** 01 of 13  
**Workflow source:** Page 02 — Section 1 (steps 1.1–1.5) + hierarchy example  
**Depends on:** Spec 00

---

## Goal

Admin creates and stores one or more **approved hierarchy configurations** for Smart SDLS production. Later, HM selects a configuration when creating a project; HM does **not** redesign the lower structure during normal project creation.

---

## Actors

| Actor | Actions |
|-------|---------|
| Admin | Create, edit (pre-use), save, make available configurations; define product types and level structure |
| HM | **Read-only** list of available/approved configurations (selection happens in Spec 02) |

---

## In scope

1. Create Hierarchy Configuration (Settings area).
2. Fixed level order for Smart SDLS:
   - Product Type → Flight → SDLS → System → Subsystem → Module → Unit → Component
3. Product Type options at least:
   - `SSDLS-1` — High Data Rate  
   - `SSDLS-2` — Low Data Rate  
4. Admin may create **multiple** configurations for different project/product requirements.
5. Save configuration so it becomes **available** for HM selection.
6. Capture configuration rule notes: customer order defines Product Type, number of Flights, and number of SDLS per Flight; Admin defines common lower-level hierarchy once.

---

## Out of scope

- Project/Flight creation (Spec 02)
- Hierarchy instance generation for a real project (Spec 03)
- Inventory reservation (Spec 04)
- In-place editing of a configuration **after** it is already used by reserved projects (see Spec 12 control rule)

---

## Detailed flow

```
1.1 Admin creates Hierarchy Configuration for Smart SDLS production
        ↓
1.2 Define fixed hierarchy levels
    (Product Type → Flight → SDLS → System → Subsystem → Module → Unit → Component)
        ↓
1.3 Configure Product Types (SSDLS-1, SSDLS-2, …)
        ↓
1.4 Save Configuration in Settings
    (multiple configs allowed)
        ↓
1.5 Configuration Available to HM
    (HM will select when creating project/flight — Spec 02)
```

### Configuration content model (minimum)

| Field / structure | Description |
|-------------------|-------------|
| Name / code | Unique human-readable config name |
| Product types supported | e.g. SSDLS-1, SSDLS-2 |
| Level definitions | Ordered levels as above |
| Systems set | Admin-defined System list (and below tree template) |
| Subsystem → Module → Unit → Component template | Same lower hierarchy for every SDLS |
| Active / available flag | Only available configs selectable by HM |
| Version or immutable snapshot id | For traceability when project freezes a config |

### Example tree concentration (from diagram)

```
PRODUCT TYPE (SSDLS-1 / SSDLS-2)
  └── FLIGHT-1 … FLIGHT-n
        └── SDLS-1 … SDLS-n  (any number per flight)
              └── System-1 … System-n  (admin-defined set)
                    └── Subsystem → Module → Unit → Component
```

**Rule:** Same lower-level hierarchy for every SDLS; maintained by Admin in Settings.

---

## Business rules

1. Level **order is fixed**; Admin configures values/templates within levels, not an arbitrary reordering of the Smart SDLS model.
2. Customer order (external/business input) determines Product Type, #Flights, #SDLS per Flight — those instance counts belong to the **project** (Spec 02), not redesign of Admin template mid-creation.
3. Multiple named configurations are allowed.
4. Only configurations marked available/approved appear for HM in Spec 02.
5. Once a configuration is **bound** to a hierarchy-generated project, do not silently mutate it in place for that project (align with Spec 12: new project for new config).

---

## Functional requirements

### Backend

1. CRUD (or create + soft-retire) for hierarchy configuration.
2. Persist product types and level template tree per configuration.
3. API: list available configurations for HM.
4. Authorization: `hierarchy_config.manage` for write; read for HM.

### Frontend

1. Admin Settings UI: create / edit / list configurations.
2. Visual indication of level order and example hierarchy.
3. HM-facing selector data source prepared (full project form is Spec 02).

---

## Acceptance criteria

- [x] Admin can create a Smart SDLS configuration with the fixed 8-level model.
- [x] Admin can define SSDLS-1 and SSDLS-2 (and mark product types).
- [x] Admin can define System set and lower hierarchy template once per config.
- [x] Multiple configs can exist and be listed.
- [x] Non-Admin cannot create/edit configs.
- [x] HM (or public project-create API) can list only available configurations.
- [x] Saved config retains structure required for auto-generation in Spec 03.

---

## Test checklist

1. Admin creates Config A (SSDLS-1 template) and Config B (SSDLS-2 template).
2. Attempt create without Admin role → denied.
3. Mark Config B unavailable → HM list excludes B.
4. Reload app / re-fetch API → structure stable.
5. Snapshot storage: editing Config A later does not rewrite fields of a previously frozen snapshot if snapshots are implemented (or document deferred freeze until Spec 03).

**Snapshot note (Spec 01):** Configurations carry a monotonic `version` field bumped on each edit. Immutable project-bound snapshots are deferred to Spec 03 (hierarchy generation), when a project freezes `configuration_id` + `version`.

---

## Handoff to next (Spec 02)

HM must be able to **select an approved configuration** when creating a Project/Flight in Draft. Configuration id (and optional version/snapshot) becomes a required project field.