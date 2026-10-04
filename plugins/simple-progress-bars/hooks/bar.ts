import type { Bar } from '../types'
import type { Update } from './parse'

/** No update for this long turns a running bar yellow. */
export const STALL_MS = 30_000
const EXPIRE_MS = 10 * 60_000
const COMPLETE_HOLD_MS = 2_000
const FAIL_HOLD_MS = 30_000
const SMOOTHING = 0.3 // tqdm's default: the weight of the newest rate sample
const ETA_HYSTERESIS = 0.1 // The shown estimate moves only on a change over 10%.

function fresh(key: string, name: string, at: number): Bar {
  return {
    key, name, label: '', done: 0, total: null, unit: '', state: 'run',
    startedAt: at, updatedAt: at, progressAt: at, endedAt: null, samples: 0, rate: null, eta: null,
  }
}

/** Returns the bar after one update. `at` is the file's modification time. */
export function apply(prev: Bar | undefined, key: string, name: string, u: Update, at: number): Bar {
  // A run after done or fail is a new run, with a new start time. A stopped bar that
  // gets a new update resumes: the Bash call that seemed to own it was another one.
  const isNewRun = prev === undefined || ((prev.state === 'complete' || prev.state === 'fail') && u.state === 'run')
  const bar = isNewRun ? fresh(key, name, at) : prev

  switch (u.state) {
    case 'done':
    case 'fail':
      return {
        ...bar, updatedAt: at, endedAt: at,
        state: u.state === 'done' ? 'complete' : 'fail',
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
  const next: Bar = { ...bar, state: 'run', label: u.detail, unit: u.unit, total: u.total, done: u.done, updatedAt: at, endedAt: null }
  if (u.total === null) {
    return { ...next, progressAt: u.done === bar.done ? bar.progressAt : at, samples: 0, rate: null, eta: null }
  }

  // A new total or a step back starts the rate again.
  if (bar.total !== u.total || u.done < bar.done || bar.samples === 0) {
    return { ...next, progressAt: at, samples: 1, rate: null, eta: null }
  }
  const dd = u.done - bar.done
  const dt = at - bar.progressAt
  // An update with no new progress (a detail, a repeat) keeps the rate and the estimate.
  if (dd === 0 || dt <= 0) return next

  const sample = dd / dt
  const rate = bar.rate === null ? sample : SMOOTHING * sample + (1 - SMOOTHING) * bar.rate
  const raw = Math.max(0, u.total - u.done) / rate
  const shown = bar.eta === null ? null : bar.eta - dt
  const isSteady = shown !== null && shown > 0 && Math.abs(raw - shown) <= ETA_HYSTERESIS * shown
  return { ...next, progressAt: at, samples: bar.samples + 1, rate, eta: isSteady ? shown : raw }
}

/** Ends a running bar whose Bash call ended: complete at its total, else stopped. */
export function stop(bar: Bar, now: number): Bar {
  if (bar.state !== 'run') return bar
  const isDone = bar.total !== null && bar.done >= bar.total
  return { ...bar, state: isDone ? 'complete' : 'stopped', endedAt: now, eta: isDone ? 0 : null }
}

/** Returns true when the plugin hides the bar at `now`. `isOwned` is true while a Bash call can own it. */
export function isExpired(bar: Bar, now: number, isOwned: boolean): boolean {
  switch (bar.state) {
    case 'complete':
      return now - (bar.endedAt ?? now) > COMPLETE_HOLD_MS
    case 'fail':
    case 'stopped':
      return now - (bar.endedAt ?? now) > FAIL_HOLD_MS
    case 'run':
      // A running Bash call keeps its bars. Other bars go 10 minutes after their last update.
      return !isOwned && now - bar.updatedAt > EXPIRE_MS
  }
}
