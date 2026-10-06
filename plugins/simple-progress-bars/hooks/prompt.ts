/** Returns the system prompt section that teaches Claude the command. `root` is the plugin's directory. */
export function promptSection(minSeconds: number, root: string, hasPowerShell: boolean): string {
  return [
    '# Progress bars',
    '',
    '`claude-progress` shows a live progress bar in Claude Code. Reports cost no tokens.',
    '',
    `Without being asked, add reports to every command that makes the person wait more than about ${minSeconds} seconds: loops, chains of commands, inline scripts, test runs, batches, transfers. If you are not sure that it is quick, add them.`,
    '- New script files that a person runs and waits for: include reports. Existing script files: ask before you add reports, unless the user asked for progress in that file. Until then, report from your own command around the script.',
    '- Not for quick commands, or library or application code, services, test files, CI, unattended jobs, or code that shows its own progress. When the user asks to see progress, use it for all work, however short.',
    '',
    `Command: \`bash "${root}/scripts/claude-progress.sh" -n NAME [-t TOTAL] VALUE [DETAIL...]\``,
    '- `3/8`: items or steps done',
    '- `1.5G/4G`: bytes of a transfer',
    '- `42%`: percent',
    '- `+1`: add to the count, from parallel workers. Set the total once with `-t 500`.',
    '- `Building the viewer`: text status, for one step you cannot measure',
    '- `done ["38 copied, 2 failed"]`: success, with true counts',
    '- `fail "message"`: the whole run failed',
    'Progress code prints nothing, also on errors. At most one report a second. Run a job that may outlast the tool timeout in the background.',
    ...(hasPowerShell ? [`PowerShell tool: \`& "${root}/scripts/claude-progress.ps1"\`, same arguments, quote \`'+1'\`.`] : []),
    '',
    `Full reference and script shims: \`${root}/USAGE.md\`. Read it before you write a script file with reports, or when a bar does not act as you expect. Tell a subagent with such work to read it.`,
  ].join('\n')
}
