import { describe, expect, test } from 'claude-code/testing'

import { parse } from '../hooks/parse'

const g = 1024 ** 3

describe('parse', () => {
  const cases: [string, string, object][] = [
    ['a count with detail', '17/240 clip.mkv', { done: 17, total: 240, unit: '', detail: 'clip.mkv' }],
    ['sizes', '1.5G/4GiB', { done: 1.5 * g, total: 4 * g, unit: 'B' }],
    ['thousands groups', '1,000/2,000', { done: 1000, total: 2000 }],
    ['a percent', '42% halfway', { done: 42, total: 100, unit: '%', detail: 'halfway' }],
    ['adds after a total', 'total 50\n+1\n+1\n+3', { done: 5, total: 50 }],
    ['an add with a size', '+512M', { done: 512 * 1024 ** 2, unit: 'B' }],
    ['text keeps the count and the total', '3/9\nScanning disk', { done: 3, total: 9, detail: 'Scanning disk' }],
    ['done fills the count to the total', '3/10\ndone', { state: 'done', done: 10, total: 10 }],
    ['fail keeps the count and gives the message', '3/10\nfail disk full', { state: 'fail', done: 3, msg: 'disk full' }],
    ['a report after done starts a new run', '1/2\ndone\n+1', { state: 'run', done: 1, total: null }],
    ['a total of 0 is text', '3/0', { total: null, detail: '3/0' }],
    ['a percent above 100 is text', '150%', { total: null, detail: '150%' }],
    ['the word total with no size is text', 'total of files', { total: null, detail: 'total of files' }],
    ['CRLF line ends', '1/4\r\n2/4\r\n', { done: 2, total: 4 }],
  ]
  for (const [name, text, fields] of cases) {
    test(name, () => {
      expect(parse(text)).toMatchObject(fields)
    })
  }

  for (const text of ['', '\n\n', '   ']) {
    test(`returns null for ${JSON.stringify(text)}`, () => {
      expect(parse(text)).toBe(null)
    })
  }
})
