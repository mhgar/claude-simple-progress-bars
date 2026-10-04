import type { Bar, BarUnit } from '../types'

// Pure logic: parse a progress file, update a bar, lay bars out in rows.

export const STALL_MS = 30_000
export const EXPIRE_MS = 10 * 60_000
export const COMPLETE_HOLD_MS = 2_000
export const FAIL_HOLD_MS = 30_000
const SMOOTHING = 0.3 // tqdm default: weight of the newest rate sample
const ETA_HYSTERESIS = 0.1
const NAME_MAX = 20
const LABEL_MAX = 24
const BAR_MIN = 10
export const SEGMENT_MIN = 50
export const ROWS_MAX = 3

/** One progress report, as the `progress` command writes it. */
export type Update = {
  state: 'run' | 'done' | 'fail'
  done: number
  total: number | null
  unit: BarUnit
  detail: string
  msg: string
  pid: number | null
}

const NUM = String.raw`(\d+(?:\.\d+)?)`
const COUNT = new RegExp(String.raw`^${NUM}\s*/\s*${NUM}\s*(.*)$`)
const PERCENT = new RegExp(String.raw`^${NUM}\s*%\s*(.*)$`)

const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Reads a JSON file from the command, or a plain line from `echo`. */
export function parse(text: string): Update | null {
  const trimmed = text.trim()
  if (trimmed === '') return null

  if (trimmed.startsWith('{')) {
    let data: Record<string, unknown>
    try {
      data = JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      return null // A partial write. The next tick reads it again.
    }
    const state = data.state === 'done' || data.state === 'fail' ? data.state : 'run'
    const total = typeof data.total === 'number' && data.total > 0 ? data.total : null
    const unit = data.unit === 'B' || data.unit === '%' ? data.unit : ''
    const pid = typeof data.pid === 'number' && data.pid > 1 ? data.pid : null
    return {
      state, total, unit, pid,
      done: Math.max(0, num(data.done, 0)),
      detail: str(data.detail),
      msg: str(data.msg),
    }
  }

  // Plain line: the last non-empty one, so `>>` also works.
  const line = trimmed.split('\n').map(l => l.trim()).filter(Boolean).at(-1) ?? ''
  const base = { msg: '', pid: null, unit: '' as BarUnit }
  let m = COUNT.exec(line)
  if (m) {
    const total = Number(m[2])
    return { ...base, state: 'run', done: Number(m[1]), total: total > 0 ? total : null, detail: m[3] ?? '' }
  }
  m = PERCENT.exec(line)
  if (m) return { ...base, state: 'run', done: Number(m[1]), total: 100, unit: '%', detail: m[2] ?? '' }
  m = /^done\b\s*(.*)$/i.exec(line)
  if (m) return { ...base, state: 'done', done: 0, total: null, detail: '', msg: m[1] ?? '' }
  m = /^fail(?:ed)?\b\s*(.*)$/i.exec(line)
  if (m) return { ...base, state: 'fail', done: 0, total: null, detail: '', msg: m[1] ?? '' }
  return { ...base, state: 'run', done: 0, total: null, detail: line }
}

/** Returns the bar after one update. `at` is the file's modification time. */
export function apply(prev: Bar | undefined, name: string, u: Update, at: number): Bar {
  const bar: Bar = prev ?? {
    name, label: '', done: 0, total: null, unit: '', state: 'run', pid: null,
    startedAt: at, updatedAt: at, endedAt: null, samples: 0, rate: null, eta: null,
  }
  const pid = u.pid ?? bar.pid

  if (u.state === 'done') {
    // A plain `done` line carries no numbers. Keep the last ones.
    const total = u.total ?? bar.total
    const done = u.total === null ? (total ?? 0) : u.done
    return {
      ...bar, pid, total, done, unit: u.total === null ? bar.unit : u.unit,
      state: 'complete', label: u.msg || u.detail || bar.label,
      updatedAt: at, endedAt: at, eta: 0,
    }
  }
  if (u.state === 'fail') {
    return {
      ...bar, pid, state: 'fail', label: u.msg || u.detail || bar.label,
      done: u.total === null ? bar.done : u.done, total: u.total ?? bar.total,
      updatedAt: at, endedAt: at, eta: null,
    }
  }

  const next: Bar = {
    ...bar, pid, state: 'run', label: u.detail, unit: u.unit,
    total: u.total, updatedAt: at, endedAt: null,
  }
  if (u.total === null) {
    return { ...next, done: u.done, samples: 0, rate: null, eta: null }
  }

  const done = Math.min(u.done, u.total)
  next.done = done
  // A new total or a step back starts the rate over.
  const isRestart = bar.total !== u.total || done < bar.done
  const dt = at - bar.updatedAt
  const dd = done - bar.done
  if (isRestart || bar.samples === 0) {
    next.samples = 1
    next.rate = null
    next.eta = null
  } else if (dd > 0 && dt > 0) {
    const sample = dd / dt
    next.rate = bar.rate === null ? sample : SMOOTHING * sample + (1 - SMOOTHING) * bar.rate
    next.samples = bar.samples + 1
    const raw = (u.total - done) / next.rate
    // The shown estimate counts down between updates. It jumps only on a change over 10%.
    const shown = bar.eta === null ? null : bar.eta - dt
    next.eta =
      shown !== null && shown > 0 && Math.abs(raw - shown) <= ETA_HYSTERESIS * shown ? shown : raw
  }

  if (done >= u.total) {
    next.state = 'complete'
    next.endedAt = at
  }
  return next
}

