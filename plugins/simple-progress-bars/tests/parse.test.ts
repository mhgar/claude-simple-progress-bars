import { describe, expect, test } from 'claude-code/testing'

import { parse, parseRun } from '../hooks/parse'

const g = 1024 ** 3

describe('parse', () => {
  const cases: [string, string, object][] = [
    ['a count with detail', '17/240 clip.mkv', { done: 17, total: 240, unit: '', detail: 'clip.mkv' }],
    ['sizes', '1.5G/4GiB', { done: 1.5 * g, total: 4 * g, unit: 'B' }],
    ['thousands groups', '1,000/2,000', { done: 1000, total: 2000 }],
    ['a percent', '42% halfway', { done: 42, total: 100, unit: '%', detail: 'halfway' }],
    ['adds after a total', 'total 50\n+1\n+1\n+3', { done: 5, total: 50 }],
    ['an add with a size', '+512M', { done: 512 * 1024 ** 2, unit: 'B' }],
    ['text keeps the count and the total', '3/9\nScanning disk', { done: 3, total: 9, detail: 'Scanning disk' }],
    ['an add of 0 sets a detail that looks like a count', '2/10\n+1\n+0 3/8 files', { done: 3, total: 10, detail: '3/8 files' }],
    ['done fills the count to the total', '3/10\ndone', { state: 'done', done: 10, total: 10 }],
    ['fail keeps the count and gives the message', '3/10\nfail disk full', { state: 'fail', done: 3, msg: 'disk full' }],
    ['stopped ends the task with its message', '3/10\nstopped interrupted', { state: 'stopped', done: 3, msg: 'interrupted' }],
    ['a report after an end changes nothing', '1/2\ndone\n+1', { state: 'done', done: 2, total: 2 }],
    ['a total of 0 is text', '3/0', { total: null, detail: '3/0' }],
    ['a percent above 100 is text', '150%', { total: null, detail: '150%' }],
    ['the word total with no size is text', 'total of files', { total: null, detail: 'total of files' }],
    ['CRLF line ends', '1/4\r\n2/4\r\n', { done: 2, total: 4 }],
  ]
  for (const [name, text, fields] of cases) {
    test(name, () => {
      expect(parse(text)).toMatchObject(fields)
    })
  }

  for (const text of ['', '\n\n', '   ']) {
    test(`returns null for ${JSON.stringify(text)}`, () => {
      expect(parse(text)).toBe(null)
    })
  }
})

describe('parseRun', () => {
  const file = (...lines: string[]) => [...lines, 'end', ''].join('\n')

  test('reads a root and its subtasks', () => {
    const tasks = parseRun(file('task 1 - render', '[1] 2/10', 'task 2 1 frames', '[2] 5/40 frame_005.exr'))

    expect(tasks).toMatchObject([
      { id: 1, root: null, name: 'render', update: { done: 2, total: 10 } },
      { id: 2, root: 1, name: 'frames', update: { done: 5, total: 40, detail: 'frame_005.exr' } },
    ])
  })

  test('keeps spaces in a name', () => {
    expect(parseRun(file('task 1 - my render job'))?.[0]?.name).toBe('my render job')
  })

  test('gives a task with no reports no count', () => {
    expect(parseRun(file('task 1 - render'))?.[0]?.update).toMatchObject({ state: 'run', done: 0, total: null })
  })

  test('keeps two tasks with one name apart', () => {
    const tasks = parseRun(file('task 1 - r', 'task 2 1 frames', '[2] done', 'task 3 1 frames', '[3] 1/9'))

    expect(tasks?.map(t => t.update.state)).toEqual(['run', 'done', 'run'])
  })

  test('returns null for a half-written file', () => {
    expect(parseRun('task 1 - render\n[1] 2/10\n')).toBe(null)
  })

  test('ignores lines of other forms, and reports for unknown tasks', () => {
    const tasks = parseRun(file('task 1 - r', 'hello', '[9] 1/2', '[1] 1/2'))

    expect(tasks).toMatchObject([{ id: 1, update: { done: 1, total: 2 } }])
  })

  for (const [end, state] of [['done', 'done'], ['fail exit 1: boom', 'fail'], ['stopped', 'stopped']] as const) {
    test(`a root that ends ${state} ends its running subtasks the same, with no message`, () => {
      const tasks = parseRun(file('task 1 - r', `[1] ${end}`, 'task 2 1 a', '[2] 3/10', 'task 3 1 b', '[3] fail own'))

      expect(tasks?.[1]?.update).toMatchObject({ state, msg: '' })
      expect(tasks?.[2]?.update).toMatchObject({ state: 'fail', msg: 'own' })
    })
  }
})
