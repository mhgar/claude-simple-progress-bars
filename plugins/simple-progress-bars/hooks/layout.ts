import type { Bar } from '../types'
import { STALL_MS } from './bar'

const NAME_MAX = 20
const LABEL_MAX = 24
const TRACK_MIN = 10
const SEGMENT_MIN = 50 // the fewest cells one bar gets before the next bar goes to a new row
const SEPARATOR = ' │ '
const SWEEP_MS = 120 // one cell of the indeterminate segment's movement

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
      if (isStalled) return `no update ${duration(now - bar.updatedAt)}`
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
function fit(bar: Bar, parts: Parts, w: number, now: number, color: string, isQuiet: boolean): Piece[] {
  const p = { ...parts }
  for (let i = 0; i <= DROP_ORDER.length; i++) {
    const head: Piece[] = []
    if (p.name) head.push({ text: `${p.name} `, bold: true })
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

/** Lays one bar out in exactly `w` cells. */
export function layout(bar: Bar, w: number, now: number): Piece[] {
  const isStalled = bar.state === 'run' && now - bar.updatedAt > STALL_MS
  const isQuiet = bar.state === 'run' && !isStalled
  const color = colorOf(bar, isStalled)
  return fit(bar, partsOf(bar, w, now, isStalled), w, now, color, isQuiet).filter(p => p.text !== '')
}

/**
 * Lays the bars out in rows of `w` cells. Each bar gets at least SEGMENT_MIN
 * cells. Rows are balanced, at most `maxRows` of them, then `+N`.
 */
export function rows(bars: readonly Bar[], w: number, now: number, maxRows: number): Piece[][] {
  if (bars.length === 0) return []
  const sep = width(SEPARATOR)
  const perRow = Math.max(1, Math.floor((w + sep) / (SEGMENT_MIN + sep)))
  const shown = bars.slice(0, perRow * maxRows)
  const more = bars.length - shown.length
  const rowCount = Math.ceil(shown.length / perRow)
  const each = Math.ceil(shown.length / rowCount)

  const out: Piece[][] = []
  for (let r = 0; r < rowCount; r++) {
    const group = shown.slice(r * each, (r + 1) * each)
    const moreText = r === rowCount - 1 && more > 0 ? `  +${more}` : ''
    const cell = Math.floor((w - width(moreText) - sep * (group.length - 1)) / group.length)
    const row: Piece[] = []
    group.forEach((bar, i) => {
      if (i > 0) row.push({ text: SEPARATOR, dim: true })
      row.push(...layout(bar, cell, now))
    })
    if (moreText) row.push({ text: moreText, dim: true })
    out.push(row)
  }
  return out
}
