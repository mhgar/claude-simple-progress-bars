import type { Bar } from '../types'
import { STALL_MS } from './bar'

const NAME_MAX = 20
const LABEL_MAX = 24
const TRACK_MIN = 10
const SEGMENT_MIN = 50 // the fewest cells one bar gets before the next bar goes to a new row
const SEPARATOR = ' │ '
const SWEEP_MS = 120 // one cell of the indeterminate segment's movement
const SUB_INDENT = '    ' // subtask rows start 4 cells to the right of their root

/** One run of text with one style. */
type Piece = { text: string; color?: string; dim?: boolean; bold?: boolean }

/** Returns the terminal cells of one code point: 0, 1, or 2. */
function cells(cp: number): number {
  if ((cp >= 0x300 && cp <= 0x36f) || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0xfe00 && cp <= 0xfe0f)) return 0
  const isWide =
    (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x20000 && cp <= 0x3fffd)
  return isWide ? 2 : 1
}

/** Returns the width of `text` in terminal cells. */
export function width(text: string): number {
  let n = 0
  for (const ch of text) n += cells(ch.codePointAt(0) ?? 0)
  return n
}

/** Cuts `text` to at most `max` cells, with `…` at the end when it cuts. */
export function truncate(text: string, max: number): string {
  if (width(text) <= max) return text
  if (max <= 0) return ''
  let out = ''
  let used = 0
  for (const ch of text) {
    const w = cells(ch.codePointAt(0) ?? 0)
    if (used + w > max - 1) break
    out += ch
    used += w
  }
  return out + '…'
}

/** Formats ms as m:ss, or h:mm:ss from one hour. */
function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Formats a byte count in powers of 1024: 1536 is "1.5K". */
function bytes(n: number): string {
  const units = ['B', 'K', 'M', 'G', 'T', 'P']
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return i === 0 ? `${Math.round(n)}B` : `${n < 10 ? n.toFixed(1) : Math.round(n)}${units[i]}`
}

const amount = (bar: Bar, n: number) =>
  bar.unit === 'B' ? bytes(n) : Number.isInteger(n) ? String(n) : n.toFixed(1)

/** The fraction done, from 0 to 1. A count past its total shows as full. */
function fraction(bar: Bar): number {
  return bar.total === null ? 0 : Math.min(1, bar.done / bar.total)
}

function colorOf(bar: Bar, isStalled: boolean): string {
  switch (bar.state) {
    case 'fail':
    case 'stopped':
      return 'red'
    case 'complete':
      return 'green'
    case 'run':
      return isStalled ? 'yellow' : 'cyan'
  }
}

function statusOf(bar: Bar, now: number, isStalled: boolean): string {
  switch (bar.state) {
    case 'fail':
      return 'failed'
    case 'stopped':
      return 'stopped'
    case 'complete':
      return 'done'
    case 'run':
      if (isStalled) return `no update ${duration(now - bar.activeAt)}`
      if (bar.total === null) return ''
      if (bar.done >= bar.total) return 'finishing…'
      if (bar.eta === null || bar.samples < 3 || now - bar.startedAt < 2000) return 'estimating…'
      return `~${duration(bar.eta - (now - bar.progressAt))} left`
  }
}

/** The texts of one bar, before the layout fits them to a width. */
type Parts = { name: string; label: string; count: string; pct: string; rate: string; elapsed: string; status: string }

function partsOf(bar: Bar, w: number, now: number, isStalled: boolean): Parts {
  const hasCount = bar.unit !== '%' && (bar.total !== null || bar.done > 0)
  return {
    name: truncate(bar.name, Math.min(NAME_MAX, Math.max(4, Math.floor(w / 5)))),
    label: truncate(bar.label, Math.min(LABEL_MAX, Math.floor(w / 5))),
    count: !hasCount ? '' : bar.total === null ? amount(bar, bar.done) : `${amount(bar, bar.done)}/${amount(bar, bar.total)}`,
    // A small epsilon keeps 0.29 * 100 = 28.999… from showing as 28%.
    pct: bar.total === null ? '' : `${Math.floor(fraction(bar) * 100 + 1e-9)}%`,
    rate: bar.unit === 'B' && bar.state === 'run' && bar.rate !== null ? `${bytes(bar.rate * 1000)}/s` : '',
    elapsed: duration((bar.endedAt ?? now) - bar.startedAt),
    status: statusOf(bar, now, isStalled),
  }
}

function track(bar: Bar, w: number, now: number, color: string): Piece[] {
  if (bar.total === null && bar.state === 'run') {
    // No total: a segment moves back and forth.
    const seg = Math.min(6, Math.max(1, Math.floor(w / 4)))
    const span = Math.max(1, w - seg)
    const step = Math.floor(now / SWEEP_MS) % (2 * span)
    const pos = Math.min(step < span ? step : 2 * span - step, Math.max(0, w - seg))
    return [
      { text: '─'.repeat(pos), dim: true },
      { text: '━'.repeat(Math.min(seg, w)), color },
      { text: '─'.repeat(Math.max(0, w - seg - pos)), dim: true },
    ]
  }
  const halves = Math.round((bar.total === null ? 1 : fraction(bar)) * w * 2)
  const full = Math.min(w, Math.floor(halves / 2))
  const half = halves % 2 === 1 && full < w
  return [
    { text: '━'.repeat(full), color },
    { text: half ? '╸' : '', color },
    { text: '─'.repeat(Math.max(0, w - full - (half ? 1 : 0))), dim: true },
  ]
}

