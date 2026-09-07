# Spec 14 — Role-Targeted Notifications

**Sequence:** 14 (follow-up after Spec 13)  
**Workflow source:** Cross-cutting — Specs 01–13 operational events + CRUD (users, customers, orders, inventory, configuration, reports)  
**Depends on:** Specs 00–13 (events already exist; this spec defines who is notified)

---

## Goal

Notify **only the concerned role or assigned person** when a domain event occurs. Never broadcast. Persist each notice per recipient so the bell and `/notifications` history are role-scoped, not inferred from recently updated records.

---

## Actors

| Actor | Receives |
|-------|----------|
| Admin / SubAdmin (`Admin*`) | User/role CRUD, signup pending activation, hierarchy-config template CRUD, backup/restore, project approval queue, optional report audit |
| Project Director (`PD`) | Draft awaiting approval, HM assignment, project approval/completion/cancel/supersede, **install pass/fail**, config-change approved, project deleted |
| Hierarchy Manager (`HM`) | Events on **their** project (`assigned_hm_id`): draft/approve/progress/hierarchy, shortage, reservation expiry, verify/handover queue |
| Inventory Manager (`IM`) | Stock CRUD, import/export, labels, issue **requests**, inspection queue, out-of-stock, warehouse events |
| Developer (`DEV`) | Assigned work, issued stock, return decision, re-issue, recall return required, verified result |
| Installer | Not a DB role. Means the **issued-to user** (`issued_to_user_id`), almost always Developer |

Legacy roles (`ProjectManager`, `Technician`, `Maintenance`, `Viewer`) are out of this matrix unless the user also holds a workflow role.

---

## Prerequisites

- Spec 00 roles and permissions exist.
- Bell UI + `/notifications` page exist (`view_notifications`).
- Four specialized notice tables already persist a subset of inventory events (see Current state).

---

## In scope

1. Canonical event → recipient → priority matrix (this document).
2. Targeting rules (concerned role only; exclude actor except confirmations).
3. Coverage status: **exists** / **partial** / **gap** vs current code.
4. Guidance for a later unified `Notification` row keyed by `event_type` + `user_id`.

---

## Out of scope

- Sending email / WhatsApp / push (Settings → Alerts toggles are UI stubs only).
- WebSocket / SSE realtime transport.
- Notifying everyone that a report was *viewed* (generation/export only).
- Replacing the four specialized inventory notice tables (issue / return / shortage / expiry remain as-is).

---

## Targeting rules

1. Notify the **concerned role / assigned person only** — never broadcast.
2. **Do not notify the actor** except confirmations (e.g. “inventory issued to you”, “account activated”).
3. Admin-level = **Admin + SubAdmin**.
4. Project events go to **that project’s assigned HM**, not every HM.
5. Warehouse events (stock CRUD, import, labels) go to **IM only** (plus Admin* only when the actor is not IM).
6. Collapse bulk ops (CSV import of 200 items) into **one** notice.
7. **Concerned PD:** project has `assigned_hm_id` and `owner_id`, not `assigned_pd_id`. Prefer `owner_id` if that user is PD; else all PD users. Optional later: persist the PD who assigned the HM.
8. **`project.approve` is Admin and PD** (not Admin-only). Draft-awaiting-approval reaches Admin* and PD.

```
Event
  → Resolve recipients
       ├─ Assigned user (HM, Dev, installer)
       └─ Role group (IM, Admin*, PD)
  → Persist notice per user
  → In-app bell and history
```

---

## Current state

Unified `appnotification` rows persist **gap** events (one row per recipient). The four specialized inventory notice tables are unchanged and remain the only source for issue / return / shortage / idle-expiry. The bell merges both. Client-inferred project/customer/maintenance loops were removed.

### Already persisted (specialized — do not duplicate)

