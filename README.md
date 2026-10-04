# Simple Progress Bars

Progress bars for the long scripts that Claude Code runs.

When Claude runs a script that takes a while, such as a batch conversion, a download, or a test suite, you normally see nothing until it ends. With this plugin, the script reports its progress, and Claude Code shows a live bar for each task above the prompt, with a count, a percent and a time estimate.

```
  convert-videos clip_018.mkv ━━━─────────── 18/90  20%  0:19  ~1:12 left │ download-ubun… ━━━━━━╸───────── 819M/2.0G  40%  46M/s  0:19  ~0:27 left
  train-model ━━━━━━━━━━━━━━━━━━──────────── 30/50  60%  0:19  ~0:12 left │ flaky-script ━━━━━━━━━━━━╸────────────────── 40/100  40%  0:18  stopped
  upload-to-nas server return… ━━━━━━━────────── 25/60  41%  0:18  failed │ scan-library Scanning libr… ──━━━━━━──────────────────────── 1234  0:19
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ 
```

You do not need to do anything. The plugin teaches Claude to add progress reports to scripts that run longer than about 30 seconds. The updates go straight to the screen, so they cost no tokens.

> **Early access.** This plugin uses Claude Code function hooks, which are an early-access feature. A Claude Code update can change them and break the plugin.

## Install

```
claude plugin marketplace add mhgar/claude-simple-progress-bars
claude plugin install simple-progress-bars@simple-progress-bars
```

Then start a new Claude Code session. A session that was open before the install does not load the plugin.

The plugin works on Linux, macOS and Windows. It needs no other software. On Windows, the command runs in Git Bash, which Claude Code already uses for its Bash tool.

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

For example:

```bash
n=$(ls *.mkv | wc -l); i=0
for f in *.mkv; do
  claude-progress -n convert "$((++i))/$n" "$f"
  ffmpeg -i "$f" ...
done
claude-progress -n convert done
```

The command never breaks a script. It always exits with 0, and outside Claude Code it does nothing. Run `claude-progress --help` for the full reference.

### Scripts that run elsewhere

Other machines do not have the `claude-progress` command. For a script that people may run outside Claude Code, add this line near the top. It turns the calls into no-ops when the command is missing:

```bash
command -v claude-progress >/dev/null || claude-progress() { :; }
```

Claude adds this line for you when it writes such a script.

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
| `minSeconds` | `30` | Claude adds progress reports only to scripts it expects to run at least this long |

## How it works

The plugin has two parts: the `claude-progress` command, and a set of hooks inside Claude Code.

1. Each `claude-progress` call writes one line to a small file: `~/.claude/progress/<session id>/<task name>`. Claude Code gives every Bash call the session ID, so each session has its own folder.
2. The plugin reads that folder four times a second, and draws a bar for each file.
3. The plugin also watches Claude's Bash calls. When the call that ran a script ends, the bars of that script end too. A bar that did not reach its total shows `stopped`.

The plugin also adds a short section to Claude's system prompt. That section tells Claude when and how to use `claude-progress`.

### What it touches

- **Files:** the command writes only in `~/.claude/progress`, or in `$CLAUDE_CONFIG_DIR/progress` if you set that variable. It removes the folders of old sessions after their Claude Code process exits.
- **Claude Code:** the plugin adds one section to the system prompt and draws the bars above the prompt. It does not change your commands, their output, or the transcript.
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

## License

MIT
