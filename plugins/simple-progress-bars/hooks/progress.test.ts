import { describe, expect, test } from 'claude-code/testing'

import type { Bar } from '../types'
import { apply, isExpired, layout, parse, promptSection, rows, stop, truncate } from './progress'

const text = (pieces: { text: string }[]) => pieces.map(p => p.text).join('')
const cells = (s: string) => [...s].length
const json = (o: object) => JSON.stringify({ v: 1, unit: '', detail: '', pid: 100, ...o })

function run(name: string, updates: [string, number][]): Bar {
  let bar: Bar | undefined
  for (const [l, at] of updates) bar = apply(bar, name, parse(l)!, at)
  return bar!
}

describe('parse', () => {
  test('reads the JSON that the command writes', () => {
    expect(parse(json({ state: 'run', done: 17, total: 240, detail: 'clip.mkv' }))).toEqual({
      state: 'run', done: 17, total: 240, unit: '', detail: 'clip.mkv', msg: '', pid: 100,
    })
    expect(parse(json({ state: 'run', done: 5, total: 0 }))?.total).toBe(null)
    expect(parse('{"state": "ru')).toBe(null) // a partial write
  })

  test('reads plain lines from echo', () => {
    expect(parse('17/240 clip.mkv')).toMatchObject({ done: 17, total: 240, detail: 'clip.mkv', pid: null })
    expect(parse('42%')).toMatchObject({ done: 42, total: 100, unit: '%' })
    expect(parse('Scanning disk')).toMatchObject({ total: null, detail: 'Scanning disk' })
    expect(parse('fail disk full')).toMatchObject({ state: 'fail', msg: 'disk full' })
    expect(parse('1/10\n2/10\n\n')).toMatchObject({ done: 2 })
    expect(parse('  \n')).toBe(null)
  })
})

describe('estimate', () => {
  test('waits for 3 updates, then counts down at a steady rate', () => {
    // 1 item per second, 100 items.
    const bar = run('job', [['0/100', 0], ['1/100', 1000], ['2/100', 2000]])
    expect(text(layout(bar, 120, 2000))).toContain('~1:38 left')
    expect(text(layout(bar, 120, 12_000))).toContain('~1:28 left')
    expect(text(layout(run('job', [['0/100', 0], ['1/100', 1000]]), 120, 1000))).toContain('estimating…')
  })

  test('shows sizes and a rate for bytes', () => {
    const at = (done: number, t: number): [string, number] =>
      [json({ state: 'run', done, total: 4 * 1024 ** 3, unit: 'B' }), t]
    const bar = run('download', [at(0, 0), at(1024 ** 3, 1000), at(2 * 1024 ** 3, 2000)])
    const out = text(layout(bar, 140, 2000))
    expect(out).toContain('2.0G/4.0G')
    expect(out).toContain('1.0G/s')
  })
})

describe('states', () => {
  test('a live process keeps a quiet bar. A dead one turns it to stopped', () => {
    const bar = run('job', [[json({ state: 'run', done: 1, total: 10 }), 0]])
    expect(text(layout(bar, 100, 40_000))).toContain('no update')
    expect(isExpired(bar, 3_600_000, true)).toBe(false)

    const stopped = stop(bar, 50_000)
    expect(stopped.state).toBe('stopped')
    expect(text(layout(stopped, 100, 50_000))).toContain('stopped')
    expect(isExpired(stopped, 79_000, false)).toBe(false)
    expect(isExpired(stopped, 81_000, false)).toBe(true)
  })

  test('a bar with no process expires after 10 minutes', () => {
    const bar = run('job', [['1/10', 0]])
    expect(isExpired(bar, 9 * 60_000, false)).toBe(false)
    expect(isExpired(bar, 11 * 60_000, false)).toBe(true)
  })

  test('done keeps the last numbers. Fail shows its message', () => {
    const done = run('job', [['3/10', 0], ['done', 1000]])
    expect(done).toMatchObject({ state: 'complete', done: 10, total: 10 })
    expect(isExpired(done, 2500, false)).toBe(false)
    expect(isExpired(done, 3500, false)).toBe(true)

    const failed = run('job', [['3/10', 0], ['fail disk full', 1000]])
    expect(failed).toMatchObject({ state: 'fail', done: 3, label: 'disk full' })
    expect(text(layout(failed, 100, 1000))).toContain('failed')
  })
})

describe('layout', () => {
  test('fills the width exactly at many widths', () => {
    const bar = run('convert-videos', [['0/240', 0], ['18/240 clip_018.mkv', 18_000]])
    for (const w of [40, 60, 80, 120, 200]) {
      expect(cells(text(layout(bar, w, 18_000)))).toBe(w)
    }
  })

  test('truncates a long task name with an ellipsis', () => {
    const bar = run('an-extremely-long-task-name-for-a-backup-job', [['0/10', 0]])
    const head = layout(bar, 200, 0)[0]?.text ?? ''
    expect(head).toBe(truncate(bar.name, 20) + ' ')
    expect(head.endsWith('… ')).toBe(true)
  })

  test('reflows into balanced rows of at least 50 cells, then +N', () => {
    const bars = 'abcdefghijk'.split('').map(n => run(n, [['1/10', 0]]))
    const counts = (w: number, n: number) => rows(bars.slice(0, n), w, 0).map(r => text(r).split('│').length)

    expect(counts(200, 3)).toEqual([3]) // 3 fit on one row
    expect(counts(200, 4)).toEqual([2, 2]) // balanced, not 3 + 1
    expect(counts(100, 2)).toEqual([1, 1])
    for (const row of rows(bars.slice(0, 4), 200, 0)) expect(cells(text(row))).toBeLessThanOrEqual(200)

    const full = rows(bars, 100, 0) // 11 bars, 1 per row
    expect(full.length).toBe(3)
    expect(text(full[2] ?? [])).toContain('+8')

    const one = rows(bars, 100, 0, 1) // the maxRows setting
    expect(one.length).toBe(1)
    expect(text(one[0] ?? [])).toContain('+10')
  })
})

test('the prompt section names the time threshold', () => {
  expect(promptSection(90)).toContain('about 90 seconds')
})