| Channel | Events | Recipients today |
|---------|--------|------------------|
| `InventoryReturnNotice` | Return requested / accepted / rejected | Shared IM/Admin queue (not per-user rows) |
| `InventoryInstallerNotice` | `issued`, `return_accepted`, `return_rejected` | Issued-to user |
| `InventoryShortageNotice` | `shortage_created`, `shortage_partial`, `shortage_fulfilled` | Requester + `assigned_hm_id` + all IM/Admin/SubAdmin |
| `InventoryReservationExpiryNotice` | `reservation_idle_reminder`, `reservation_auto_released` | `reserved_by_user_id` + `assigned_hm_id` |

### Unified `AppNotification` (gap events)

Role-targeted rows via `notify()` / `notify_from_audit()`, listed at `GET /notifications/` for the current user. Existing inventory event types are skipped so they are not double-emitted.

Settings → Alerts has email toggles (project approval, assignment, maintenance, inventory, milestones) but **email is not sent**.

### Two “handover” moments

| Name in product | Event | Recipient |
|-----------------|-------|-----------|
| Stock handover (UI “Request handover”) | Developer item request | **IM only** |
| Verify handover | Dev reports installation complete | **Assigned HM** |

---

## Event matrix

Priority: `high` | `medium` | `low`.  
Status: **exists** | **partial** | **gap** | **optional**.

### 1. Projects (Specs 02–03, 09, 11)

| Event | Trigger | Recipients | Priority | Status |
|-------|---------|------------|----------|--------|
| Project created | Legacy `POST /projects/` | Admin* | medium | gap |
| Draft submitted | `POST /projects/draft/` or bulk | Admin* + PD (approval queue); assigned HM if PD created on their behalf | high | gap |
| HM assigned / reassigned | `POST /projects/{id}/assign-hm/` | New HM (high), previous HM (medium), owner/PD (low) | mixed | gap |
| Project approved | `POST /projects/{id}/approve/` (Admin or PD) | Assigned HM (high), other PDs (medium) | mixed | gap |
| Project rejected | Not in API (approve or cancel only); if added | Assigned HM + PD | high | gap |
| Project superseded | Config-change successor | Assigned HM + PD + IM | medium | gap |
| Hierarchy generated | `POST /projects/{id}/generate-hierarchy/` | Assigned HM (low, skip if actor), PD (low), IM (medium: ready for stock) | mixed | gap |
| Ready for inventory | Status after generate | IM + assigned HM | medium | gap |
| Progress updated | Spec 09 auto-recalc; milestone thresholds 25/50/75% | Assigned HM + PD | low | gap |
| Project completed / ready to deliver | Completion gate | PD + assigned HM + Admin* | high | gap |
| Project cancelled | `POST /projects/{id}/cancel/` | Assigned HM, Developers with open issue, IM (recall), PD, Admin* | high | gap |
| Project edited (non-structural) | `PUT /projects/{id}/` | Assigned HM + PD | low | gap |
| Project deleted | `DELETE /projects/{id}/` | Assigned HM + PD + Admin* | high | gap |

### 2. Customers and orders

| Event | Trigger | Recipients | Priority | Status |
|-------|---------|------------|----------|--------|
| Customer created / edited / deleted | `POST/PUT/DELETE /customers/` | Admin* + PD | medium (delete = high) | gap |
| Order created / edited / deleted | `POST/PUT/DELETE /orders/` | PD + assigned HM of linked project (if any) + Admin* | medium (delete = high) | gap |
| Order approved | Permission `approve_orders` exists; no dedicated endpoint | PD + Admin* | high | gap if implemented |

Client today infers “customer status changed” from `updated_at`; `order_updated` is unused.

### 3. Assignments and developer work (Spec 07)

