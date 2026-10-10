# Simple Progress Bars

![Progress bars above the Claude Code prompt, one task per row in aligned columns: running tasks with time estimates and a transfer rate, a stalled task in yellow, a finished task in green, a failed upload and a stopped backup in red, and a render task with a subtask on an indented row under it](plugins/simple-progress-bars/assets/screenshot.png)

Progress bars for the long jobs that Claude Code runs.

When Claude runs a long job, such as a batch conversion, a download, or a render on a remote server, you normally see nothing until it ends. This plugin shows a live bar for each task.

You do not need to set anything up: Claude adds progress to long work by itself, and asks before it changes your own scripts. Say "show progress" to get it for everything. The progress costs no tokens.

## Install

```
claude plugin install simple-progress-bars@anthropic-plugin-directory
```

Or, for the newest version, install it from this repository:

```
claude plugin marketplace add mhgar/claude-simple-progress-bars
claude plugin install simple-progress-bars@simple-progress-bars
```

It needs Claude Code v2.1.287 or later, on Linux, macOS, or Windows. Start a new session after the install.

## Use it in your own scripts

Print a `[progress]` line as your script works, and you get a live bar with a time estimate:

```bash
# convert.sh
n=$(ls *.mkv | wc -l); i=0
for f in *.mkv; do
  echo "[progress] $((++i))/$n $f"
  ffmpeg -i "$f" ...
done
echo "[progress] done"
```

The progress lines stay out of the output, and any language works, even over SSH. See [`USAGE.md`](plugins/simple-progress-bars/USAGE.md) for more.

## Settings

Claude adds a bar to anything that it expects to take more than a couple of seconds. To change that, run `/plugin configure simple-progress-bars@simple-progress-bars`.

## Privacy

- **Files:** the plugin keeps a few small status files in your Claude folder, and cleans them up by itself.
- **Claude Code:** the plugin adds one short section to Claude's instructions. It does not change your commands or the conversation.
- **Network:** none. Nothing leaves your machine, apart from the SSH commands that you or Claude run.

## Development

The specs in [`openspec/specs`](openspec/specs) describe what each part must do, and [`USAGE.md`](plugins/simple-progress-bars/USAGE.md) explains how the parts work together.

```
claude plugin validate plugins/simple-progress-bars     # check the manifest and hooks
claude plugin test plugins/simple-progress-bars         # run the plugin tests
plugins/simple-progress-bars/tests/cli-test.sh          # test the wrapper, and the PowerShell wrapper where PowerShell is installed
npx @fission-ai/openspec validate --specs --strict      # check the specs
```

To try the plugin without installing it, start Claude Code with `claude --plugin-dir plugins/simple-progress-bars`, and type `! examples/demo.sh` at the prompt. The demo shows each kind of bar.

The evals in `plugins/simple-progress-bars/evals` check that Claude uses the plugin well:

```
claude plugin eval plugins/simple-progress-bars --ablation none --scaffold --trust-plugin --allow-tools Bash Write Edit
```

Cases tagged `bash` need Linux or macOS. On Windows, add `--tag write` to run the other cases. The "Claude evals" GitHub workflow runs all of them on Linux when you start it by hand, with the `ANTHROPIC_API_KEY` repository secret.

## License

MIT
