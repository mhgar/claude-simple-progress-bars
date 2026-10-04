import { describe, expect, test } from 'claude-code/testing'

import { run, upd } from './fixtures'
import { ingest, isTaskName, needsRead, settle, watchedPids } from './watch'

describe('ingest', () => {
  test('drops a bar whose file is gone', () => {
    const prev = [run('a', [[{ state: 'fail', done: 1, total: 2 }, 0]])]

    expect(ingest(prev, [])).toEqual([])
  })

  test('keeps a bar whose file did not parse', () => {
    const prev = [run('a', [[{ done: 1, total: 2 }, 0]])]

    const bars = ingest(prev, [{ key: '/d/a', name: 'a', mtimeMs: 5, update: null }])

    expect(bars).toEqual(prev)
  })

  test('adds a bar for a new file', () => {
    const bars = ingest([], [{ key: '/d/b', name: 'b', mtimeMs: 5, update: upd({ done: 1, total: 4 }) }])

    expect(bars[0]).toMatchObject({ key: '/d/b', name: 'b', done: 1, total: 4 })
  })
})

describe('needsRead', () => {
  const bar = run('a', [[{ done: 1, total: 2 }, 100]])
  const cases: [string, number, boolean][] = [['an unchanged file', 100, false], ['a newer file', 101, true]]
  for (const [name, mtime, expected] of cases) {
    test(`${name}: ${expected ? 'read' : 'skip'}`, () => {
      expect(needsRead(bar, mtime)).toBe(expected)
    })
  }
})

describe('isTaskName', () => {
  for (const [name, expected] of [['convert', true], ['convert.lock', false], ['convert.123.tmp', false]] as const) {
    test(`${name}: ${expected}`, () => {
      expect(isTaskName(name)).toBe(expected)
    })
  }
})

describe('settle', () => {
  test('a dead owner at the total ends complete', () => {
    const bar = run('a', [[{ done: 3, total: 3, pid: 50 }, 0]])

    const { bars } = settle([bar], new Set(), 100)

    expect(bars[0]?.state).toBe('complete')
  })

  test('a dead owner below the total ends stopped', () => {
    const bar = run('a', [[{ done: 1, total: 3, pid: 50 }, 0]])

    const { bars } = settle([bar], new Set(), 100)

    expect(bars[0]?.state).toBe('stopped')
  })

  test('a live owner keeps a silent bar running', () => {
    const bar = run('a', [[{ done: 1, total: 3, pid: 50 }, 0]])

    const { bars, expired } = settle([bar], new Set([50]), 3_600_000)

    expect([bars[0]?.state, expired.length]).toEqual(['run', 0])
  })

  test('splits off a complete bar after its hold', () => {
    const bar = run('a', [[{ state: 'done', done: 3, total: 3 }, 0]])

    const { bars, expired } = settle([bar], new Set(), 5000)

    expect([bars.length, expired.length]).toEqual([0, 1])
  })
})

describe('watchedPids', () => {
  test('lists each owner of a running bar once', () => {
    const bars = [run('a', [[{ pid: 7 }, 0]]), run('b', [[{ pid: 7 }, 0]]), run('c', [[{ state: 'done', pid: 8 }, 0]])]

    expect(watchedPids(bars)).toEqual([7])
  })
})