| Event | Trigger | Recipients | Priority | Status |
|-------|---------|------------|----------|--------|
| Developer assigned to hierarchy node | `POST /hierarchy/{type}/{id}/assign-developer/` | That Developer | high | gap |
| Developer unassigned / reassigned | Same API | Previous Dev + new Dev | high | gap |
| Developer requests item / bulk request | `POST /item-requests/` | **IM only** | high | gap |
| Item request cancelled | Request status `cancelled` | Requesting Developer | medium | gap |
| IM issues against request | `POST /item-requests/{id}/issue/` | Requesting Developer (installer “issued” notice) + assigned HM (low) | mixed | **partial** |

### 4. Installation, test, verify (Spec 08)

| Event | Trigger | Recipients | Priority | Status |
|-------|---------|------------|----------|--------|
| Install started | `POST /item-install/.../start/` | Assigned HM | low | gap |
| Test pass | `POST /item-install/.../test/` pass | Concerned PD + assigned HM | medium | gap |
| Test fail | `POST /item-install/.../test/` fail | Concerned PD + assigned HM + IM (rework inbound) | high | gap |
| Handover requested (complete reported) | `POST /item-install/.../complete/` | Assigned HM | high | gap |
| Verify installation requested | Item on HM verification queue | Assigned HM | high | gap (same event as handover if combined) |
| Verified installed | `POST /item-verifications/{id}/verify/` | That Developer + PD (low) | medium | gap |
| Install reverted | Revert install | IM + assigned HM | medium | gap |

### 5. Inventory stock CRUD and warehouse ops

Recipients: **IM only**, unless noted. Admin* only if the actor is not IM.

| Event | Trigger | Recipients | Priority | Status |
|-------|---------|------------|----------|--------|
| Inventory added / edited / deleted | Inventory CRUD | IM | medium (delete = high) | gap |
| Instance added / deleted | Instance CRUD | IM | medium | gap |
| Import CSV/JSON | One notice with counts | IM | medium | gap |
| Export CSV/JSON | Export endpoints | IM (optional; skip if actor is IM) | low | gap |
| Out of stock | Qty hits 0 or issue blocked | IM | high | gap |
| Low stock | Optional threshold (not in product today) | IM | medium | gap |
| Auto-assembled parent inventory | Children verified | IM + assigned HM | low | gap |

### 6. Labels

| Event | Trigger | Recipients | Priority | Status |
|-------|---------|------------|----------|--------|
| Labels generated | `POST /labels/generate` | IM | low | gap |
| Labels printed / reprinted | `POST /labels/print` | IM | low | gap |
| Label deactivated / investigated / replaced | Compromise workflow | IM + Admin* | high | gap |
| Suspicious / invalid label scan | `LABEL_SUSPICIOUS_SCAN` | IM + Admin* | high | gap |

### 7. Reservation (Specs 04, 06)

| Event | Trigger | Recipients | Priority | Status |
|-------|---------|------------|----------|--------|
| Inventory reserved | Reserve API | Assigned HM (skip if actor) + IM (low) | medium | gap |
| Reservation released (manual) | Release API | IM + assigned HM | medium | gap |
| Reservation extended | Extend API | IM | low | gap |
| Idle reservation reminder (30 days) | Expiry job | Reserving HM + assigned HM | high | **exists** |
| Reservation auto-released (+7 day grace) | Expiry job | Reserving HM + assigned HM + **IM** | medium | **exists** (add IM) |

### 8. Shortage (Spec 05)

Spec 05 requires **HM and IM only**. Drop Admin* from shortage unless they opt in as subscribers.

| Event | Trigger | Recipients | Priority | Status |
|-------|---------|------------|----------|--------|
| Shortage created | Reserve miss | Assigned HM + IM | high | **exists** (also Admin* today) |
| Shortage partially fulfilled | Partial receive | Same | medium | **exists** |
| Shortage restocked / fulfilled + auto-reserved | Receive + FCFS | Assigned HM + IM | medium | **exists** |
| Shortage cancelled | `POST /projects/{id}/shortages/{id}/cancel/` or project cancel | Assigned HM + IM | low | gap |

### 9. Issue, return, inspection (Specs 07, 10)

