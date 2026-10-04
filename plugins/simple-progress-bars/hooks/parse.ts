import type { BarUnit } from '../types'

/** One task record, as `claude-progress` writes it. */
export type Update = {
  state: 'run' | 'done' | 'fail'
  done: number
  total: number | null
  unit: BarUnit
  detail: string
  msg: string
  pid: number | null
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/**
 * Reads a task file: the system boundary, so every field is checked here.
 * Returns null for an empty or half-written file. The next read gets it.
 */
export function parse(text: string): Update | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>

  const total = num(d.total)
  const pid = num(d.pid)
  return {
    state: d.state === 'done' || d.state === 'fail' ? d.state : 'run',
    done: Math.max(0, num(d.done) ?? 0),
    total: total !== null && total > 0 ? total : null,
    unit: d.unit === 'B' || d.unit === '%' ? d.unit : '',
    detail: str(d.detail),
    msg: str(d.msg),
    pid: pid !== null && Number.isInteger(pid) && pid > 1 ? pid : null,
  }
}
