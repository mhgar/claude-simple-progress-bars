import { describe, expect, test } from 'claude-code/testing'

import { run, steady } from './fixtures'
import { counts, layout, rows, truncate, width } from '../hooks/layout'
import type { Row } from '../hooks/layout'

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

const view = (fields: { collapsed?: string[]; isCompact?: boolean; height?: number } = {}) =>
  ({ collapsed: new Set(fields.collapsed ?? []), isCompact: fields.isCompact ?? false, height: fields.height ?? 20 })
const lines = (out: Row[]) => out.map(r => text(r.pieces))
const bar = (name: string, fields: object = { done: 1, total: 10 }, root: string | null = null) => run(name, [[fields, 0]], root)

describe('rows', () => {
  const bars = 'abcdefghijkl'.split('').map(n => bar(n))
  const perRow = (w: number, n: number) => lines(rows(bars.slice(0, n), w, 0, view())).map(l => l.split('│').length)

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
    for (const line of lines(rows(bars.slice(0, 4), 200, 0, view()))) expect(width(line)).toBeLessThanOrEqual(200)
  })

  test('roots with no subtasks are no buttons', () => {
    expect(rows(bars.slice(0, 2), 200, 0, view()).map(r => r.target)).toEqual([undefined])
  })
})

describe('counts', () => {
  test('counts by state in a fixed order, and leaves out states with no bar', () => {
    const list = [bar('d', { state: 'done' }), bar('r'), bar('f', { state: 'fail' }), bar('r2')]

    expect(counts(list, 0)).toBe('2 running, 1 failed, 1 done')
  })

  test('counts a running bar with no update for 30 s as stalled', () => {
    expect(counts([bar('s')], 31_000)).toBe('1 stalled')
  })
})

describe('rows with subtasks', () => {
  const root = bar('render', { done: 2, total: 10 })
  const sub = (name: string, fields: object = { done: 1, total: 4 }) => bar(name, fields, root.key)

  test('a root with subtasks gets its own row with an open mark, and its subtasks an indented row under it', () => {
    const out = lines(rows([root, sub('frames'), sub('upload')], 200, 0, view()))

    expect(out.length).toBe(2)
    expect(out[0]?.startsWith('▾ render')).toBe(true)
    expect(out[1]?.startsWith('    frames')).toBe(true)
    expect(out[1]).toContain('upload')
  })

  test('the root row is a button with the key of its root', () => {
    expect(rows([root, sub('frames')], 200, 0, view())[0]?.target).toEqual({ root: root.key })
  })

  test('draws a subtask name dim, and a root name bold', () => {
    const [rootRow, subRow] = rows([root, sub('frames')], 200, 0, view())

    expect(rootRow?.pieces.find(p => p.text === 'render ')).toMatchObject({ bold: true })
    expect(subRow?.pieces.find(p => p.text === 'frames ')).toMatchObject({ dim: true })
  })

  test('keeps every row of a block inside the width', () => {
    for (const line of lines(rows([root, sub('a'), sub('b'), sub('c')], 120, 0, view()))) expect(width(line)).toBeLessThanOrEqual(120)
  })

  test('a collapsed root shows one row, with a shut mark and its subtasks counted by state', () => {
    const subs = [sub('a'), sub('b', { state: 'fail' }), sub('c', { state: 'done' })]

    const out = lines(rows([root, ...subs], 200, 0, view({ collapsed: [root.key] })))

    expect(out.length).toBe(1)
    expect(out[0]?.startsWith('▸ render')).toBe(true)
    expect(out[0]?.endsWith('+3: 1 running, 1 failed, 1 done')).toBe(true)
  })

  test('a narrow collapsed root drops the counts first', () => {
    const out = lines(rows([root, sub('a'), sub('b'), sub('c')], 60, 0, view({ collapsed: [root.key] })))

    expect(out[0]?.endsWith('+3')).toBe(true)
    expect(width(out[0] ?? '')).toBeLessThanOrEqual(60)
  })

  test('a root whose subtasks have all hidden packs as a normal bar', () => {
    const out = lines(rows([root, bar('tests')], 200, 0, view()))

    expect(out).toEqual([expect.stringMatching(/^render .*│ tests /)])
  })

  test('a quiet root with a busy subtask is not stalled', () => {
    const busy = { ...root, activeAt: 59_000 }

    expect(text(layout(busy, 100, 60_000))).not.toContain('no update')
  })
})

