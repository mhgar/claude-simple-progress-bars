## Context

Today the command `claude-progress` writes lines to a task file, and the plugin reads that file. Scripts in Python and Node load a twin of the command through a shim. A job on another machine cannot reach the task file. Every Bash tool call already captures the output of its command, and SSH carries the output of a remote command. The wrapper uses this path. It turns output lines into a run file that the plugin reads.

Terms in this document:
- **Wrapper**: the new `claude-progress`, which runs a command.
- **Run**: one start of the wrapper. **Run file**: the file of one run.
- **Task**: one unit of progress. Each run has one **root task**, and the root can have **subtasks**.
- **Bar**: the display of one task.

## Goals / Non-Goals

**Goals:**
- One way to report progress from any language, on any machine: print a line.
- The script is in control of its tasks. The wrapper ends a task only as a fallback.
- Correct bars for background jobs and for jobs on a remote server over SSH.
- Bars end when their job ends, also after a cancel or a kill.
- A root task can have one layer of subtasks.
- The exit status and the normal output of the command stay the same.
- No new runtime. Bash 3.2 (macOS) and Windows PowerShell 5.1 stay supported.

**Non-Goals:**
- More than one layer of subtasks.
- A control to collapse and expand a root. The mod API supports it (a `Button` in the band), so a later change can add it. Roots will start expanded.
- A reconnect for SSH. `autossh` and the SSH keep-alive options already do this.

## Decisions

### One method: the wrapper
`claude-progress [-n NAME] [--] COMMAND [ARGS...]` runs COMMAND. The first word that is not an option starts COMMAND. `--` is optional, and marks the end of the options. `-n` sets the name of the root task. Without `-n`, the name is the file name of COMMAND without its extension: `./render.sh` gives `render`. For `bash -c` or `ssh`, that name tells the person nothing, so the guidance tells Claude to set `-n`. `-h`, `--help`, and no arguments print the help. `--dir` prints the progress directory.

The direct form goes. One status in a chain of commands becomes a tag inside the command:

```bash
claude-progress -n build bash -c 'echo "[progress] Building the viewer"; make viewer'
```

Alternative: keep the direct form beside the wrapper. Two methods mean two sets of rules in the guidance, and the shims stay alive. Rejected.

### The tag: `[progress]` at the start of a line
A tag line starts with `[progress]` or `[progress:NAME]`, then one space, then VALUE. The tag must be at the start of the line, so a sentence such as "50% faster" never moves a bar. NAME is the text up to the first `]`, cut to 80 characters. An empty NAME reads as `[progress]`. A line with a tag and no VALUE is not a tag line, and passes through as output.

VALUE has the forms of today: `N/M`, sizes such as `1.5G/4G`, `N%`, `+N`, `total N`, text, `done [MSG]`, `fail [MSG]`, and `clear`. Three rules:
- Scripts print `done` or `fail` at the end of each task. An exit status is not always reliable, so an explicit end is the main signal.
- `clear` removes a task and its bar at once. On the root, it also removes the subtasks. A script never has to print it.
- `stopped` is for the wrapper only. A tag with this value reads as text, so a script cannot make a bar look stopped by mistake.

The wrapper removes a `\r` before a `\n`, so programs with Windows line ends work.

Alternatives: `::progress::` (the GitHub Actions form) is harder to type in a format string. A tag in the middle of a line gives false matches.

### Root tasks and subtasks
Each run has one root task at a time. `[progress]` updates the root. `[progress:NAME]` updates the subtask NAME of the root.

If no root runs, the first tag starts one:
- A `[progress]` tag starts the root with its VALUE.
- A `[progress:NAME]` tag starts the root with no count, and then the subtask. The root shows a moving segment until a `[progress]` tag gives it a count.

So a subtask always has a root. A tag can name only one task, so there is only one layer of subtasks. A task keeps its role, root or subtask, for its whole life.

An end of the root ends every running subtask at once, with the same state and no message. A subtask that already ended keeps its own end. The wrapper applies this rule, so its own state stays correct. The plugin applies the same rule as a guard, for a file that a dead wrapper left.

