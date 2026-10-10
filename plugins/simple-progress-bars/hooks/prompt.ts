/** Returns the system prompt section that teaches Claude the wrapper. `root` is the plugin's directory. */
export function promptSection(minSeconds: number, root: string, hasPowerShell: boolean): string {
  return [
    '# Progress bars',
    '',
    '`claude-progress` runs a command and shows its progress as a live bar in Claude Code. Progress costs no tokens.',
    '',
    `Without being asked, run every command that makes the person wait more than about ${minSeconds} seconds through it: loops, chains of commands, inline scripts, test runs, batches, transfers, background jobs, and jobs on a remote server. If you are not sure that it is quick, use it.`,
    `Command: \`bash "${root}/scripts/claude-progress.sh" -n NAME COMMAND [ARGS...]\`. A chain: \`-n NAME bash -c '...'\`. A remote job: \`-n NAME ssh HOST '...'\`.`,
    'The command prints tag lines. A tag starts the line: `[progress] VALUE` for the task, `[progress:SUB] VALUE` for a subtask. Flush the output after each tag. Tag lines never reach the output.',
    '- `3/8`: items or steps done',
    '- `1.5G/4G`: bytes of a transfer',
    '- `42%`: percent',
    '- `+1`: add to the count, also from parallel workers. Set the total first with `total 500`.',
    '- `Building the viewer`: text status, for one step you cannot measure',
    '- `done ["38 copied, 2 failed"]`: success, with true counts',
    '- `fail "message"`: the task failed',
    'End each task with `done` or `fail`. When the command exits, the wrapper ends what is left, by the exit status.',
    `A command that prints no tags shows no bar. For one step that you cannot measure, print a status first: \`-n build bash -c 'echo "[progress] Building"; ./build.sh'\`.`,
    '- New script files that a person runs and waits for: print tags. Existing script files: ask before you add tags, unless the user asked for progress in that file. Until then, print the tags from your own command around the script: a status, or a count from its output or its files.',
    '- Not for quick commands, or library or application code, services, test files, or CI. When the user asks to see progress, use it for all work, however short.',
    'Put the wrapper outside `nohup` and `&`. Run a job that can take longer than the tool timeout in the background.',
    ...(hasPowerShell ? [`PowerShell tool: \`& "${root}/scripts/claude-progress.ps1" -n NAME COMMAND\`, same tags.`] : []),
    '',
    `Full reference, flush examples, and remote recipes: \`${root}/USAGE.md\`. Read it before you write a script file with tags, or when a bar does not act as you expect. Tell a subagent with such work to read it.`,
  ].join('\n')
}
