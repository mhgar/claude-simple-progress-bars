import type { BarUnit } from '../types'

/** The state of one task, folded from its reports. */
export type Update = {
  state: 'run' | 'done' | 'fail' | 'stopped'
  done: number
  total: number | null
  unit: BarUnit
  detail: string
  msg: string
}

/** One task of a run file. `root` is the ID of its root task, or null for a root. */
export type RunTask = { id: number; root: number | null; name: string; update: Update }

const NUMBER = String.raw`(\d{1,15}(?:,\d{3})*(?:\.\d{1,6})?)`
const UNIT = String.raw`([KMGTP]i?B?|kB|B)?` // attached to the number: 1.5G, 300MiB, 12kB
const SIZE = new RegExp(`^${NUMBER}${UNIT}$`)
const COUNT = new RegExp(`^${NUMBER}${UNIT}/${NUMBER}${UNIT}$`)
const PERCENT = /^(\d{1,3}(?:\.\d{1,6})?)%$/
const FACTOR: Record<string, number> = { K: 1024, k: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5 }
const TASK = /^task (\d+) (-|\d+) (.*)$/
const REPORT = /^\[(\d+)\] (.*)$/

type Size = { n: number; isBytes: boolean }

function toSize(number: string, unit: string | undefined): Size {
  return { n: Number(number.replace(/,/g, '')) * (FACTOR[unit?.[0] ?? ''] ?? 1), isBytes: unit !== undefined }
}

function size(text: string): Size | null {
  const m = SIZE.exec(text)
  return m ? toSize(m[1] ?? '', m[2]) : null
}

const fresh = (): Update => ({ state: 'run', done: 0, total: null, unit: '', detail: '', msg: '' })

/** Applies one report to the state. The first word is the VALUE, and the rest is detail text. */
function step(s: Update, line: string): Update {
  if (s.state !== 'run') return s // An ended task is final.
  const cut = line.indexOf(' ')
  const word = cut < 0 ? line : line.slice(0, cut)
  const rest = cut < 0 ? '' : line.slice(cut + 1)
  const lower = word.toLowerCase()

  if (lower === 'done') return { ...s, state: 'done', msg: rest, done: s.total ?? s.done }
  if (lower === 'fail' || lower === 'failed') return { ...s, state: 'fail', msg: rest }
  if (lower === 'stopped') return { ...s, state: 'stopped', msg: rest }

  const count = COUNT.exec(word)
  if (count) {
    const done = toSize(count[1] ?? '', count[2])
    const total = toSize(count[3] ?? '', count[4])
    if (total.n > 0) return { ...s, done: done.n, total: total.n, unit: done.isBytes || total.isBytes ? 'B' : '', detail: rest }
  }
  const pct = PERCENT.exec(word)
  if (pct && Number(pct[1]) <= 100) return { ...s, done: Number(pct[1]), total: 100, unit: '%', detail: rest }

  const add = word.startsWith('+') ? size(word.slice(1)) : null
  if (add) return { ...s, done: s.done + add.n, unit: add.isBytes ? 'B' : s.unit, detail: rest || s.detail }

  const total = lower === 'total' ? size(rest) : null
  if (total && total.n > 0) return { ...s, total: total.n, unit: total.isBytes ? 'B' : s.unit }

  return { ...s, detail: line } // text: the count and the total stay
}

const lines = (text: string) => text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')

/**
 * Folds reports into the state of one task. This is a system boundary, so every
 * report is checked here. Returns null for no reports.
 */
export function parse(text: string): Update | null {
  const reports = lines(text)
  return reports.length === 0 ? null : reports.reduce(step, fresh())
}

/** Ends a running subtask with the end state of its root, with no message. */
function endWith(root: Update, sub: Update): Update {
  if (sub.state !== 'run' || root.state === 'run') return sub
  return { ...sub, state: root.state, msg: '', done: root.state === 'done' ? (sub.total ?? sub.done) : sub.done }
}

/**
 * Reads a run file: `task ID ROOT NAME` lines, `[ID] VALUE` reports, and `end` last.
 * Returns null for a file with no `end` line, which the wrapper is still writing.
 */
export function parseRun(text: string): RunTask[] | null {
  const all = lines(text)
  if (all[all.length - 1] !== 'end') return null

  const tasks = new Map<number, RunTask>()
  for (const line of all) {
    const task = TASK.exec(line)
    if (task) {
      const id = Number(task[1])
      tasks.set(id, { id, root: task[2] === '-' ? null : Number(task[2]), name: task[3] ?? '', update: fresh() })
      continue
    }
    const report = REPORT.exec(line)
    const t = report ? tasks.get(Number(report[1])) : undefined
    if (t) t.update = step(t.update, report?.[2] ?? '')
  }

  const list = [...tasks.values()]
  return list.map(t => {
    const root = t.root === null ? undefined : tasks.get(t.root)
    return root ? { ...t, update: endWith(root.update, t.update) } : t
  })
}
