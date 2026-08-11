# Spec 05 — Shortage Handling & FCFS Auto-Reserve

**Sequence:** 05 of 13  
**Workflow source:** Page 03 — Section 3 steps 3.5–3.8 (No branch + FCFS path)  
**Depends on:** Spec 04

---

## Goal

When stock is insufficient, notify HM & IM, track shortage until IM receives inventory, then **auto-remove shortage and reserve** for the waiting Flight → SDLS demand on a **first-come-first-reserved** basis.

---

## Actors

| Actor | Actions |
|-------|---------|
| System | Detect short item; notify; auto-reserve on receipt using FCFS |
| HM | Receives shortage notifications; may retry reservation once stock appears |
| IM | Enters received Part Number / Serial Number into inventory |

---

## In scope

1. On unavailable item during reserve attempt: create **shortage** entries.
2. Notify HM and IM of short items with: **Part Number, Qty, Flight, SDLS, LRU** (hierarchy item).
3. Maintain active shortage list while waiting for stock.
4. IM receives goods into inventory (`AVAILABLE` after receipt).
5. Auto-remove matching shortages and **auto-reserve** for waiting demand FCFS.
6. Path that lands in Spec 04 reservation lock state after auto-reserve.

---

## Out of scope

- Reservation expiry / idle auto-release (Spec 06)
- Purchase order / procurement external system (only “wait until inventory becomes available”)
- Issue flow (Spec 07)

---

## Detailed flow

```
3.2 Item available?  ──No──►
3.5 Notify HM & IM of short items
    (Part Number, Qty, Flight, SDLS, LRU)
        ↓
3.6 Wait until required inventory becomes available
        ↓
3.7 IM enters received Part Number / Serial Number
    in Inventory Management System
        ↓
3.8 Auto-remove from shortage list & reserve for Flight → SDLS
    on first-come-first-reserved basis
        ↓ (FCFS auto-reserve)
3.3 / 3.4 Normal reservation lock applies
```

---

## Business rules

1. **FCFS:** shortage (or reservation request) timestamps determine which project/Flight/SDLS gets stock first when units arrive.
2. On receipt, system matches part numbers (and qty) to open shortage demand; does not require HM to re-click reserve for matched auto path.
3. Notifications must include Part Number, Qty, Flight, SDLS, LRU/hierarchy item.
4. Partial receipt fulfills partial qty; remainder stays short.
5. Status: received unit may briefly be `AVAILABLE` then immediately `RESERVED` for winner on FCFS; or reserve atomically on receipt.
6. Audit-friendly: record why auto-reserve occurred (shortage fulfillment).

---

## Data model (shortage)

| Field | Notes |
|-------|-------|
| Part number | Required |
| Qty short | Remaining |
| Project / Flight | Required |
| SDLS | Required |
| Hierarchy item / LRU ref | Required |
| Requested by HM | From original reserve |
| Requested at | FCFS key |
| Status | OPEN / PARTIAL / FULFILLED / CANCELLED |
| Last notified at | Optional |

---

## Functional requirements

### Backend

1. Shortage create on failed reserve or partial reserve shortfall.
2. Notification channel (in-app minimum; email optional if already supported).
3. On inventory receipt API: after stock available, run **FCFS matcher**.
4. Matcher reserves (Spec 04 service) and closes short qty.
5. List/filter shortage endpoints for IM and HM.

### Frontend

1. Shortage list views (HM: my projects; IM: all open).
2. Notification surface (toast/bell) with required fields.
3. IM inventory receive UI triggers auto-reserve backend path.
4. After FCFS, project reservation list updates without manual refresh issues (poll/refetch).

---

## Acceptance criteria

- [ ] Reserve when stock 0 creates shortage + notifies HM & IM.
- [ ] Notification payload includes PN, Qty, Flight, SDLS, LRU.
- [ ] Two waiting shortages for same PN: earlier request gets first received unit.
- [ ] Auto-reserve sets unit `RESERVED` and links Flight/SDLS.
- [ ] Shortage qty decrements / closes correctly.
- [ ] Second project does not steal stock assigned by FCFS to first.

---

## Test checklist

1. Project A short at T0, Project B short at T1; IM receives 1 unit → only A reserved.
2. Receive 2 units; both A and B fulfilled if each needed 1.
3. Cancel project shortage (if UI supports cancel) stops auto-reserve.
4. Wrong PN receipt does not clear unrelated shortage.

---

## Handoff to next (Spec 06)

Reserved stock may sit unused. Spec 06 prevents deadlock via idle reminder + grace + auto-release.