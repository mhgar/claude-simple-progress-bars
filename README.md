# Simple Progress Bars

Progress bars with time estimates for the long scripts that Claude Code runs. A script reports its progress with one command, and the bar shows under the prompt:

```
❯ convert the videos in ~/clips to h265
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  ⏵⏵ auto mode on · 1 shell · ↓ to manage
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  convert-vid… ━━━━──────────────── 18/90  20%  0:19  ~1:12 left │ download-ub… ━━━━━━╸───────── 819M/2.0G  40%  0:19  ~0:27 left
  train-model ━━━━━━━━━━━━╸──────── 30/50  60%  0:19  ~0:12 left │ flaky-script ━━━━━━━━━───────────── 40/100  40%  0:18  stopped
  upload-to-n… server retu… ━━━━╸────── 25/60  41%  0:18  failed │ scan-library Scanning li… ──━━━━━━───────────────── 1234  0:19
```

Each update costs zero tokens. Claude learns about the command from a short section that the plugin adds to its system prompt. Claude uses it only for scripts that run longer than about 30 seconds and have countable work.

> **Early access.** This plugin is a Claude Code *mod*: it uses function hooks, which Claude Code marks as early access. A Claude Code update can change that API and break the plugin.

## Install

```
claude plugin marketplace add mhgar/simple-progress-bars
claude plugin install simple-progress-bars@simple-progress-bars
```

Then start a new Claude Code session. The plugin puts the `claude-progress` command on the `PATH` of Claude's Bash tool.

**Requirements:** Claude Code with function hooks, Python 3.8 or later, and Linux or macOS. Windows is not supported.

## Usage

Claude writes these calls for you. You can also use them in your own scripts. Options come first, then one VALUE, then detail text.

| Call | Meaning |
| --- | --- |
| `claude-progress -n NAME 17/240 [detail]` | 17 of 240 done |
| `claude-progress -n NAME 1.5G/4G` | Sizes. The bar shows `1.5G/4.0G` and a rate |
| `claude-progress -n NAME 42% [detail]` | Percent done |
| `claude-progress -n NAME Scanning disk` | Text with no number. The count and the total stay. With no total, a segment moves back and forth |
| `claude-progress -n NAME -t 500`, then `claude-progress -n NAME +1` | A total, then counts from parallel workers. A file lock keeps the count correct |
| `claude-progress -n NAME done [msg]` | The task is complete |
| `claude-progress -n NAME fail [msg]` | The task failed. The bar turns red |
| `claude-progress -n NAME clear` | Remove the bar now |
| `cmd \| claude-progress -n NAME -l -t 5000` | Count lines of output, like `pv -l`. `-b` counts bytes |
| `claude-progress -n NAME -p -- python train.py` | Read `tqdm`, `pv`, or `rsync` output from the command, and report its exit status |

Example:

```bash
n=$(ls *.mkv | wc -l); i=0
for f in *.mkv; do
  claude-progress -n convert "$((++i))/$n" "$f"
  ffmpeg -i "$f" ...
done
claude-progress -n convert done
```

Run `claude-progress --help` for the full reference. If you leave out `-n`, the task name is the name of the calling script.

**Scripts that run outside Claude Code.** Outside a Claude Code session, `claude-progress` reports nothing, but other machines do not have the command at all. Claude puts this line near the top of a script file that people can run elsewhere. Then the calls do nothing there, pipe modes pass the input through, and `-- COMMAND` runs the command:

```bash
command -v claude-progress >/dev/null || claude-progress() { local a m=; for a; do case $a in --) break;; -l|-b|-p) m=1;; esac; done; while [ $# -gt 0 ] && [ "$1" != -- ]; do shift; done; if [ $# -gt 0 ]; then shift; "$@"; elif [ -n "$m" ]; then cat; fi; }
```

## What the bar shows

- **Task name:** In bold. A name longer than 20 cells, or one fifth of the line, is cut with `…`. Wide characters count as two cells.
- **Time estimate:** A smoothed rate (exponential moving average, smoothing 0.3, the `tqdm` default). The rate counts only updates that change the count. The bar shows `estimating…` until it has 3 counted updates and 2 seconds of data. The shown value moves only when the new estimate differs by more than 10%.
- **At the total:** A bar that reaches its total while the script runs shows `finishing…`. It shows `done` when the script reports done or exits.
- **Layout:** Each task gets at least 50 columns. Tasks that do not fit on one line go to the next line. The rows are balanced, up to the row limit, then `+N`.
- **Colors:** Cyan while a task runs. Yellow "no update" after 30 seconds with no update. Green when done. Red when failed or stopped.

