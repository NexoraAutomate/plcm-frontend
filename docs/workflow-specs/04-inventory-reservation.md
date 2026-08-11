# Spec 04 — Inventory Reservation (Happy Path)

**Sequence:** 04 of 13  
**Workflow source:** Page 03 — Section 3 steps 3.1–3.4 (Yes branch)  
**Depends on:** Spec 03; stock items exist as `AVAILABLE` (existing inventory capability)

---

## Goal

HM reserves available inventory against the project hierarchy (**Flight → SDLS → hierarchy items**). Reserved stock is **locked** until used, released, or auto-released (expiry in Spec 06).

---

## Actors

| Actor | Actions |
|-------|---------|
| HM | Initiate reservation against Flight/SDLS/hierarchy nodes |
| System | Check availability; lock stock; set item status `RESERVED` |
| IM | Indirect stakeholder (notified in shortage Spec 05 only) |

---

## In scope

1. Availability check for required hierarchy items / part numbers.
2. On available: reserve inventory for HM against Flight → SDLS → hierarchy items.
3. Status: items become `RESERVED` and locked.
4. Persist reservation record metadata (see data fields).
5. Manual release of reservation (HM) back to `AVAILABLE` if allowed before issue.

---

## Out of scope

- Shortage notification and FCFS wait list (Spec 05)
- Expiry reminders and auto-release job (Spec 06)
- Issue to developer (Spec 07)

---

## Detailed flow (happy path)

```
3.1 System checks inventory availability for all required hierarchy items
        ↓
3.2 Item (x) available in Inventory?
        ↓ Yes
3.3 Reserve inventory for HM against Flight(s) → SDLS(s) → hierarchy items
        ↓
3.4 Inventory reserved against Flight → SDLS and locked
    until used / released / auto-released
```

### Status change

```
AVAILABLE → RESERVED
```

---

## Reservation record (from diagram note)

| Field | Required |
|-------|----------|
| Flight / Project No. | Yes |
| SDLS | Yes |
| Hierarchy item reference (system/module/unit/component as applicable) | Yes |
| Reserved By (HM) | Yes |
| Part Number / Serial Number | Yes when serialised |
| Reserved Date | Yes |
| Expiry Date | Yes (default policy; Spec 06 uses idle 30 days) |
| Last Reminder | Nullable |
| Extension Count | Default 0 |

---

## Business rules

1. Only projects in `READY_FOR_INVENTORY` (or post-hierarchy statuses not cancelled) can reserve.
2. Reservation scope is **Flight → SDLS → item**, not free-floating stock hold without project context.
3. Reserved quantity is not available for other projects’ reservations.
4. Item status must transition only via Spec 00 matrix: `AVAILABLE` → `RESERVED`.
5. Soft lock must prevent issue to wrong project or re-reservation elsewhere.
6. Partial reserve: if some items available and some not, Available ones may reserve; short ones go Spec 05 (caller flow can be batch). For this spec, focus on all-available path; partial may defer shortages list to Spec 05.

---

## Functional requirements

### Backend

1. Reserve API(s): single item and/or batch for hierarchy requirements.
2. Availability query by part number / inventory unit against free `AVAILABLE` stock.
3. Create reservation ledger row; update inventory/unit status to `RESERVED`.
4. Release API: HM can release unused reservation → `AVAILABLE`.
5. Permission: `inventory.reserve`, `inventory.release`.

### Frontend

1. Project hierarchy UI: Reserve action on reservable nodes.
2. Show reserved badge, reserved-by, expiry.
3. List reservations for project / for HM.
4. Release reservation action with confirm.

---

## Acceptance criteria

- [ ] Available unit can be reserved for a specific Flight/SDLS hierarchy node.
- [ ] Same unit cannot be reserved twice / by another project.
- [ ] Reservation metadata fields stored as specified.
- [ ] Item shows status `RESERVED`.
- [ ] HM can release before issue → `AVAILABLE`.
- [ ] Project not ready for inventory cannot reserve.

---

## Test checklist

1. Two projects compete for one unit → second fails.
2. Reserve three units for Flight-1 / SDLS-2 successfully.
3. Release restores availability for others.
4. Serial-tracked units reserve by serial, not anonymous qty only.

---

## Handoff to next (Spec 05)

When required item **not** available: notify HM & IM, create shortage row, wait for receipt, FCFS auto-reserve.