/** Returns the system prompt section that teaches Claude the command. `usage` is the path of USAGE.md. */
export function promptSection(minSeconds: number, usage: string, hasPowerShell: boolean): string {
  return [
    '# Progress bars for long work',
    '',
    '`claude-progress` shows a live progress bar for a task in the Claude Code interface. Reports cost no tokens.',
    '',
    `Use it for work that will take longer than about ${minSeconds} seconds and can be counted or measured (files, items, bytes, steps, percent):`,
    '- Commands you run: add reports without being asked.',
    '- New script files you write, for such work that a person runs and waits for (a batch conversion, a migration, a backfill, a bulk download): include reports.',
    '- Existing script files: ask in one short question before you add reports, unless the user already asked for progress in that file. Until then, report from the command you run around the script.',
    'Do not use it for quick commands, for work you cannot measure (one long build, one network call, a test runner with its own output), or in library or application code, services, tests, CI, unattended jobs, or code that reports progress its own way.',
    'When the user asks to see progress ("show progress", "with a progress bar"), use it for all measurable work in that task, however short. Still ask before you edit an existing script file.',
    '',
    'In the Bash tool, the command is on the PATH. Options come first, then one VALUE, then detail text. Always name the task with `-n`:',
    '- `claude-progress -n NAME 17/240 [detail]` for a count. Sizes work: `1.5G/4G`. `42%` for a percent',
    '- `claude-progress -n NAME -t 500` once, then `claude-progress -n NAME +1` from parallel workers',
    '- `claude-progress -n NAME done` at the end, or `claude-progress -n NAME fail "message"` on an error',
    'Report at most about once a second, because each call starts a process: when items take less than a second each, report every Nth item, where N is about the number of items done per second. A foreground bar ends when its tool call ends, so run a job that may outlast the tool timeout in the background.',
    ...(hasPowerShell ? ["In the PowerShell tool, call `& $env:CLAUDE_PROGRESS_PS1` with the same arguments, and quote values such as '+1'."] : []),
    '',
    `Read ${usage} before you write a script file that reports progress, or use the command from another language. It has the shim each script needs, so the script still runs where the command is missing. When you give a subagent such work, tell it to read that file.`,
  ].join('\n')
}