A task that ended is final. A later tag with the same name makes a new task, with a new bar. The old bar keeps its end until its hold time is over. This applies to the root and to subtasks. Example: after `[progress] done`, a `[progress:frames] 1/240` tag starts a new root with no count and a new subtask `frames`. A distinct name for each subtask is clearer for the person, but it is not necessary.

### Read both streams, document standard output
The wrapper reads standard output and standard error. Tag lines on either stream count. Other lines go back to the stream that they came from. The guidance tells Claude to print tags to standard output, because it is the easiest stream in every language.

Both streams feed one loop in the wrapper, so only one loop writes the run file. Each line carries a mark of its stream into that loop. The order of lines between the two streams can change. The order inside one stream stays.

### Buffering
In a pipe, many programs hold their output in a buffer, and tags then arrive late. The guidance tells Claude to flush the output after each tag line, and `USAGE.md` gives one example for each common language, such as `print(..., flush=True)` in Python. The wrapper also sets `PYTHONUNBUFFERED=1` for the command that it starts, so local Python scripts work without a flush. The environment does not cross SSH, so remote scripts still need the flush. The rule "the plugin sets no environment variables" stays true: this variable goes only to the child process.

### One run file
Each run writes one file, `<config>/progress/<session id>/<pid>-<start>`. PID is the process ID of the wrapper, and START is its start time in seconds. A PID cannot start twice in one second, so the name is unique. The bash wrapper reads the time once at start, with one `date` call, because bash 3.2 has no `EPOCHSECONDS`.

The wrapper creates the run file at the first tag. It gives each task a number, ID, in the order that the tasks start. A line `task ID - NAME` declares a root. A line `task ID ROOT NAME` declares a subtask of the root with the ID ROOT. NAME comes last, so it can hold spaces. Each line `[ID] VALUE [DETAIL]` is a report for that task. The last line is `end`:

```
task 1 - render
[1] total 500
[1] 231/500 frame_231.exr
task 2 1 frames
[2] done
task 3 1 upload
[3] 3/10
task 4 1 frames
[4] 2/240
end
```

A task name never has to be parsed out of a report line. Two tasks with the same name have two IDs, so they never mix. The plugin reads the reports of each task in order, with the line folding of today.

### Rewrite from memory
The wrapper holds the state of each task in memory. After each tag, it changes the state of that one task, and rewrites the whole run file at once, with one `printf` and no new process. It does not wait or group writes. For each task, the file keeps only the lines that make its current state:
- the newest `total`,
- the newest count or percent,
- one `+N` with the sum of the whole-number adds after that count,
- each add with a unit or a decimal point, such as `+1.5G`, because bash cannot add decimals,
- `+0 DETAIL` for the newest detail, if it came after the newest count. `+0` adds nothing, so a detail such as `3/8 files` never reads as a count.
- the end line.

The wrapper drops a task from the file 15 seconds after the task ends. This is longer than the longest hold time, so the person still sees each end. A script that starts thousands of subtasks still has a small file.

So a script can print tags at any rate, and the "once a second" rule goes away. The dot file and the rename of today go, because only one process writes each file.

A rewrite empties the file before it writes it. So a read of the plugin can find an empty file, or only a part of it. The plugin ignores a read with no `end` line as its last line, and keeps the state from its last good read.

The bash 3.2 limits apply: no associative arrays. The wrapper keeps the state of its tasks in indexed arrays, and measures time with `SECONDS`.

### The heartbeat
The plugin must tell a quiet live job from a dead wrapper. In both cases, the tags stop. So the wrapper also rewrites its file when 5 seconds pass with no write. Two checks make sure of this:
- Its loop waits for a line with a time limit (`read -t 5` in bash). So a long, quiet step in the script never delays the heartbeat.
- After each line, also an untagged one, the wrapper compares the time since its last write. So a command that prints all the time, but no tags, still gets a heartbeat.

The plugin already gets the modification time of each file when it lists the directory. A run file that has not changed for 15 seconds is stale: the plugin ends its running tasks as `stopped`. When the file changes again, these tasks run again with the state that the file holds. This happens after `Ctrl+Z` and continue, or after the computer sleeps. A `stopped` that the plugin decided on its own is a guess, and a `stopped` that the wrapper wrote is final.

