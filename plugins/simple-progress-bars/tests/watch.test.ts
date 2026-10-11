import { describe, expect, test } from 'claude-code/testing'

import type { Bar } from '../types'
import { parseRun } from '../hooks/parse'
import { hide, ingest, isSessionFile, settle } from '../hooks/watch'
import type { Hidden, RunFile } from '../hooks/watch'

const F = '/s/100-1700000000'
const byKey = (bars: Bar[]) => new Map(bars.map(b => [b.key, b]))
const runFile = (mtimeMs: number, ...lines: string[]): RunFile =>
  ({ file: F, mtimeMs, tasks: parseRun([...lines, 'end'].join('\n')) })
const mtimes = (at: number) => new Map([[F, at]])

describe('ingest', () => {
  test('makes one bar for each task, with its root', () => {
    const bars = ingest(new Map(), [runFile(5, 'task 1 - render', '[1] 1/4', 'task 2 1 frames')], new Map())

    expect(bars).toMatchObject([
      { key: `${F}#1`, root: null, name: 'render', done: 1, total: 4 },
      { key: `${F}#2`, root: `${F}#1`, name: 'frames' },
    ])
  })

  test('keeps the bars of a file that was not read or was half written', () => {
    const prev = ingest(new Map(), [runFile(5, 'task 1 - render', '[1] 1/4')], new Map())

    expect(ingest(byKey(prev), [{ file: F, mtimeMs: 6, tasks: null }], new Map())).toEqual(prev)
  })

  test('drops a task that is no longer in the file', () => {
    const prev = ingest(new Map(), [runFile(5, 'task 1 - r', 'task 2 1 a')], new Map())

    expect(ingest(byKey(prev), [runFile(6, 'task 1 - r')], new Map()).map(b => b.name)).toEqual(['r'])
  })

  test('drops the bars of a file that is gone', () => {
    const prev = ingest(new Map(), [runFile(5, 'task 1 - r')], new Map())

    expect(ingest(byKey(prev), [], new Map())).toEqual([])
  })

  test('a task that ended and hid does not show again when its file changes', () => {
    const hidden: Hidden = new Map([[`${F}#2`, Infinity]])

    const bars = ingest(new Map(), [runFile(99, 'task 1 - r', 'task 2 1 a', '[2] done')], hidden)

    expect(bars.map(b => b.name)).toEqual(['r'])
  })

  test('a task that went stale and hid shows again when its file changes', () => {
    const hidden: Hidden = new Map([[`${F}#1`, 5]])

    expect(ingest(new Map(), [runFile(5, 'task 1 - r')], hidden).length).toBe(0)
    expect(ingest(new Map(), [runFile(6, 'task 1 - r')], hidden).length).toBe(1)
  })

  test('a file with no end line, such as an old .owner record, shows no bar', () => {
    const owner = { file: '/s/.owner', mtimeMs: 5, tasks: parseRun('{"pid":42,"procStart":"1"}\n') }

    expect(ingest(new Map(), [owner], new Map())).toEqual([])
  })
})

describe('isSessionFile', () => {
  const ids = new Set(['abc', 'def'])
  const cases = [
    ['a name with the session ID and a dot belongs', 'abc.4242-1700000000', true],
    ['a name of an earlier session ID belongs', 'def.1-1700000000', true],
    ['a name of another session does not belong', 'xyz.4242-1700000000', false],
    ['a session ID that starts another ID does not match', 'abc-2.4242-1700000000', false],
    ['a name with no dot does not belong', 'abc', false],
    ['a dot file does not belong', '.owner', false],
  ] as const
  for (const [name, file, expected] of cases) {
    test(name, () => {
      expect(isSessionFile(file, ids)).toBe(expected)
    })
  }
})

describe('settle', () => {
  const bars = (at: number) => ingest(new Map(), [runFile(at, 'task 1 - r', '[1] 1/3')], new Map())

  test('a running bar of a fresh file keeps running', () => {
    expect(settle(bars(0), mtimes(0), 10_000).bars[0]?.state).toBe('run')
  })

  test('a running bar of a file older than 10 s shows stopped', () => {
    expect(settle(bars(0), mtimes(0), 10_001).bars[0]).toMatchObject({ state: 'stopped', isStale: true })
  })

  test('a stalled bar whose file gets heartbeats stays for 1 hour', () => {
    const beat = ingest(byKey(bars(0)), [runFile(3_600_000, 'task 1 - r', '[1] 1/3')], new Map())

    const { bars: kept, expired } = settle(beat, mtimes(3_600_000), 3_600_100)

    expect([kept[0]?.state, kept[0]?.activeAt, expired.length]).toEqual(['run', 0, 0])
  })

  test('a stale bar runs again when its file changes', () => {
    const stopped = settle(bars(0), mtimes(0), 10_001).bars

    expect(settle(stopped, mtimes(20_000), 20_100).bars[0]?.state).toBe('run')
  })

  test('a subtask report keeps its root active', () => {
    const root = ingest(new Map(), [runFile(0, 'task 1 - r', 'task 2 1 a')], new Map())
    const later = ingest(byKey(root), [runFile(9000, 'task 1 - r', 'task 2 1 a', '[2] 1/5')], new Map())

    expect(settle(later, mtimes(9000), 9100).bars.find(b => b.name === 'r')?.activeAt).toBe(9000)
  })

  test('splits off a complete bar after its hold, and hides it for good', () => {
    const done = ingest(new Map(), [runFile(0, 'task 1 - r', '[1] done')], new Map())
    const hidden: Hidden = new Map()

    const { bars: kept, expired } = settle(done, mtimes(0), 11_000)
    hide(hidden, expired, mtimes(0))

    expect([kept.length, expired.length, hidden.get(`${F}#1`)]).toEqual([0, 1, Infinity])
  })

  test('hides a stale bar only until its file changes', () => {
    const hidden: Hidden = new Map()
    const { expired } = settle(bars(0), mtimes(0), 21_000)

    hide(hidden, expired, mtimes(0))

    expect(hidden.get(`${F}#1`)).toBe(0)
  })
})