const DROP_ORDER = ['label', 'rate', 'count', 'elapsed', 'name'] as const

/** Fits the parts into `w` cells, and drops parts in DROP_ORDER until the track fits. */
function fit(bar: Bar, parts: Parts, w: number, now: number, color: string, isQuiet: boolean, isSub: boolean): Piece[] {
  const p = { ...parts }
  for (let i = 0; i <= DROP_ORDER.length; i++) {
    const head: Piece[] = []
    if (p.name) head.push(isSub ? { text: `${p.name} `, dim: true } : { text: `${p.name} `, bold: true })
    if (p.label) head.push(isQuiet || bar.state === 'complete' ? { text: `${p.label} `, dim: true } : { text: `${p.label} `, color })
    const tail = [p.count, p.pct, p.rate, p.elapsed, p.status].filter(Boolean)
    const tailText = tail.length > 0 ? ` ${tail.join('  ')}` : ''
    const room = w - head.reduce((n, piece) => n + width(piece.text), 0) - width(tailText)
    if (room >= TRACK_MIN) {
      return [...head, ...track(bar, room, now, color), { text: tailText, color: isQuiet ? undefined : color, dim: isQuiet }]
    }
    const drop = DROP_ORDER[i]
    if (drop !== undefined) p[drop] = ''
  }
  return track(bar, Math.max(1, w), now, color) // very narrow: the track alone
}

/** Lays one bar out in exactly `w` cells. A subtask has a dim name. */
export function layout(bar: Bar, w: number, now: number, isSub = false): Piece[] {
  const isStalled = bar.state === 'run' && now - bar.activeAt > STALL_MS
  const isQuiet = bar.state === 'run' && !isStalled
  const color = colorOf(bar, isStalled)
  return fit(bar, partsOf(bar, w, now, isStalled), w, now, color, isQuiet, isSub).filter(p => p.text !== '')
}

/** What the person chose: the roots they collapsed, and the state of the band. `height` is the band's height in rows. */
export type View = { collapsed: ReadonlySet<string>; isCompact: boolean; height: number }

/** What a press on a row does: toggle a root, or toggle the band. */
export type Target = { root: string } | { band: true }

/** One drawn row: its pieces, and the press target of a row that is a button. */
export type Row = { pieces: Piece[]; target?: Target }

const COMPACT_ROWS = 4
const MARK_OPEN = '▾ '
const MARK_SHUT = '▸ '
const COUNT_ORDER = ['running', 'stalled', 'failed', 'stopped', 'done'] as const

type Word = (typeof COUNT_ORDER)[number]

function wordOf(bar: Bar, now: number): Word {
  switch (bar.state) {
    case 'complete':
      return 'done'
    case 'fail':
      return 'failed'
    case 'stopped':
      return 'stopped'
    case 'run':
      return now - bar.activeAt > STALL_MS ? 'stalled' : 'running'
  }
}

/** Counts bars by state: "2 running, 1 failed". States with no bar are left out. */
export function counts(bars: readonly Bar[], now: number): string {
  const n = new Map<Word, number>()
  for (const b of bars) n.set(wordOf(b, now), (n.get(wordOf(b, now)) ?? 0) + 1)
  return COUNT_ORDER.filter(w => n.has(w)).map(w => `${n.get(w)} ${w}`).join(', ')
}

/** One row before it is drawn. A root row of a block has a mark, and the bars behind its `+N`. */
type Plan =
  | { kind: 'bars'; bars: Bar[]; isSub: boolean }
  | { kind: 'root'; root: Bar; isOpen: boolean; hidden: Bar[] }

/** Splits `bars` into `count` rows of balanced length. */
function balance(bars: readonly Bar[], count: number, isSub: boolean): Plan[] {
  const each = Math.ceil(bars.length / count)
  return Array.from({ length: count }, (_, r): Plan => ({ kind: 'bars', bars: bars.slice(r * each, (r + 1) * each), isSub }))
    .filter(row => row.kind === 'bars' && row.bars.length > 0)
}

/** Draws a row of bars in exactly `w` cells, with ` │ ` between them. */
function drawBars(bars: readonly Bar[], w: number, now: number, isSub: boolean): Piece[] {
  const sep = width(SEPARATOR)
  const indent = isSub ? SUB_INDENT : ''
  const room = w - width(indent)
  const cell = Math.floor((room - sep * (bars.length - 1)) / bars.length)
  const out: Piece[] = indent ? [{ text: indent }] : []
  bars.forEach((bar, i) => {
    if (i > 0) out.push({ text: SEPARATOR, dim: true })
    out.push(...layout(bar, cell, now, isSub))
  })
  return out
}

