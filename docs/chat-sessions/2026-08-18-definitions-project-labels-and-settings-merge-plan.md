# Chat Session Export — Definitions, Project Labels & Settings Merge Plan

**Date:** 2026-08-18  
**Repos:**
- Backend: `c:\VSCode\plcm\backend\plcm-backend`
- Frontend: `c:\VSCode\plcm\frontend\plcm-frontend`

**Purpose:** Restore context on another machine. Load this file in Cursor (or paste into a new chat) to continue work.

---

## 1. Original request (completed)

In **Settings → Definitions**, admins can define custom names and abbreviations for hierarchy levels (System, Subsystem, Module, Unit, Component). The user wanted the **same for Project** — e.g. rename "Project" to "Flight" application-wide.

### Pattern used (existing levels)

```
Backend GET/PATCH /definitions
  → AppDefinitionsProvider (React context + runtime singleton)
  → useAppDefinitions().entityLabel(level, plural?)
  → resolveEntityTypeLabel(level) for non-React code
```

Key files:
- `lib/app-definitions.ts` — defaults, `getEntityTypeLabel`, `getLevelAbbrev`
- `lib/app-definitions-context.tsx` — provider + hook
- `lib/models.ts` — `AppDefinitions` interface
- `components/settings/definitions-panel.tsx` — ENTITY_ROWS table
- `components/settings/hooks/use-definitions-settings.ts` — draft/save hook

---

## 2. What was implemented

### 2.1 Backend

| File | Change |
|------|--------|
| `app/models/base.py` | Added `label_project`, `label_projects`, `abbrev_project` to `AppDefinitionsCommon` (defaults: Project, Projects, PROJ) |
| `app/schemas/schemas.py` | Added same fields to `AppDefinitionsRead` and `AppDefinitionsUpdate` |
| `app/services/app_definitions_service.py` | **Critical fix:** Added project fields to `DEFAULT_APP_DEFINITIONS`, `ENTITY_LEVELS`, `LABEL_FIELDS`, `ABBREV_FIELDS` — without this, saves were silently ignored |
| `alembic/versions/p1q2r3s4t5u6_appdefinitions_project_labels.py` | Migration adding three columns to `appdefinitions` |

**Migration note:** DB had no Alembic stamp initially. Steps taken:
1. `alembic stamp o0d1e2f3a4b5` (match existing schema)
2. Fixed migration `down_revision` from `a1b2c3d4e5f6` → `o0d1e2f3a4b5`
3. `alembic upgrade p1q2r3s4t5u6` — succeeded

Current DB revision after migration: **`p1q2r3s4t5u6 (head)`**

### 2.2 Frontend

| File | Change |
|------|--------|
| `lib/models.ts` | `label_project`, `label_projects`, `abbrev_project` on `AppDefinitions` |
| `lib/app-definitions.ts` | `'project'` in `HierarchyEntityLevel`, defaults, `getEntityTypeLabel`, `getLevelAbbrev`; `project: undefined` in part/serial template maps |
| `components/settings/definitions-panel.tsx` | Project row in ENTITY_ROWS; filter `project` out of per-level PN/SN template dropdown |
| `components/settings/hooks/use-definitions-settings.ts` | `project: []` in `hierarchyByLevel` |
| `components/app-sidebar.tsx` | `/projects` in `HIERARCHY_LABEL_BY_HREF`; nav labels use `entityLabel`; "Project Hierarchy" section header dynamic |
| `app/(dashboard)/projects/page.tsx` | Page titles, dialogs use `entityLabel('project')` |
| `app/(dashboard)/projects/[id]/page.tsx` | Breadcrumbs, form labels, system section titles |
| `components/projects/projects-mini-dashboard.tsx` | Chart/card titles |
| `components/systems/systems-list-dashboard.tsx` | Project-related chart titles |
| `components/hierarchy-entity-detail-panel.tsx` | DetailRow "Project" → `entityLabel('project')` |
| `components/settings/statuses-panel.tsx` | Projects status type label |
| `components/dashboard/executive/FiltersPanel.tsx` | Project filter label |
| `components/inventory-reservation-hold-dialog.tsx` | Project row label |

**Not fully updated (lower priority):** Some reporting PDF columns, orders/customers "Total projects" KPI tiles still hardcoded.

---

## 3. Bug fix — Save Definitions reverted Project name

**Symptom:** User changed Project level name in Definitions, clicked Save — UI reverted to "Project".

**Root cause:** Frontend sent `label_project` / `label_projects` / `abbrev_project` correctly, but `update_app_definitions()` in `app_definitions_service.py` only whitelists keys in `LABEL_FIELDS` and `ABBREV_FIELDS`. Project keys were missing → backend ignored them and returned unchanged row.

**Fix:** Added project fields to `DEFAULT_APP_DEFINITIONS`, `ENTITY_LEVELS`, `LABEL_FIELDS`, `ABBREV_FIELDS` in `app/services/app_definitions_service.py`.

**Verify:** Change Project → Flight in Settings → Definitions → Save. Reload app; sidebar and Projects page should show "Flights" / "Flight".

---

## 4. Tab overlap analysis (discussion only)

Three Settings tabs overlap conceptually:

