import { atom, read, update } from 'claude-code'
import type { EngineInterface, ProcessRunResult, Register, Timer } from 'claude-code'

import type { Bar, Board } from '../types'
import { rows } from './layout'
import { parse } from './parse'
import { promptSection } from './prompt'
import { ingest, isTaskName, needsRead, owners, settle } from './watch'
import type { TaskFile } from './watch'

const board = atom({ plugin: 'simple-progress-bars', key: 'board' } as const, { bars: [], now: 0 } as Board)

// 4 reads a second: the bar moves smoothly, and a read lists one small directory.
const TICK_MS = 250
const ID_CHECK_TICKS = 4 // once a second: /clear and /resume change the session id
const OLD_DIR_MINUTES = 24 * 60
const INDENT = 2 // cells: the hint line's own indent
// Only directories named like a session id are swept, whatever PROGRESS_DIR names.
const SESSION_DIR_GLOB = '????????-????-????-????-????????????'
// The process goes on after these ends, under a new session id.
const CONTINUES = new Set(['clear', 'resume'])

/** What one load of the module watches. `register` makes it, and every step takes it. */
type Watch = {
  base: string | null
  /** The session directories of this process, newest last. Older ones keep their background tasks. */
  dirs: string[]
  hasProc: boolean
  isBusy: boolean
  ticks: number
  timer: Timer | null
  logged: Set<string>
  /** The text of shim.sh for the prompt, or null when its read failed. */
  shim: string | null
}

/** Writes a failure to the debug log, once per kind of failure. */
function log($: EngineInterface, w: Watch, what: string, error: unknown) {
  if (w.logged.has(what)) return
  w.logged.add(what)
  $.ui.log(`simple-progress-bars: ${what}: ${String(error)}`, { to: 'debug' })
}

async function run($: EngineInterface, w: Watch, what: string, argv: string[]): Promise<ProcessRunResult | null> {
  try {
    const result = await $.process.run(argv)
    if (result.exitCode !== 0) log($, w, what, result.stderr.trim() || `exit ${result.exitCode}`)
    return result
  } catch (error) {
    log($, w, what, error)
    return null
  }
}

/** Returns the pids that still run: through /proc on Linux, through one ps call on macOS. */
async function alive($: EngineInterface, w: Watch, pids: readonly number[]): Promise<Set<number>> {
  if (pids.length === 0) return new Set()
  if (w.hasProc) {
    const found = await Promise.all(pids.map(p => $.fs.exists(`/proc/${p}`).catch(() => true)))
    return new Set(pids.filter((_, i) => found[i]))
  }
  const ps = await run($, w, 'ps', ['ps', '-o', 'pid=', '-p', pids.join(',')])
  // ps exits 1 when no pid runs. With no output at all, it failed: mark nothing as stopped.
  if (ps === null || (ps.exitCode !== 0 && ps.stderr.trim() !== '')) return new Set(pids)
  return new Set(ps.stdout.split('\n').map(s => Number(s.trim())).filter(n => n > 0))
}

/** Lists one session directory. Reads only the files that changed since the last read. */
async function readDir($: EngineInterface, dir: string, byKey: ReadonlyMap<string, Bar>): Promise<TaskFile[]> {
  const entries = await $.fs.list(dir).catch(() => [])
  const tasks = entries.filter(e => e.kind === 'file' && isTaskName(e.name))
  return Promise.all(tasks.map(async (entry): Promise<TaskFile> => {
    const key = `${dir}/${entry.name}`
    const isChanged = needsRead(byKey.get(key), entry.mtimeMs)
    const update = isChanged ? parse(await $.fs.read(key).catch(() => '')) : null
    return { key, name: entry.name, mtimeMs: entry.mtimeMs, update }
  }))
}

/** Deletes the files of expired bars. A file that changed since its last read stays: it holds a new run. */
async function removeFiles($: EngineInterface, w: Watch, expired: readonly Bar[]) {
  const stats = await Promise.all(expired.map(b => $.fs.stat(b.key).catch(() => null)))
  // The store keeps its lock beside the task file, as a dot file: <dir>/.<name>.lock
  const paths = expired.flatMap((b, i) => stats[i]?.mtimeMs === b.updatedAt
    ? [b.key, `${b.key.slice(0, b.key.length - b.name.length)}.${b.name}.lock`]
    : [])
  if (paths.length > 0) await run($, w, 'rm', ['rm', '-f', '--', ...paths])
}

async function followSessionId($: EngineInterface, w: Watch) {
  const dir = `${w.base}/${await $.session.id()}`
  if (w.dirs.includes(dir)) return
  w.dirs.push(dir)
  await run($, w, 'mkdir', ['mkdir', '-p', '-m', '700', dir])
}

