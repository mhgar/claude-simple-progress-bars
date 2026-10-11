import type { Bar } from '../types'
import type { Update } from './parse'

/** A run file that has not changed for this long belongs to a wrapper that is gone. */
export const STALE_MS = 10_000
/** An ended bar, done, failed, or stopped, shows for this long. */
const HOLD_MS = 10_000
const ETA_HYSTERESIS = 0.1 // The shown estimate moves only on a change over 10%.
const STEP_SMOOTHING = 0.3 // tqdm's default: the weight of the newest step in the typical step
const MIN_AVERAGING_MS = 15_000 // indicatif's averaging time, for fast steps
const STEPS_AVERAGED = 3 // The averaging time is this many typical steps, for slow steps.
const OLD_WEIGHT = 0.1 // Data as old as the averaging time keeps this much of the weight.

/** Where a task is: its key, run file, and root. */
export type Place = { key: string; file: string; root: string | null; name: string }

/** The estimator's state before its first step. */
const UNKNOWN = { progress: 0, samples: 0, rate: null, eta: null, stepTime: null, stepSize: null } as const

function fresh(p: Place, at: number): Bar {
  return {
    ...p, label: '', done: 0, total: null, unit: '', state: 'run', isStale: false,
    startedAt: at, updatedAt: at, progressAt: at, endedAt: null, sig: '', ...UNKNOWN,
  }
}

/** Returns the bar after one update. `at` is the file's modification time. An unchanged update keeps the bar. */
export function apply(prev: Bar | undefined, p: Place, u: Update, at: number): Bar {
  const sig = JSON.stringify(u)
  if (prev !== undefined && prev.sig === sig) return prev
  const bar = { ...(prev ?? fresh(p, at)), sig }

  switch (u.state) {
    case 'done':
    case 'fail':
    case 'stopped':
      return {
        ...bar, updatedAt: at, endedAt: at, isStale: false,
        state: u.state === 'done' ? 'complete' : u.state,
        label: u.msg || u.detail || bar.label,
        done: u.total === null ? bar.done : u.done,
        total: u.total ?? bar.total,
        unit: u.total === null ? bar.unit : u.unit,
        eta: u.state === 'done' ? 0 : null,
      }
    case 'run':
      return run(bar, u, at)
  }
}

function run(bar: Bar, u: Update, at: number): Bar {
  const next: Bar = { ...bar, state: 'run', isStale: false, label: u.detail, unit: u.unit, total: u.total, done: u.done, updatedAt: at, endedAt: null }
  // No total, a new total, or a step back of the count starts the estimate again.
  const isRestart = u.total === null || bar.total !== u.total || u.done < bar.done
  return isRestart ? { ...next, progressAt: at, ...UNKNOWN } : next
}

/** The averaging time of the rate: a few typical steps, and at least indicatif's 15 s. */
const averagingMs = (stepTime: number | null) => Math.max(MIN_AVERAGING_MS, STEPS_AVERAGED * (stepTime ?? 0))

/** Folds a sample of `dd` units over `dt` ms into `rate`. A longer sample weighs more. */
function blend(rate: number, dd: number, dt: number, stepTime: number | null): number {
  const keep = OLD_WEIGHT ** (dt / averagingMs(stepTime))
  return keep * rate + (1 - keep) * dd / dt
}

/**
 * Feeds the estimator of a running bar with a total. `progress` is the count, or for a root
 * the count plus the done part of its one running subtask. `at` is the file's modification time.
 */
export function track(bar: Bar, progress: number, at: number): Bar {
  if (bar.state !== 'run' || bar.total === null) return bar
  if (bar.samples === 0) return { ...bar, progress, progressAt: at, samples: 1 }
  const dd = progress - bar.progress
  const dt = at - bar.progressAt
  // No new progress keeps the estimate: a detail, a repeat, or a subtask that ended before its root moved.
  if (dd <= 0 || dt <= 0) return bar

  const rate = bar.rate === null ? dd / dt : blend(bar.rate, dd, dt, bar.stepTime)
  const stepTime = bar.stepTime === null ? dt : STEP_SMOOTHING * dt + (1 - STEP_SMOOTHING) * bar.stepTime
  const stepSize = bar.stepSize === null ? dd : STEP_SMOOTHING * dd + (1 - STEP_SMOOTHING) * bar.stepSize
  const raw = Math.max(0, bar.total - progress) / rate
  const shown = bar.eta === null ? null : bar.eta - dt
  const isSteady = shown !== null && shown > 0 && Math.abs(raw - shown) <= ETA_HYSTERESIS * shown
  return { ...bar, progress, progressAt: at, samples: bar.samples + 1, rate, stepTime, stepSize, eta: isSteady ? shown : raw }
}

/**
 * Returns the time left at `now` in ms, or null while estimating. It counts down while the
 * current step takes no longer than a typical step. After that, it acts as if the step ended
 * now with a typical size, so the time left grows with the step. 0: the last step runs long.
 */
export function timeLeft(bar: Bar, now: number): number | null {
  if (bar.eta === null || bar.rate === null || bar.stepTime === null || bar.stepSize === null || bar.total === null) return null
  const gap = now - bar.progressAt
  if (gap <= bar.stepTime) return Math.max(0, bar.eta - gap)
  const rate = blend(bar.rate, bar.stepSize, gap, bar.stepTime)
  return Math.max(0, bar.total - bar.progress - bar.stepSize) / rate
}

/** Ends a running bar whose run file went stale at `at`. The plugin guessed it, so `revive` can undo it. */
export function stale(bar: Bar, at: number): Bar {
  if (bar.state !== 'run') return bar
  return { ...bar, state: 'stopped', isStale: true, endedAt: at, eta: null }
}

/** Runs a bar again that `stale` ended, when its run file changes again. */
export function revive(bar: Bar): Bar {
  return bar.isStale ? { ...bar, state: 'run', isStale: false, endedAt: null } : bar
}

/** Returns true when the plugin hides the bar at `now`. A running bar never hides. */
export function isExpired(bar: Bar, now: number): boolean {
  switch (bar.state) {
    case 'complete':
    case 'fail':
    case 'stopped':
      return now - (bar.endedAt ?? now) > HOLD_MS
    case 'run':
      return false
  }
}
