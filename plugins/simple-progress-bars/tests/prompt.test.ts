import { describe, expect, test } from 'claude-code/testing'

import { promptSection } from '../hooks/prompt'

describe('promptSection', () => {
  test('names the time threshold', () => {
    expect(promptSection(90, null)).toContain('about 90 seconds')
  })

  test('separates commands, new script files, and existing scripts', () => {
    const text = promptSection(30, null)
    expect(text).toContain('without being asked')
    expect(text).toContain('Script files you write')
    expect(text).toContain('always ask the user before you edit one')
    expect(text).toContain('library or application code')
  })

  test('uses it for all measurable work when the user asks for progress', () => {
    expect(promptSection(30, null)).toContain('When the user asks to see progress')
  })

  test('gives the shim for scripts that run outside Claude Code', () => {
    expect(promptSection(30, 'shim text\n')).toContain('```bash\nshim text\n```')
  })

  test('leaves the shim out when its read failed', () => {
    expect(promptSection(30, null)).not.toContain('```bash')
  })
})
