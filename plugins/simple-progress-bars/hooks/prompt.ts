/** Returns the system prompt section that teaches Claude the command. */
export function promptSection(minSeconds: number, shim: string | null): string {
  const portable = shim === null ? [] : [
    'In a bash script file that people can run outside Claude Code, put these lines near the top, so the calls do nothing there:',
    '```bash',
    shim.trim(),
    '```',
  ]
  return [
    '# Progress bars for long scripts',
    '',
    'This session shows progress bars in the Claude Code interface, through the `claude-progress` command on the PATH of the Bash tool. You can always use it.',
    `Use it only when a script will run longer than about ${minSeconds} seconds and its work can be counted or measured (files, items, bytes, steps, percent). Do not use it for quick commands or for work with no measurable progress.`,
    '',
    'Options come first, then one VALUE, then detail text. Always give a short task name with `-n`:',
    '- `claude-progress -n NAME 17/240 [detail]` for a count. Sizes work: `1.5G/4G`',
    '- `claude-progress -n NAME 42% [detail]` for percent',
    '- `claude-progress -n NAME -t 500` once, then `claude-progress -n NAME +1` from parallel workers',
    '- `claude-progress -n NAME done` at the end, or `claude-progress -n NAME fail "message"` on an error',
    '- `cmd | claude-progress -n NAME -l -t 5000` counts lines and passes them through (`-b` counts bytes)',
    '- `claude-progress -n NAME -p -- python train.py` reads tqdm, pv, or rsync output from the command and reports its exit status',
    '',
    'Each call takes about 15 ms, so in fast loops report every Nth item. The command never fails the script.',
    ...portable,
    'Run `claude-progress --help` for the full reference.',
  ].join('\n')
}
