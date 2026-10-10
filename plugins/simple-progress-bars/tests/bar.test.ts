import { describe, expect, test } from 'claude-code/testing'

import { isExpired, revive, stale } from '../hooks/bar'
import { run, steady } from './fixtures'

describe('apply', () => {
  test('a steady rate gives an estimate of the items left', () => {
    const bar = run('job', steady(100, 3)) // 2 of 100 at 2 s, 1 item a second

    expect(Math.round((bar.eta ?? 0) / 1000)).toBe(98)
  })

  test('an update with no new count keeps the estimate', () => {
    const before = run('job', steady(100, 3))

    const after = run('job', [...steady(100, 3), [{ done: 2, total: 100, detail: 'still here' }, 7000]])

    expect([after.eta, after.progressAt]).toEqual([before.eta, before.progressAt])
  })

  test('repeated updates do not raise the next rate sample', () => {
    const repeats: [object, number][] = [2200, 2400, 2600, 2800].map(t => [{ done: 2, total: 100 }, t])

    const bar = run('job', [...steady(100, 3), ...repeats, [{ done: 3, total: 100 }, 3000]])

    expect(Math.round((bar.rate ?? 0) * 1000)).toBe(1) // 1 item a second, not 5
  })

  test('an unchanged update keeps the bar and its update time', () => {
    const bar = run('job', [[{ done: 1, total: 5 }, 0], [{ done: 1, total: 5 }, 9000]])

    expect(bar.updatedAt).toBe(0)
  })

  test('a running bar at its total stays running', () => {
    const bar = run('job', [[{ done: 0, total: 3 }, 0], [{ done: 3, total: 3 }, 1000]])

    expect(bar.state).toBe('run')
  })

  test('a new total starts the rate again', () => {
    const bar = run('job', [...steady(100, 3), [{ done: 2, total: 200 }, 3000]])

    expect(bar.rate).toBe(null)
  })

  test('fail shows its message', () => {
    const bar = run('job', [[{ done: 3, total: 10 }, 0], [{ state: 'fail', done: 3, total: 10, msg: 'disk full' }, 1000]])

    expect(bar).toMatchObject({ state: 'fail', label: 'disk full' })
  })

  test('stopped ends the bar with its message', () => {
    const bar = run('job', [[{ done: 1, total: 5 }, 0], [{ state: 'stopped', done: 1, total: 5, msg: 'interrupted' }, 1000]])

    expect(bar).toMatchObject({ state: 'stopped', label: 'interrupted', endedAt: 1000 })
  })
})

describe('stale and revive', () => {
  test('a stale running bar shows stopped from the time the file went stale', () => {
    const bar = stale(run('job', [[{ done: 1, total: 3 }, 0]]), 15_000)

    expect(bar).toMatchObject({ state: 'stopped', isStale: true, endedAt: 15_000 })
  })

  test('a stale bar runs again with its start time', () => {
    const bar = revive(stale(run('job', [[{ done: 1, total: 3 }, 0]]), 15_000))

    expect(bar).toMatchObject({ state: 'run', isStale: false, endedAt: null, startedAt: 0 })
  })

  test('an ended bar does not go stale', () => {
    const done = run('job', [[{ state: 'done', done: 3, total: 3 }, 0]])

    expect(stale(done, 15_000).state).toBe('complete')
  })
})

describe('isExpired', () => {
  const ended = (state: 'done' | 'fail' | 'stopped') => run('job', [[{ done: 1, total: 2 }, 0], [{ state, done: 1, total: 2 }, 1]])
  const cases: [string, ReturnType<typeof run>, number, boolean][] = [
    ['complete, after 5 s', ended('done'), 5002, false],
    ['complete, at 10 s', ended('done'), 10_001, false],
    ['complete, after 10 s', ended('done'), 10_002, true],
    ['failed, at 10 s', ended('fail'), 10_001, false],
    ['failed, after 10 s', ended('fail'), 10_002, true],
    ['stopped, after 10 s', ended('stopped'), 10_002, true],
    ['running, after a day', run('job', [[{ done: 1, total: 2 }, 0]]), 86_400_000, false],
  ]
  for (const [name, bar, now, expected] of cases) {
    test(`${name}: ${expected ? 'expired' : 'kept'}`, () => {
      expect(isExpired(bar, now)).toBe(expected)
    })
  }
})