/** Draws the row of a root with subtasks: its mark, its bar, and `+N` for subtasks that do not show. */
function drawRoot(p: Extract<Plan, { kind: 'root' }>, w: number, now: number): Piece[] {
  const mark = p.isOpen ? MARK_OPEN : MARK_SHUT
  const plus = p.hidden.length > 0 ? `  +${p.hidden.length}` : ''
  const withCounts = plus ? `${plus}: ${counts(p.hidden, now)}` : ''
  // The counts give way first, before any part of the bar.
  const tail = plus && w - width(mark) - width(withCounts) >= SEGMENT_MIN ? withCounts : plus
  const out: Piece[] = [{ text: mark, dim: true }, ...layout(p.root, w - width(mark) - width(tail), now)]
  if (tail) out.push({ text: tail, dim: true })
  return out
}

/**
 * Lays the bars out in rows of `w` cells. Each bar gets at least SEGMENT_MIN cells.
 * Groups go in start order: a root with subtasks gets a block, with a row of its own
 * and, while it is open, its subtasks in indented rows under it. Roots with no
 * subtasks pack together in balanced rows. The rows stay within the band's height,
 * or within 4 rows in a compact band, and a last line counts what does not show.
 */
export function rows(bars: readonly Bar[], w: number, now: number, view: View): Row[] {
  if (bars.length === 0) return []
  const sep = width(SEPARATOR)
  const perRow = (cells: number) => Math.max(1, Math.floor((cells + sep) / (SEGMENT_MIN + sep)))
  const subWidth = w - width(SUB_INDENT)
  const keys = new Set(bars.map(b => b.key))
  const subsOf = new Map<string, Bar[]>()
  const roots: Bar[] = []
  for (const b of bars) {
    if (b.root !== null && keys.has(b.root)) subsOf.set(b.root, [...(subsOf.get(b.root) ?? []), b])
    else roots.push(b) // A subtask whose root is gone shows as a root.
  }

  // Groups in start order: a run of roots with no subtasks, or one block.
  type Group = { run: Bar[] } | { root: Bar; subs: Bar[] }
  const groups: Group[] = []
  for (const root of roots) {
    const subs = subsOf.get(root.key)
    const last = groups[groups.length - 1]
    if (subs !== undefined) groups.push({ root, subs })
    else if (last !== undefined && 'run' in last) last.run.push(root)
    else groups.push({ run: [root] })
  }
  const isOpen = (g: { root: Bar }) => !view.collapsed.has(g.root.key)
  const need = (g: Group) => 'run' in g
    ? Math.ceil(g.run.length / perRow(w))
    : 1 + (isOpen(g) ? Math.ceil(g.subs.length / perRow(subWidth)) : 0)

  // The rows of bars, and the last line, from the height table.
  const total = groups.reduce((n, g) => n + need(g), 0)
  const height = Math.max(1, view.height)
  const fitsWhole = total <= COMPACT_ROWS && total <= height
  const limit = fitsWhole ? total : view.isCompact ? Math.min(COMPACT_ROWS, height - 1) : Math.min(total, height - 1)

  // Fill the rows group by group. After the first group that does not fit whole, the rest go to the last line.
  let left = limit
  const plans: Plan[] = []
  const unseen: Bar[] = []
  let isFull = false
  for (const g of groups) {
    const members = 'run' in g ? g.run : [g.root, ...g.subs]
    if (isFull || left === 0) {
      unseen.push(...members)
      isFull = true
      continue
    }
    if ('run' in g) {
      const fit = Math.min(g.run.length, left * perRow(w))
      const count = Math.ceil(fit / perRow(w))
      plans.push(...balance(g.run.slice(0, fit), count, false))
      unseen.push(...g.run.slice(fit))
      left -= count
      isFull = fit < g.run.length
      continue
    }
    const open = isOpen(g)
    const subRows = open ? Math.min(left - 1, Math.ceil(g.subs.length / perRow(subWidth))) : 0
    const shown = open ? Math.min(g.subs.length, subRows * perRow(subWidth)) : 0
    plans.push({ kind: 'root', root: g.root, isOpen: open, hidden: g.subs.slice(shown) })
    if (subRows > 0) plans.push(...balance(g.subs.slice(0, shown), subRows, true))
    left -= 1 + subRows
    isFull = open && shown < g.subs.length
  }

  const out: Row[] = plans.map(p => p.kind === 'root'
    ? { pieces: drawRoot(p, w, now), target: { root: p.root.key } }
    : { pieces: drawBars(p.bars, w, now, p.isSub) })
  if (fitsWhole) return out

  const more = unseen.length > 0 ? `${unseen.length} more: ${counts(unseen, now)}` : ''
  const line = view.isCompact ? `▸ ${more}` : more ? `▴ show less · ${more}` : '▴ show less'
  out.push({ pieces: [{ text: truncate(line, w), dim: true }], target: { band: true } })
  return out
}
