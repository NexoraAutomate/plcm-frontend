# Hierarchy & Inventory Management Workflow — Spec Index

**Source:** `Final - Workflow.drawio` (pages 01–06)  
**Purpose:** Individual, sequential feature specs for one-by-one implementation and test.  
**Rule:** Implement and test the current spec fully before starting the next.

**Progress:** Spec 00 and Spec 01 are implemented. Next: Spec 02 (project create & approve).

---

## Implementation order

| Seq | Spec file | Workflow origin | Can ship alone? |
|-----|-----------|-----------------|-----------------|
| 00 | [00-roles-status-foundations.md](./00-roles-status-foundations.md) | Overview + page 06 roles + inventory status model | Yes — foundation only |
| 01 | [01-hierarchy-configuration.md](./01-hierarchy-configuration.md) | Page 02 — Section 1 | Yes |
| 02 | [02-project-creation-approval.md](./02-project-creation-approval.md) | Page 02 — Section 2 (2.1–2.3) | Yes |
| 03 | [03-hierarchy-generation.md](./03-hierarchy-generation.md) | Page 02 — Section 2 (2.4–2.6) | Yes |
| 04 | [04-inventory-reservation.md](./04-inventory-reservation.md) | Page 03 — Section 3 (happy path) | Yes |
| 05 | [05-shortage-handling.md](./05-shortage-handling.md) | Page 03 — Section 3 (shortage branch) | Yes |
| 06 | [06-reservation-expiry.md](./06-reservation-expiry.md) | Page 03 — side process | Yes |
| 07 | [07-issue-to-developer.md](./07-issue-to-developer.md) | Page 04 — Section 4 | Yes |
| 08 | [08-install-test-verify.md](./08-install-test-verify.md) | Page 04 — Section 5 | Yes |
| 09 | [09-project-progress-calculation.md](./09-project-progress-calculation.md) | Page 04 — Section 5A | Yes |
| 10 | [10-defect-rework-loop.md](./10-defect-rework-loop.md) | Page 05 — Section 6 | Yes |
| 11 | [11-inventory-recall.md](./11-inventory-recall.md) | Page 05 — recall side process | Yes |
| 12 | [12-configuration-change.md](./12-configuration-change.md) | Page 02 — CC workflow | Yes |
| 13 | [13-audit-trail.md](./13-audit-trail.md) | Page 06 — Section 7 | Last full UX; hooks noted earlier |

---

## End-to-end flow (from Overview)

```
1. Hierarchy Configuration (Admin)
        ↓
2. Project Create (HM)
        ↓
3. Project Approval (PD / Admin)
        ↓
4. Inventory Reservation & Shortage (HM / IM)
        ↓
5. Issue to Developer (HM / Dev / IM)
        ↓
6. Install / Test / Verify (Dev / HM)
        ↓
7. Defect / Rework  ⟷  retest  |  or Recall on cancel
        ↓
8. Audit Trail (system-wide, all steps above)

```

### Happy-path inventory status chain

```
Available → Reserved → Issued → Installation in Progress
  → Under Testing / Review → Installed Verified
```

### Return / inspection branch

```
Issued (or later) → Returned → Inspection
  → Reusable (back to Available)
  → Repairable
  → Scrapped
```

---

## Roles (used in every later spec)

| Code | Role | High-level responsibility |
|------|------|---------------------------|
| Admin | Administrator | Hierarchy configs; approve projects; approve config changes |
| PD | Project Director | Assign projects to HM; cancel project / trigger recall |
| HM | Hierarchy Manager | Draft project; select config; generate hierarchy; reserve; assign Dev; verify |
| IM | Inventory Manager | Stock receipt; issue + signature; inspection; shortage fulfill |
| Dev | Developer | Request item; install; test (Pass/Fail); report complete |

---

## How to use each spec

1. Confirm **Prerequisites** are already implemented and tested.
2. Implement only items in **In scope**.
3. Verify **Acceptance criteria** (including negative paths).
4. Check **Out of scope** — do not pull next-spec work forward.
5. Note **Handoff to next** for what the following phase needs.

---

## Spec template (all files follow)

- Goal & workflow source  
- Actors  
- Prerequisites  
- In scope / Out of scope  
- Detailed flow  
- Business rules  
- Status / data changes  
- Functional requirements (backend + frontend)  
- Acceptance criteria  
- Test checklist  
- Handoff to next  
