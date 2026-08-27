# Demo login credentials (local / dev only)

Weak passwords for smoke-testing role-based flows. **Do not use in production.**

Seeded via `plcm-backend/scripts/seed_workflow_demo.py` or `CREATE_WORKFLOW_DEMO_USERS=true` on API startup.

| Username | Password | Role (DB name) | Spec code |
|---|---|---|---|
| `admin` | `password@82768243` | Admin | ADMIN |
| `demo-pd` | `Demo@pd123` | ProjectDirector | PD |
| `demo-hm` | `Demo@hm123` | HierarchyManager | HM |
| `demo-im` | `Demo@im123` | InventoryManager | IM |
| `demo-dev` | `Demo@dev123` | Developer | DEV |

Also listed in [workflow-specs/MANUAL_TESTING_GUIDE.md](./workflow-specs/MANUAL_TESTING_GUIDE.md).
