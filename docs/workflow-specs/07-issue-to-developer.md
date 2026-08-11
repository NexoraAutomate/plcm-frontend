# Spec 07 — Issue Inventory to Developer

**Sequence:** 07 of 13  
**Workflow source:** Page 04 — Section 4 (steps 4.1–4.5)  
**Depends on:** Spec 04 (item `RESERVED` against hierarchy)

---

## Goal

HM assigns hierarchy work to a Developer; Developer requests the item; IM issues inventory with signature; system auto-updates status to **`ISSUED`**, then after **24 hours** auto-updates to **`INSTALLATION_IN_PROGRESS`**.

---

## Actors

| Actor | Actions |
|-------|---------|
| HM | Assign hierarchy item (module/subsystem/unit/…) to a Developer |
| Developer | Request the item from IM |
| IM | Issue inventory with signature (hard copy or digital) |
| System | Auto status: `ISSUED` → after 24h → `INSTALLATION IN PROGRESS` |

---

## In scope

1. HM assignment of hierarchy node to Developer.
2. Developer request-to-issue workflow against assigned/reserved item.
3. IM issue action with signature capture (digital mandatory; hard-copy flag optional).
4. Status auto-update to `ISSUED` on successful issue.
5. Scheduled/auto transition after 24 hours to `INSTALLATION_IN_PROGRESS`.
6. Note from diagram: **all status changes in this section are automatic** after issue (no manual status toggle for the 24h step).

---

## Out of scope

- Pass/fail testing and HM verify complete (Spec 08)
- Defect return loop (Spec 10)
- Weighted project progress (Spec 09)

---

## Detailed flow

```
4.1 HM assigns hierarchy item (module/subsystem/unit/…) to a Developer
        ↓
4.2 Developer requests the item from IM
        ↓
4.3 IM issues inventory with signature (hard copy or digital)
        ↓
4.4 Status auto-updates to ISSUED
        ↓ (+24h auto)
4.5 Status auto-updates to INSTALLATION IN PROGRESS
```

### Status chain

```
RESERVED → ISSUED → INSTALLATION_IN_PROGRESS (+24h)
```

---

## Business rules

1. Issue only for items **reserved to the same project/hierarchy** being assigned.
2. Signature is required to complete issue (digital signature or “hard copy confirmed” attestation).
3. Status `ISSUED` is automatic on issue success—operators do not manually set it.
4. 24-hour timer starts at issue timestamp.
5. After 24h, system sets `INSTALLATION_IN_PROGRESS` automatically even if Dev has not clicked install yet (per diagram).
6. Developer on assignment must be an app user (role Dev or any permitted user selected as assignee—follow product decision; diagram labels role Developer).

---

## Data model (issuance)

| Field | Notes |
|-------|-------|
| Hierarchy node id | Assigned work item |
| Developer user id | Assignee / requester |
| Inventory unit / serial | Issued unit |
| Project / Flight / SDLS | Context |
| Issued by IM | User id |
| Signature type | DIGITAL / HARD_COPY |
| Signature payload or acknowledgment | Required |
| Issued at | Timer start |
| Status | ISSUED / … |

---

## Functional requirements

### Backend

1. Assign developer to hierarchy node API (`hierarchy.assign_developer`).
2. Developer request API (`item.request`) — creates issue request queue for IM.
3. IM issue API with signature (`inventory.issue`).
4. Transition `RESERVED` → `ISSUED` atomically with ledger.
5. Job: every hour/minute marks issuances older than 24h → `INSTALLATION_IN_PROGRESS`.
6. Permissions for HM/Dev/IM accordingly.

### Frontend

1. HM assign-dev dialog on hierarchy item.
2. Dev “Request item” action.
3. IM issue queue with signature pad / acknowledge hard copy.
4. Show status badges ISSUED and INSTALLATION IN PROGRESS.
5. No manual dropdown to set those status values in happy path.

---

## Acceptance criteria

- [ ] Dev cannot obtain stock without HM assignment path + IM issue.
- [ ] Issue without signature blocked.
- [ ] On issue: status `ISSUED`, reservation consumed into issuance context.
- [ ] After 24h clock: status becomes `INSTALLATION_IN_PROGRESS` without user action.
- [ ] Other project cannot issue the same reserved unit.

---

## Test checklist

1. Full path assign → request → issue with signature.
2. Timer test: mock issued_at -25h → job flips status.
3. Reject issue if not reserved to this hierarchy.
4. Audit-friendly fields recorded for Spec 13.

---

## Handoff to next (Spec 08)

From `INSTALLATION_IN_PROGRESS` (or during install work), Developer installs, tests, reports complete; on fail go to Spec 10.