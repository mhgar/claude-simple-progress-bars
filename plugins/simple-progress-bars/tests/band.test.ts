import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PLUGIN = 'simple-progress-bars'
const DIR = '/home/u/.claude/progress/s1'
const RUN = '4242-1700000000'
const CONVERT = 'task 1 - convert\n[1] 17/240 clip.mkv\nend\n'
// On Windows the engine hands the fs hooks a native path: C:\home\u\... for /home/u/...
const posix = (path: string) => path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')

const band = (overrides: { hasSurvey?: boolean; isWorking?: boolean } = {}) => ({
  plugin: PLUGIN,
  surface: 'terminal' as const,
  component: 'AbovePrompt' as const,
  props: {
    hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 }, view: {}, ...overrides,
  },
})

/** A session whose progress directory holds `files`, by name. Returns the clock. */
function world(on: On, files: Record<string, string>, { envSetFails = false } = {}) {
  const clock = mock.clock(on, { now: 10_000 })
  mock.env(on, { HOME: '/home/u' })
  on('session.start', ($, e) => Promise.resolve({ cwd: e.cwd }))
  on('session.id', () => Promise.resolve({ value: 's1' }) as never)
  on('env.set', () => (envSetFails ? Promise.reject(new Error('refused')) : Promise.resolve({ value: undefined })) as never)
  on('fs.list', ($, e) => Promise.resolve({ value: posix(e.path) !== DIR ? [] : Object.keys(files).map(name => (
    { name, kind: 'file' as const, size: 1, mtimeMs: 10_000, isLink: false }
  )) }) as never)
  on('fs.read', ($, e) => Promise.resolve({ value: files[posix(e.path).slice(DIR.length + 1)] ?? '' }) as never)
  // The engine draws nothing of its own in the band: an empty box stands for it.
  on('ui.render', { component: 'AbovePrompt' }, () => Promise.resolve({ type: 'Box', props: {}, children: [] }) as never)
  return clock
}

describe('the band above the prompt', () => {
  test('draws a running task, while Claude works and after', async ($, on) => {
    const clock = world(on, { [RUN]: CONVERT })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)

    for (const isWorking of [true, false]) {
      const ui = await $.ui.mount(band({ isWorking }))
      expect(await ui.find({ type: 'Text', text: /convert/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /17\/240/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('draws a root with its subtask on an indented row', async ($, on) => {
    const clock = world(on, { [RUN]: 'task 1 - render\n[1] 2/10\ntask 2 1 frames\n[2] 5/40\nend\n' })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)

    const ui = await $.ui.mount(band())
    expect(await ui.find({ type: 'Text', text: /render/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^ {4}$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /frames/ })).toBeDefined()
  })

  test('draws nothing for a half-written run file', async ($, on) => {
    const clock = world(on, { [RUN]: 'task 1 - convert\n[1] 17/240\n' })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)

    const ui = await $.ui.mount(band())
    expect(await ui.findAll({ type: 'Text' })).toEqual([])
  })

  test('draws nothing with no task', async ($, on) => {
    const clock = world(on, {})
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)

    const ui = await $.ui.mount(band())
    expect(await ui.findAll({ type: 'Text' })).toEqual([])
  })

  test('gives the band to a survey', async ($, on) => {
    const clock = world(on, { [RUN]: CONVERT })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)

    const ui = await $.ui.mount(band({ hasSurvey: true }))
    expect(await ui.find({ type: 'Text', text: /convert/ })).toBeUndefined()
  })

  test('draws the bars even when the environment cannot be set', async ($, on) => {
    const clock = world(on, { [RUN]: CONVERT }, { envSetFails: true })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)

    const ui = await $.ui.mount(band())
    expect(await ui.find({ type: 'Text', text: /convert/ })).toBeDefined()
  })
})

describe('presses in the band', () => {
  const ROOT_KEY = `root:${DIR}/${RUN}#1`
  const RENDER = 'task 1 - render\n[1] 2/10\ntask 2 1 frames\n[2] 5/40\ntask 3 1 upload\n[3] 1/3\nend\n'

  test('a press on a root row collapses its subtasks, and a second press shows them again', async ($, on) => {
    const clock = world(on, { [RUN]: RENDER })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)
    const ui = await $.ui.mount(band())
    expect(await ui.find({ type: 'Text', text: /frames/ })).toBeDefined()

    await ui.press({ key: ROOT_KEY })
    expect(await ui.find({ type: 'Text', text: /frames/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /\+2: 2 running/ })).toBeDefined()

    await ui.press({ key: ROOT_KEY })
    expect(await ui.find({ type: 'Text', text: /frames/ })).toBeDefined()
  })

  test('a press on the last line makes the band compact, and a second press expands it', async ($, on) => {
    // Nine roots, two to a row in 120 columns: five rows of bars.
    const files = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`${100 + i}-1700000000`, `task 1 - job${i}\n[1] 1/2\nend\n`]))
    const clock = world(on, files)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)
    const ui = await $.ui.mount(band())
    expect(await ui.find({ type: 'Text', text: /show less/ })).toBeDefined()

    await ui.press({ key: 'band' })
    expect(await ui.find({ type: 'Text', text: /▸ 1 more: 1 running/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /job8/ })).toBeUndefined()

    await ui.press({ key: 'band' })
    expect(await ui.find({ type: 'Text', text: /job8/ })).toBeDefined()
  })

  test('the plugin forgets a collapse when the root is gone', async ($, on) => {
    const files: Record<string, string> = { [RUN]: RENDER }
    const clock = world(on, files)
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)
    const ui = await $.ui.mount(band())
    await ui.press({ key: ROOT_KEY })

    delete files[RUN]
    await clock.advance(300)
    files[RUN] = RENDER // only to look: a real root never comes back
    await clock.advance(300)

    expect(await ui.find({ type: 'Text', text: /frames/ })).toBeDefined()
  })
})
