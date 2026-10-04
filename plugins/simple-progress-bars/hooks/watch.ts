import type { Bar } from '../types'
import { apply, isExpired, stop } from './bar'
import type { Update } from './parse'

/** One task file as one read of a session directory finds it. */
export type TaskFile = {
  key: string
  name: string
  mtimeMs: number
  /** The folded state, or null when the file was not read or holds no line yet. */
  update: Update | null
}

/** A foreground Bash call: when it started, and when it ended, or null while it runs. */
export type Call = { start: number; end: number | null }

// File times and the clock can differ by a few ms. A bar that starts this soon before a call still belongs to it.
const CLOCK_SLACK_MS = 50

/** Returns true for a task file. Dot files are temporary files of the command. */
export const isTaskName = (name: string) => !name.startsWith('.')

/** Returns true when a file must be read again: it is new, or it changed since the bar's update. */
export function needsRead(bar: Bar | undefined, mtimeMs: number): boolean {
  return bar === undefined || mtimeMs > bar.updatedAt
}

/** Applies the files to the bars, which `byKey` holds by key. A bar whose file is gone is dropped. */
export function ingest(byKey: ReadonlyMap<string, Bar>, files: readonly TaskFile[]): Bar[] {
  const bars: Bar[] = []
  for (const f of files) {
    const old = byKey.get(f.key)
    const bar = f.update === null ? old : apply(old, f.key, f.name, f.update, f.mtimeMs)
    if (bar !== undefined) bars.push(bar)
  }
  return bars
}

const startedIn = (bar: Bar, call: Call) => bar.startedAt >= call.start - CLOCK_SLACK_MS

/**
 * Ends the running bars whose Bash call ended, and splits off the bars to hide.
 * A bar ends when a call that it started in has ended, no running call can own it,
 * and it got no update after that call ended.
 */
export function settle(bars: readonly Bar[], calls: readonly Call[], now: number): { bars: Bar[]; expired: Bar[] } {
  const kept: Bar[] = []
  const expired: Bar[] = []
  for (const b of bars) {
    const isOwned = calls.some(c => c.end === null && startedIn(b, c))
    const hasEnded = calls.some(c => c.end !== null && startedIn(b, c) && b.updatedAt <= c.end)
    const bar = b.state === 'run' && !isOwned && hasEnded ? stop(b, now) : b
    if (isExpired(bar, now, isOwned)) expired.push(bar)
    else kept.push(bar)
  }
  kept.sort((a, b) => a.startedAt - b.startedAt)
  return { bars: kept, expired }
}
