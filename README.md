# Simple Progress Bars

![Progress bars above the Claude Code prompt: two running tasks with time estimates, one with a transfer size, a stalled task, and a failed upload in red](plugins/simple-progress-bars/assets/screenshot.png)

Progress bars for the long scripts that Claude Code runs.

When Claude runs a script that takes a while, such as a batch conversion, a download, or a test suite, you normally see nothing until it ends. With this plugin, the script reports its progress, and Claude Code shows a live bar for each task above the prompt, with a count, a percent and a time estimate.

You do not need to do anything. The plugin teaches Claude to add progress reports to every command that makes you wait more than a second or two, and to new scripts it writes for long jobs, such as a batch conversion or a migration. It asks before it adds them to your existing scripts, and it never adds them to library or app code, tests or CI. Say "show progress" and Claude reports progress on all the work it can measure. The updates go straight to the screen, so they cost no tokens.

## Install

Install the plugin from the Anthropic Directory, which is built into Claude Code:

```
claude plugin install simple-progress-bars@anthropic-plugin-directory
```

You can also type `/plugin` in Claude Code and find Simple Progress Bars in the Anthropic Directory.

If the directory install fails, install the plugin from this repository:

```
claude plugin marketplace add mhgar/claude-simple-progress-bars
claude plugin install simple-progress-bars@simple-progress-bars
```

The directory has the version that Anthropic reviewed. This repository can have a newer version.

The plugin needs Claude Code v2.1.287 or later, where mods are on by default. Then start a new Claude Code session. A session that was open before the install does not load the plugin.

The plugin works on Linux, macOS and Windows. It needs no other software. On Windows, the command runs in Git Bash, which Claude Code already uses for its Bash tool, or in PowerShell.

## Usage

Claude writes the progress calls for you. You can also use the `claude-progress` command in your own scripts:

| Call | What it shows |
| --- | --- |
| `claude-progress -n NAME 17/240 [detail]` | 17 of 240 done |
| `claude-progress -n NAME 1.5G/4G` | A size, with a transfer rate |
| `claude-progress -n NAME 42% [detail]` | A percent |
| `claude-progress -n NAME Scanning disk` | A text status, with no number |
| `claude-progress -n NAME -t 500`, then `claude-progress -n NAME +1` | A total, then one step at a time. Safe from parallel workers |
| `claude-progress -n NAME done [message]` | The task is complete |
| `claude-progress -n NAME fail [message]` | The task failed |
| `claude-progress -n NAME clear` | Remove the bar now |

`-n` gives the task its name. Each name gets its own bar.

For example, in a bash script with the shim below:

```bash
n=$(ls *.mkv | wc -l); i=0
for f in *.mkv; do
  claude-progress -n convert "$((++i))/$n" "$f"
  ffmpeg -i "$f" ...
done
claude-progress -n convert done
```

The command never breaks a script. It always exits with 0, and outside Claude Code it does nothing. Run the command with `--help` for the full reference.

### Shells and languages

- **Bash:** the bash command is `scripts/claude-progress.sh`. The plugin gives Claude its full path in the system prompt, and puts nothing on the `PATH`.
- **PowerShell:** `scripts/claude-progress.ps1` is a PowerShell version of the command, which takes the same arguments.
- **Python and Node:** `claude_progress.py` and `claude-progress.js` write the progress file themselves, with no bash.
- **Other languages:** a script calls the command through bash.

A script calls the command through a short shim near the top. The shim finds the newest installed copy of the plugin and runs its command. Where the plugin is not installed, it turns the calls into no-ops. For a bash script:

```bash
claude-progress() { local c; c=$(ls -dt "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/*/simple-progress-bars/*/scripts/claude-progress.sh 2>/dev/null | head -n 1); [ -n "$c" ] && bash "$c" "$@"; return 0; }
```

[`USAGE.md`](plugins/simple-progress-bars/USAGE.md) has the shim for each language, and the rules for reports in a script. Claude reads it before it writes such a script, so you do not need to.

## Reading a bar

Each bar shows the task name, its detail text, the count, the percent, the time so far, and the time left. A task measured in bytes also shows its transfer rate.

The color tells you the state:

- **Cyan:** the task runs.
- **Yellow, `no update`:** the task has sent no update for 30 seconds.
- **Green, `done`:** the task is complete. The bar goes after 2 seconds.
- **Red, `failed` or `stopped`:** the task failed, or its script ended before it finished. The bar stays for 30 seconds.

The time estimate shows `estimating…` until the task has made enough progress to measure. If many tasks run at once, the bars fill up to 3 rows, and a `+N` shows how many more there are.

## Settings

Run `/plugin configure simple-progress-bars@simple-progress-bars` to change these:

| Setting | Default | What it does |
| --- | --- | --- |
| `maxRows` | `3` | The most rows of bars to show |
| `minSeconds` | `2` | Claude adds progress reports to commands it expects to run at least this long |

## How it works

The plugin has two parts: the `claude-progress` command, and a set of hooks inside Claude Code.

1. Each `claude-progress` call reads the session ID from `CLAUDE_CODE_SESSION_ID`, which Claude Code sets in every shell call. It writes one line to `~/.claude/progress/<session id>/<task name>`.
2. The plugin reads that session's folder four times a second, and draws a bar for each file.
3. The plugin also watches Claude's Bash and PowerShell calls. When the call that ran a script ends, the bars of that script end too. A bar that did not reach its total shows `stopped`.

The plugin also adds a short section to Claude's system prompt. That section tells Claude when to use `claude-progress` and how to call it, and points it to `USAGE.md` for the rest. The plugin sets no environment variables.

### What it touches

- **Files:** the command writes only in `~/.claude/progress`, or in `$CLAUDE_CONFIG_DIR/progress` if you set that variable. It removes the folders of old sessions after their Claude Code process exits.
- **Claude Code:** the plugin adds one section to the system prompt, and draws the bars above the prompt. It does not change your commands, their output, or the transcript.
- **Network:** none. Nothing leaves your machine.

## Development

The specs in [`openspec/specs`](openspec/specs) describe what each part must do.

```
claude plugin validate plugins/simple-progress-bars     # check the manifest and hooks
claude plugin test plugins/simple-progress-bars         # run the plugin tests
plugins/simple-progress-bars/tests/cli-test.sh          # test the claude-progress command
npx @fission-ai/openspec validate --specs --strict      # check the specs
```

To try the plugin without installing it, start Claude Code with `claude --plugin-dir plugins/simple-progress-bars`. Then type `! examples/demo.sh` at the prompt. The demo starts six fake tasks that show each kind of bar.

### Claude evals

The tests above check the code. The evals in `plugins/simple-progress-bars/evals` check that Claude uses the plugin well: that it reports progress for long work and when you ask for it, that it asks before it edits your scripts, and that it keeps the command out of library code and quick commands. Each case runs Claude 3 times, because its answers vary.

```
claude plugin eval plugins/simple-progress-bars --ablation none --scaffold --trust-plugin --allow-tools Bash Write Edit
```

Cases tagged `bash` need Linux or macOS, because the eval runner cannot confine the Bash tool on Windows. On Windows, add `--tag write` to run the other cases. The "Claude evals" GitHub workflow runs all of them on Linux when you start it by hand. It needs the `ANTHROPIC_API_KEY` repository secret.

## License

MIT
