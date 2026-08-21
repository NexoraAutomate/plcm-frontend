# Chat Export — Workflow Manual-Testing Groundwork

**Exported:** 2026-08-21  
**Topic:** Lay repeatable groundwork to manually test workflow specs (demo users, inventory, seed fixtures, guide)

---

## User request

> I want to test the workflow defined via spec files in the `plcm-frontend/docs/workflow-specs` folder myself manually. Please lay the necessary ground work for that (including addition of demo inventory items, creation of relevant user demo accounts, etc.). Also, please make the process repeatable by creating seed files, CSV files (for demo inventory), etc. Guide me along the way and break each process into easy to follow steps. First create a plan on how you will lay the ground work and then we will execute it together.

---

## Plan (approved and implemented)

**Name:** Workflow Manual-Testing Groundwork

### Goal

Make it possible to walk specs in `docs/workflow-specs/` by hand with:

- One login per role (Admin, PD, HM, IM, Dev)
- Two hierarchy configs (SSDLS-1 / SSDLS-2) with node names that match demo stock
- Enough `AVAILABLE` inventory (with serial instances) for reservation, contention, and shortage/FCFS
- A repeatable reset path via fixtures + a CLI seed script
- A written guide that breaks setup and each early spec into short steps

**Default scope:** foundation through Spec 06 (roles → configs → project → generate → reserve → shortage → expiry). Specs 07–13 reuse the same accounts/stock; projects are created via UI (Specs 02–03).

### What already existed (reused)

| Piece | Location | Action |
|-------|----------|--------|
| Demo users (PD/HM/IM/Dev) | `app/services/workflow_demo_users.py` | Enable via `CREATE_WORKFLOW_DEMO_USERS=true` |
| Default Admin | `ensure_default_admin` in `app/auth.py` | Already on by default (`admin` / `password@82768243`) |
| Status vocabulary | `workflow_foundation_seed.py` | Already runs on startup |
| Config create API/service | `hierarchy_config_service.create_configuration` | Call from seed script |
| Proper stock instances | `inventory_service.create_inventory_instance` | Use this — not bare CSV HTTP import alone |

**Constraint:** HTTP `POST /inventory/import-csv/` only allows Admin/SubAdmin, and creates parent `Inventory` rows without full instance semantics. The seed script creates groups + `InventoryInstance` rows as `AVAILABLE`. Reservation matching is by hierarchy node name (e.g. `"Comm"`).

### Deliverables

1. **Backend fixtures** under `plcm-backend/fixtures/workflow-demo/`:
   - `hierarchy_configs.json` — `DEMO-SSDLS-1`, `DEMO-SSDLS-2`
   - `inventory_demo.csv` — DEMO serials/PNs
   - `entity_list.json` — catalog names required by config validation

2. **CLI seed script** `plcm-backend/scripts/seed_workflow_demo.py`:
   - Ensures statuses, demo users (force), configs, inventory
   - Flags: `--dry-run`, `--configs-only`, `--inventory-only`
   - Does **not** auto-create projects

3. **Env wiring:**
   - Document `CREATE_WORKFLOW_DEMO_USERS` in `.env.example`
   - Enable in local `.env`

4. **Manual testing guide:**
   - `plcm-frontend/docs/workflow-specs/MANUAL_TESTING_GUIDE.md`
   - Link from `00-README.md` and `docs/testing_prompt.md`

### Out of scope (this pass)

- Pre-seeding issued / under-test / recall dispositions (Specs 07–11)
- Changing `is_inventory_manager` so `demo-im` can use CSV import UI
- Auto-seeding inventory on every API startup
- Committing or pushing unless asked

---

## Implementation summary (executed in this chat)

### Files created / updated

**Backend**

- `fixtures/workflow-demo/entity_list.json`
- `fixtures/workflow-demo/hierarchy_configs.json`
- `fixtures/workflow-demo/inventory_demo.csv`
- `scripts/seed_workflow_demo.py`
- `app/services/workflow_demo_users.py` — added `force=True` so CLI can create users without the env gate alone
- `.env.example` — documented `CREATE_WORKFLOW_DEMO_USERS`
- `.env` — set `CREATE_WORKFLOW_DEMO_USERS=true` (kept existing `DATABASE_URL`)

**Frontend docs**

- `docs/workflow-specs/MANUAL_TESTING_GUIDE.md`
- `docs/workflow-specs/00-README.md` — link to the guide
- `docs/testing_prompt.md` — pointer to the guide + seed command

### Demo accounts

| Username | Password | Role |
|----------|----------|------|
| `admin` | `password@82768243` | Admin |
| `demo-pd` | `Demo@pd123` | ProjectDirector |
| `demo-hm` | `Demo@hm123` | HierarchyManager |
| `demo-im` | `Demo@im123` | InventoryManager |
| `demo-dev` | `Demo@dev123` | Developer |

### Fixture map (high level)

| Code / stock | Purpose |
|--------------|---------|
| `DEMO-SSDLS-1` | Comm → RF → Modem → Baseband Unit → FPGA Card |
| `DEMO-SSDLS-2` | Power → PSU → Converter → Regulator Unit → Cap Bank |
| `DEMO-SN-COMM-*` etc. | Happy-path reserve (enough for 2×3) |
| `DEMO-SN-SHARE-001` | Dual-project contention |
| `PN-DEMO-*` | Spot / filter demo inventory |

### Seed command

```bash
cd plcm-backend
python scripts/seed_workflow_demo.py
```

### Seed run note from this chat

First seed attempt failed with **Postgres connection refused** on `localhost:5432`. Deliverables were completed; seed must be re-run when Postgres is up, then restart the backend and follow the manual guide.

---

## Agreed next steps (Phases B–E)

1. Confirm Postgres is running and `DATABASE_URL` is correct.
2. Restart backend (pick up `CREATE_WORKFLOW_DEMO_USERS=true`).
3. Run `python scripts/seed_workflow_demo.py` and verify the summary.
4. Login once as each demo user.
5. Follow Specs 01–03 in the UI to produce a `READY_FOR_INVENTORY` project.
6. Spec 04+ with seeded inventory (reserve / shortage / expiry as applicable).

Full step-by-step: [MANUAL_TESTING_GUIDE.md](./MANUAL_TESTING_GUIDE.md)

---

## Related plan attachment (reference only)

The approved plan lived at Cursor plans (`workflow_demo_groundwork_81904560.plan.md`). A copy may also exist under this folder; **do not treat the plan file as the runbook** — use `MANUAL_TESTING_GUIDE.md` for day-to-day testing.