| Event | Trigger | Recipients | Priority | Status |
|-------|---------|------------|----------|--------|
| Inventory issued to developer | Issue API | That Developer/installer | high | **exists** |
| Return requested | Return request | **IM** (today Admin/SubAdmin queue; IM should be primary) | high | **exists, retarget to IM** |
| Return accepted / rejected | Accept/reject | Requesting installer | medium / high | **exists** |
| Item removed (defect) | Rework remove | IM + assigned HM | high | gap |
| Returned to IM (rework) | Rework return | IM | high | gap (overlaps return requested) |
| Inspection started | `.../inspect/` | Assigned HM | low | gap |
| Inspection pass (reusable) | Disposition reusable | Assigned HM + that Developer | medium | gap |
| Inspection fail (repairable / scrapped) | Disposition | Assigned HM + PD (if scrapped) | high | gap |
| Repair complete | Repair-complete API | IM (ready to re-issue) | medium | gap |
| Re-issued after rework | Reissue API | That Developer | high | gap (reuse issued notice) |
| Rework cycle warning (3+ loops) | `REWORK_CYCLE_WARNING_ATTEMPTS` | Assigned HM + PD | high | gap |

### 10. Recall (Spec 11)

| Event | Trigger | Recipients | Priority | Status |
|-------|---------|------------|----------|--------|
| Recall opened | Project cancel | Each Developer with issued stock + IM | high | gap |
| Developer returned recalled item | Recall return | IM | high | gap |
| Force-return | Admin force-return | That Developer + IM | high | gap |
| Recall inspection / disposition | Inspect / disposition | Assigned HM + PD | medium | gap |

### 11. Configuration (Specs 01, 12)

**Hierarchy configuration templates (Admin CRUD):**

| Event | Recipients | Priority | Status |
|-------|------------|----------|--------|
| Config created / edited / availability toggled / deleted | Admin* only | medium | gap |

**Live project configuration change:**

| Event | Trigger | Recipients | Priority | Status |
|-------|---------|------------|----------|--------|
| Change requested | `POST /projects/{id}/config-change/` | Admin* + IM (returns incoming) | high | gap |
| Inventory returned for config change | `.../return-inventory/` | IM | high | gap |
| Change submitted | `.../submit/` | Admin* | high | gap |
| Change approved | `.../approve/` | Requesting HM + PD | high | gap |
| Change cancelled / withdrawn | `.../cancel/` | Admin* + IM | medium | gap |
| Successor project created | `.../create-project/` | Requesting HM + Admin* (source → `SUPERSEDED`) | medium | gap |

**App definitions / statuses / entity catalog CRUD:** Admin* only — low — gap (optional; noisy).

### 12. Users, roles, security

| Event | Recipients | Priority | Status |
|-------|------------|----------|--------|
| User created (admin create) | Admin* only | medium | gap |
| Public signup (inactive Viewer awaiting activation) | Admin* | high | gap |
| User activated / deactivated | That user (activation) + Admin* | medium | gap |
| User edited / deleted | Admin* | medium / high | gap |
| Role assigned / removed | That user + Admin* | medium | gap |
| Role / permission CRUD | Admin* only | medium | gap |
| Password / security settings changed | That user; Admin* if admin reset | low | gap |
| Session terminated / inactivity lockout | That user + Admin* | medium | gap |

### 13. Reports

Do **not** notify on report *view*. Notify only generation/export of durable artifacts.

Report types: `build_history_dossier`, `maintenance_history_dossier`, `hierarchy`, `inventory`, `maintenance`, `executive`.

| Event | Recipients | Priority | Status |
|-------|------------|----------|--------|
| Build history dossier generated | Assigned HM + PD of that project | low | gap |
| Maintenance history dossier generated | Case owner / maintenance-capable Admin* | low | gap |
| Executive / hierarchy / inventory / maintenance exported | Actor confirmation (optional) + Admin* audit ping | low | gap |
| Report register `POST /reports/register` | Admin* (audit) | low | optional |

