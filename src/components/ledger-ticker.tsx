"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  LEDGER_ROWS,
  formatLedgerAmount,
  formatLedgerDate,
  type LedgerRow,
} from "@/lib/ledger";

/*
 * LedgerTicker — the decorative, endlessly scrolling book of (fictitious)
 * transactions that sits to the right of the hero.
 *
 * Motion model (Lenis-style, hand-rolled): Lenis itself hijacks *document*
 * scroll, which this page doesn't have — so instead we reuse its core idea,
 * an exponentially-damped velocity integrated by rAF, applied to a single
 * `translate3d` on the track. That gives the same weighty, inertial feel
 * while keeping the strip self-contained and dependency-free.
 *
 *   - The list is rendered twice; the offset wraps modulo one copy's height,
 *     so the last row hands off to the first with no visible seam.
 *   - Wheel over the strip scales the base speed (and can push it negative,
 *     i.e. reverse).
 *   - Click toggles pause. Drag scrubs, and releasing flings with inertia.
 */

/** Idle scroll speed, px/sec. */
const BASE_SPEED = 34;
/** Wheel sensitivity: speed multiplier change per pixel of wheel delta. */
const WHEEL_GAIN = 0.0016;
const MIN_MULTIPLIER = -4;
const MAX_MULTIPLIER = 8;
/** Velocity smoothing time constant, seconds. Larger = heavier. */
const DAMPING_TAU = 0.32;
/** Pointer travel (px) beyond which a press counts as a drag, not a click. */
const DRAG_THRESHOLD = 4;
const MAX_FLING_SPEED = 2600;

/**
 * "Today" for the rows. The server (and the hydration render) uses a fixed
 * anchor so both sides agree; once hydrated, the rows re-date themselves
 * against the visitor's real clock. Snapshots are cached because
 * `useSyncExternalStore` requires a referentially stable value.
 */
const SERVER_TODAY = new Date(2026, 8, 9, 12);
let clientToday: Date | null = null;
const neverChanges = () => () => {};
const getServerToday = () => SERVER_TODAY;
const getClientToday = () => (clientToday ??= new Date());

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION).matches;
const getServerReducedMotion = () => false;

function rowsWithDates(base: Date) {
  return LEDGER_ROWS.map((row: LedgerRow) => {
    const date = new Date(base);
    date.setDate(date.getDate() - row.daysAgo);
    return {
      ...row,
      date: formatLedgerDate(date),
      display: formatLedgerAmount(row.amount),
    };
  });
}