describe('band states and the last line', () => {
  // 7 roots, one a row in 100 cells: 7 rows of bars.
  const seven = 'abcdefg'.split('').map(n => bar(n))

  test('four rows or fewer have no last line, in either state', () => {
    for (const isCompact of [false, true]) expect(rows(seven.slice(0, 3), 100, 0, view({ isCompact })).length).toBe(3)
  })

  test('an expanded band shows every row, and ends with show less', () => {
    const out = rows(seven, 100, 0, view())

    expect(out.length).toBe(8)
    expect(out[7]).toMatchObject({ target: { band: true } })
    expect(text(out[7]?.pieces ?? [])).toBe('▴ show less')
  })

  test('a compact band shows 4 rows, and counts the rest', () => {
    const out = rows(seven, 100, 0, view({ isCompact: true }))

    expect(out.length).toBe(5)
    expect(text(out[4]?.pieces ?? [])).toBe('▸ 3 more: 3 running')
    expect(out[4]?.target).toEqual({ band: true })
  })

  test('a band taller than its height joins show less and the count', () => {
    const nine = 'abcdefghi'.split('').map(n => bar(n))

    const out = rows(nine, 100, 0, view({ height: 6 }))

    expect(out.length).toBe(6)
    expect(text(out[5]?.pieces ?? [])).toBe('▴ show less · 4 more: 4 running')
  })

  test('the more line counts done tasks too', () => {
    const list = [...seven.slice(0, 5), bar('x', { state: 'done' })]

    expect(text(rows(list, 100, 0, view({ isCompact: true }))[4]?.pieces ?? [])).toBe('▸ 2 more: 1 running, 1 done')
  })
})

describe('overflow', () => {
  const root = bar('render', { done: 2, total: 10 })
  const subs = 'abcdefgh'.split('').map(n => bar(`sub-${n}`, { done: 1, total: 4 }, root.key))

  test('a block that does not fit whole keeps its root row, and counts the rest of its subtasks on it', () => {
    const out = lines(rows([root, ...subs, bar('encode'), bar('tests')], 120, 0, view({ isCompact: true })))

    expect(out.length).toBe(5)
    expect(out[0]?.startsWith('▾ render')).toBe(true)
    expect(out[0]?.endsWith('+2: 2 running')).toBe(true)
    expect(out[4]).toBe('▸ 2 more: 2 running')
  })

  test('a later small group never moves up to fill a gap', () => {
    const big = [root, ...subs.slice(0, 5)] // 1 root row and 3 subtask rows in 120 cells: 4 rows
    const out = lines(rows([bar('first'), ...big, bar('last')], 120, 0, view({ isCompact: true })))

    expect(out.some(l => l.startsWith('last'))).toBe(false)
    expect(out[1]?.endsWith('+1: 1 running')).toBe(true)
    expect(out[out.length - 1]).toBe('▸ 1 more: 1 running')
  })

  test('a run that does not fit whole shows the roots that fit', () => {
    const many = 'abcdef'.split('').map(n => bar(n))

    const out = lines(rows(many, 100, 0, view({ isCompact: true })))

    expect(out.slice(0, 4).map(l => l[0])).toEqual(['a', 'b', 'c', 'd'])
    expect(out[4]).toBe('▸ 2 more: 2 running')
  })

  test('a band of one row shows only the last line', () => {
    expect(lines(rows('abc'.split('').map(n => bar(n)), 100, 0, view({ height: 1 })))).toEqual(['▴ show less · 3 more: 3 running'])
  })
})