| Tab | File | Purpose |
|-----|------|---------|
| **Definitions** | `definitions-panel.tsx` | Level labels/abbrevs, PN/SN templates, CI/SKU formats; also has tree view + item abbreviations (redundant) |
| **SDLS Configurations** | `hierarchy-config-panel.tsx` | Admin-defined **templates** for project creation (product types + System→Component node layout). Spec 01. HM selects config when drafting a project. |
| **System Hierarchy** | `hierarchy-panel.tsx` | CRUD on **live** hierarchy records in `hierarchies` table — systems, subsystems, etc.; batch JSON import; validator |

**User clarification:**
- SDLS Configurations is fundamentally like Systems Hierarchy but for **configuration templates** with different hierarchy layouts.
- Every new project selects a predefined hierarchy from admin-defined configurations.
- User does **not** want duplicate tabs — wants merge into **Definitions** with sub-tabs, enterprise-style UX, dialogs for tree views to reduce clutter.

**Registry:** `components/settings/settings-tabs-config.ts` — tabs `definitions`, `hierarchy-configs`, `hierarchy`.

---

## 5. Proposed merge plan — **NOT YET IMPLEMENTED**

User asked to merge Definitions + SDLS Configurations + System Hierarchy into **one Definitions tab** with **three sub-tabs**. Plan was presented; user did not confirm implementation before requesting this MD export.

### Sub-tab 1 — Labels & Templates
- Current Definitions content: level name/abbrev table, per-level PN/SN templates, other formats.
- **Remove** from here: `HierarchyTreeEditor` + abbreviations table (move to sub-tab 3).

### Sub-tab 2 — SDLS Configurations
- Embed full `HierarchyConfigPanel` (`hierarchy-config-panel.tsx`) as-is.

### Sub-tab 3 — System Hierarchy
- Embed full `HierarchyPanel` (`hierarchy-panel.tsx`) as-is.
- Includes tree editor, CRUD, batch import, validator, item abbreviations.

### Top-level Settings changes (when implementing)
| File | Action |
|------|--------|
| `settings-tabs-config.ts` | Remove `hierarchy-configs` and `hierarchy` from `SETTINGS_TABS`; update `SettingsTabId` |
| `settings-page.tsx` | Remove cases for those tabs |
| `definitions-panel.tsx` | Replace body with 3-sub-tab layout; wire sub-panels |
| `use-definitions-settings.ts` | Optionally trim hierarchy CRUD exports if sub-tab 1 no longer needs them |

### Open questions for user (confirm before coding)
1. OK to remove tree-view + abbreviation table from Labels & Templates sub-tab?
2. OK to remove `hierarchy-configs` and `hierarchy` from top-level Settings tab bar entirely?

### Legacy redirects
`LEGACY_ADMIN_REDIRECTS` maps `/hierarchy` → `hierarchy`. Update to `definitions` with sub-tab query param if merge is done (e.g. `?tab=definitions&section=hierarchy`).

---

## 6. Key code references

### ENTITY_ROWS (Definitions panel — includes project)

```tsx
// components/settings/definitions-panel.tsx
const ENTITY_ROWS = [
  { key: 'project', singular: 'label_project', plural: 'label_projects', abbrev: 'abbrev_project' },
  { key: 'system', ... },
  // subsystem, module, unit, component
];
```

### Backend whitelist (must include project for save to work)

```python
# app/services/app_definitions_service.py
LABEL_FIELDS = ("label_project", "label_projects", "label_system", ...)
ABBREV_FIELDS = ("abbrev_project", "abbrev_system", ...)
ENTITY_LEVELS = ("project", "system", "subsystem", "module", "unit", "component")
```

### SDLS config constants

```ts
// lib/hierarchy-config.ts
FIXED_HIERARCHY_LEVELS — Product Type → Flight → SDLS → System → ... → Component
TEMPLATE_NODE_LEVELS — system through component only
DEFAULT_CONFIG_NOTES — explains admin template vs project scope (Spec 02)
```

---

## 7. Git status note (session start)

Untracked/new files included migration and modified backend/frontend definition files. User did not request commits in this session.

---

## 8. Suggested next steps (for continuation)

1. **If merge not started:** Implement Definitions sub-tab layout per Section 5; get user confirmation on open questions.
2. **If testing Project labels:** Ensure backend restarted after `app_definitions_service.py` fix; re-test Save Definitions.
3. **Optional cleanup:** Wire remaining hardcoded "Project" strings in reporting/orders/customers pages.
4. **Docs:** Align `docs/workflow-specs/01-hierarchy-configuration.md` with merged Settings UX once implemented.

---

## 9. How to restore this session in Cursor

1. Open the same workspace (backend + frontend repos).
2. Start a new chat and attach or paste:
   - This file: `docs/chat-sessions/2026-08-18-definitions-project-labels-and-settings-merge-plan.md`
3. Say something like:
   > Continue from the chat session export. Implement the Settings Definitions merge (Section 5) / or fix X / or test Y.

---

## 10. Related specs

- `docs/workflow-specs/00-README.md`
- `docs/workflow-specs/01-hierarchy-configuration.md` — SDLS configurations (Spec 01)
- `docs/workflow-specs/02-project-creation-approval.md` — HM selects config when creating project (Spec 02)
- `docs/workflow-specs/03-hierarchy-generation.md` — hierarchy generation from config (Spec 03)