/** Marks a running bar whose process has exited. */
export function stop(bar: Bar, now: number): Bar {
  return bar.state === 'run' ? { ...bar, state: 'stopped', endedAt: now, eta: null } : bar
}

/** Returns true when the mod removes the bar at `now`. `isAlive` is the process check. */
export function isExpired(bar: Bar, now: number, isAlive: boolean): boolean {
  const ended = now - (bar.endedAt ?? bar.updatedAt)
  if (bar.state === 'complete') return ended > COMPLETE_HOLD_MS
  if (bar.state === 'fail' || bar.state === 'stopped') return ended > FAIL_HOLD_MS
  // A live process keeps its bar. A bar with no process expires after 10 minutes.
  return bar.pid !== null && isAlive ? false : now - bar.updatedAt > EXPIRE_MS
}

export function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function truncate(text: string, max: number): string {
  const chars = [...text]
  if (max <= 0) return ''
  if (chars.length <= max) return text
  return max === 1 ? '…' : chars.slice(0, max - 1).join('') + '…'
}

/** 1536 -> "1.5K", in powers of 1024. */
export function bytes(n: number): string {
  const units = ['B', 'K', 'M', 'G', 'T', 'P']
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return i === 0 ? `${Math.round(n)}B` : `${n < 10 ? n.toFixed(1) : Math.round(n)}${units[i]}`
}

const len = (s: string) => [...s].length

export type Piece = { text: string; color?: string; dim?: boolean; bold?: boolean }

