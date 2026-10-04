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

/** Returns true for a task file. Dot files are the store's locks and temporary files. */
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

/** Returns the owners of running bars, split by whether their file changed in this read. */
export function owners(bars: readonly Bar[], files: readonly TaskFile[]): { check: number[]; wrote: number[] } {
  const changed = new Set(files.filter(f => f.update !== null).map(f => f.key))
  const check = new Set<number>()
  const wrote = new Set<number>()
  for (const b of bars) {
    if (b.state !== 'run' || b.pid === null) continue
    // An owner that wrote in this read is alive. Only the others need the process check.
    if (changed.has(b.key)) wrote.add(b.pid)
    else check.add(b.pid)
  }
  return { check: [...check].filter(p => !wrote.has(p)), wrote: [...wrote] }
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
