# Spec 10 — Defect / Rework Loop

**Sequence:** 10 of 13  
**Workflow source:** Page 05 — Section 6 (steps 6.1–6.10 + loop)  
**Depends on:** Spec 08 (fail path entry); Spec 07 issue/re-issue patterns; Spec 00 return statuses

---

## Goal

When an installed item fails test or a defect is found: remove and return to IM, inspect, repair or replace, re-issue to Developer, re-install and re-test, HM verify; loop until success ends in **`INSTALLED_VERIFIED`**.

---

## Actors

| Actor | Actions |
|-------|---------|
| Developer | Remove after fail; re-install; re-test |
| IM | Receive return; inspect; repair/replace support; re-issue |
| HM | Verify after successful retest path |
| System | Status tracking; loop control |

---

## In scope

1. Entry from Spec 08 Fail (6.2).
2. Full loop:
   - 6.1 Item installed → 6.2 Fails test / defect found  
   - 6.3 Item removed  
   - 6.4 Returned to IM  
   - 6.5 IM inspects  
   - 6.6 Repaired or replaced  
   - 6.7 Re-issued to Developer  
   - 6.8 Developer re-installs  
   - 6.9 Re-tested / inspected  
   - 6.10 HM verifies & updates status  
3. Decision: **Fails again?** → Yes loop to 6.2; No → `INSTALLED_VERIFIED`.
4. Use statuses: `RETURNED`, `INSPECTION`, disposition (`REPAIRABLE` / replace as new issue unit / scrap path as needed), then back through issue/install/test.

---

## Out of scope

- Project-wide recall on cancel (Spec 11)
- Configuration change mass return (Spec 12)
- Vendor RMA external systems

---

## Detailed flow

```
6.1 Item installed
      ↓
6.2 Fails test / defect found
      ↓
6.3 Item removed
      ↓
6.4 Returned to IM
      ↓
6.5 IM inspects
      ↓
6.6 Repaired or replaced
      ↓
6.7 Re-issued to Developer
      ↓
6.8 Developer re-installs
      ↓
6.9 Re-tested / inspected
      ↓
6.10 HM verifies & updates status
      ↓
   Fails again?
    ├─ Yes → loop to 6.2
    └─ No  → INSTALLED VERIFIED
```

---

## Business rules

1. Fail after install/test cannot remain `INSTALLED_VERIFIED`.
2. Physical return recorded as `RETURNED` then `INSPECTION`.
3. **Repair**: same serial may re-enter issue after repair.  
   **Replace**: new serial issued; defective unit dispositioned (repairable/scrapped).
4. Re-issue reuses Spec 07 issue rules (signature, status `ISSUED`…); may skip re-reserve if still project-bound—define: rework retains project allocation.
5. Loop may run unbounded until Pass+HM verify or hierarchical escalate (optional max cycle warning).
6. Progress (Spec 09): node not counted verified during open rework; restored only after new verify.
7. Overview path reusable/repairable/scrapped applies from inspection outcomes when item will not re-issue immediately.

---

## Functional requirements

### Backend

1. Open defect / rework case linked to hierarchy node + inventory unit.
2. Transitions: remove, return, inspect, disposition, re-issue.
3. Reuse issue APIs with `rework=true` or re-issue endpoint.
4. Close rework only on HM verify success.
5. History of loop iterations (attempt count).

### Frontend

1. Fail action from Spec 08 opens rework wizard.
2. IM queues: returned units, inspect form, disposition.
3. Re-issue + Dev re-install/test screens (reuse Spec 07/08 UI with rework context).
4. Show attempt history and current loop stage.

---

## Acceptance criteria

- [ ] Fail creates rework and prevents verified state.
- [ ] Full loop can complete to `INSTALLED_VERIFIED`.
- [ ] Second fail re-enters loop at 6.2 without losing history.
- [ ] Replace creates issue against new serial; old serial correctly dispositioned.
- [ ] Progress excludes unverified rework nodes.

---

## Test checklist

1. Pass path after one rework.
2. Double fail loop.
3. Scrap disposition cannot re-issue that serial.
4. Signature required on re-issue.

---

## Handoff to next (Spec 11)

Separate path when **project is cancelled**: recall all issued items, IM inspects, reusable/repairable/scrapped—not continuous rework for active install.