The heartbeat works the same on Linux, macOS, and Windows. It starts no process in the plugin, and a reused PID cannot fool it. A mod has no Node runtime, so a PID check is not possible without a new process.

The heartbeat replaces two old rules of the plugin:
- **A bar ends with its foreground shell call.** This rule marked a background wrapper as stopped when the call that started it ended. The plugin no longer tracks Bash calls.
- **A running bar hides 10 minutes after its last update.** This rule hid live jobs with a quiet step of more than 10 minutes.

### Fallback ends
The script ends its tasks. The wrapper ends only the tasks that are still running, in these cases:

| Event | Layer | Result for each running task |
|---|---|---|
| The command exits with status 0 | End of the run | `done` |
| The command exits with another status | End of the run | `fail exit N: LAST`. LAST is the last line that the command printed and that was not a tag line, cut to 200 characters. |
| `INT`, `TERM`, `HUP`, or `QUIT` | Signal trap | The wrapper sends the same signal to the command and waits for it. Then it writes `stopped`, and exits with `128 + the signal number`. |
| Any other exit of the wrapper, such as an internal error | Exit trap (`trap … EXIT` in bash, `finally` in PowerShell) | `stopped` |
| `KILL`, a crash, or a power loss | Heartbeat check in the plugin | `stopped` after 15 seconds |

A task that the script ended keeps its end. The exit status, a signal, and the exit trap do not change it. Claude still sees the exit status.

After the command exits, the wrapper exits with the status of the command. If the command does not exist, the status is 127, the same as in the shell.

The command stays in the process group of the wrapper. So when Claude Code stops the group, the command stops too. The wrapper ignores `PIPE`. If Claude Code closes the output pipe, the wrapper drops the output that it cannot write, and keeps the job and its bars alive.

### Hiding ended bars
Only the plugin hides bars. An ended bar hides after its hold time, whatever the wrapper and the command do. For example, a remote script prints `[progress] done`, and the bar goes 5 seconds later, while the SSH command still runs. The wrapper never deletes a file. The session sweep of today removes old files.

The hold times change (`isExpired` in `hooks/bar.ts`):

| End state | Today | New |
|---|---|---|
| `done` | 2 seconds | 5 seconds |
| `fail` and `stopped` | 30 seconds | 10 seconds |

Today the plugin notes a hidden bar by its file, and shows it again when the file changes. A run file changes at every tag and every heartbeat, so this rule shows ended bars again and again. The plugin now notes a hidden bar by its run file and task ID. An ended task is final, so once hidden it never shows again. The one exception is a `stopped` that the plugin guessed from a stale file: that task runs again when the file changes.

### Display of subtasks
A root with visible subtasks gets a block. The root has a row of its own, at full width. Its subtasks pack into the rows under it, with the packing of today. Every subtask row starts with an indent of 4 cells. Subtask names are dim, so the root stands out. The block has no empty rows above or below it.

```
  render frame_231.exr ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──────────────────── 231/500 46% 2:10 ~2:31 left
      frames ━━━━━━━━━━━━━━━━━━━━━━━━━━──────────────── 40/240 17% 0:20 ~1:40 left │ upload ━━━━━━━━━━━━━━━━━━──────── 3/10 30% 0:05 ~0:12 left
      thumbs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──── 80/120 67% 0:40 ~0:20 left
  tests ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━──────────────── 40/50 80% 1:02 ~0:15 left
```

Rules:
- A root with no visible subtasks is a normal bar, and packs with other bars as today.
- Subtasks of one root go in the order of their start times. Roots go in the order of their start times, as today.
- The rows go first to roots. Subtasks get the rows that are left. Subtasks that do not fit become `+N` at the end of their root's row. The `+N` for whole roots stays on the last row, as today.
- A report of a subtask counts as an update of its root for the stall state (`no update`). A root turns yellow only when its whole run is quiet for 30 seconds.

### Outside Claude Code
With no session ID, the wrapper runs the command and passes all lines through, also the tag lines. A person who runs the same command in a terminal then sees the progress as text.

