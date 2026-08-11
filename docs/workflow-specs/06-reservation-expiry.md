# Spec 06 — Reservation Expiry (Deadlock Prevention)

**Sequence:** 06 of 13  
**Workflow source:** Page 03 — Side process “Reservation Expiry”  
**Depends on:** Spec 04 (reserved records with dates)

---

## Goal

Prevent perpetual stock lockups when HM reserves inventory and then goes idle: **reminder after idle 30 days**, then **+7 day grace**, then **auto-release** back to stock (`AVAILABLE`).

---

## Actors

| Actor | Actions |
|-------|---------|
| System | Detect idle reservations; remind; auto-release |
| HM | Receives reminder; may use stock, extend (if allowed), or accept release |
| IM | Benefits from stock returning to available pool |

---

## In scope

1. Job/schedule that scans `RESERVED` inventory idle per policy.
2. Timeline:
   - Reserved
   - Idle **30 days**
   - Reminder → HM
   - If no response: **+7 day grace**
   - Auto-release back to stock → `AVAILABLE`
3. Update fields: `Last Reminder`, clear reservation linkage on auto-release.
4. Optional: extension mechanism increments `Extension Count` and delays expiry (if product wants; diagram emphasizes expiry — document extension as optional).

---

## Out of scope

- Issue / install lifecycle (Specs 07–08)
- Changing the 30 + 7 day policy without product approval (configurable constants OK)

---

## Detailed flow

```
Reserved
   ↓
Idle 30 days
   ↓
Reminder → HM
   ↓
No response
   ↓
+7 day grace
   ↓
Auto-release back to stock (AVAILABLE)
```

---

## Business rules

1. Idle means no further lifecycle progress (not issued/used) for the reservation period.
2. Reminder must go to reserving HM (and optionally project stakeholders).
3. After total idle/grace window elapses with no issue/extension → auto-release.
4. Auto-release:
   - Status `RESERVED` → `AVAILABLE`
   - Reservation record closed with reason `AUTO_RELEASE_EXPIRY`
   - Stock free for Spec 04/05 again
5. Items already `ISSUED` or beyond are **not** expired by this process.
6. Manual release (Spec 04) remains allowed earlier.

### Default timing constants

| Parameter | Default |
|-----------|---------|
| Idle before reminder | 30 days |
| Grace after reminder | 7 days |
| Total before release | ~37 days unless extension |

Make values configurable (settings/env) for testability.

---

## Functional requirements

### Backend

1. Scheduled job (cron / worker) evaluation of reservations.
2. Reminder sender (in-app + optional email).
3. Auto-release service reusing Spec 04 release, with system actor.
4. Idempotent: re-running job does not double-notify excessively (respect Last Reminder).
5. Tests with time frozen / short intervals in test profile.

### Frontend

1. Reservation shows expiry / countdown.
2. Show last reminder date.
3. History note when auto-released (list may show historical rows).

---

## Acceptance criteria

- [ ] Reservation idle past policy receives reminder to HM.
- [ ] Further no-response through grace → auto-released to `AVAILABLE`.
- [ ] Issued items are not auto-released by this job.
- [ ] Released stock can be reserved by another project.
- [ ] Last Reminder and closed reservation reason recorded.

---

## Test checklist

1. Time-travel tests for day 0 / day 30 / day 37.
2. Partially progressed (ISSUED) reservation excluded.
3. Extension (if implemented) resets or prolongs timer and increments Extension Count.
4. Multiple reservations evaluated independently.

---

## Handoff to next (Spec 07)

Valid non-expired `RESERVED` stock can be issued to a Developer after HM assignment and Dev request.