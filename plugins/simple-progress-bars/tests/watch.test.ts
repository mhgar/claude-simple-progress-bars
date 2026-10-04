import { describe, expect, test } from 'claude-code/testing'

import type { Bar } from '../types'
import { run, upd } from './fixtures'
import { ingest, isTaskName, needsRead, settle } from '../hooks/watch'

const byKey = (bars: Bar[]) => new Map(bars.map(b => [b.key, b]))

describe('ingest', () => {
  test('drops a bar whose file is gone', () => {
    expect(ingest(byKey([run('a', [[{ done: 1, total: 2 }, 0]])]), [])).toEqual([])
  })

  test('keeps a bar whose file was not read', () => {
    const prev = [run('a', [[{ done: 1, total: 2 }, 0]])]

    expect(ingest(byKey(prev), [{ key: '/d/a', name: 'a', mtimeMs: 5, update: null }])).toEqual(prev)
  })

  test('adds a bar for a new file', () => {
    const bars = ingest(new Map(), [{ key: '/d/b', name: 'b', mtimeMs: 5, update: upd({ done: 1, total: 4 }) }])

    expect(bars[0]).toMatchObject({ key: '/d/b', name: 'b', done: 1, total: 4 })
  })
})

describe('needsRead', () => {
  const bar = run('a', [[{ done: 1, total: 2 }, 100]])
  for (const [name, mtime, expected] of [['an unchanged file', 100, false], ['a newer file', 101, true]] as const) {
    test(`${name}: ${expected ? 'read' : 'skip'}`, () => {
      expect(needsRead(bar, mtime)).toBe(expected)
    })
  }
})

describe('isTaskName', () => {
  for (const [name, expected] of [['convert', true], ['job.lock', true], ['.convert.4242', false]] as const) {
    test(`${name}: ${expected}`, () => {
      expect(isTaskName(name)).toBe(expected)
    })
  }
})

describe('settle', () => {
  const inCall = run('a', [[{ done: 1, total: 3 }, 1000]]) // started and last updated at 1 s

  test('a bar whose call ended stops', () => {
    const { bars } = settle([inCall], [{ start: 500, end: 2000 }], 2100)

    expect(bars[0]?.state).toBe('stopped')
  })

  test('a bar at its total whose call ended is complete', () => {
    const atTotal = run('a', [[{ done: 3, total: 3 }, 1000]])

    expect(settle([atTotal], [{ start: 500, end: 2000 }], 2100).bars[0]?.state).toBe('complete')
  })

  test('a bar that another running call can own keeps running', () => {
    const calls = [{ start: 500, end: 2000 }, { start: 800, end: null }]

    expect(settle([inCall], calls, 2100).bars[0]?.state).toBe('run')
  })

  test('a bar updated after the call ended keeps running', () => {
    const background = run('a', [[{ done: 1, total: 3 }, 1000], [{ done: 2, total: 3 }, 2500]])

    expect(settle([background], [{ start: 500, end: 2000 }], 2600).bars[0]?.state).toBe('run')
  })

  test('a bar that started before the call keeps running', () => {
    expect(settle([inCall], [{ start: 1500, end: 2000 }], 2100).bars[0]?.state).toBe('run')
  })

  test('splits off a complete bar after its hold', () => {
    const { bars, expired } = settle([run('a', [[{ state: 'done', done: 3, total: 3 }, 0]])], [], 5000)

    expect([bars.length, expired.length]).toEqual([0, 1])
  })
})