### PowerShell
The PowerShell wrapper starts the command with `System.Diagnostics.Process`, and reads both streams with the asynchronous line events. A timer writes the heartbeat. A lock makes sure that only one event or the timer writes the file at a time. This works in Windows PowerShell 5.1 and in PowerShell 7.

### Background jobs
The plugin reads only run files, never the output of a command. So a wrapper in the background works the same as in the foreground. The wrapper must run as long as the job:

| Command | Result |
|---|---|
| Bash tool with `run_in_background` | Works |
| `nohup claude-progress -n render ./render.sh > log 2>&1 &` | Works |
| `claude-progress -n render nohup ./render.sh &` | Fails. The child exits at once, and later tags go nowhere. |

The guidance states this rule: put the wrapper outside `nohup`, `&`, and `setsid`.

### Remote jobs
An attached job runs inside the SSH connection, and the wrapper reads its output directly:

```bash
claude-progress -n render ssh -q -o ServerAliveInterval=30 -o ServerAliveCountMax=3 host 'python -u render.py'
```

`-q` hides the server banner. The keep-alive options make SSH exit after about 90 seconds with no answer, and the wrapper then writes `fail`. When the connection drops, the server usually stops an attached job too.

A detached job runs on the server with no connection, and writes its output to a log file there. A dropped connection does not stop it. Claude starts it, and then follows its log inside the wrapper:

```bash
ssh -q host 'nohup python -u render.py > render.log 2>&1 &'
claude-progress -n render ssh -q host 'tail -n +1 -F render.log'
```

`tail -F` prints each new line of the log as the job writes it, so the bar gets live updates. `-n +1` replays the log from the start, so a new follower rebuilds the full state: the root, its total, and its subtasks. The wrapper keeps only the current state in its file, so a long log costs only a short burst of reads.

The bar ends when the remote script prints `done` or `fail`, also while the follower still runs. `tail -F` does not exit by itself, so Claude runs the follower in the background, and stops it after the end. If the follower connection drops, only the watching stops, and Claude can start it again.

## Risks / Trade-offs

- [A slow bash loop for verbose commands] Each untagged line goes through a bash `read` loop. A command that prints thousands of lines a second shows its output more slowly. Mitigation: test with a large output, and measure the time. If it is too slow, filter with `awk` and keep bash for the writes.
- [A rewrite for each tag] At a very high tag rate, the wrapper rewrites a small file thousands of times a second. Mitigation: measure it. If it is too slow, write at most once every 100 ms and always write the last state.
- [A late heartbeat] A wrapper that is very slow, for example on a busy computer, can miss the 15-second limit. Its tasks then show `stopped` until the next write brings them back.
- [Lines with `\r` alone] Text that a program redraws with a carriage return has no line end, so the wrapper finds no tag in it and passes it through unchanged.
- [Interleaved streams] The order of lines between standard output and standard error can change. This is visible to Claude, but no data is lost.
- [Breaking change] The direct form, the twins, the shims, and the task file format change. Scripts that use a shim stop reporting, but they do not break. Mitigation: release as 1.1.0, and state it in the README.

## Migration Plan

1. Change the plugin: run files, tasks by ID, roots and subtasks, `stopped`, the heartbeat check, the hold times, the hidden list, and the block layout. Remove the Bash call tracking and the 10-minute expiry. Add tests.
2. Rewrite the bash command and the PowerShell twin as the wrapper, with tests.
3. Change the prompt section, `USAGE.md`, the READMEs, the demo, and the evals. Run the evals.
4. Delete the Python and Node twins and the shims.
5. Release 1.1.0.

Rollback: install 1.0.8 again. The command and the plugin come in one package, so they change back together.

## Open Questions

None for this change. A later change looks again at the display of subtasks:
- **The row limit.** This change keeps the default of 3 rows. A block uses more rows, so a default of 4 can be better.
- **The end of a block.** In this change, a block becomes a normal bar as soon as its last subtask hides. The bars under it then move. A block that stays until its root ends gives fewer jumps.
- **Collapse and expand.** See Non-Goals.
