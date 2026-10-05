import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Bar, Board } from '../types'
import { rows } from './layout'
import { parse } from './parse'
import { promptSection } from './prompt'
import { ingest, isTaskName, needsRead, settle } from './watch'
import type { Call, TaskFile } from './watch'

const board = atom({ plugin: 'simple-progress-bars', key: 'board' } as const, { bars: [], now: 0 } as Board)

// 4 reads a second: the bar moves smoothly, and a read lists one small directory.
const TICK_MS = 250
const ID_CHECK_TICKS = 4 // once a second: /clear and /resume change the session id
const CALL_KEEP_MS = 60_000 // An ended call matters only to the next few reads.
const INDENT = 2 // cells: in line with the text of the prompt, after its glyph

// One cell stays free at the right edge: a row as wide as the band gets cut with `…`.
const barWidth = (columns: number) => Math.max(20, columns - INDENT - 1)

/** What one load of the module watches. `register` makes it, and every step takes it. */
type Watch = {
  /** `<config dir>/progress`, the same directory that the command writes to. */
  base: string | null
  /** The session directories of this process, newest last. Older ones keep their background tasks. */
  dirs: string[]
  /** The foreground Bash and PowerShell calls that run, or ended in the last minute. */
  calls: Call[]
  /** Expired task files, by key, with the modification time they had. A newer write shows them again. */
  hidden: Map<string, number>
  isBusy: boolean
  ticks: number
}

/** Lists one session directory. Reads only the files that changed, and skips hidden ones. */
async function readDir($: EngineInterface, w: Watch, dir: string, byKey: ReadonlyMap<string, Bar>): Promise<TaskFile[]> {
  const entries = await $.fs.list(dir).catch(() => [])
  const tasks = entries.filter(e => e.kind === 'file' && isTaskName(e.name))
    .filter(e => w.hidden.get(`${dir}/${e.name}`) !== e.mtimeMs)
  return Promise.all(tasks.map(async (entry): Promise<TaskFile> => {
    const key = `${dir}/${entry.name}`
    w.hidden.delete(key)
    const isChanged = needsRead(byKey.get(key), entry.mtimeMs)
    const update = isChanged ? parse(await $.fs.read(key).catch(() => '')) : null
    return { key, name: entry.name, mtimeMs: entry.mtimeMs, update }
  }))
}

async function tick($: EngineInterface, w: Watch) {
  if (w.base === null || w.isBusy) return
  w.isBusy = true
  try {
    w.ticks += 1
    if (w.ticks % ID_CHECK_TICKS === 0) {
      const dir = `${w.base}/${await $.session.id()}`
      if (!w.dirs.includes(dir)) w.dirs.push(dir)
    }

    const [now, prev] = await Promise.all([$.clock.now(), read($, board)])
    w.calls = w.calls.filter(c => c.end === null || now - c.end < CALL_KEEP_MS)
    const byKey = new Map(prev.bars.map(b => [b.key, b]))
    const files = (await Promise.all(w.dirs.map(d => readDir($, w, d, byKey)))).flat()
    const { bars, expired } = settle(ingest(byKey, files), w.calls, now)
    for (const b of expired) w.hidden.set(b.key, b.updatedAt)

    if (bars.length > 0 || prev.bars.length > 0) await update($, board, () => ({ bars, now }))
  } finally {
    w.isBusy = false
  }
}

async function start($: EngineInterface, w: Watch) {
  // The same directory as the command: ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/progress.
  // Windows has no HOME outside Git Bash, so USERPROFILE stands for it there.
  const [configDir, home, profile, id] = await Promise.all([
    $.env.get('CLAUDE_CONFIG_DIR'), $.env.get('HOME'), $.env.get('USERPROFILE'), $.session.id(),
  ])
  const config = configDir || (home || profile ? `${home || profile}/.claude` : null)
  if (config !== null) {
    w.base = `${config}/progress`
    w.dirs = [`${w.base}/${id}`]
    $.clock.every(TICK_MS, () => void tick($, w))
  }
  // The command and its twins live in scripts/, off every PATH. Shells and scripts find them through these.
  const fail = (name: string) => (error: unknown) => {
    $.ui.log(`simple-progress-bars: ${name}: ${String(error)}`, { to: 'debug' })
  }
  await Promise.all([
    $.env.set('CLAUDE_PROGRESS_SH', `${$.plugin.root}/scripts/claude-progress.sh`).catch(fail('CLAUDE_PROGRESS_SH')),
    $.env.set('CLAUDE_PROGRESS_DIR', `${$.plugin.root}/scripts`).catch(fail('CLAUDE_PROGRESS_DIR')),
    $.env.set('CLAUDE_PROGRESS_PS1', `${$.plugin.root}/scripts/claude-progress.ps1`).catch(fail('CLAUDE_PROGRESS_PS1')),
  ])
}

/** Runs one shell call. A foreground call is noted while it runs, so that its end can end its bars. */
async function track<T>($: EngineInterface, w: Watch, isBackground: boolean | undefined, run: () => Promise<T>): Promise<T> {
  if (isBackground) return run()
  const call: Call = { start: await $.clock.now(), end: null }
  w.calls.push(call)
  try {
    return await run()
  } finally {
    call.end = await $.clock.now()
  }
}

export const register: Register = (on, options) => {
  const maxRows = typeof options.maxRows === 'number' ? Math.max(1, Math.round(options.maxRows)) : 3
  const minSeconds = typeof options.minSeconds === 'number' ? Math.max(1, options.minSeconds) : 30
  const w: Watch = {
    base: null, dirs: [], calls: [], hidden: new Map(), isBusy: false, ticks: 0,
  }

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await start($, w)
    return result
  })

  // The end of a foreground shell call ends the bars that only it can own.
  on('tool.call', { tool: 'Bash' }, ($, e, next) => track($, w, e.run_in_background, () => next(e)))
  on('tool.call', { tool: 'PowerShell' }, ($, e, next) => track($, w, e.run_in_background, () => next(e)))

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    const text = promptSection(minSeconds, `${$.plugin.root}/USAGE.md`, e.tools.includes('PowerShell'))
    const section = { id: 'simple-progress-bars:usage', text, scope: 'session' as const }
    return { sections: [...result.sections, section] }
  })

  // Above the prompt, in its band, and never in the transcript: the same while Claude works and after.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { bars, now } = await read($, board)
    if (bars.length === 0 || e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {rows(bars, barWidth(e.props.bodyColumns), now, Math.min(maxRows, e.props.maxRows)).map((row, r) => (
          <Box key={`row${r}`} flexDirection="row" paddingLeft={INDENT}>
            {row.map((p, i) => (
              <Text key={String(i)} color={p.color} dimColor={p.dim} bold={p.bold} wrap="truncate">{p.text}</Text>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
