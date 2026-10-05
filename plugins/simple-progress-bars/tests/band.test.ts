import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PLUGIN = 'simple-progress-bars'
const DIR = '/home/u/.claude/progress/s1'
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
    const clock = world(on, { convert: '17/240 clip.mkv\n' })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)

    for (const isWorking of [true, false]) {
      const ui = await $.ui.mount(band({ isWorking }))
      expect(await ui.find({ type: 'Text', text: /convert/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /17\/240/ })).toBeDefined()
      await ui.unmount()
    }
  })

  test('draws nothing with no task', async ($, on) => {
    const clock = world(on, {})
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)

    const ui = await $.ui.mount(band())
    expect(await ui.findAll({ type: 'Text' })).toEqual([])
  })

  test('gives the band to a survey', async ($, on) => {
    const clock = world(on, { convert: '17/240 clip.mkv\n' })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)

    const ui = await $.ui.mount(band({ hasSurvey: true }))
    expect(await ui.find({ type: 'Text', text: /convert/ })).toBeUndefined()
  })

  test('draws the bars even when CLAUDE_PROGRESS_PS1 cannot be set', async ($, on) => {
    const clock = world(on, { convert: '17/240 clip.mkv\n' }, { envSetFails: true })
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
    await clock.advance(300)

    const ui = await $.ui.mount(band())
    expect(await ui.find({ type: 'Text', text: /convert/ })).toBeDefined()
  })
})
