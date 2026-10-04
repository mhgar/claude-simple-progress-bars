import { describe, expect, test } from 'claude-code/testing'

import { run, steady } from './fixtures'
import { layout, rows, truncate, width } from '../hooks/layout'

const text = (pieces: { text: string }[]) => pieces.map(p => p.text).join('')

describe('layout', () => {
  for (const w of [1, 5, 12, 40, 80, 200]) {
    test(`fills exactly ${w} cells`, () => {
      const bar = run('convert-videos', [[{ done: 18, total: 240, detail: 'clip_018.mkv' }, 0]])

      const line = text(layout(bar, w, 0))

      expect(width(line)).toBe(w)
    })
  }

  test('shows the count of a bar with no total', () => {
    const bar = run('scan', [[{ done: 1234 }, 0]])

    expect(text(layout(bar, 80, 0))).toContain('1234')
  })

  test('shows 29 of 100 as 29%', () => {
    const bar = run('job', [[{ done: 29, total: 100 }, 0]])

    expect(text(layout(bar, 80, 0))).toContain(' 29%')
  })

  test('shows sizes and a rate for bytes', () => {
    const g = 1024 ** 3
    const bar = run('download', [[{ done: 0, total: 4 * g, unit: 'B' }, 0], [{ done: g, total: 4 * g, unit: 'B' }, 1000], [{ done: 2 * g, total: 4 * g, unit: 'B' }, 2000]])

    expect(text(layout(bar, 140, 2000))).toContain('2.0G/4.0G  50%  1.0G/s')
  })

  test('counts the estimate down between updates', () => {
    const bar = run('job', steady(100, 3))

    expect(text(layout(bar, 120, 12_000))).toContain('~1:28 left')
  })

  test('shows estimating before 3 counted updates', () => {
    const bar = run('job', steady(100, 2))

    expect(text(layout(bar, 120, 1000))).toContain('estimating…')
  })

  test('shows no update after 30 s of silence', () => {
    const bar = run('job', [[{ done: 1, total: 10 }, 0]])

    expect(text(layout(bar, 100, 31_000))).toContain('no update 0:31')
  })

  test('shows finishing at the total while the script runs', () => {
    const bar = run('job', [[{ done: 0, total: 3 }, 0], [{ done: 3, total: 3 }, 1000]])

    expect(text(layout(bar, 100, 1000))).toContain('finishing…')
  })
})

describe('truncate', () => {
  test('cuts a long name with an ellipsis', () => {
    expect(truncate('an-extremely-long-task-name', 10)).toBe('an-extrem…')
  })

  test('counts wide characters as two cells', () => {
    const cut = truncate('変換中のビデオファイル', 9)

    expect(width(cut)).toBeLessThanOrEqual(9)
    expect(cut.endsWith('…')).toBe(true)
  })
})

describe('rows', () => {
  const bars = 'abcdefghijk'.split('').map(n => run(n, [[{ done: 1, total: 10 }, 0]]))
  const perRow = (w: number, n: number, max = 3) => rows(bars.slice(0, n), w, 0, max).map(r => text(r).split('│').length)

  const cases: [number, number, number[]][] = [
    [200, 3, [3]], // three fit on one row
    [200, 4, [2, 2]], // balanced, not 3 and 1
    [100, 2, [1, 1]], // one bar a row under 103 cells
  ]
  for (const [w, n, expected] of cases) {
    test(`${n} bars in ${w} cells make rows of ${expected.join(' and ')}`, () => {
      expect(perRow(w, n)).toEqual(expected)
    })
  }

  test('keeps every row inside the width', () => {
    for (const row of rows(bars.slice(0, 4), 200, 0, 3)) expect(width(text(row))).toBeLessThanOrEqual(200)
  })

  test('shows the bars past the row limit as +N', () => {
    const out = rows(bars, 100, 0, 1)

    expect(out.length).toBe(1)
    expect(text(out[0] ?? [])).toContain('+10')
  })
})
