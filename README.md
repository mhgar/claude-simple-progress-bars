# Simple Progress Bars

Progress bars with time estimates for the long scripts that Claude Code runs. A script reports its progress with one command, and the bars show in the band above the prompt of Claude Code, while Claude works and after. They never go into the transcript.

```
  convert-videos clip_018.mkv ━━━─────────── 18/90  20%  0:19  ~1:12 left │ download-ubun… ━━━━━━╸───────── 819M/2.0G  40%  46M/s  0:19  ~0:27 left
  train-model ━━━━━━━━━━━━━━━━━━──────────── 30/50  60%  0:19  ~0:12 left │ flaky-script ━━━━━━━━━━━━╸────────────────── 40/100  40%  0:18  stopped
  upload-to-nas server return… ━━━━━━━────────── 25/60  41%  0:18  failed │ scan-library Scanning libr… ──━━━━━━──────────────────────── 1234  0:19
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ 
```

Each update costs zero tokens. Claude learns about the command from a short section that the plugin adds to its system prompt. Claude uses it only for scripts that run longer than about 30 seconds and have countable work.

> **Early access.** This plugin is a Claude Code *mod*: it uses function hooks, which Claude Code marks as early access. A Claude Code update can change that API and break the plugin.

## Install

```
claude plugin marketplace add mhgar/claude-simple-progress-bars
claude plugin install simple-progress-bars@simple-progress-bars
```

Then start a new Claude Code session. The plugin puts the `claude-progress` command on the `PATH` of Claude's Bash tool.

**Requirements:** Claude Code with function hooks, on Linux, macOS, or Windows. The command is a bash script, so it needs no other runtime. On Windows it runs in Git Bash, which Claude Code uses for its Bash tool.

## Usage

Claude writes these calls for you. You can also use them in your own scripts. Options come first, then one VALUE, then detail text.

| Call | Meaning |
| --- | --- |
| `claude-progress -n NAME 17/240 [detail]` | 17 of 240 done |
| `claude-progress -n NAME 1.5G/4G` | Sizes. The bar shows `1.5G/4.0G` and a rate |
| `claude-progress -n NAME 42% [detail]` | Percent done |
| `claude-progress -n NAME Scanning disk` | Text with no number. The count and the total stay |
| `claude-progress -n NAME -t 500`, then `claude-progress -n NAME +1` | A total, then counts from parallel workers |
| `claude-progress -n NAME done [msg]` | The task is complete |
| `claude-progress -n NAME fail [msg]` | The task failed. The bar turns red |
| `claude-progress -n NAME clear` | Remove the bar now |

Example:

```bash
n=$(ls *.mkv | wc -l); i=0
for f in *.mkv; do
  claude-progress -n convert "$((++i))/$n" "$f"
  ffmpeg -i "$f" ...
done
claude-progress -n convert done
```

The command never fails a script: it always exits 0, and outside a Claude Code session it reports nothing. A call takes about 2 ms. Run `claude-progress --help` for the full reference.

**Scripts that run outside Claude Code.** Other machines do not have the command. Claude puts this line near the top of a script file that people can run elsewhere, so the calls do nothing there:

```bash
command -v claude-progress >/dev/null || claude-progress() { :; }
```

## What the bar shows

- **Task name:** In bold. A name longer than 20 cells, or one fifth of the line, is cut with `…`. Wide characters count as two cells.
- **Time estimate:** A smoothed rate (exponential moving average, weight 0.3 for the newest sample). Only updates that change the count make a rate sample. The bar shows `estimating…` until it has 3 counted updates and 2 seconds of data. The shown value moves only when a new estimate differs by more than 10%.
- **Transfer rate:** A task in bytes, such as `claude-progress -n download 819M/2G`, also shows its rate, such as `46M/s`. On a narrow row, the rate is the second part to go.
- **At the total:** A bar that reaches its total while its script runs shows `finishing…`.
- **Layout:** Each task gets at least 50 columns. Tasks that do not fit on a row go to the next row. The rows are balanced, up to the row limit, then `+N`.
- **Colors:** Cyan while a task runs. Yellow `no update` after 30 seconds with no update. Green when done. Red when failed or stopped.

## How a bar ends

| Case | Result |
| --- | --- |
| The script reports `done` | Green `done` for 2 seconds, then the bar goes. |
| The script reports `fail` | Red `failed` with the message, for 30 seconds. |
| The foreground Bash call that ran the script ends first | `done` when the count reached the total, else red `stopped` for 30 seconds. A later update resumes the bar. |
| A background script stops reporting | Yellow `no update` after 30 seconds. The bar goes 10 minutes after its last update. |
| The script reports a new run after `done` or `fail` | A new bar, with a new start time. |

## Settings

Run `/plugin configure simple-progress-bars@simple-progress-bars`, or use the config menu.

| Setting | Default | Meaning |
| --- | --- | --- |
| `maxRows` | `3` | Most rows of bars |
| `minSeconds` | `30` | Claude adds progress reports only to scripts it expects to run at least this long |

## How it works

1. Each call of `claude-progress` writes one line to `<config>/progress/<session id>/<task name>`. `<config>` is `$CLAUDE_CONFIG_DIR`, or `~/.claude`. The session ID comes from `CLAUDE_CODE_SESSION_ID`, which Claude Code sets in every Bash call.
2. A new count or percent replaces the file. Every other report appends a line, so parallel workers need no lock.
3. The plugin reads the session directory 4 times a second. It reads a file again only when the file changes, and it folds the lines in order into the state of the task.
4. The plugin watches its foreground Bash calls. When a call ends, the bars that only that call can own end too.

**What it touches:** The command writes only in `<config>/progress`. Each session folder records its Claude Code process in `.owner` (the pid and its start time, as Claude Code keeps them in `~/.claude/sessions`). When a session writes its first task, the command deletes the folders of other sessions that are over: 1 hour after the last write once their Claude Code process has exited, or after 7 days when the folder has no owner record. A folder whose Claude Code process runs stays, however long its tasks take. The plugin only reads, and it runs no processes. Neither part uses the network.

## What the plugin changes in Claude Code

| Hook | Change |
| --- | --- |
| `prompt.compose` | Adds one section, `simple-progress-bars:usage`, at the end of Claude's system prompt. It tells Claude when and how to call `claude-progress`. No other part of the prompt changes. |
| `tool.call` (Bash) | Notes when each foreground Bash call starts and ends. The command, its input, and its result do not change. |
| `ui.render` (`AbovePrompt`) | Draws the bars in the band above the prompt. The transcript and the status line stay as Claude Code draws them. |
| `session.start` | Reads `CLAUDE_CONFIG_DIR`, `HOME`, and `USERPROFILE` only to find the progress directory, and reads the plugin's own `shim.sh`. No value leaves the machine. |

## Development

The behavior of each part is specified in [`openspec/specs`](openspec/specs), the source of truth for what the code does.

```
claude plugin validate plugins/simple-progress-bars     # manifest and hooks
cd plugins/simple-progress-bars && claude plugin test . # parse, bar, layout, watch, and prompt tests
plugins/simple-progress-bars/tests/cli-test.sh          # tests for the claude-progress command
npx @fission-ai/openspec validate --specs --strict      # the specs
```

To try the plugin without an install, run `claude --plugin-dir plugins/simple-progress-bars`. Then run `! examples/demo.sh` in the session. It starts six fake tasks that show each kind of bar.

## License

MIT
