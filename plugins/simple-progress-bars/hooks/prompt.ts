/** Returns the system prompt section that teaches Claude the command. `usage` is the path of USAGE.md. */
export function promptSection(minSeconds: number, usage: string, hasPowerShell: boolean): string {
  return [
    '# Progress bars',
    '',
    '`claude-progress` shows a live progress bar in Claude Code. Reports cost no tokens.',
    '',
    `Without being asked, add reports to every command that makes the person wait more than about ${minSeconds} seconds: loops, chains of commands, inline scripts, test runs, batches, transfers. If you are not sure that it is quick, add them.`,
    '- Several items or steps: a count, such as `3/8`. A transfer: bytes, such as `1.5G/4G`, or a percent. One step that you cannot measure, such as a build: a text status.',
    '- New script files that a person runs and waits for: include reports. Existing script files: ask before you add reports, unless the user asked for progress in that file. Until then, report from your own command around the script.',
    '- Not for quick commands, or library or application code, services, test files, CI, unattended jobs, or code that shows its own progress. When the user asks to see progress, use it for all work, however short.',
    '',
    'In the Bash tool, run `bash "$CLAUDE_PROGRESS_SH"`. It is not on the PATH. Always name the task with `-n`:',
    '- `-n NAME 17/240 [detail]`, `-n NAME 42%`, or `-n NAME Building the viewer`',
    '- `-n NAME -t 500` once, then `-n NAME +1` from parallel workers',
    '- `-n NAME done "38 copied, 2 failed"` at the end, with true counts, or `-n NAME fail "message"`',
    'Progress code must print nothing, also on errors. Report at most about once a second. A foreground bar ends with its tool call, so run a job that may outlast the tool timeout in the background.',
    ...(hasPowerShell ? ["In the PowerShell tool, call `& $env:CLAUDE_PROGRESS_PS1` with the same arguments, and quote values such as '+1'."] : []),
    '',
    `Read ${usage} before you write a script file with reports, or use the command from another language. Tell a subagent with such work to read it.`,
  ].join('\n')
}
