import type { BarUnit } from '../types'

/** The state of one task, folded from the lines of its file. */
export type Update = {
  state: 'run' | 'done' | 'fail'
  done: number
  total: number | null
  unit: BarUnit
  detail: string
  msg: string
}

const NUMBER = String.raw`(\d{1,15}(?:,\d{3})*(?:\.\d{1,6})?)`
const UNIT = String.raw`([KMGTP]i?B?|kB|B)?` // attached to the number: 1.5G, 300MiB, 12kB
const SIZE = new RegExp(`^${NUMBER}${UNIT}$`)
const COUNT = new RegExp(`^${NUMBER}${UNIT}/${NUMBER}${UNIT}$`)
const PERCENT = /^(\d{1,3}(?:\.\d{1,6})?)%$/
const FACTOR: Record<string, number> = { K: 1024, k: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5 }

type Size = { n: number; isBytes: boolean }

function toSize(number: string, unit: string | undefined): Size {
  return { n: Number(number.replace(/,/g, '')) * (FACTOR[unit?.[0] ?? ''] ?? 1), isBytes: unit !== undefined }
}

function size(text: string): Size | null {
  const m = SIZE.exec(text)
  return m ? toSize(m[1] ?? '', m[2]) : null
}

const fresh = (): Update => ({ state: 'run', done: 0, total: null, unit: '', detail: '', msg: '' })

/** Applies one line to the state. The first word is the VALUE, and the rest is detail text. */
function step(s: Update, line: string): Update {
  const cut = line.indexOf(' ')
  const word = cut < 0 ? line : line.slice(0, cut)
  const rest = cut < 0 ? '' : line.slice(cut + 1)
  const lower = word.toLowerCase()
  const isEnd = lower === 'done' || lower === 'fail' || lower === 'failed'
  const run = s.state !== 'run' && !isEnd ? fresh() : s // A report after an end starts a new run.

  if (lower === 'done') return { ...run, state: 'done', msg: rest, done: run.total ?? run.done }
  if (isEnd) return { ...run, state: 'fail', msg: rest }

  const count = COUNT.exec(word)
  if (count) {
    const done = toSize(count[1] ?? '', count[2])
    const total = toSize(count[3] ?? '', count[4])
    if (total.n > 0) return { ...run, done: done.n, total: total.n, unit: done.isBytes || total.isBytes ? 'B' : '', detail: rest }
  }
  const pct = PERCENT.exec(word)
  if (pct && Number(pct[1]) <= 100) return { ...run, done: Number(pct[1]), total: 100, unit: '%', detail: rest }

  const add = word.startsWith('+') ? size(word.slice(1)) : null
  if (add) return { ...run, done: run.done + add.n, unit: add.isBytes ? 'B' : run.unit, detail: rest || run.detail }

  const total = lower === 'total' ? size(rest) : null
  if (total && total.n > 0) return { ...run, total: total.n, unit: total.isBytes ? 'B' : run.unit }

  return { ...run, detail: line } // text: the count and the total stay
}

/**
 * Folds the lines of a task file into the state of its task. This is the system
 * boundary, so every line is checked here. Returns null for a file with no line yet.
 */
export function parse(text: string): Update | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  return lines.length === 0 ? null : lines.reduce(step, fresh())
}
