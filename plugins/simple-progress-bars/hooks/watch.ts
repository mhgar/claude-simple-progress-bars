import type { Bar } from '../types'
import { apply, isExpired, stop } from './bar'
import type { Update } from './parse'

/** One task file as one read of a session directory finds it. */
export type TaskFile = {
  key: string
  name: string
  mtimeMs: number
  /** The parsed record, or null when the file was not read or did not parse. */
  update: Update | null
}

/** Returns true for a file name that is a task, not the store's lock or temporary file. */
export const isTaskName = (name: string) => !name.endsWith('.lock') && !name.endsWith('.tmp')

/** Returns true when a file must be read again: it is new, or it changed since the bar's update. */
export function needsRead(bar: Bar | undefined, mtimeMs: number): boolean {
  return bar === undefined || mtimeMs > bar.updatedAt
}

/** Applies the files to the bars. A bar whose file is gone is dropped. */
export function ingest(prev: readonly Bar[], files: readonly TaskFile[]): Bar[] {
  const byKey = new Map(prev.map(b => [b.key, b]))
  const bars: Bar[] = []
  for (const f of files) {
    const old = byKey.get(f.key)
    const bar = f.update === null ? old : apply(old, f.key, f.name, f.update, f.mtimeMs)
    if (bar !== undefined) bars.push(bar)
  }
  return bars
}

/** Returns the pids that the process check must look at. */
export function watchedPids(bars: readonly Bar[]): number[] {
  return [...new Set(bars.flatMap(b => (b.state === 'run' && b.pid !== null ? [b.pid] : [])))]
}

/** Ends the bars whose process exited, and splits off the bars to remove. */
export function settle(bars: readonly Bar[], live: ReadonlySet<number>, now: number): { bars: Bar[]; expired: Bar[] } {
  const kept: Bar[] = []
  const expired: Bar[] = []
  for (const b of bars) {
    const isAlive = b.pid !== null && live.has(b.pid)
    const bar = b.state === 'run' && b.pid !== null && !isAlive ? stop(b, now) : b
    if (isExpired(bar, now, isAlive)) expired.push(bar)
    else kept.push(bar)
  }
  kept.sort((a, b) => a.startedAt - b.startedAt)
  return { bars: kept, expired }
}
