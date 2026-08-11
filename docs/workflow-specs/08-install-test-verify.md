# Spec 08 — Installation, Testing & Verification

**Sequence:** 08 of 13  
**Workflow source:** Page 04 — Section 5 (steps 5.1–5.6)  
**Depends on:** Spec 07 (item at Issued / Installation in Progress)

---

## Goal

Developer installs and tests the item. On **Pass**, Dev reports installation complete and HM verifies. Only after testing + HM verification does status become **`INSTALLED_VERIFIED`**. On **Fail**, divert to Defect/Rework (Spec 10).

---

## Actors

| Actor | Actions |
|-------|---------|
| Developer | Install; test/inspect; Pass/Fail; report complete on Pass |
| HM | Verify installation after Dev reports complete |
| System | Status transitions; (progress update consumed in Spec 09) |

---

## In scope

1. Dev records installation activity.
2. Dev records test/inspect outcome **Pass** or **Fail**.
3. Pass path: report installation complete → HM verifies → `INSTALLED_VERIFIED`.
4. Intermediate status **`UNDER_TESTING_REVIEW`** when under test/review (align Overview status chain).
5. Fail path handoff: status/event that Spec 10 starts from (FAIL → Section 6.2).
6. Enforcement: **`INSTALLED_VERIFIED` only after testing + HM verification**.

---

## Out of scope

- Full weighted progress dashboard math (Spec 09) — emit events only
- Complete defect/repair loop (Spec 10)
- Project completion gate UI polish may wait for Spec 09

---

## Detailed flow

```
[from 4.5 Installation in Progress]
        ↓
5.1 Developer installs item
        ↓
5.2 Developer tests / inspects
        ↓
5.3 Test result?
    ├─ Pass → 5.4 Dev reports installation complete
    │              ↓
    │         5.5 HM verifies
    │              ↓
    │         5.6 Status → INSTALLED VERIFIED
    │             (only after testing + HM verification)
    │
    └─ Fail → go to Section 6.2 (Defect/Rework) — Spec 10
```

### Status chain (pass)

```
INSTALLATION_IN_PROGRESS → UNDER_TESTING_REVIEW → (complete reported) → INSTALLED_VERIFIED
```

HM verification is the gate into terminal `INSTALLED_VERIFIED`.

---

## Business rules

1. Only assigned Developer (or authorized role) may mark install/test for that item.
2. Fail **must not** reach `INSTALLED_VERIFIED`.
3. HM cannot force verified without Dev completion report (unless explicit superuser exception—default no).
4. Pass requires both: Dev report complete **and** HM verify.
5. All transitions automatic from recorded events; avoid free-form status editing.

---

## Functional requirements

### Backend

1. APIs:
   - Start/complete install  
   - Submit test result Pass/Fail  
   - Report installation complete  
   - HM verify  
2. Status transitions per Spec 00.
3. On Fail: mark defect pending / open rework ticket hook for Spec 10.
4. Permission: `item.install_test`, `item.verify`.

### Frontend

1. Dev workspace: Install / Test Pass-Fail / Report complete.
2. HM verification queue.
3. Clear status display; disable verify until complete reported.
4. On Fail, deep-link/guidance into rework (Spec 10 UI may be stub until built).

---

## Acceptance criteria

- [ ] Pass path ends in `INSTALLED_VERIFIED` only after HM verify.
- [ ] Skipping HM verify cannot set verified.
- [ ] Fail never sets verified; triggers rework entry condition.
- [ ] Status under testing visible while Dev tests/reviews.
- [ ] Non-assigned Dev blocked from acting on item.

---

## Test checklist

1. Happy path pass + verify.
2. HM verify before Dev complete → rejected.
3. Fail path creates rework precondition record.
4. Status history shows event order.

---

## Handoff to next (Spec 09)

Each reach of `INSTALLED_VERIFIED` (and intermediate lifecycle events) must feed **automatic weighted progress** for Product Type → Flight → SDLS → … tree.