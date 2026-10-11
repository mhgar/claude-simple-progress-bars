import type { Bar } from '../types'
import { apply, isExpired, revive, STALE_MS, stale, track } from './bar'
import type { RunTask } from './parse'

/** One run file as one read of the progress directory finds it. */
export type RunFile = {
  file: string
  mtimeMs: number
  /** The tasks of a complete read, or null when the file was not read or was half written. */
  tasks: RunTask[] | null
}

/**
 * Returns true for a run file of one of the sessions in `ids`: `<session id>.<pid>-<start>`.
 * A session ID holds no `.`, so the first `.` ends it.
 */
export function isSessionFile(name: string, ids: ReadonlySet<string>): boolean {
  const dot = name.indexOf('.')
  return dot > 0 && ids.has(name.slice(0, dot))
}

/** The key of one task: unique across the watched sessions. */
export const taskKey = (file: string, id: number) => `${file}#${id}`

/**
 * Hidden tasks by key. A task that ended for good hides forever. A task that went
 * stale hides until its file changes after the time noted here.
 */
export type Hidden = Map<string, number>

/** Notes the expired bars in `hidden`. */
export function hide(hidden: Hidden, expired: readonly Bar[], mtimes: ReadonlyMap<string, number>) {
  for (const b of expired) hidden.set(b.key, b.isStale ? (mtimes.get(b.file) ?? 0) : Infinity)
}

/** Returns true when a task of a file with this modification time stays hidden. */
function isHidden(hidden: Hidden, key: string, mtimeMs: number): boolean {
  const until = hidden.get(key)
  if (until === undefined) return false
  if (mtimeMs > until) {
    hidden.delete(key) // A stale task whose file changed: it runs again.
    return false
  }
  return true
}

/** Applies the files to the bars, which `byKey` holds by key. Bars of a file that is gone are dropped. */
export function ingest(byKey: ReadonlyMap<string, Bar>, files: readonly RunFile[], hidden: Hidden): Bar[] {
  const bars: Bar[] = []
  for (const f of files) {
    if (f.tasks === null) {
      for (const b of byKey.values()) if (b.file === f.file) bars.push(b)
      continue
    }
    const applied: Bar[] = []
    for (const t of f.tasks) {
      const key = taskKey(f.file, t.id)
      if (isHidden(hidden, key, f.mtimeMs)) continue
      const place = { key, file: f.file, root: t.root === null ? null : taskKey(f.file, t.root), name: t.name }
      applied.push(apply(byKey.get(key), place, t.update, f.mtimeMs))
    }
    bars.push(...applied.map(b => track(b, progressOf(b, applied), f.mtimeMs)))
  }
  return bars
}

/**
 * Returns the progress that the estimator of `bar` follows: its count, plus for a root
 * with a count in items the done part of its one running subtask with a total.
 */
export function progressOf(bar: Bar, bars: readonly Bar[]): number {
  if (bar.root !== null || bar.total === null || bar.unit !== '') return bar.done
  const [sub, ...more] = bars.filter(b => b.root === bar.key && b.state === 'run' && b.total !== null && b.total > 0)
  if (sub === undefined || sub.total === null || more.length > 0) return bar.done
  return bar.done + Math.min(1, sub.done / sub.total)
}

/** Ends the running bars of stale files, runs them again when their file changes, and splits off the bars to hide. */
export function settle(bars: readonly Bar[], mtimes: ReadonlyMap<string, number>, now: number): { bars: Bar[]; expired: Bar[] } {
  const kept: Bar[] = []
  const expired: Bar[] = []
  for (const b of bars) {
    const mtime = mtimes.get(b.file) ?? now
    const isFileStale = now - mtime > STALE_MS
    const bar = isFileStale ? stale(b, mtime + STALE_MS) : revive(b)
    if (isExpired(bar, now)) expired.push(bar)
    else kept.push(bar)
  }
  kept.sort((a, b) => a.startedAt - b.startedAt)
  return { bars: kept, expired }
}
