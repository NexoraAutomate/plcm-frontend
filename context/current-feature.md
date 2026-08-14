# Current Feature: Reservation Expiry (Deadlock Prevention)

## Status

In Progress

## Goals

- Scan `RESERVED` inventory that has sat idle with no issue/use
- After idle 30 days, send a reminder to the reserving HM
- After a further 7-day grace with no response, auto-release back to `AVAILABLE`
- Record `Last Reminder` on remind; close the reservation with reason `AUTO_RELEASE_EXPIRY`
- Do not expire items already `ISSUED` or later in the lifecycle
- Keep Spec 04 manual release available before expiry
- Released stock can be reserved by another project
- Timing constants (30 + 7 days) are configurable for tests
- Reservation UI shows expiry/countdown, last reminder, and auto-release history
- Inventory serials show status Reserved while held by HM; click opens flight / SDLS / system details
- IM Issue to developer stays available on reserved serials (physical handover)

## Notes

- Depends on Spec 04 reserved records (dates, reminder, extension count)
- Out of scope: issue/install (Specs 07–08); changing 30+7 policy without product approval (configurable constants OK)
- Backend: scheduled job, in-app reminder (email optional), auto-release via Spec 04 release with system actor, idempotent (respect Last Reminder)
- Frontend: expiry/countdown, last reminder date, historical auto-released rows; inventory serial Reserved status + hold dialog (flight/system)
- Optional: extension increments `Extension Count` and delays expiry (diagram emphasizes expiry)
- Idle = no further lifecycle progress (not issued/used)
- Source path: `docs/workflow-specs/06-reservation-expiry.md`

## History

<!-- Completed features (append only) -->

### Shortage Handling & FCFS Auto-Reserve
Spec 05: create shortages on unavailable reserve, notify HM and IM (PN, Qty, Flight, SDLS, LRU), keep an open list, and FCFS auto-reserve on IM receipt into Spec 04 `RESERVED` lock. Partial receipts decrement remaining qty; auto-reserve is audited as shortage fulfillment.
