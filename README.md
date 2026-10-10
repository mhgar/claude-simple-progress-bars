# Simple Progress Bars

![Progress bars above the Claude Code prompt, one task per row in aligned columns: running tasks with time estimates and a transfer rate, a stalled task in yellow, a finished task in green, a failed upload and a stopped backup in red, and a render task with a subtask on an indented row under it](plugins/simple-progress-bars/assets/screenshot.png)

Progress bars for the long jobs that Claude Code runs.

When Claude runs something that takes a while, such as a batch conversion, a download, a test suite, or a render on a remote server, you normally see nothing until it ends. With this plugin, Claude Code shows a live bar for each task above the prompt, with a count, a percent, and a time estimate.

You do not need to do anything. The plugin teaches Claude to show progress for every command that makes you wait more than a second or two, and in new scripts that it writes for long jobs. It asks before it changes your own scripts, and it keeps progress out of library code, tests, and CI. Say "show progress" and Claude shows progress for all the work it can measure. The progress costs no tokens.

## Install

Install the plugin from the Anthropic Directory, which is built into Claude Code:

```
claude plugin install simple-progress-bars@anthropic-plugin-directory
```

You can also type `/plugin` in Claude Code and find Simple Progress Bars in the Anthropic Directory.

If the directory install fails, install the plugin from this repository. It can have a newer version than the directory:

```
claude plugin marketplace add mhgar/claude-simple-progress-bars
claude plugin install simple-progress-bars@simple-progress-bars
```

The plugin needs Claude Code v2.1.287 or later. Start a new session after the install. It works on Linux, macOS, and Windows, and needs no other software.

## Reading the bars

Each task has a row, and the rows line up in columns: the name, a detail, the bar, the count, the percent, the time so far, and the time left. A download also shows its speed. The steps of a task show on indented rows under it.

The color tells you the state:

- **Cyan:** the task runs.
- **Yellow, `no update`:** the task has sent no update for 30 seconds.
- **Green, `done`:** the task is complete. The bar goes after 5 seconds.
- **Red, `failed` or `stopped`:** the task failed, or stopped before it ended. The bar goes after 10 seconds.

### Fold the bars down

All bars show by default. When there are too many:

- **A task with steps** has `▾` before its name. Press its row to hide the steps, and press it again to show them.
- **The whole list:** past 4 rows, the list ends with `▴ show less`. Press it to keep 4 rows and a summary such as `▸ 3 more: 2 running, 1 failed`. Press the summary to see everything again.

To press a row, click it in Claude Code's fullscreen mode. In any mode, press `ctrl+x`, then `Tab`, to move to the bars, then use the arrow keys and Enter. Esc goes back to the prompt.

## Use it in your own scripts

Claude does this for you, but you can also do it. Run the job through `claude-progress`, and print progress lines from it:

```bash
claude-progress -n "Convert videos" ./convert.sh
```

```bash
# convert.sh
n=$(ls *.mkv | wc -l); i=0
for f in *.mkv; do
  echo "[progress] $((++i))/$n $f"
  ffmpeg -i "$f" ...
done
echo "[progress] done"
```

The progress lines do not show in the output. Every other line does. Any language works, also on a remote server over SSH. [`USAGE.md`](plugins/simple-progress-bars/USAGE.md) has the full reference.

## Settings

Run `/plugin configure simple-progress-bars@simple-progress-bars` to change this:

| Setting | Default | What it does |
| --- | --- | --- |
| `minSeconds` | `2` | Claude shows progress for commands that it expects to run at least this long |

## Privacy

- **Files:** the plugin writes only in `~/.claude/progress`, or in `$CLAUDE_CONFIG_DIR/progress` if you set that variable, and removes old files by itself.
- **Claude Code:** the plugin adds one short section to Claude's instructions, and draws the bars above the prompt. It does not change your commands or the conversation.
- **Network:** none. Nothing leaves your machine, apart from the SSH commands that you or Claude run.

## Development

The specs in [`openspec/specs`](openspec/specs) describe what each part must do, and [`USAGE.md`](plugins/simple-progress-bars/USAGE.md) explains how the parts work together.

```
claude plugin validate plugins/simple-progress-bars     # check the manifest and hooks
claude plugin test plugins/simple-progress-bars         # run the plugin tests
plugins/simple-progress-bars/tests/cli-test.sh          # test the wrapper, and the PowerShell wrapper where pwsh is installed
npx @fission-ai/openspec validate --specs --strict      # check the specs
```

To try the plugin without installing it, start Claude Code with `claude --plugin-dir plugins/simple-progress-bars`, and type `! examples/demo.sh` at the prompt. The demo shows each kind of bar.

The evals in `plugins/simple-progress-bars/evals` check that Claude uses the plugin well. Each case runs Claude 3 times, because its answers vary:

```
claude plugin eval plugins/simple-progress-bars --ablation none --scaffold --trust-plugin --allow-tools Bash Write Edit
```

Cases tagged `bash` need Linux or macOS. On Windows, add `--tag write` to run the other cases. The "Claude evals" GitHub workflow runs all of them on Linux when you start it by hand, with the `ANTHROPIC_API_KEY` repository secret.

## License

MIT
