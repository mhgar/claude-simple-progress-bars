import type { Bar } from '../types'
import type { Update } from './parse'

/** No update for this long turns a running bar yellow. */
export const STALL_MS = 30_000
/** A run file that has not changed for this long belongs to a wrapper that is gone. */
export const STALE_MS = 15_000
/** An ended bar, done, failed, or stopped, shows for this long. */
const HOLD_MS = 10_000
const SMOOTHING = 0.3 // tqdm's default: the weight of the newest rate sample
const ETA_HYSTERESIS = 0.1 // The shown estimate moves only on a change over 10%.

/** Where a task is: its key, run file, and root. */
export type Place = { key: string; file: string; root: string | null; name: string }

function fresh(p: Place, at: number): Bar {
  return {
    ...p, label: '', done: 0, total: null, unit: '', state: 'run', isStale: false,
    startedAt: at, updatedAt: at, activeAt: at, progressAt: at, endedAt: null, samples: 0, rate: null, eta: null, sig: '',
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
        ...bar, updatedAt: at, activeAt: at, endedAt: at, isStale: false,
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
  const next: Bar = { ...bar, state: 'run', isStale: false, label: u.detail, unit: u.unit, total: u.total, done: u.done, updatedAt: at, activeAt: at, endedAt: null }
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
