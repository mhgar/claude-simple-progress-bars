import { describe, expect, test } from 'claude-code/testing'

import { promptSection } from '../hooks/prompt'

const USAGE = '/plugin/USAGE.md'

describe('promptSection', () => {
  test('names the time threshold', () => {
    expect(promptSection(90, USAGE, false)).toContain('about 90 seconds')
  })

  test('covers ad hoc commands, and commands that may not be quick', () => {
    const text = promptSection(2, USAGE, false)
    expect(text).toContain('loops, chains of commands, inline scripts')
    expect(text).toContain('If you are not sure that it is quick, add them.')
  })

  test('reports a text status for one step that it cannot measure', () => {
    const text = promptSection(2, USAGE, false)
    expect(text).toContain('One step that you cannot measure, such as a build: a text status')
    expect(text).toContain('-n NAME Building the viewer')
  })

  test('names batch work and file transfers', () => {
    const text = promptSection(2, USAGE, false)
    expect(text).toContain('test runs, batches, transfers')
    expect(text).toContain('A transfer: bytes')
  })

  test('separates commands, new script files, and existing scripts', () => {
    const text = promptSection(30, USAGE, false)
    expect(text).toContain('Without being asked')
    expect(text).toContain('New script files that a person runs')
    expect(text).toContain('Existing script files: ask before you add reports')
    expect(text).toContain('library or application code')
  })

  test('uses it for all measurable work when the user asks for progress', () => {
    expect(promptSection(30, USAGE, false)).toContain('When the user asks to see progress')
  })

  test('runs the bash command through CLAUDE_PROGRESS_SH', () => {
    const text = promptSection(30, USAGE, false)
    expect(text).toContain('run `bash "$CLAUDE_PROGRESS_SH"`')
    expect(text).toContain('`-n NAME 17/240 [detail]`')
  })

  test('asks for true counts in done, and silent progress code', () => {
    const text = promptSection(30, USAGE, false)
    expect(text).toContain('with true counts')
    expect(text).toContain('Progress code must print nothing, also on errors.')
  })

  test('limits the rate, and sends long jobs to the background', () => {
    const text = promptSection(30, USAGE, false)
    expect(text).toContain('at most about once a second')
    expect(text).toContain('in the background')
  })

  test('points to USAGE.md for scripts, other languages, and subagents', () => {
    const text = promptSection(30, USAGE, false)
    expect(text).toContain(`Read ${USAGE} before you write a script file`)
    expect(text).toContain('Tell a subagent with such work to read it')
  })

  test('tells about PowerShell only when the session has the PowerShell tool', () => {
    expect(promptSection(30, USAGE, true)).toContain('CLAUDE_PROGRESS_PS1')
    expect(promptSection(30, USAGE, false)).not.toContain('CLAUDE_PROGRESS_PS1')
  })
})
