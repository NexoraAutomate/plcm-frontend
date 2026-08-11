# Spec 09 — Automatic Project Progress Calculation

**Sequence:** 09 of 13  
**Workflow source:** Page 04 — Section 5A (P-1 … P-5) + formula + completion gate  
**Depends on:** Spec 03 (tree), Spec 08 (verified / lifecycle events)

---

## Goal

Automatically compute **weighted** project progress from the Smart SDLS hierarchy tree and lifecycle events—no manual project percentage entry. Dashboard surfaces overall, flight, SDLS, and subtree progress plus bottlenecks. Project completes only when all required items are verified.

---

## Actors

| Actor | Actions |
|-------|---------|
| System | Derive weights; compute averages; update dashboard metrics |
| HM / PD / Admin | Consume dashboard (read) |
| Dev | Actions in Spec 08 feed events (no manual % entry) |

---

## In scope

1. Hierarchy weight from **actual tree concentration**:
   - Product Type → Flight → SDLS → System → Subsystem → Module → Unit → Component
2. Each required node contributes by **weighted share**, not equal System count only.
3. Node progress driven by lifecycle events:
   - Procurement → Procured → Reserved → Issued → Installation In Progress → Under Testing/Review → Installed Verified  
   (Map to statuses that exist; procurement pair may be optional if not already in inventory domain—degrade gracefully).
4. Weighted average across required nodes automatically.
5. Dashboard metrics:
   - Overall % progress  
   - Flight progress  
   - SDLS progress  
   - System / subtree progress  
   - Current status bottlenecks  
6. Completion gate: project `COMPLETED` / `READY_TO_DELIVER` only when all required hierarchy items reach required final verified state. Partial completion remains automatic %.

### Formula (from diagram)

```
Progress of parent = Σ (Children Nodes Installed Verified) / Total Children Nodes
```

Clarify implementation: use **weighted** children where tree concentration differs (P-1/P-2). Equal split per sibling when weights equal; otherwise weight by leaf count or configured mass.

Node completion is driven by recorded lifecycle events; **no manual project percentage entry**.

---

## Out of scope

- Defect loop accounting beyond “verified state rolls back / excludes failed nodes” integration (Spec 10 may reduce verified children)
- Recall cancel progress (Spec 11)

---

## Detailed flow

```
P-1 Derive hierarchy weights from actual tree concentration
        ↓
P-2 Each required node contributes by weighted share
        ↓
P-3 Node progress follows lifecycle events
        ↓
P-4 Calculate weighted average across nodes
    (18/20 leaves ≠ always 90% if concentrations differ)
        ↓
P-5 Dashboard: overall / flight / SDLS / system / bottlenecks
```

Event link: when Spec 08 reaches `INSTALLED_VERIFIED`, recompute impacted ancestors.

---

## Business rules

1. Progress is always system-calculated from tree + events.
2. Parent progress rolls up from children using documented formula and weights.
3. Bottlenecks = nodes / statuses blocking completion (e.g. large residual in `RESERVED` or fail loops).
4. Project completion state only when 100% required verified (or policy-defined required set).
5. Incomplete project still shows honest partial %.

### Weighting guidance

- Default weight of a subtree = number of **required leaf components** (or unit of measure agreed with domain).
- Example warning from diagram: “18 of 20 equivalent weighted units ≠ always 90% if tree concentrations differ.”

---

## Functional requirements

### Backend

1. Progress service: input project id → tree with per-node progress + rollups.
2. Recompute on lifecycle events (or query-time compute if tree fits SLA; cache if needed).
3. Endpoint(s) for overall + breakdown.
4. Completion transition when gate met (permission rules who flips complete may be system-only).

### Frontend

1. Project dashboard cards: overall %.
2. Drill-down: Flight → SDLS → System progress bars.
3. Bottleneck list (top blockers).
4. No free-text or free-slider “% complete” field on project.

---

## Acceptance criteria

- [ ] Verifying a leaf increases subtree and overall % automatically.
- [ ] Uneven trees produce non-naive percentages when concentrations differ.
- [ ] Manual % entry is not available.
- [ ] Dashboard shows required breakdown levels.
- [ ] Project cannot mark complete with unverified required nodes.
- [ ] Fail/open defects do not count as Installed Verified.

---

## Test checklist

1. Synthetic tree: 2 SDLS with unequal leaves → verify math.
2. Event sequence Reserved→…→Verified increments progress stepwise if intermediate stages contribute (if intermediate weights defined; otherwise only verified may count—document chosen policy).
3. Gate: 1 of N left unverified → not complete.
4. Performance smoke for large generated trees.

---

## Recommended progress stage weights (decide in implementation if not fixed)

| Lifecycle stage | Suggested node completion fraction |
|-----------------|------------------------------------|
| Not started | 0 |
| Reserved | 0.1 |
| Issued | 0.3 |
| Installation in Progress | 0.5 |
| Under Testing | 0.75 |
| Installed Verified | 1.0 |

*(Diagram emphasizes events drive progress; stage weights can be refined with product owners. Minimum viable: count only Verified for parent formula and show stage distribution in bottlenecks.)*

---

## Handoff to next (Spec 10)

When tests fail, Defect/Rework loop must reverse verified contribution and re-enter install/test until verified again.