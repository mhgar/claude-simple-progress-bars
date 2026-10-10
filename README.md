# Simple Progress Bars

![Progress bars above the Claude Code prompt: two running tasks with time estimates, one with a transfer size, a stalled task, a finished task in green, and a failed upload in red](plugins/simple-progress-bars/assets/screenshot.png)

Progress bars for the long scripts that Claude Code runs.

When Claude runs a script that takes a while, such as a batch conversion, a download, a test suite, or a render on a remote server, you normally see nothing until it ends. With this plugin, the script prints its progress, and Claude Code shows a live bar for each task above the prompt, with a count, a percent and a time estimate.

You do not need to do anything. The plugin teaches Claude to run every command that makes you wait more than a second or two through the `claude-progress` wrapper, and to print progress lines in new scripts that it writes for long jobs. It asks before it adds them to your existing scripts, and it never adds them to library or app code, tests or CI. Say "show progress" and Claude shows progress for all the work it can measure. The progress lines never reach Claude, so they cost no tokens.

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

The plugin works on Linux, macOS and Windows. It needs no other software. On Windows, the wrapper runs in Git Bash, which Claude Code already uses for its Bash tool, or in PowerShell.

## Usage

Claude does this for you. You can also use the wrapper yourself. Run a command through it:

```bash
claude-progress -n convert ./convert.sh
```

The command prints tag lines, and each tag line moves a bar. A tag starts the line:

| Tag line | What it shows |
| --- | --- |
| `[progress] 17/240 [detail]` | 17 of 240 done |
| `[progress] 1.5G/4G` | A size, with a transfer rate |
| `[progress] 42% [detail]` | A percent |
| `[progress] Scanning disk` | A text status, with no number |
| `[progress] total 500`, then `[progress] +1` | A total, then one step at a time. Parallel workers can each print `+1` |
| `[progress] done [message]` | The task is complete |
| `[progress] fail [message]` | The task failed |
| `[progress:frames] 5/40` | The subtask `frames`, on an indented row under the task |

For example, `convert.sh`:

```bash
n=$(ls *.mkv | wc -l); i=0
for f in *.mkv; do
  echo "[progress] $((++i))/$n $f"
  ffmpeg -i "$f" ...
done
echo "[progress] done"
```

The tag lines never reach the output. Every other line does. When the command exits, the wrapper ends each task that is still running: `done` after exit status 0, else `fail` with the last line of output. The wrapper exits with the exit status of the command. Outside Claude Code, it runs the command and changes nothing, so you see the tag lines as text.

Any language works, because a tag is a line of output. Flush the output after each tag line, for example `print(..., flush=True)` in Python. A job on a remote server works the same way: `claude-progress -n render ssh host './render.sh'`.

[`USAGE.md`](plugins/simple-progress-bars/USAGE.md) has the full reference, flush examples for each language, and recipes for background and remote jobs. Claude reads it before it writes such a script, so you do not need to.

### Shells

- **Bash:** the wrapper is `scripts/claude-progress.sh`. The plugin gives Claude its full path in the system prompt, and puts nothing on the `PATH`.
- **PowerShell:** `scripts/claude-progress.ps1` is a PowerShell version of the wrapper, which takes the same arguments.

Version 1.1.0 replaced the per-call command, the Python and Node twins, and the shims with the wrapper. A script that loads a shim of an older version does nothing now. Print tag lines instead.

## Reading a bar

Each bar shows the task name, its detail text, the count, the percent, the time so far, and the time left. A task measured in bytes also shows its transfer rate. A task with subtasks has a row of its own, and its subtasks show on indented rows under it.

The color tells you the state:

- **Cyan:** the task runs.
- **Yellow, `no update`:** the task, and its subtasks, have sent no update for 30 seconds.
- **Green, `done`:** the task is complete. The bar goes after 5 seconds.
- **Red, `failed` or `stopped`:** the task failed, or its wrapper stopped before the task ended. The bar goes after 10 seconds.

