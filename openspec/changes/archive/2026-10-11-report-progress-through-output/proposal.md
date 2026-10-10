## Why

Today a script reports progress through calls to `claude-progress`, and each language needs a shim to find that command. A job on a remote server cannot call the local command at all. So Claude writes its own poll loop over SSH, or it shows only a text status. The prompt section also tells Claude to skip "unattended jobs" and "code that shows its own progress", so Claude often skips remote jobs. Output works everywhere: every language can print a line, and SSH carries output to the local machine with no extra setup.

## What Changes

Progress reports move from command calls to output lines. This is the one method of the plugin. It replaces the direct calls, the language twins, and the shims. The script is in control of its tasks. The wrapper ends a task only as a fallback, when the script did not end it.

**The wrapper**
- **BREAKING**: `claude-progress` becomes a wrapper: `claude-progress [-n NAME] [--] COMMAND [ARGS...]`. It runs the command, reads its standard output and standard error, and turns tag lines into bars.
- The wrapper removes tag lines from the output and passes all other lines through. So progress costs no tokens.
- Scripts can print tag lines at any rate. The wrapper starts no process for a tag line.
- The wrapper sets `PYTHONUNBUFFERED=1` for the command, so local Python output arrives at once.

**Tags and tasks**
- A tag line is `[progress] VALUE [DETAIL]` or `[progress:NAME] VALUE [DETAIL]`. VALUE has the forms of today: `3/8`, `1.5G/4G`, `42%`, `+1`, `total 500`, text, `done`, `fail`, `clear`. The wrapper accepts `\n` and `\r\n` line ends.
- Each run has one root task. `[progress]` updates the root. Its name comes from `-n`, or else from the file name of the command without its extension: `./render.sh` gives `render`.
- `[progress:NAME]` updates the subtask NAME of the root. If no root runs, the tag also starts a root, which shows with no count until a `[progress]` tag arrives. There is one layer of subtasks only. A task keeps its role for its whole life.
- Scripts print `done` or `fail` at the end of each task, because an exit status is not always reliable. A script never has to print `clear`.
- An end of the root ends every running subtask at once, with the same state. A subtask that already ended keeps its own end.
- A task that ended is final. A later tag with the same name makes a new task with a new bar.
- Only the wrapper writes `stopped`. A tag with this value reads as text.

**Fallback ends**
- When the command exits, the wrapper ends each task that is still running: `done` after exit status 0, else `fail` with the exit status and the last line of output. The wrapper exits with the status of the command.
- On `INT`, `TERM`, `HUP`, or `QUIT`, the wrapper sends the signal to the command, waits for it, and ends its running tasks as `stopped`. A trap on its own exit catches every other way out. A closed output pipe does not stop the wrapper or the command.
- **Heartbeat**: when 5 seconds pass with no write, the wrapper rewrites its file, also while the command prints untagged lines. If a file does not change for 15 seconds, the plugin ends its running tasks as `stopped`. This covers a `KILL`, a crash, and background jobs. If the file changes again later, as after a sleep of the computer, those tasks run again.

**Files**
- **BREAKING**: Each wrapper run writes one run file, `<pid>-<start time>`, from its first tag on. The wrapper holds the state of its tasks in memory, and rewrites the whole file at once after each tag. The file holds only the current state, so it stays small. The last line is `end`, so the plugin can ignore a half-written file.
- The wrapper drops a task from the file 15 seconds after it ends.

**Plugin**
- The plugin hides a `done` bar after 5 seconds (today 2), and a `fail` or `stopped` bar after 10 seconds (today 30). An ended bar hides after its hold time, whatever the wrapper and the command do. So a remote script that prints `done` ends its bar, also while SSH still runs.
- The plugin hides bars by run file and task ID. An ended task never shows again after it hides.
- **BREAKING**: Remove the rule that a bar ends with its foreground shell call, and the 10-minute expiry of running bars. The heartbeat replaces both.
- A root with subtasks gets its own row, and its subtasks pack into the rows under it, each row with an indent of 4 cells.
- A subtask report counts as an update of its root for the stall check (`no update`).

**Guidance**
- The prompt section teaches one rule: run slow work through the wrapper, print tag lines, flush output after each tag, and end each task with `done` or `fail`.
- It drops "unattended jobs" and "code that shows its own progress" from the cases to skip.
- It covers background jobs, remote jobs, and detached remote jobs that Claude follows through their log.

**Removed**
- **BREAKING**: the direct form (`claude-progress -n NAME VALUE`) and the `-t` option. A tag line `total N` replaces `-t`.
- **BREAKING**: the Python and Node twins (`claude_progress.py`, `claude-progress.js`) and all five shims (`shim.sh`, `shim.ps1`, `shim.py`, `shim.js`, `shim.mjs`).
- Two implementations of the wrapper stay: `claude-progress.sh` for bash, and `claude-progress.ps1` for PowerShell.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `progress-command`: the command becomes the wrapper. New requirements for tag lines, root tasks and subtasks, the run file, the heartbeat, output, exit status, and signals. The direct form and the Python and Node twins go.
- `progress-tracking`: run files with tasks by ID. A new end value `stopped`. A stale run file ends its running tasks, and a fresh write brings them back. Subtasks end with their root. New hold times. The shell-call rule and the 10-minute expiry go.
- `progress-display`: a root with subtasks gets a block: its own row, and indented rows of subtasks under it. Subtask reports keep their root from the stall state.
- `claude-guidance`: teach the wrapper, tag lines, flushing, background jobs, remote jobs, and detached remote jobs. Drop two cases to skip. Remove the shims.

## Impact

- `plugins/simple-progress-bars/scripts/claude-progress.sh` and `claude-progress.ps1`: rewritten as the wrapper.
- Deleted: `scripts/claude_progress.py`, `scripts/claude-progress.js`, and `shim.*`.
- `hooks/parse.ts`, `hooks/bar.ts`, `hooks/watch.ts`, `hooks/register.tsx`, `hooks/layout.ts`: run files, tasks by ID, the heartbeat check, the hold times, and the block layout. The plugin no longer tracks Bash calls.
- `hooks/prompt.ts`, `USAGE.md`, both READMEs, `examples/demo.sh`, and `openspec/config.yaml` (its context names the shim).
- Tests: `tests/cli-test.sh`, `tests/parse.test.ts`, `tests/bar.test.ts`, `tests/watch.test.ts`, `tests/layout.test.ts`, `tests/prompt.test.ts`, `tests/band.test.ts`.
- Evals: every case that checks for command calls or shims, and new cases for a remote job and a detached remote job.
- Release: 1.1.0. Scripts that use a shim stop reporting, but they do not break, because a shim does nothing when it finds no twin.
