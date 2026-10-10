import type { Bar } from '../types'
import { STALL_MS } from './bar'

const NAME_MAX = 20
const LABEL_MAX = 24
const TRACK_MIN = 10
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

/** One bar on its own row: its mark, whether it is a subtask, and the subtasks behind its `+N`. */
type Line = { bar: Bar; isSub: boolean; mark: string; hidden: Bar[] }

// The name and detail columns follow their longest value, up to these shares of the width.
const NAME_SHARE = 0.25
const LABEL_SHARE = 0.2
const COLUMN_MIN = 8
const GAP = '  '
const GUTTER = 2 // cells for the mark of a root with subtasks

/** The columns that a narrow band gives up, in order, until the track gets TRACK_MIN cells. */
const NARROW_STEPS = ['counts', 'label', 'rate', 'count', 'elapsed', 'name', 'pct'] as const

/** The raw texts of one row, before the table cuts or pads them. */
type Texts = { name: string; label: string; count: string; pct: string; rate: string; elapsed: string; status: string; more: string; full: string }

function textsOf(line: Line, now: number): Texts {
  const isStalled = line.bar.state === 'run' && now - line.bar.activeAt > STALL_MS
  const p = partsOf(line.bar, Number.MAX_SAFE_INTEGER, now, isStalled)
  const more = line.hidden.length > 0 ? `+${line.hidden.length}` : ''
  return {
    name: line.bar.name, label: line.bar.label, count: p.count, pct: p.pct, rate: p.rate, elapsed: p.elapsed, status: p.status,
    more, full: more ? `${more}: ${counts(line.hidden, now)}` : '',
  }
}

const padEnd = (text: string, n: number) => text + ' '.repeat(Math.max(0, n - width(text)))
const padStart = (text: string, n: number) => ' '.repeat(Math.max(0, n - width(text))) + text

/**
 * Draws the lines as one table. Every column has the width of its widest value,
 * the name and detail columns up to a share of the width. The track gets what is
 * left, but at most as much as the other columns together, so a wide band does
 * not stretch the bars. A narrow band drops whole columns, so the rows stay aligned.
 */
function table(lines: readonly Line[], w: number, now: number): Piece[][] {
  const texts = lines.map(l => textsOf(l, now))
  const indentOf = (l: Line) => (l.isSub ? SUB_INDENT : '')
  const widest = (pick: (t: Texts, i: number) => string) => texts.reduce((n, t, i) => Math.max(n, width(pick(t, i))), 0)
  const dropped = new Set<string>()
  let nameCap = Math.max(COLUMN_MIN, Math.floor(w * NAME_SHARE))
  const labelCap = Math.max(COLUMN_MIN, Math.floor(w * LABEL_SHARE))

  const measure = () => {
    const col = (key: keyof Texts, cap = Infinity) => (dropped.has(key) ? 0 : Math.min(cap, widest(t => t[key])))
    const widths = {
      name: widest((t, i) => indentOf(lines[i] as Line) + truncate(t.name, nameCap)),
      label: col('label', labelCap),
      count: col('count'), pct: col('pct'), rate: col('rate'), elapsed: col('elapsed'), status: col('status'),
      more: dropped.has('counts') ? widest(t => t.more) : widest(t => t.full),
    }
    const present = Object.values(widths).filter(n => n > 0)
    const text = GUTTER + present.reduce((n, c) => n + c, 0) + width(GAP) * present.length // one gap for each column, the track's included
    return { widths, text, track: Math.min(w - text, text) }
  }

  let m = measure()
  for (const step of NARROW_STEPS) {
    if (m.track >= TRACK_MIN) break
    if (step === 'name') nameCap = COLUMN_MIN
    else if (step === 'pct') dropped.add('pct').add('status')
    else dropped.add(step)
    m = measure()
  }
  const trackWidth = Math.max(1, Math.min(m.track, w - m.text))

  return lines.map((line, i) => {
    const t = texts[i] as Texts
    const bar = line.bar
    const isStalled = bar.state === 'run' && now - bar.activeAt > STALL_MS
    const isQuiet = bar.state === 'run' && !isStalled
    const color = colorOf(bar, isStalled)
    const numberStyle = isQuiet ? { dim: true } : { color }
    const out: Piece[] = [{ text: line.mark, dim: true }]
    out.push(line.isSub
      ? { text: padEnd(indentOf(line) + truncate(t.name, nameCap), m.widths.name), dim: true }
      : { text: padEnd(truncate(t.name, nameCap), m.widths.name), bold: true })
    if (m.widths.label > 0) {
      out.push({ text: GAP }, { text: padEnd(truncate(t.label, m.widths.label), m.widths.label), ...(isQuiet || bar.state === 'complete' ? { dim: true } : { color }) })
    }
    out.push({ text: GAP }, ...track(bar, trackWidth, now, color))
    for (const key of ['count', 'pct', 'rate', 'elapsed'] as const) {
      if (m.widths[key] > 0) out.push({ text: GAP }, { text: padStart(t[key], m.widths[key]), ...numberStyle })
    }
    if (m.widths.status > 0) out.push({ text: GAP }, { text: padEnd(t.status, m.widths.status), ...numberStyle })
    if (m.widths.more > 0) out.push({ text: GAP }, { text: padEnd(dropped.has('counts') ? t.more : t.full, m.widths.more), dim: true })
    return out.filter(p => p.text !== '')
  })
}

