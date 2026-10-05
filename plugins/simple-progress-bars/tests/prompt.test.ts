import { describe, expect, test } from 'claude-code/testing'

import { promptSection } from '../hooks/prompt'

const USAGE = '/plugin/USAGE.md'

describe('promptSection', () => {
  test('names the time threshold', () => {
    expect(promptSection(90, USAGE, false)).toContain('about 90 seconds')
  })

  test('separates commands, new script files, and existing scripts', () => {
    const text = promptSection(30, USAGE, false)
    expect(text).toContain('without being asked')
    expect(text).toContain('New script files you write')
    expect(text).toContain('ask in one short question before you add reports')
    expect(text).toContain('library or application code')
  })

  test('uses it for all measurable work when the user asks for progress', () => {
    expect(promptSection(30, USAGE, false)).toContain('When the user asks to see progress')
  })

  test('limits the rate, and sends long jobs to the background', () => {
    const text = promptSection(30, USAGE, false)
    expect(text).toContain('at most about once a second')
    expect(text).toContain('in the background')
  })

  test('points to USAGE.md for scripts, other languages, and subagents', () => {
    const text = promptSection(30, USAGE, false)
    expect(text).toContain(`Read ${USAGE} before you write a script file`)
    expect(text).toContain('tell it to read that file')
  })

  test('tells about PowerShell only when the session has the PowerShell tool', () => {
    expect(promptSection(30, USAGE, true)).toContain('CLAUDE_PROGRESS_PS1')
    expect(promptSection(30, USAGE, false)).not.toContain('CLAUDE_PROGRESS_PS1')
  })
})