export default function LedgerTicker() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  /** `null` until the visitor takes a side; then their click wins outright. */
  const [pausedByVisitor, setPausedByVisitor] = useState<boolean | null>(null);
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(false);

  const today = useSyncExternalStore(
    neverChanges,
    getClientToday,
    getServerToday,
  );
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  );
  // Reduced motion holds the strip still until the visitor says otherwise.
  const paused = pausedByVisitor ?? reducedMotion;

  const rows = useMemo(() => rowsWithDates(today), [today]);

  // Mutable animation state — deliberately outside React so the rAF loop
  // never triggers a render.
  const anim = useRef({
    offset: 0,
    velocity: BASE_SPEED,
    multiplier: 1,
    loopHeight: 0,
    paused: false,
    dragging: false,
    /** Pointer y at the last move, for drag deltas. */
    lastY: 0,
    lastMoveTime: 0,
    dragVelocity: 0,
  });

  // Mirror the derived `paused` into the loop's state. Handlers below also
  // write `anim.current.paused` synchronously, so the rAF loop never waits on
  // a React commit to learn the strip should stop.
  useEffect(() => {
    anim.current.paused = paused;
  }, [paused]);

  // Track the height of one copy of the list; the offset wraps against it.
  useEffect(() => {
    const copy = copyRef.current;
    if (!copy) return;
    const measure = () => {
      anim.current.loopHeight = copy.getBoundingClientRect().height;
      if (anim.current.loopHeight > 0) setReady(true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [rows]);

  // The loop: damp velocity toward its target, integrate, wrap, paint.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;
    let previous = performance.now();

    const tick = (now: number) => {
      const state = anim.current;
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;

      if (state.dragging) {
        // While dragging the pointer owns the offset; keep velocity in sync
        // so releasing hands off smoothly into the fling.
        state.velocity = state.dragVelocity;
      } else {
        const target = state.paused ? 0 : BASE_SPEED * state.multiplier;
        // Frame-rate independent exponential approach — Lenis' lerp, done
        // against elapsed time rather than a fixed per-frame factor.
        const k = 1 - Math.exp(-dt / DAMPING_TAU);
        state.velocity += (target - state.velocity) * k;
        state.offset += state.velocity * dt;
      }

      const loop = state.loopHeight;
      if (loop > 0) state.offset = ((state.offset % loop) + loop) % loop;
      track.style.transform = `translate3d(0, ${-state.offset}px, 0)`;

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Wheel scales the speed. Registered manually because it must be a
  // non-passive listener to call preventDefault.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const state = anim.current;
      state.multiplier = Math.min(
        MAX_MULTIPLIER,
        Math.max(MIN_MULTIPLIER, state.multiplier - event.deltaY * WHEEL_GAIN),
      );
      // Spinning the wheel is an intent to move: un-pause.
      if (state.paused) {
        state.paused = false;
        setPausedByVisitor(false);
      }
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  /** Total pointer travel during the current press, to tell click from drag. */
  const dragTravel = useRef(0);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const state = anim.current;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is best-effort: without it the drag still tracks, it just
      // stops following the pointer once it leaves the strip.
    }
    state.lastY = event.clientY;
    state.lastMoveTime = performance.now();
    state.dragVelocity = 0;
    state.dragging = true;
    dragTravel.current = 0;
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = anim.current;
    if (!state.dragging) return;
    const now = performance.now();
    const dy = event.clientY - state.lastY;
    const dt = Math.max((now - state.lastMoveTime) / 1000, 1 / 240);

    // Dragging down pulls the rows down, i.e. decreases the offset.
    state.offset -= dy;
    state.dragVelocity = Math.max(
      -MAX_FLING_SPEED,
      Math.min(MAX_FLING_SPEED, -dy / dt),
    );
    state.lastY = event.clientY;
    state.lastMoveTime = now;
    dragTravel.current += Math.abs(dy);
  }, []);

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const state = anim.current;
    if (!state.dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    state.dragging = false;
    setDragging(false);
    // Hand the drag's momentum to the damped loop, which eases it back to
    // the ambient speed.
    state.velocity = state.dragVelocity;

    // A press that never really moved is a click: toggle pause.
    if (dragTravel.current < DRAG_THRESHOLD) {
      const next = !state.paused;
      state.paused = next;
      setPausedByVisitor(next);
    }
  }, []);

  return (
    <div
      className={`ledger${ready ? " is-ready" : ""}${paused ? " is-paused" : ""}${
        dragging ? " is-dragging" : ""
      }`}
      aria-hidden="true"
    >
      <div className="ledger-head">
        <span>Date</span>
        <span>What this is</span>
        <span className="num">Amount</span>
        <span>Tax Bracket</span>
      </div>
      <div
        className="ledger-viewport"
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="ledger-track" ref={trackRef}>
          {[0, 1].map((copy) => (
            <div
              className="ledger-copy"
              key={copy}
              ref={copy === 0 ? copyRef : undefined}
            >
              {rows.map((row, index) => (
                <div className={`ledger-row is-${row.kind}`} key={`${copy}-${index}`}>
                  <span className="ledger-date">{row.date}</span>
                  <span className="ledger-label">{row.label}</span>
                  <span className="ledger-amount">{row.display}</span>
                  <span className="ledger-bracket">{row.bracket}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
