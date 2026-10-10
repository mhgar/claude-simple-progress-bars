import type { Bar } from '../types'
import { apply } from '../hooks/bar'
import type { Update } from '../hooks/parse'

/** Returns a run update with the given fields. */
export function upd(fields: Partial<Update>): Update {
  return { state: 'run', done: 0, total: null, unit: '', detail: '', msg: '', ...fields }
}

/** Applies updates in order, each at its time in ms, and returns the bar of task 1 in the file `/d/<name>`. */
export function run(name: string, steps: [Partial<Update>, number][], root: string | null = null): Bar {
  let bar: Bar | undefined
  const place = { key: `/d/${name}#1`, file: `/d/${name}`, root, name }
  for (const [fields, at] of steps) bar = apply(bar, place, upd(fields), at)
  if (bar === undefined) throw new Error('no steps')
  return bar
}

/** Updates of `total` items, one item each second from 0 s. */
export function steady(total: number, count: number): [Partial<Update>, number][] {
  return Array.from({ length: count }, (_, i) => [{ done: i, total }, i * 1000])
}
