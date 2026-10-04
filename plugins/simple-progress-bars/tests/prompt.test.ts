import { describe, expect, test } from 'claude-code/testing'

import { promptSection } from '../hooks/prompt'

describe('promptSection', () => {
  test('names the time threshold', () => {
    expect(promptSection(90, null)).toContain('about 90 seconds')
  })

  test('gives the shim for scripts that run outside Claude Code', () => {
    expect(promptSection(30, 'shim text\n')).toContain('```bash\nshim text\n```')
  })

  test('leaves the shim out when its read failed', () => {
    expect(promptSection(30, null)).not.toContain('```bash')
  })
})
