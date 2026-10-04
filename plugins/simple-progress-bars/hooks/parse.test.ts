import { describe, expect, test } from 'claude-code/testing'

import { parse } from './parse'

const json = (o: object) => JSON.stringify({ state: 'run', done: 1, total: 10, unit: '', detail: '', msg: '', pid: 100, ...o })

describe('parse', () => {
  test('reads every field of a record', () => {
    const text = json({ done: 17, total: 240, detail: 'clip.mkv', pid: 4242 })

    const u = parse(text)

    expect(u).toEqual({ state: 'run', done: 17, total: 240, unit: '', detail: 'clip.mkv', msg: '', pid: 4242 })
  })

  const cases: [string, string, object][] = [
    ['a total of 0 means no total', json({ total: 0 }), { total: null }],
    ['a negative count reads as 0', json({ done: -5 }), { done: 0 }],
    ['pid 1 is no owner', json({ pid: 1 }), { pid: null }],
    ['a fractional pid is no owner', json({ pid: 4.5 }), { pid: null }],
    ['an unknown state reads as run', json({ state: 'paused' }), { state: 'run' }],
    ['an unknown unit reads as a count', json({ unit: 'KB' }), { unit: '' }],
  ]
  for (const [name, text, fields] of cases) {
    test(name, () => {
      expect(parse(text)).toMatchObject(fields)
    })
  }

  for (const text of ['', '{"state": "ru', '42', 'null', 'done']) {
    test(`returns null for ${JSON.stringify(text)}`, () => {
      expect(parse(text)).toBe(null)
    })
  }
})
