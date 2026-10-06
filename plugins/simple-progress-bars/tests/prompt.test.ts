import { describe, expect, test } from 'claude-code/testing'

import { promptSection } from '../hooks/prompt'

const ROOT = '/plugin'

describe('promptSection', () => {
  test('names the time threshold', () => {
    expect(promptSection(90, ROOT, false)).toContain('about 90 seconds')
  })

  test('covers ad hoc commands, and commands that may not be quick', () => {
    const text = promptSection(2, ROOT, false)
    expect(text).toContain('loops, chains of commands, inline scripts')
    expect(text).toContain('If you are not sure that it is quick, add them.')
  })

  test('reports a text status for one step that it cannot measure', () => {
    const text = promptSection(2, ROOT, false)
    expect(text).toContain('`Building the viewer`: text status, for one step you cannot measure')
  })

  test('names batch work and file transfers', () => {
    const text = promptSection(2, ROOT, false)
    expect(text).toContain('test runs, batches, transfers')
    expect(text).toContain('`1.5G/4G`: bytes of a transfer')
  })

  test('separates commands, new script files, and existing scripts', () => {
    const text = promptSection(30, ROOT, false)
    expect(text).toContain('Without being asked')
    expect(text).toContain('New script files that a person runs')
    expect(text).toContain('Existing script files: ask before you add reports')
    expect(text).toContain('library or application code')
  })

  test('uses it for all measurable work when the user asks for progress', () => {
    expect(promptSection(30, ROOT, false)).toContain('When the user asks to see progress')
  })

  test('runs the bash command by its full path', () => {
    const text = promptSection(30, ROOT, false)
    expect(text).toContain('Command: `bash "/plugin/scripts/claude-progress.sh" -n NAME [-t TOTAL] VALUE [DETAIL...]`')
    expect(text).toContain('`3/8`: items or steps done')
  })

  test('asks for true counts in done, and silent progress code', () => {
    const text = promptSection(30, ROOT, false)
    expect(text).toContain('`done ["38 copied, 2 failed"]`: success, with true counts')
    expect(text).toContain('Progress code prints nothing, also on errors.')
  })

  test('limits the rate, and sends long jobs to the background', () => {
    const text = promptSection(30, ROOT, false)
    expect(text).toContain('At most one report a second.')
    expect(text).toContain('in the background')
  })

  test('points to USAGE.md for scripts, other languages, and subagents', () => {
    const text = promptSection(30, ROOT, false)
    expect(text).toContain('Full reference and script shims: `/plugin/USAGE.md`. Read it before you write a script file')
    expect(text).toContain('Tell a subagent with such work to read it')
  })

  test('tells about PowerShell only when the session has the PowerShell tool', () => {
    expect(promptSection(30, ROOT, true)).toContain('PowerShell tool: `& "/plugin/scripts/claude-progress.ps1"`')
    expect(promptSection(30, ROOT, false)).not.toContain('claude-progress.ps1')
  })
})
