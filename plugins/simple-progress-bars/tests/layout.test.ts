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
  const bars = 'abcdefgh'.split('').map(n => bar(n))

  test('each bar has a row of its own, at every width', () => {
    for (const w of [60, 120, 300]) expect(rows(bars.slice(0, 4), w, 0, view()).length).toBe(4)
  })

  test('every row has the same width, inside the band', () => {
    const list = [bar('Convert videos', { done: 64, total: 90, detail: 'clip_064.mkv' }), bar('Thumbnails', { done: 120, total: 120 })]
    for (const w of [40, 120, 300]) {
      const widths = lines(rows(list, w, 0, view())).map(l => width(l))
      expect(new Set(widths).size).toBe(1)
      expect(widths[0]).toBeLessThanOrEqual(w)
    }
  })

  test('aligns the tracks and the percents of all rows', () => {
    const list = [bar('Convert videos', { done: 64, total: 90 }), bar('Thumbnails', { done: 120, total: 120 })]

    const [one, two] = lines(rows(list, 160, 0, view()))

    expect(one?.indexOf('━')).toBe(two?.indexOf('━'))
    expect(one?.indexOf('%')).toBe(two?.indexOf('%'))
  })

  test('the name column follows the longest name on screen', () => {
    const short = lines(rows([bar('ab'), bar('cd')], 200, 0, view()))[0] ?? ''
    const long = lines(rows([bar('ab'), bar('a longer name')], 200, 0, view()))[0] ?? ''

    expect(long.indexOf('━') - short.indexOf('━')).toBe('a longer name'.length - 2)
  })

  test('cuts a name past a quarter of the width', () => {
    const out = lines(rows([bar('Download the Ubuntu desktop image')], 100, 0, view()))[0] ?? ''

    expect(out.startsWith('  Download the Ubuntu desk… ')).toBe(true) // 25 cells of name
  })

  test('the track is at most as wide as the other columns, so a wide band does not stretch it', () => {
    const out = lines(rows([bar('Thumbnails', { done: 1, total: 4 })], 300, 0, view()))[0] ?? ''
    const trackCells = [...out].filter(ch => ch === '━' || ch === '─' || ch === '╸').length

    expect(trackCells).toBe(width(out) - trackCells)
  })

  test('a narrow band drops whole columns, and keeps the gutter, the name, and the track', () => {
    const list = [bar('Convert videos', { done: 64, total: 90, detail: 'clip_064.mkv' }), bar('Thumbnails', { done: 3, total: 4 })]

    const out = lines(rows(list, 30, 0, view()))

    expect(out[0]).toMatch(/^ {2}Convert… {2}[━─╸]+$/)
    expect(out[1]).toMatch(/^ {2}Thumbna… {2}[━─╸]+$/)
  })

  test('roots with no subtasks are no buttons', () => {
    expect(rows(bars.slice(0, 2), 200, 0, view()).map(r => r.target)).toEqual([undefined, undefined])
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

  test('a root with subtasks has an open mark, and each subtask a row under it, 4 cells to the right', () => {
    const out = lines(rows([root, sub('frames'), sub('upload')], 200, 0, view()))

    expect(out.length).toBe(3)
    expect(out[0]?.startsWith('▾ render')).toBe(true)
    expect(out[1]?.startsWith('      frames')).toBe(true)
    expect(out[2]?.startsWith('      upload')).toBe(true)
  })

  test('the root row is a button with the key of its root', () => {
    expect(rows([root, sub('frames')], 200, 0, view())[0]?.target).toEqual({ root: root.key })
  })

  test('draws a subtask name dim, and a root name bold', () => {
    const [rootRow, subRow] = rows([root, sub('frames')], 200, 0, view())

    expect(rootRow?.pieces.find(p => p.text.startsWith('render'))).toMatchObject({ bold: true })
    expect(subRow?.pieces.find(p => p.text.includes('frames'))).toMatchObject({ dim: true })
  })

  test('a collapsed root shows one row, with a shut mark and its subtasks counted by state', () => {
    const subs = [sub('a'), sub('b', { state: 'fail' }), sub('c', { state: 'done' })]

    const out = lines(rows([root, ...subs], 200, 0, view({ collapsed: [root.key] })))

    expect(out.length).toBe(1)
    expect(out[0]?.startsWith('▸ render')).toBe(true)
    expect(out[0]?.trimEnd().endsWith('+3: 1 running, 1 failed, 1 done')).toBe(true)
  })

  test('a narrow collapsed root drops the counts first', () => {
    const out = lines(rows([root, sub('a'), sub('b'), sub('c')], 60, 0, view({ collapsed: [root.key] })))

    expect(out[0]?.trimEnd().endsWith('+3')).toBe(true)
    expect(width(out[0] ?? '')).toBeLessThanOrEqual(60)
  })

  test('a root whose subtasks have all hidden shows as a normal bar', () => {
    const out = rows([root, bar('tests')], 200, 0, view())

    expect(out.map(r => r.target)).toEqual([undefined, undefined])
  })

  test('a quiet root with a busy subtask is not stalled', () => {
    const busy = { ...root, activeAt: 59_000 }

    expect(text(layout(busy, 100, 60_000))).not.toContain('no update')
  })
})

describe('band states and the last line', () => {
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
  })

  test('a band taller than its height joins show less and the count', () => {
    const out = rows('abcdefghi'.split('').map(n => bar(n)), 100, 0, view({ height: 6 }))

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
    expect(out[0]?.trimEnd().endsWith('+5: 5 running')).toBe(true)
    expect(out[4]).toBe('▸ 2 more: 2 running')
  })

  test('a later small group never moves up to fill a gap', () => {
    const out = lines(rows([bar('first'), root, ...subs.slice(0, 3), bar('last')], 120, 0, view({ isCompact: true })))

    expect(out.some(l => l.includes('last'))).toBe(false)
    expect(out[1]?.trimEnd().endsWith('+1: 1 running')).toBe(true)
    expect(out[out.length - 1]).toBe('▸ 1 more: 1 running')
  })

  test('a run that does not fit whole shows the roots that fit', () => {
    const out = lines(rows('abcdef'.split('').map(n => bar(n)), 100, 0, view({ isCompact: true })))

    expect(out.slice(0, 4).map(l => l.trim()[0])).toEqual(['a', 'b', 'c', 'd'])
    expect(out[4]).toBe('▸ 2 more: 2 running')
  })

  test('a band of one row shows only the last line', () => {
    expect(lines(rows('abc'.split('').map(n => bar(n)), 100, 0, view({ height: 1 })))).toEqual(['▴ show less · 3 more: 3 running'])
  })
})
