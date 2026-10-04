import { describe, expect, test } from 'claude-code/testing'

import { apply, isExpired, stop } from '../hooks/bar'
import { run, steady, upd } from './fixtures'

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

  test('a run after done starts with a new start time', () => {
    const bar = run('job', [[{ done: 1, total: 2 }, 0], [{ state: 'done', done: 2, total: 2 }, 1000], [{ done: 1, total: 5 }, 9000]])

    expect(bar).toMatchObject({ state: 'run', startedAt: 9000 })
  })

  test('a stopped bar that gets an update resumes with its start time', () => {
    const stopped = stop(run('job', [[{ done: 1, total: 5 }, 0]]), 500)

    const bar = apply(stopped, stopped.key, stopped.name, upd({ done: 2, total: 5 }), 4000)

    expect(bar).toMatchObject({ state: 'run', startedAt: 0, endedAt: null })
  })
})

describe('stop', () => {
  test('a bar at its total ends complete', () => {
    expect(stop(run('job', [[{ done: 3, total: 3 }, 0]]), 500).state).toBe('complete')
  })

  test('a bar below its total ends stopped', () => {
    expect(stop(run('job', [[{ done: 1, total: 3 }, 0]]), 500).state).toBe('stopped')
  })
})

describe('isExpired', () => {
  const ended = (state: 'done' | 'fail') => run('job', [[{ done: 1, total: 2 }, 0], [{ state, done: 1, total: 2 }, 0]])
  const running = run('job', [[{ done: 1, total: 2 }, 0]])
  const cases: [string, ReturnType<typeof run>, number, boolean, boolean][] = [
    ['complete, at 2 s', ended('done'), 2000, false, false],
    ['complete, after 2 s', ended('done'), 2001, false, true],
    ['failed, at 30 s', ended('fail'), 30_000, false, false],
    ['failed, after 30 s', ended('fail'), 30_001, false, true],
    ['running in a running call, after an hour', running, 3_600_000, true, false],
    ['running with no call, at 10 min', running, 600_000, false, false],
    ['running with no call, after 10 min', running, 600_001, false, true],
  ]
  for (const [name, bar, now, isOwned, expected] of cases) {
    test(`${name}: ${expected ? 'expired' : 'kept'}`, () => {
      expect(isExpired(bar, now, isOwned)).toBe(expected)
    })
  }
})
