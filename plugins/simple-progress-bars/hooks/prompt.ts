/** Returns the system prompt section that teaches Claude the command. */
export function promptSection(minSeconds: number, shim: string | null): string {
  const portable = shim === null ? [] : [
    'The shim: in a script file that people can run outside Claude Code, put these lines near the top, so the calls do nothing there:',
    '```bash',
    shim.trim(),
    '```',
  ]
  return [
    '# Progress bars for long scripts',
    '',
    'This session shows progress bars in the Claude Code interface, through the `claude-progress` command on the PATH of the Bash tool.',
    '',
    `Use it for work that will take longer than about ${minSeconds} seconds and can be counted or measured (files, items, bytes, steps, percent):`,
    '- Commands you run: add progress reports to such a script or loop without being asked.',
    '- Script files you write: when a new standalone script does such work and a person runs it and waits for it (a batch conversion, a migration, a backfill, a bulk download), include progress reports and the shim below.',
    '- Existing script files: always ask the user before you edit one to add reports, in one short question, unless they already asked you to add progress to that file. Until they agree, report from the command you run around the script instead, for example a loop that runs it once for each item.',
    'Do not use it for quick commands, for work with no measurable progress (one long build, one network call, a test runner with its own output), or in library or application code, services, tests, CI, unattended jobs, or code that already reports progress its own way.',
    '',
    'When the user asks to see progress ("show progress", "with a progress bar", "let me see how far it gets"), use it for all measurable work in that task, even work shorter than the limit above or with only a few coarse steps. The rule for existing script files still applies.',
    '',
    'Options come first, then one VALUE, then detail text. Always give a short task name with `-n`:',
    '- `claude-progress -n NAME 17/240 [detail]` for a count. Sizes work: `1.5G/4G`',
    '- `claude-progress -n NAME 42% [detail]` for percent',
    '- `claude-progress -n NAME -t 500` once, then `claude-progress -n NAME +1` from parallel workers',
    '- `claude-progress -n NAME done` at the end, or `claude-progress -n NAME fail "message"` on an error',
    '- `claude-progress -n NAME Scanning disk` for text with no number',
    '',
    'The command never fails the script. A bar ends when its Bash call ends, so run the script in the foreground when you can. In fast loops, report every Nth item.',
    ...portable,
    'Run `claude-progress --help` for the full reference.',
  ].join('\n')
}
