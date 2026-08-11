# Spec 13 — Audit Trail (System-Wide)

**Sequence:** 13 of 13  
**Workflow source:** Overview §7 + Page 06 — Section 7  
**Depends on:** Specs 00–12 (implements logging for those actions; ideally hook incrementally earlier)

---

## Goal

Record **immutable** audit logs for every meaningful action across hierarchy and inventory workflows: who, role, date/time, IP/device, old→new, remarks. Provide admin (and authorized) query UI/API.

---

## Actors

| Actor | Actions |
|-------|---------|
| System | Append-only log on each domain action |
| Admin | Query / export audit trail |
| Other roles | Possibly view audits for entities they own (optional policy) |

---

## In scope

1. Append-only audit store.
2. Required fields per event:
   - Who performed the action  
   - Role (Admin / PD / HM / IM / Developer)  
   - Date / time  
   - IP / device  
   - Old value → New value  
   - Remarks  
3. Action types at minimum:
   - Reserved · Released · Issued · Installation in Progress · Under Testing · Installed Verified · Returned · Re-Issued · Modified · Deleted  
   - Plus project: created, approved, hierarchy generated, cancelled, config change request/approve  
4. Query filters: entity, user, role, action, date range, project.
5. No update/delete of audit rows via application APIs.

---

## Out of scope

- External SIEM export (optional later)
- Changing business workflows (only observing them)

---

## Implementation strategy note

Although last in the delivery sequence for **full audit UX**, each prior spec should leave **hook points** (service-layer events). Spec 13 completes:

1. Central audit writer  
2. Backfill of hooks on existing services if gap remains  
3. Read UI + permissions `audit.read`

---

## Detailed requirements

### Event envelope

| Field | Type | Required |
|-------|------|----------|
| id | UUID | Yes |
| occurred_at | timestamp UTC | Yes |
| actor_user_id | FK | Yes (system user for jobs) |
| actor_role | string/enum | Yes |
| action | enum/code | Yes |
| entity_type | string | Yes |
| entity_id | string | Yes |
| project_id | FK nullable | When applicable |
| old_value | JSON | When applicable |
| new_value | JSON | When applicable |
| remarks | string | Optional |
| ip_address | string | When request-scoped |
| user_agent / device | string | When request-scoped |
| correlation_id | string | Optional (request id) |

### Action catalog (minimum)

| Action code | When |
|-------------|------|
| RESERVED | Spec 04/05 |
| RELEASED | Spec 04/06/11/12 |
| ISSUED | Spec 07 |
| INSTALLATION_IN_PROGRESS | Spec 07 (auto) / Spec 08 |
| UNDER_TESTING | Spec 08 |
| INSTALLED_VERIFIED | Spec 08/10 |
| RETURNED | Spec 10–12 |
| RE_ISSUED | Spec 10 |
| MODIFIED | Generic entity updates |
| DELETED | Soft/hard deletes |
| PROJECT_CREATED / APPROVED / HIERARCHY_GENERATED / CANCELLED | Specs 02–03, 11 |
| CONFIG_CHANGE_* | Spec 12 |
| SHORTAGE_* / AUTO_RESERVE | Spec 05 |
| AUTO_RELEASE_EXPIRY | Spec 06 |

---

## Business rules

1. Application users cannot edit or erase audit rows.
2. System jobs (24h flip, expiry) log with system actor and role `SYSTEM`.
3. Old→new must be sufficient to reconstruct status transitions.
4. Failures to write audit should either fail the business transaction or alert critically (prefer same transaction for status-changing ops).

---

## Functional requirements

### Backend

1. Audit service + persistence (table append-only).
2. Middleware/helpers to capture IP/user-agent.
3. Domain services call audit writer.
4. Admin listing API with filters; optional export CSV.
5. DB privileges: app role INSERT + SELECT only on audit table (no UPDATE/DELETE grants).

### Frontend

1. Audit trail page (Admin).
2. Optional entity drawer “History” for a project/item.
3. Human-readable action labels.

---

## Acceptance criteria

- [ ] Every Spec 04–12 status-changing action creates an audit row with required fields.
- [ ] Auto jobs appear with system actor.
- [ ] API cannot update/delete audit rows.
- [ ] Admin can filter by project, actor, action, date.
- [ ] Sample flow end-to-end leaves complete reconstructable history.

---

## Test checklist

1. Perform full happy path Specs 01–09 → expect ordered audits.
2. Fail + rework + verify → Returned / Re-Issued / Installed Verified present.
3. Cancel + recall dispositions audited.
4. Config change path audited including NEW project create.
5. Attempt DELETE audit via API → fails.

---

## Handoff

No further workflow specs remain. Optional follow-ups (not in drawio): reporting, notifications preferences, external integrations.
