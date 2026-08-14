# Current Feature: Shortage Handling & FCFS Auto-Reserve

## Status

In Progress

## Goals

- Create shortage entries when a reserve attempt finds an unavailable item (including partial shortfall)
- Notify HM and IM with Part Number, Qty, Flight, SDLS, and LRU/hierarchy item
- Keep an active shortage list until stock arrives
- On IM receipt (`AVAILABLE`), auto-remove matching shortages and auto-reserve waiting demand FCFS
- After auto-reserve, land in Spec 04 reservation lock (`RESERVED`, linked to Flight/SDLS)
- FCFS: earlier shortage timestamp wins when two projects wait on the same PN
- Partial receipt fulfills partial qty; remainder stays OPEN/PARTIAL
- Audit why auto-reserve happened (shortage fulfillment)

## Notes

- Depends on Spec 04 reservation service
- Out of scope: reservation expiry (Spec 06), procurement/PO, issue flow (Spec 07)
- Backend: shortage create, in-app notify, FCFS matcher on receipt API, list/filter endpoints
- Frontend: HM/IM shortage lists, notification surface, receive UI triggers matcher, refetch reservation list
- Data: PN, qty short, Flight, SDLS, LRU, requested by/at, status OPEN/PARTIAL/FULFILLED/CANCELLED
- Source path: `docs/workflow-specs/05-shortage-handling.md`

## History

<!-- Completed features (append only) -->