The time estimate shows `estimating…` until the task has made enough progress to measure.

### Collapse and compact

The band shows every bar by default. When it is too much, fold it down:

- **A task with subtasks** has `▾` before its name. Press its row to hide the subtasks: the row then shows `▸` and `+3: 1 running, 1 failed, 1 done`. Press it again to show them.
- **The whole band:** with more than 4 rows, the band ends with `▴ show less`. Press it to keep 4 rows and one line such as `▸ 3 more: 2 running, 1 failed`. Press that line to see everything again.

To press a row, click it in Claude Code's fullscreen mode. In any mode, press `ctrl+x`, then `Tab`, to move to the bars. Then use Tab or the arrow keys, and Enter. Esc goes back to the prompt. Claude Code's own `[-]` mark beside the bars hides them all.

## Settings

Run `/plugin configure simple-progress-bars@simple-progress-bars` to change these:

| Setting | Default | What it does |
| --- | --- | --- |
| `minSeconds` | `2` | Claude runs commands through the wrapper when it expects them to run at least this long |

Version 1.2.0 removed the `maxRows` setting. The band now fits the height that Claude Code gives it, and you can make it compact.

## How it works

The plugin has two parts: the `claude-progress` wrapper, and a set of hooks inside Claude Code.

1. The wrapper runs the command, and reads its standard output and standard error. It reads the session ID from `CLAUDE_CODE_SESSION_ID`, which Claude Code sets in every shell call.
2. The wrapper holds the state of each task in memory. After each tag line, it rewrites one run file, `~/.claude/progress/<session id>/<pid>-<start>`. It also rewrites the file every 5 seconds while the command is quiet.
3. The plugin reads that session's folder four times a second, and draws a bar for each task. If a run file does not change for 15 seconds, its wrapper is gone, and its running tasks show `stopped`.

The plugin also adds a short section to Claude's system prompt. That section tells Claude when to use the wrapper and how to print tags, and points it to `USAGE.md` for the rest. The plugin sets no environment variables. The wrapper sets `PYTHONUNBUFFERED=1` for the command that it runs, and for nothing else.

### What it touches

- **Files:** the wrapper writes only in `~/.claude/progress`, or in `$CLAUDE_CONFIG_DIR/progress` if you set that variable. It removes the folders of old sessions after their Claude Code process exits.
- **Claude Code:** the plugin adds one section to the system prompt, and draws the bars above the prompt. It does not change your commands or the transcript. The wrapper removes only the tag lines from the output.
- **Network:** none. Nothing leaves your machine, apart from the SSH commands that you or Claude run.

## Development

The specs in [`openspec/specs`](openspec/specs) describe what each part must do.

```
claude plugin validate plugins/simple-progress-bars     # check the manifest and hooks
claude plugin test plugins/simple-progress-bars         # run the plugin tests
plugins/simple-progress-bars/tests/cli-test.sh          # test the wrapper, and compare the PowerShell wrapper where pwsh is installed
npx @fission-ai/openspec validate --specs --strict      # check the specs
```

To try the plugin without installing it, start Claude Code with `claude --plugin-dir plugins/simple-progress-bars`. Then type `! examples/demo.sh` at the prompt. The demo starts fake tasks that show each kind of bar.

### Claude evals

The tests above check the code. The evals in `plugins/simple-progress-bars/evals` check that Claude uses the plugin well: that it runs long work through the wrapper, also on a remote server, and when you ask for it, that it asks before it edits your scripts, and that it keeps tags out of library code and quick commands. Each case runs Claude 3 times, because its answers vary.

```
claude plugin eval plugins/simple-progress-bars --ablation none --scaffold --trust-plugin --allow-tools Bash Write Edit
```

Cases tagged `bash` need Linux or macOS, because the eval runner cannot confine the Bash tool on Windows. On Windows, add `--tag write` to run the other cases. The "Claude evals" GitHub workflow runs all of them on Linux when you start it by hand. It needs the `ANTHROPIC_API_KEY` repository secret.

## License

MIT
