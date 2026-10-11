import type { Bar } from '../types'
import { apply, track } from '../hooks/bar'
import type { Update } from '../hooks/parse'

/** Returns a run update with the given fields. */
export function upd(fields: Partial<Update>): Update {
  return { state: 'run', done: 0, total: null, unit: '', detail: '', msg: '', ...fields }
}

/** Applies updates in order, each at its time in ms, as `ingest` does, and returns the bar of task 1 in the file `/d/<name>`. */
export function run(name: string, steps: [Partial<Update>, number][], root: string | null = null): Bar {
  let bar: Bar | undefined
  const place = { key: `/d/${name}#1`, file: `/d/${name}`, root, name }
  for (const [fields, at] of steps) {
    const u = upd(fields)
    bar = track(apply(bar, place, u, at), u.done, at)
  }
  if (bar === undefined) throw new Error('no steps')
  return bar
}

/** Updates of `total` items, one item each `stepMs` (default 1 s) from 0 s. */
export function steady(total: number, count: number, stepMs = 1000): [Partial<Update>, number][] {
  return Array.from({ length: count }, (_, i) => [{ done: i, total }, i * stepMs])
}
