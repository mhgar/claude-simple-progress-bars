import type { Bar } from '../types'
import { apply } from '../hooks/bar'
import type { Update } from '../hooks/parse'

/** Returns a run update with the given fields. */
export function upd(fields: Partial<Update>): Update {
  return { state: 'run', done: 0, total: null, unit: '', detail: '', msg: '', ...fields }
}

/** Applies updates in order, each at its time in ms, and returns the bar. */
export function run(name: string, steps: [Partial<Update>, number][]): Bar {
  let bar: Bar | undefined
  for (const [fields, at] of steps) bar = apply(bar, `/d/${name}`, name, upd(fields), at)
  if (bar === undefined) throw new Error('no steps')
  return bar
}

/** Updates of `total` items, one item each second from 0 s. */
export function steady(total: number, count: number): [Partial<Update>, number][] {
  return Array.from({ length: count }, (_, i) => [{ done: i, total }, i * 1000])
}
