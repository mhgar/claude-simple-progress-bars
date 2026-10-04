import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Bar, Board } from '../types'
import { apply, isExpired, parse, promptSection, rows, stop } from './progress'

const board = atom(
  { plugin: 'simple-progress-bars', key: 'board' } as const,
  { dir: null, bars: [], now: 0 } as Board,
)

const TICK_MS = 250
const ID_CHECK_TICKS = 4 // Check the session id every second, because /clear changes it.
const OLD_DIR_MINUTES = 24 * 60
const INDENT = '  ' // matches the hint line's own indent

// The module's own variables start over on each reload. session.start fires again then.
let base: string | null = null
let dir: string | null = null
let hasProc = true // Linux has /proc. macOS does not, so it uses ps.
let isBusy = false
let ticks = 0

const isTaskFile = (name: string) => !name.endsWith('.lock') && !name.endsWith('.tmp')

/** Returns the pids in `pids` that still run. */
async function alive($: EngineInterface, pids: readonly number[]): Promise<Set<number>> {
  if (pids.length === 0) return new Set()
  if (hasProc) {
    const found = await Promise.all(pids.map(p => $.fs.exists(`/proc/${p}`).catch(() => true)))
    return new Set(pids.filter((_, i) => found[i]))
  }
  const ps = await $.process.run(['ps', '-o', 'pid=', '-p', pids.join(',')]).catch(() => null)
  if (ps === null) return new Set(pids) // If ps fails, mark nothing as stopped.
  return new Set(ps.stdout.split('\n').map(s => Number(s.trim())).filter(n => n > 0))
}

async function tick($: EngineInterface) {
  if (dir === null || base === null || isBusy) return
  isBusy = true
  try {
    ticks += 1
    if (ticks % ID_CHECK_TICKS === 0) {
      const next = `${base}/${await $.session.id()}`
      if (next !== dir) {
        dir = next
        await $.process.run(['mkdir', '-p', '-m', '700', dir]).catch(() => {})
      }
    }

    const now = await $.clock.now()
    const prev = await read($, board)
    const entries = await $.fs.list(dir).catch(() => [])
    const byName = new Map(prev.dir === dir ? prev.bars.map(b => [b.name, b]) : [])
    let bars: Bar[] = []

    for (const entry of entries) {
      if (entry.kind !== 'file' || !isTaskFile(entry.name)) continue
      let bar = byName.get(entry.name)
      byName.delete(entry.name)
      if (bar === undefined || entry.mtimeMs > bar.updatedAt) {
        const text = await $.fs.read(`${dir}/${entry.name}`).catch(() => '')
        const u = parse(text)
        if (u !== null) bar = apply(bar, entry.name, u, entry.mtimeMs)
      }
      if (bar !== undefined) bars.push(bar)
    }

    // The files are read first, so a `done` written just before exit wins over the check.
    const pids = bars.flatMap(b => (b.state === 'run' && b.pid !== null ? [b.pid] : []))
    const live = await alive($, [...new Set(pids)])
    bars = bars.map(b => (b.state === 'run' && b.pid !== null && !live.has(b.pid) ? stop(b, now) : b))

    const expired = bars.filter(b => isExpired(b, now, b.pid !== null && live.has(b.pid)))
    bars = bars.filter(b => !expired.includes(b))
    // A file that is gone keeps its row only while it shows a final state.
    for (const bar of byName.values()) {
      if (bar.state !== 'run' && !isExpired(bar, now, false)) bars.push(bar)
    }

    if (expired.length > 0) {
      const paths = expired.flatMap(b => [`${dir}/${b.name}`, `${dir}/${b.name}.lock`])
      await $.process.run(['rm', '-f', '--', ...paths]).catch(() => {})
    }
    bars.sort((a, b) => a.startedAt - b.startedAt)

    if (bars.length > 0 || prev.bars.length > 0 || prev.dir !== dir) {
      await update($, board, () => ({ dir, bars, now }))
    }
  } finally {
    isBusy = false
  }
}

export const register: Register = (on, options) => {
  const position = options.position === 'above' ? 'above' : 'below'
  const maxRows = typeof options.maxRows === 'number' ? Math.max(1, Math.round(options.maxRows)) : 3
  const minSeconds = typeof options.minSeconds === 'number' ? options.minSeconds : 30

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    // The same base directory that the progress command uses.
    const env = await $.process
      .run(['sh', '-c', 'printf "%s" "${PROGRESS_DIR:-${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/claude-progress}"'])
      .catch(() => null)
    base = (env?.stdout.trim() || '/tmp/claude-progress').replace(/\/\/+/g, '/').replace(/\/+$/, '')
    dir = `${base}/${await $.session.id()}`
    hasProc = await $.fs.exists('/proc/self').catch(() => false)
    await $.process.run(['mkdir', '-p', '-m', '700', dir]).catch(() => {})
    // Remove what crashed sessions left behind.
    await $.process
      .run(['find', base, '-mindepth', '1', '-maxdepth', '1', '-type', 'd',
        '-mmin', `+${OLD_DIR_MINUTES}`, '-exec', 'rm', '-rf', '--', '{}', '+'])
      .catch(() => {})
    $.clock.every(TICK_MS, () => void tick($))
    return result
  })

  on('session.end', async ($, e, next) => {
    if (base !== null) {
      await $.process.run(['rm', '-rf', '--', `${base}/${e.sessionId}`]).catch(() => {})
    }
    // After /clear the process goes on under a new id with no session.start.
    // The timer keeps going, and the id check moves it to the new directory.
    if (e.reason !== 'clear') dir = null
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    return {
      sections: [
        ...result.sections,
        { id: 'simple-progress-bars:usage', text: promptSection(minSeconds), scope: 'session' as const },
      ],
    }
  })

  if (position === 'below') {
    // Under the prompt, below the engine's own hint line. The engine's line and
    // its live pills stay as they are.
    on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
      const hint = await next(e)
      const { bars, now } = await read($, board)
      if (bars.length === 0) return hint

      const { Box, Text } = $.ui.resolve(e)
      const columns = e.viewport?.columns ?? 80
      const width = Math.max(20, columns - 2 * INDENT.length)

      return (
        <Box flexDirection="column">
          {hint}
          <Text dimColor wrap="truncate">{'─'.repeat(columns)}</Text>
          {rows(bars, width, now, maxRows).map((row, r) => (
            <Box key={`row${r}`} flexDirection="row">
              <Text>{INDENT}</Text>
              {row.map((p, i) => (
                <Text key={String(i)} color={p.color} dimColor={p.dim} bold={p.bold} wrap="truncate">
                  {p.text}
                </Text>
              ))}
            </Box>
          ))}
        </Box>
      )
    })
  } else {
    // In the band above the prompt. The engine keeps a notification row
    // between this band and the prompt.
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
      const { bars, now } = await read($, board)
      if (bars.length === 0 || e.props.hasSurvey) return next(e)

      const { Box, Text } = $.ui.resolve(e)
      const width = e.props.bodyColumns

      return (
        <Box flexDirection="column">
          <Text dimColor wrap="truncate">{'─'.repeat(width)}</Text>
          {rows(bars, width, now, maxRows).map((row, r) => (
            <Box key={`row${r}`} flexDirection="row">
              {row.map((p, i) => (
                <Text key={String(i)} color={p.color} dimColor={p.dim} bold={p.bold} wrap="truncate">
                  {p.text}
                </Text>
              ))}
            </Box>
          ))}
        </Box>
      )
    })
  }
}
