# Implementation Roadmap — One Spec at a Time

Use this checklist while shipping. Mark each row only after **implementation + test** pass for that spec.

| Done | Seq | Spec | Suggested test focus before next |
|------|-----|------|----------------------------------|
| ☑ | 00 | Roles & status foundations | Transition matrix unit tests; 5 role users |
| ☑ | 01 | Hierarchy configuration | Admin creates SSDLS-1/2 configs |
| ☐ | 02 | Project create & approve | Draft blocked; Admin approve enables gate |
| ☐ | 03 | Hierarchy generation | Tree counts match scope; ready for inventory |
| ☐ | 04 | Inventory reservation | AVAILABLE→RESERVED lock |
| ☐ | 05 | Shortage & FCFS | Notify + receipt auto-reserve order |
| ☐ | 06 | Reservation expiry | Reminder 30d + grace 7d + auto-release |
| ☐ | 07 | Issue to developer | Signature + ISSUED + 24h install-in-progress |
| ☐ | 08 | Install / test / verify | Pass→verified; Fail blocks verified |
| ☐ | 09 | Progress calculation | Weighted rollup; no manual % |
| ☐ | 10 | Defect / rework | Full loop to verified |
| ☐ | 11 | Inventory recall | Cancel dispositions |
| ☐ | 12 | Configuration change | No in-place edit; new project path |
| ☐ | 13 | Audit trail | Immutable logs for all prior actions |

## Recommended mini E2E after each major block

| After | Mini E2E |
|-------|----------|
| 03 | Admin config → HM draft → Admin approve → Generate hierarchy |
| 06 | Reserve (available + short) → receive → FCFS → expire idle reserve |
| 09 | Issue → +24h → install → pass → verify → % moves → completion gate |
| 12 | Rework once; cancel another project; config-change a third |
| 13 | Replay happy path and assert audit completeness |

## Dependency graph (simplified)

```
00 ──► 01 ──► 02 ──► 03 ──► 04 ──► 05
                      │       │
                      │       └──► 06
                      │
                      └──► 07 ──► 08 ──► 09
                                   │
                                   └──► 10
                      04/07/08 ──► 11
                      01–05 + 11 services ──► 12
                      all ──► 13
```

## Source of truth

Primary diagram: `Final - Workflow.drawio`  
Pages: Overview | Config & Project | Reservation | Issue & Install | Rework & Recall | Audit & Roles
