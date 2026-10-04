import { describe, expect, test } from 'claude-code/testing'

import { promptSection, SHIM } from './prompt'

describe('promptSection', () => {
  test('names the time threshold', () => {
    expect(promptSection(90)).toContain('about 90 seconds')
  })

  test('gives the shim for scripts that run outside Claude Code', () => {
    expect(promptSection(30)).toContain(SHIM)
  })
})
