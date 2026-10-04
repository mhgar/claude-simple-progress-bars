# Simple Progress Bars

Progress bars with time estimates for the long scripts that Claude Code runs. A script reports its progress with one command, and the bar shows under the prompt:

```
❯ convert the videos in ~/clips to h265
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ auto mode on · 1 shell · ↓ to manage
──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  convert-vide… clip_018.mkv ━━──────── 18/90  20%  0:19  ~1:12 left │ download-ubu… ━━━━━─────── 819M/2.0G  40%  46M/s  0:19  ~0:27 left
  train-model ━━━━━━━━━━━━━━━────────── 30/50  60%  0:19  ~0:12 left │ flaky-script ━━━━━━━━━━╸─────────────── 40/100  40%  0:18  stopped
  upload-to-nas server retur… ━━━━━╸─────── 25/60  41%  0:18  failed │ scan-library Scanning lib… ──────────────━━━━━━────────────── 0:19
```

Each update costs zero tokens. Claude learns about the command from a short section that the plugin adds to its system prompt, and uses it only for scripts that run longer than about 30 seconds and have countable work.

> **Early access.** This plugin is a Claude Code *mod*: it uses function hooks, which Claude Code marks as early access. A Claude Code update can change that API and break the plugin.

## Install

```
claude plugin marketplace add mhgar/simple-progress-bars
claude plugin install simple-progress-bars@simple-progress-bars
```

Then start a new Claude Code session. The plugin puts the `progress` command on the `PATH` of Claude's Bash tool.

**Requirements:** Claude Code with function hooks, Python 3, and Linux or macOS. Windows is not supported.

## Usage

Claude writes these calls for you. You can also use them in your own scripts.

| Call | Meaning |
| --- | --- |
| `progress -n NAME 17/240 [detail]` | 17 of 240 done |
| `progress -n NAME 1.5G/4G` | Sizes. The bar shows `1.5G/4.0G` and a rate |
| `progress -n NAME 42% [detail]` | Percent done |
| `progress -n NAME Scanning disk` | No total. A segment moves back and forth |
| `progress -n NAME -t 500`, then `progress -n NAME +1` | A total, then counts from parallel workers. A file lock keeps the count correct |
| `progress -n NAME done [msg]` | The task is complete |
| `progress -n NAME fail [msg]` | The task failed. The bar turns red |
| `progress -n NAME clear` | Remove the bar now |
| `cmd \| progress -n NAME -l -t 5000` | Count lines of output, like `pv -l`. `-b` counts bytes |
| `progress -n NAME -p -- python train.py` | Read `tqdm`, `pv`, or `rsync` output from the command, and report its exit status |

Example:

```bash
n=$(ls *.mkv | wc -l); i=0
for f in *.mkv; do
  progress -n convert "$((++i))/$n" "$f"
  ffmpeg -i "$f" ...
done
progress -n convert done
```

Run `progress --help` for the full reference. If you leave out `-n`, the task name is the name of the calling script.

## What the bar shows

- **Task name:** In bold. A name longer than 20 characters, or one fifth of the line, is cut with `…`.
- **Time estimate:** A smoothed rate (exponential moving average, smoothing 0.3, the `tqdm` default). The bar shows `estimating…` until it has 3 updates and 2 seconds of data. The shown value changes only when the new estimate differs by more than 10%.
- **Layout:** Each task gets at least 50 columns. Tasks that do not fit on one line go to the next line. The rows are balanced, up to the row limit, then `+N`.
- **Colors:** Cyan while a task runs. Yellow "no update" after 30 seconds with no update. Green when done. Red when failed or stopped.

## Failure handling

| Case | Result |
| --- | --- |
| The script crashes or is killed before `done` | The plugin sees that the reporting process exited. The bar shows "stopped" for 30 seconds. |
| A command run with `-p --` exits with a non-zero status | The bar shows "failed" with `exit N`. `progress` exits with the same status. |
| No update for 30 seconds while the process runs | The bar turns yellow and stays. |
| Bad input, or the plugin is not loaded | A warning on stderr. `progress` exits 0, so it never fails a script. |
| Run outside Claude Code | `progress` does nothing. With `-p --`, it runs the command normally. |
| The total changes, or the count goes back | The rate estimate starts again. |
| `/clear` | The plugin follows the new session ID. |

## Settings

Run `/plugin configure simple-progress-bars@simple-progress-bars`, or use the config menu.

| Setting | Default | Meaning |
| --- | --- | --- |
| `position` | `below` | `below`: under the mode line. `above`: in the band above the prompt. Claude Code keeps an empty notification row between that band and the prompt. |
| `maxRows` | `3` | Most rows of bars |
| `minSeconds` | `30` | Claude adds progress reports only to scripts it expects to run at least this long |

## How it works

1. `progress` writes one small JSON file per task to `<runtime dir>/claude-progress/<session id>/<task name>`. The runtime dir is `$XDG_RUNTIME_DIR`, else `$TMPDIR`, else `/tmp`. The session ID comes from `CLAUDE_CODE_SESSION_ID`, which Claude Code sets in every Bash call. Each write goes to a temporary file first, then a rename replaces the task file.
2. The plugin reads the session directory 4 times a second, and reads a file again only when it changes.
3. The plugin checks whether each reporting process still runs: through `/proc` on Linux, through `ps` on macOS.

**What the plugin touches:** It reads and writes only the session directory. At session start, it deletes session directories that are older than 24 hours. At session end, it deletes the directory of that session. It runs `mkdir`, `rm`, `find`, and `ps` for this work, and it does not use the network.

## Similar projects

| Project | Difference |
| --- | --- |
| [agent-progress](https://github.com/csinva/agent-progress) | Shows bars in the status line. Claude writes a monitor script and estimates the ETA with an LLM call, so it costs tokens. |
| [ccprogress](https://github.com/amigoer/ccprogress) | Tracks the steps of Claude's own plan, not scripts. |
| [claude-code-eta](https://github.com/meyer-coder/claude-code-eta) | Estimates how long prompts and agents take. |

## Development

```
claude plugin validate plugins/simple-progress-bars     # manifest and hooks
cd plugins/simple-progress-bars && claude plugin test . # layout, estimate, and state tests
plugins/simple-progress-bars/tests/cli-test.sh          # tests for the progress command
```

To try the plugin without an install, run `claude --plugin-dir plugins/simple-progress-bars`. Then run `! examples/demo.sh` in the session. It starts six fake tasks that show each kind of bar.

## License

MIT
