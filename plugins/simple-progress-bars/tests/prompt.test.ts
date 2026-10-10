import { describe, expect, test } from 'claude-code/testing'

import { promptSection } from '../hooks/prompt'

const ROOT = '/plugin'

describe('promptSection', () => {
  test('names the time threshold', () => {
    expect(promptSection(90, ROOT, false)).toContain('about 90 seconds')
  })

  test('covers ad hoc commands, background and remote jobs, and commands that may not be quick', () => {
    const text = promptSection(2, ROOT, false)
    expect(text).toContain('loops, chains of commands, inline scripts, test runs, batches, transfers, background jobs, and jobs on a remote server')
    expect(text).toContain('If you are not sure that it is quick, use it.')
  })

  test('runs the bash wrapper by its full path, also for chains and remote jobs', () => {
    const text = promptSection(30, ROOT, false)
    expect(text).toContain('Command: `bash "/plugin/scripts/claude-progress.sh" -n NAME COMMAND [ARGS...]`')
    expect(text).toContain("`-n NAME ssh HOST '...'`")
  })

  test('teaches the tags, flushing, and the main values', () => {
    const text = promptSection(30, ROOT, false)
    expect(text).toContain('A tag starts the line: `[progress] VALUE` for the task, `[progress:SUB] VALUE` for a subtask.')
    expect(text).toContain('Flush the output after each tag.')
    for (const value of ['`3/8`', '`1.5G/4G`', '`42%`', '`+1`', '`total 500`', '`Building the viewer`', '`done ["38 copied, 2 failed"]`', '`fail "message"`']) {
      expect(text).toContain(value)
    }
  })

  test('asks for an end of each task', () => {
    expect(promptSection(30, ROOT, false)).toContain('End each task with `done` or `fail`.')
  })

  test('separates commands, new script files, and existing scripts', () => {
    const text = promptSection(30, ROOT, false)
    expect(text).toContain('Without being asked')
    expect(text).toContain('New script files that a person runs')
    expect(text).toContain('Existing script files: ask before you add tags')
    expect(text).toContain('print the tags from your own command around the script')
  })

  test('says that a command with no tags shows no bar, and gives a status for one step', () => {
    const text = promptSection(30, ROOT, false)
    expect(text).toContain('A command that prints no tags shows no bar.')
    expect(text).toContain(`echo "[progress] Building"; ./build.sh`)
  })

  test('skips quick commands and code that is not a job, but not unattended jobs or code with its own progress', () => {
    const text = promptSection(30, ROOT, false)
    expect(text).toContain('Not for quick commands, or library or application code, services, test files, or CI.')
    expect(text).not.toContain('unattended')
    expect(text).not.toContain('shows its own progress')
  })

  test('uses it for all work when the user asks for progress', () => {
    expect(promptSection(30, ROOT, false)).toContain('When the user asks to see progress')
  })

  test('puts the wrapper outside nohup and &, and sends long jobs to the background', () => {
    const text = promptSection(30, ROOT, false)
    expect(text).toContain('Put the wrapper outside `nohup` and `&`.')
    expect(text).toContain('in the background')
  })

  test('points to USAGE.md for scripts and subagents', () => {
    const text = promptSection(30, ROOT, false)
    expect(text).toContain('`/plugin/USAGE.md`. Read it before you write a script file with tags')
    expect(text).toContain('Tell a subagent with such work to read it')
  })

  test('tells about PowerShell only when the session has the PowerShell tool', () => {
    expect(promptSection(30, ROOT, true)).toContain('PowerShell tool: `& "/plugin/scripts/claude-progress.ps1" -n NAME COMMAND`')
    expect(promptSection(30, ROOT, false)).not.toContain('claude-progress.ps1')
  })
})
