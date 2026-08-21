# Manual Testing Guide — Workflow Specs (00–06)

Use this after seeding demo users, hierarchy configs, and inventory. Specs **07–13** reuse the same accounts and stock; create projects in the UI (Specs 02–03) so you practice the real flow.

**Related:** [00-README.md](./00-README.md) · fixtures in `plcm-backend/fixtures/workflow-demo/` · seed script `plcm-backend/scripts/seed_workflow_demo.py`

---

## 1. Prerequisites

1. Postgres is running and `DATABASE_URL` in `plcm-backend/.env` points at the DB you intend to use.
2. Backend: from `plcm-backend`, with venv active:
   ```bash
   uvicorn app.main:app --reload
   ```
3. Frontend: from `plcm-frontend`:
   ```bash
   npm run dev
   ```
4. Open the app (typically http://localhost:3000).

Optional: if schema is behind, run `alembic upgrade head` from `plcm-backend` before seeding.

---

## 2. Seed (repeatable)

### One-time env

In `plcm-backend/.env`:

```env
CREATE_WORKFLOW_DEMO_USERS=true
```

Restart the API after changing this (startup also creates demo users). The seed script creates them even if the flag was off.

### Run the seed

```bash
cd plcm-backend
python scripts/seed_workflow_demo.py
```

Useful flags:

| Flag | Effect |
|------|--------|
| `--dry-run` | Report what would be created; no writes |
| `--configs-only` | Entity list + hierarchy configs only |
| `--inventory-only` | Inventory CSV only |

Expected console themes: entity list / configs / inventory created-or-skipped counts, then a demo account table ending with `Done`.

Re-running is safe: existing `DEMO-*` configs, users, and serials are skipped.

---

## 3. Account cheat sheet

| Username | Password | Role |
|----------|----------|------|
| `admin` | `password@82768243` | Admin |
| `demo-pd` | `Demo@pd123` | ProjectDirector |
| `demo-hm` | `Demo@hm123` | HierarchyManager |
| `demo-im` | `Demo@im123` | InventoryManager |
| `demo-dev` | `Demo@dev123` | Developer |

Log out between role switches (or use a private window per role).

**Note:** Warehouse CSV import in the UI is Admin/SubAdmin-gated. Use the seed script (or Admin) for stock; `demo-im` is for issue/inspect/shortage flows after Spec 05+.

---

## 4. Fixture map

### Hierarchy configs

| Code | Product type | Template path (names must match stock) |
|------|--------------|----------------------------------------|
| `DEMO-SSDLS-1` | SSDLS-1 (HDR) | Comm → RF → Modem → Baseband Unit → FPGA Card |
| `DEMO-SSDLS-2` | SSDLS-2 (LDR) | Power → PSU → Converter → Regulator Unit → Cap Bank |

View/edit: **Settings → Hierarchy Configurations** (`/settings?tab=hierarchy-configs`) as Admin.

### Inventory (selected)

| Scenario | What to use |
|----------|-------------|
| Happy-path reserve (Spec 04) | `Comm` / `RF` / … serials `DEMO-SN-COMM-001` … `006` (enough for 2 flights × 3 SDLS) |
| Shortage / FCFS (Spec 05) | Exhaust free `Comm` units, then receive more; PN `PN-DEMO-COMM` |
| Contention (Spec 04) | Single serial `DEMO-SN-SHARE-001` on PN `PN-DEMO-COMM-SHARE` |
| Second config / Spec 12 later | `DEMO-SSDLS-2` + `Power` / `PSU` / … stock |
| Spot demo data | Serial / PN prefixes `DEMO-SN-` / `PN-DEMO-` |

Inventory UI: `/inventory` (Admin or permitted roles).

---

## 5. Walkthrough by spec

### Spec 00 — Roles & status foundations

1. Login as each demo user; confirm you can reach the app home/dashboard.
2. As **Admin**, open Statuses and confirm inventory statuses include Available, Reserved, Issued, etc.
3. Quick permission smoke:
   - **Admin**: Settings → Hierarchy Configurations visible.
   - **PD**: Projects visible; cannot create hierarchy configs.
   - **HM**: Can open Projects; draft create available when configs exist.
   - **IM / Dev**: Confirm Issue Queue / My Assignments visibility matches role (no config manage).

### Spec 01 — Hierarchy configuration

1. Login as **admin**.
2. Open `/settings?tab=hierarchy-configs`.
3. Confirm **Demo SSDLS-1 (HDR)** and **Demo SSDLS-2 (LDR)** exist and are available.
4. Optional: set DEMO-SSDLS-2 unavailable → as **demo-hm**, confirm it no longer appears in the draft-project config picker → Admin sets it available again.

### Spec 02 — Project creation & approval

Suggested scope for later reservation: **2 flights × 3 SDLS**.

1. Login as **demo-hm** → `/projects` → create draft:
   - Config: `DEMO-SSDLS-1`
   - Product type: SSDLS-1
   - Flight count: 2, SDLS per flight: 3
2. Confirm status **Draft**; Generate Hierarchy disabled.
3. Logout → login as **demo-pd** → open the project → **Assign HM** → select Demo Hierarchy Manager (`demo-hm`) if not already set.
4. Logout → login as **admin** → open the project → **Approve**.
5. Confirm status **Approved**.

### Spec 03 — Hierarchy generation

1. Login as **demo-hm** → open the approved project.
2. Click **Generate Hierarchy** (once).
3. Confirm status moves to **Hierarchy Generated** / **Ready for Inventory**.
4. Open the tree; expect 2 flights × 3 SDLS with Comm → … under each SDLS.
5. Confirm Generate is blocked on a second click.

### Spec 04 — Inventory reservation (happy path)

1. Stay as **demo-hm** on the Ready-for-Inventory project.
2. Pick Flight → SDLS → system **Comm** (or lower node) → **Reserve**.
3. Confirm item/serial becomes **Reserved** and is locked.
4. Optional: reserve enough nodes for one full SDLS; release one reservation back to **Available**.
5. Contention (optional): second project + try to reserve `DEMO-SN-SHARE-001` already held by the first.

### Spec 05 — Shortage handling

1. As **demo-hm**, reserve until a needed PN has no free units → expect shortage / wait list behavior if Spec 05 is implemented.
2. Open `/shortages` and Notifications.
3. As **demo-im** (or Admin), receive additional stock for that PN → confirm FCFS auto-reserve if implemented.

If Spec 05 UI/API is not ready yet, stop after documenting the shortage signal and continue with Spec 06.

### Spec 06 — Reservation expiry

1. Ensure at least one **Reserved** item exists.
2. For a short test, temporarily lower idle/grace in `.env` (then restart API), e.g.:
   ```env
   RESERVATION_IDLE_DAYS=0
   RESERVATION_GRACE_DAYS=0
   RESERVATION_EXPIRY_JOB_INTERVAL_SECONDS=60
   ```
3. Wait for the job (or trigger the expiry evaluation endpoint if your build exposes one).
4. Confirm reminder / auto-release to **Available**.
5. Restore production-like values (`30` / `7` / `3600`) when finished.

---

## 6. Specs 07–13 (continue later)

Same users and remaining `DEMO-*` stock. Do **not** require extra seed for:

- Issue → install → verify (07–09)
- Defect/rework (10)
- Cancel/recall (11)
- Config change using DEMO-SSDLS-2 (12)
- Audit as Admin (13)

Follow each numbered spec file in this folder when you reach them.

---

## 7. Reset

| Situation | Action |
|-----------|--------|
| Need more stock / missing users | Re-run `python scripts/seed_workflow_demo.py` |
| Spot demo inventory | Filter inventory by `DEMO-SN-` or `PN-DEMO-` |
| Spot demo configs | Codes `DEMO-SSDLS-1` / `DEMO-SSDLS-2` |
| Contaminated DB / want clean slate | Drop/recreate DB (or restore snapshot), restart API, run seed again |

The seed does **not** delete projects or reservations; idempotent adds only.