function track(bar: Bar, cells: number, now: number, color: string): Piece[] {
  if (bar.total === null) {
    if (bar.state !== 'run') return [{ text: '━'.repeat(cells), color }]
    // Indeterminate: a segment moves back and forth.
    const seg = Math.min(6, Math.max(1, Math.floor(cells / 4)))
    const span = Math.max(1, cells - seg)
    const step = Math.floor(now / 120) % (2 * span)
    const pos = step < span ? step : 2 * span - step
    return [
      { text: '─'.repeat(pos), dim: true },
      { text: '━'.repeat(seg), color },
      { text: '─'.repeat(cells - seg - pos), dim: true },
    ]
  }
  const halves = Math.round((bar.done / bar.total) * cells * 2)
  const full = Math.min(cells, Math.floor(halves / 2))
  const half = halves % 2 === 1 && full < cells
  return [
    { text: '━'.repeat(full), color },
    { text: half ? '╸' : '', color },
    { text: '─'.repeat(cells - full - (half ? 1 : 0)), dim: true },
  ]
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** Lays one bar out in exactly `width` cells, or fewer when the width is too small. */
export function layout(bar: Bar, width: number, now: number): Piece[] {
  const age = now - bar.updatedAt
  const isStalled = bar.state === 'run' && age > STALL_MS
  const color =
    bar.state === 'fail' || bar.state === 'stopped' ? 'red'
    : bar.state === 'complete' ? 'green'
    : isStalled ? 'yellow'
    : 'cyan'

  const name = truncate(bar.name, Math.min(NAME_MAX, Math.max(4, Math.floor(width / 5))))
  const label = truncate(bar.label, Math.min(LABEL_MAX, Math.floor(width / 5)))

  const count =
    bar.total === null || bar.unit === '%' ? ''
    : bar.unit === 'B' ? `${bytes(bar.done)}/${bytes(bar.total)}`
    : `${fmtNum(bar.done)}/${fmtNum(bar.total)}`
  const rate =
    bar.unit === 'B' && bar.state === 'run' && bar.rate !== null ? `${bytes(bar.rate * 1000)}/s` : ''
  const pct = bar.total === null ? '' : `${Math.floor((bar.done / bar.total) * 100)}%`
  const elapsed = duration((bar.endedAt ?? now) - bar.startedAt)
  const left =
    bar.state === 'fail' ? 'failed'
    : bar.state === 'stopped' ? 'stopped'
    : bar.state === 'complete' ? 'done'
    : isStalled ? `no update ${duration(age)}`
    : bar.total === null ? ''
    : bar.eta === null || bar.samples < 3 || now - bar.startedAt < 2000 ? 'estimating…'
    : `~${duration(bar.eta - age)} left`

  // Parts in the order the mod drops them when the row is too narrow.
  const parts = { label, rate, count, elapsed, name }
  const dropOrder = ['label', 'rate', 'count', 'elapsed', 'name'] as const
  const isQuiet = bar.state === 'run' && !isStalled

  const build = (): Piece[] => {
    const head: Piece[] = []
    if (parts.name) head.push({ text: parts.name + ' ', bold: true })
    if (parts.label) {
      head.push(isQuiet || bar.state === 'complete'
        ? { text: parts.label + ' ', dim: true }
        : { text: parts.label + ' ', color })
    }
    const tail = [parts.count, pct, parts.rate, parts.elapsed, left].filter(Boolean)
    const tailText = tail.length ? ' ' + tail.join('  ') : ''
    const used = head.reduce((n, p) => n + len(p.text), 0) + len(tailText)
    const cells = width - used
    if (cells < BAR_MIN) return []
    return [
      ...head,
      ...track(bar, cells, now, color),
      { text: tailText, color: isQuiet ? undefined : color, dim: isQuiet },
    ]
  }

  for (let i = 0; ; i++) {
    const pieces = build()
    if (pieces.length > 0) return pieces.filter(p => p.text !== '')
    const drop = dropOrder[i]
    if (drop === undefined) break
    parts[drop] = ''
  }
  // Very narrow: the bar alone.
  return track(bar, Math.max(1, width), now, color).filter(p => p.text !== '')
}

export const SEPARATOR = ' │ '

/**
 * Lays the bars out in rows of `width` cells. Each bar gets at least
 * SEGMENT_MIN cells. Rows are balanced, at most `maxRows`, then `+N`.
 */
export function rows(bars: readonly Bar[], width: number, now: number, maxRows = ROWS_MAX): Piece[][] {
  if (bars.length === 0) return []
  const sep = len(SEPARATOR)
  const perRow = Math.max(1, Math.floor((width + sep) / (SEGMENT_MIN + sep)))
  const capacity = perRow * Math.max(1, maxRows)
  const shown = bars.slice(0, capacity)
  const more = bars.length - shown.length
  const rowCount = Math.ceil(shown.length / perRow)
  const each = Math.ceil(shown.length / rowCount)

  const out: Piece[][] = []
  for (let r = 0; r < rowCount; r++) {
    const group = shown.slice(r * each, (r + 1) * each)
    const isLast = r === rowCount - 1
    const moreText = isLast && more > 0 ? `  +${more}` : ''
    const room = width - len(moreText) - sep * (group.length - 1)
    const cell = Math.floor(room / group.length)
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

export function promptSection(minSeconds = 30): string {
  return [
    '# Progress bars for long scripts',
    '',
    'This session shows progress bars in the Claude Code interface, through the `progress` command on PATH. You can always use it.',
    `Use it only when a script will run longer than about ${minSeconds} seconds and its work can be counted or measured (files, items, bytes, steps, percent). Do not use it for quick commands or for work with no measurable progress.`,
    '',
    'Main forms. Always give a short task name with `-n`:',
    '- `progress -n NAME 17/240 [detail]` for a count. Sizes work: `1.5G/4G`',
    '- `progress -n NAME 42% [detail]` for percent',
    '- `progress -n NAME -t 500` once, then `progress -n NAME +1` from parallel workers',
    '- `progress -n NAME done` at the end, or `progress -n NAME fail "message"` on an error',
    '- `cmd | progress -n NAME -l -t 5000` counts lines and passes them through (`-b` counts bytes)',
    '- `progress -n NAME -p -- python train.py` reads tqdm, pv, or rsync output from the command and reports its exit status',
    '',
    'Each call takes about 15 ms, so in fast loops report every Nth item. The command never fails the script. Run `progress --help` for the full reference.',
  ].join('\n')
}