async function tick($: EngineInterface, w: Watch) {
  if (w.base === null || w.isBusy) return
  w.isBusy = true
  try {
    w.ticks += 1
    if (w.ticks % ID_CHECK_TICKS === 0) await followSessionId($, w)

    const [now, prev] = await Promise.all([$.clock.now(), read($, board)])
    const byKey = new Map(prev.bars.map(b => [b.key, b]))
    const files = (await Promise.all(w.dirs.map(d => readDir($, d, byKey)))).flat()

    // The files are read first, so a `done` written just before exit wins over the process check.
    const ingested = ingest(byKey, files)
    const { check, wrote } = owners(ingested, files)
    const live = new Set([...(await alive($, w, check)), ...wrote])
    const { bars, expired } = settle(ingested, live, now)
    await removeFiles($, w, expired)

    if (bars.length > 0 || prev.bars.length > 0) await update($, board, () => ({ bars, now }))
  } finally {
    w.isBusy = false
  }
}

async function start($: EngineInterface, w: Watch) {
  const [dir, id, hasProc, shim] = await Promise.all([
    run($, w, 'claude-progress --dir', [`${$.plugin.root}/bin/claude-progress`, '--dir']),
    $.session.id(),
    $.fs.exists('/proc/self').catch(() => false),
    $.fs.read(`${$.plugin.root}/shim.sh`).catch((error: unknown) => {
      log($, w, 'shim.sh', error)
      return null
    }),
  ])
  w.shim = shim
  const base = dir?.stdout.trim() ?? ''
  if (dir === null || dir.exitCode !== 0 || base === '') return
  w.base = base
  w.dirs = [`${base}/${id}`]
  w.hasProc = hasProc
  await run($, w, 'mkdir', ['mkdir', '-p', '-m', '700', base, ...w.dirs])
  w.timer = $.clock.every(TICK_MS, () => void tick($, w))
  // Remove the directories that crashed sessions left behind. Nothing waits for it.
  void run($, w, 'sweep', ['find', base, '-mindepth', '1', '-maxdepth', '1', '-type', 'd', '-name', SESSION_DIR_GLOB,
    '-mmin', `+${OLD_DIR_MINUTES}`, '-exec', 'rm', '-rf', '--', '{}', '+'])
}

async function end($: EngineInterface, w: Watch, reason: string) {
  if (CONTINUES.has(reason)) return // The next id check adds the new directory.
  w.timer?.cancel()
  w.timer = null
  if (w.dirs.length > 0) await run($, w, 'rm', ['rm', '-rf', '--', ...w.dirs])
  w.base = null
  w.dirs = []
}

export const register: Register = (on, options) => {
  const position = options.position === 'above' ? 'above' : 'below'
  const maxRows = typeof options.maxRows === 'number' ? Math.max(1, Math.round(options.maxRows)) : 3
  const minSeconds = typeof options.minSeconds === 'number' ? Math.max(1, options.minSeconds) : 30
  const w: Watch = { base: null, dirs: [], hasProc: true, isBusy: false, ticks: 0, timer: null, logged: new Set(), shim: null }

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await start($, w)
    return result
  })

  on('session.end', async ($, e, next) => {
    await end($, w, e.reason)
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    const section = { id: 'simple-progress-bars:usage', text: promptSection(minSeconds, w.shim), scope: 'session' as const }
    return { sections: [...result.sections, section] }
  })

  if (position === 'below') {
    // Under the prompt, below the engine's own hint line, which keeps its live pills.
    on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
      const hint = await next(e)
      const { bars, now } = await read($, board)
      if (bars.length === 0) return hint

      const { Box, Text } = $.ui.resolve(e)
      const columns = e.viewport?.columns ?? 80
      return (
        <Box flexDirection="column">
          {hint}
          <Text dimColor wrap="truncate">{'─'.repeat(columns)}</Text>
          {rows(bars, Math.max(20, columns - 2 * INDENT), now, maxRows).map((row, r) => (
            <Box key={`row${r}`} flexDirection="row" paddingLeft={INDENT}>
              {row.map((p, i) => (
                <Text key={String(i)} color={p.color} dimColor={p.dim} bold={p.bold} wrap="truncate">{p.text}</Text>
              ))}
            </Box>
          ))}
        </Box>
      )
    })
  } else {
    // In the band above the prompt. What other plugins draw there stays, under the bars.
    on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
      const band = await next(e)
      const { bars, now } = await read($, board)
      if (bars.length === 0 || e.props.hasSurvey) return band

      const { Box, Text } = $.ui.resolve(e)
      const columns = e.props.bodyColumns
      return (
        <Box flexDirection="column">
          <Text dimColor wrap="truncate">{'─'.repeat(columns)}</Text>
          {rows(bars, columns, now, maxRows).map((row, r) => (
            <Box key={`row${r}`} flexDirection="row">
              {row.map((p, i) => (
                <Text key={String(i)} color={p.color} dimColor={p.dim} bold={p.bold} wrap="truncate">{p.text}</Text>
              ))}
            </Box>
          ))}
          {band}
        </Box>
      )
    })
  }
}