### 14. Maintenance

Today these are **client-inferred and not role-filtered**. They should become persisted, role-scoped notices.

| Event | Recipients | Priority | Status |
|-------|------------|----------|--------|
| Case opened | Maintenance + assigned HM of related project | high | gap (client-derived) |
| Fault identified / suspected / confirmed / under inspection | Maintenance + HM | medium / high | gap (client-derived) |
| Case resolved / closed | Opener + HM | low | gap (client-derived) |
| Fault cascade / children suspected | Maintenance + HM | high | gap (client-derived) |
| Delivery created / confirmed | Maintenance + PD | medium | gap |

### 15. System

| Event | Recipients | Priority | Status |
|-------|------------|----------|--------|
| Backup created / restore run | Admin* | high | gap |
| Database / settings change | Admin* | medium | gap |

---

## Recipient cheat-sheet

- **Admin / SubAdmin only:** user CRUD, role CRUD, signup pending, hierarchy-config template CRUD, backup/restore, optional report audit
- **IM only:** stock CRUD, import/export, labels, issue **requests**, inspection queue, out-of-stock, most warehouse events
- **Assigned HM:** draft/approve/progress/hierarchy of *their* project, shortage, reservation expiry, verify/handover queue
- **PD:** draft awaiting approval, HM assignment, project approval/completion/cancel/supersede, **install pass/fail**, config-change approved, project deleted (prefer `owner_id` when that user is PD)
- **Developer / installer:** assigned work, issued stock, return decision, re-issue, recall return required, verified result
- **Never:** Viewer, unrelated HM/IM/PD, or the actor (except “issued to you” / “account activated”)

---

## Business rules

1. One persisted row per (event, recipient). Shared queues (return notices) must become per-user or be listed only for IM.
2. Shortage recipients = assigned HM + IM (Spec 05). Admin* is optional subscriber, not default.
3. Auto-release (Spec 06) must also notify IM so released stock is visible in the warehouse feed.
4. Return-requested notices go to IM as primary; installer receives only the decision.
5. Combine “complete reported” and “verify requested” into one HM notice if both fire on the same action.
6. Progress notices fire on **milestone thresholds**, not every `updated_at`.

---

## Functional requirements

### Backend

1. Unified `AppNotification` with `event_type`, `user_id`, `priority`, `title`, `message`, `href`, `read_at`, `created_at`.
2. Emit gap events from workflow services / `WorkflowAuditAction`. Skip event types already covered by specialized inventory tables.
3. Recipient resolver per event type using the matrix above.
4. Keep existing inventory notice APIs; `GET /notifications/` is scoped to the current user and is merged in the bell with inventory feeds.

### Frontend

1. Bell and `/notifications` read persisted, role-targeted notices (unified + existing inventory tables).
2. Stop client-inferred project/customer/maintenance noise.
3. Settings → Alerts remain channel preferences (in-app now; email later).

---

## Acceptance criteria

- [x] Matrix in this spec is the source of truth for who is notified.
- [x] No event in the matrix broadcasts to all users with `view_notifications`.
- [x] Existing inventory notices remain listed with their coverage status.
- [x] Spec index lists this file as Spec 14.

---

## Test checklist (when implementing)

1. As IM: see issue requests and shortages; do **not** see user-created notices.
2. As assigned HM: see verify/handover and shortage for own project; not another HM’s project.
3. As Developer: see “issued to you” and assignment; do **not** see Admin user CRUD.
4. As Admin: see signup pending and user CRUD; shortage only if opted in.
5. As PD: see install pass/fail and draft awaiting approval for concerned projects.
6. Actor who performs an action does not receive that event (except confirmation types).

---

## Handoff

Specialized inventory notice tables stay in place. Gap events persist as `AppNotification` rows. The frontend bell merges both feeds and no longer infers notices from recently updated projects, customers, or maintenance cases.
