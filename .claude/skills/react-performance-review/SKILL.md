---
name: react-performance-review
description: Measure and review React performance issues (slow rendering, rerender churn, UI lag), then propose minimal high-impact fixes with evidence and validation steps. Use this skill whenever users mention slow or janky React behavior, typing/click latency, unnecessary rerenders, profiling, performance regressions, or requests to optimize frontend performance in components/PRs.
argument-hint: [component-or-route]
---

# React Performance Review

This skill defines workflow only. Canonical policy lives in:

- `docs/frontend/performance.md`
- `docs/frontend/react-patterns.md`

## Reference Loading

Load only the reference needed for the active bottleneck:

- Read `docs/frontend/performance.md` when choosing responsiveness or rendering strategies (`useTransition`, `useDeferredValue`, debouncing, virtualization, bundle impact).
- Read `docs/frontend/react-patterns.md` when deciding memoization and component API patterns.

## Success Criteria

- Bottleneck evidence is captured (Profiler trace, Performance panel, or equivalent reproducible measurement).
- Recommendations are ordered by impact and risk.
- Any manual memoization recommendation includes explicit evidence and a verification plan.
- If code changes are made, before/after measurement is reported.

## Step 1: Scope and Reproduction

- Identify the route/component and exact interaction causing slowness.
- Document expected responsiveness in plain language.
- If there is no reproducible scenario, stop and request one before proposing optimizations.

## Step 2: Baseline Measurement

- Capture at least one baseline:
  - React DevTools Profiler for rerender/commit hotspots.
  - Browser Performance panel for scripting/layout/paint cost.
- Record:
  - interaction name
  - slowest commit/frame
  - top contributors (components/functions)

## Step 3: Diagnose Primary Bottleneck

Choose one primary bottleneck class before proposing fixes:

- Expensive render/compute work in a hot path
- Unnecessary rerenders from unstable props or broad state fan-out
- List size/render volume issue
- Update-priority issue (urgent vs non-urgent work)

Keep secondary hypotheses short and separate from the primary diagnosis.

## Step 4: Propose Changes in Priority Order

1. Simplify render logic and reduce work first.
2. Narrow re-render fan-out via state placement and tighter child APIs.
3. Use concurrent primitives (`useTransition`, `useDeferredValue`) when responsiveness is the core issue.
4. Use manual memoization (`useMemo`, `useCallback`, `React.memo`) only when measurements justify it or referential identity is required by an integration.
5. Use structural fixes (virtualization, lazy loading) for list and bundle bottlenecks.

For each recommendation, include:

- why it targets the measured bottleneck
- expected user-facing gain
- risk/tradeoff

## Step 5: Validate and Report

- Re-run the same scenario and compare before/after measurements.
- Confirm correctness and no behavior regressions.
- If code changed, run:
  - `pnpm lint:ts`
  - `pnpm lint:js`

Use this response format:

1. Baseline evidence
2. Bottleneck diagnosis
3. Ordered recommendations
4. Validation results (or plan, if not implemented)
5. Residual risks