/**
 * Lays the bars out as a table with one bar on each row. Groups go in start order:
 * a root with subtasks gets a block, with its subtasks on the rows under it while
 * it is open, and roots with no subtasks follow each other. The rows stay within
 * the band's height, or within 4 rows in a compact band, and a last line counts
 * what does not show.
 */
export function rows(bars: readonly Bar[], w: number, now: number, view: View): Row[] {
  if (bars.length === 0) return []
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
  const need = (g: Group) => ('run' in g ? g.run.length : 1 + (isOpen(g) ? g.subs.length : 0))

  // The rows of bars, and the last line, from the height table.
  const total = groups.reduce((n, g) => n + need(g), 0)
  const height = Math.max(1, view.height)
  const fitsWhole = total <= COMPACT_ROWS && total <= height
  const limit = fitsWhole ? total : view.isCompact ? Math.min(COMPACT_ROWS, height - 1) : Math.min(total, height - 1)

  // Fill the rows group by group. After the first group that does not fit whole, the rest go to the last line.
  let left = limit
  const lines: Line[] = []
  const unseen: Bar[] = []
  let isFull = false
  for (const g of groups) {
    if (isFull || left === 0) {
      unseen.push(...('run' in g ? g.run : [g.root, ...g.subs]))
      isFull = true
      continue
    }
    if ('run' in g) {
      const fit = Math.min(g.run.length, left)
      for (const bar of g.run.slice(0, fit)) lines.push({ bar, isSub: false, mark: ' '.repeat(GUTTER), hidden: [] })
      unseen.push(...g.run.slice(fit))
      left -= fit
      isFull = fit < g.run.length
      continue
    }
    const open = isOpen(g)
    const shown = open ? Math.min(left - 1, g.subs.length) : 0
    lines.push({ bar: g.root, isSub: false, mark: open ? MARK_OPEN : MARK_SHUT, hidden: g.subs.slice(shown) })
    for (const bar of g.subs.slice(0, shown)) lines.push({ bar, isSub: true, mark: ' '.repeat(GUTTER), hidden: [] })
    left -= 1 + shown
    isFull = open && shown < g.subs.length
  }

  const drawn = table(lines, w, now)
  const out: Row[] = lines.map((line, i) => ({
    pieces: drawn[i] ?? [],
    target: line.mark.trim() !== '' ? { root: line.bar.key } : undefined,
  }))
  if (fitsWhole) return out

  const more = unseen.length > 0 ? `${unseen.length} more: ${counts(unseen, now)}` : ''
  const line = view.isCompact ? `▸ ${more}` : more ? `▴ show less · ${more}` : '▴ show less'
  out.push({ pieces: [{ text: truncate(line, w), dim: true }], target: { band: true } })
  return out
}