## Failure handling

| Case | Result |
| --- | --- |
| The script crashes or is killed before `done` | The plugin sees that the reporting process exited. The bar shows "stopped" for 30 seconds. A bar at its total shows "done". |
| A command run with `-p --` exits with a non-zero status | The bar shows "failed" with `exit N`. `claude-progress` exits with the same status. |
| A command run with `-p --` dies by a signal | The bar shows "failed" with `signal N`. `claude-progress` dies by the same signal, so the shell sees it. Ctrl-C reaches the command, and SIGTERM and SIGHUP pass on to it. |
| The command cannot start | Exit 127 for a missing command, 126 for one that cannot run, as in a shell. |
| The reader of a pipe closes early (`\| head`) | `claude-progress` ends by SIGPIPE, as `cat` does. With `--`, the command gets SIGPIPE on its next write. |
| A background process keeps the output pipes open | `claude-progress` waits 1 second after the command exits, then ends. |
| No update for 30 seconds while the process runs | The bar turns yellow and stays. |
| Bad input, or the plugin is not loaded | A warning on stderr. Direct reports exit 0, pipe modes still pass the input through, and `--` still runs the command. |
| Outside Claude Code | `claude-progress` reports nothing. See the shim above for machines that do not have it. |
| The total changes, or the count goes back | The rate estimate starts again. |
| `/clear` or `/resume` | The plugin follows the new session ID, and keeps the bars of background tasks that started before. |

## Settings

Run `/plugin configure simple-progress-bars@simple-progress-bars`, or use the config menu.

| Setting | Default | Meaning |
| --- | --- | --- |
| `position` | `below` | `below`: under the mode line. `above`: in the band above the prompt, over what other plugins draw there. Claude Code keeps an empty notification row between that band and the prompt. |
| `maxRows` | `3` | Most rows of bars |
| `minSeconds` | `30` | Claude adds progress reports only to scripts it expects to run at least this long |

## How it works

1. `claude-progress` writes one small JSON file per task to `<dir>/<session id>/<task name>`. `<dir>` is `$PROGRESS_DIR`, else `$XDG_RUNTIME_DIR/claude-progress`, else `$TMPDIR/claude-progress`, else `/tmp/claude-progress-<uid>`. The session ID comes from `CLAUDE_CODE_SESSION_ID`, which Claude Code sets in every Bash call. Each write goes to a temporary file first, then a rename replaces the task file.
2. The plugin asks `claude-progress --dir` for `<dir>` once at session start, so the two parts always agree.
3. The plugin reads the session directory 4 times a second, and reads a file again only when it changes.
4. The plugin checks whether each reporting process still runs: through `/proc` on Linux, through one `ps` call on macOS.

**What the plugin touches:** It reads and writes only `<dir>`. At session start, it deletes subdirectories of `<dir>` that are named like a session ID and are older than 24 hours. At session end, it deletes the directories of that process. It runs `mkdir`, `rm`, `find`, and `ps` for this work, and it does not use the network.

## Limits

- **Sandboxed Bash:** If the Bash tool runs in a sandbox with its own `TMPDIR` or its own PID namespace, the bars can fail to show, or a crashed script can keep its bar. On Linux, `XDG_RUNTIME_DIR` usually avoids the first problem.
- **Buffered output:** `-p --` sets `PYTHONUNBUFFERED=1` for the command. Other programs can buffer their output when it goes to a pipe. On Linux, use `stdbuf -oL COMMAND`.
- **Parse mode guesses:** `-p` takes the newest `N%` or `N/M` in the output. A percent wins over a count on the same line. The first stream and kind that it finds stay its source. Output with other numbers in that form can move the bar.

## Similar projects

| Project | Difference |
| --- | --- |
| [agent-progress](https://github.com/csinva/agent-progress) | Shows bars in the status line. Claude writes a monitor script and estimates the ETA with an LLM call, so it costs tokens. |
| [ccprogress](https://github.com/amigoer/ccprogress) | Tracks the steps of Claude's own plan, not scripts. |
| [claude-code-eta](https://github.com/meyer-coder/claude-code-eta) | Estimates how long prompts and agents take. |

## Development

```
claude plugin validate plugins/simple-progress-bars     # manifest and hooks
cd plugins/simple-progress-bars && claude plugin test . # parse, bar, layout, watch, and prompt tests
plugins/simple-progress-bars/tests/cli-test.sh          # tests for the claude-progress command
```

To try the plugin without an install, run `claude --plugin-dir plugins/simple-progress-bars`. Then run `! examples/demo.sh` in the session. It starts six fake tasks that show each kind of bar.

## License

MIT
