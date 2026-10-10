# claude-progress reference

`claude-progress [-n NAME] [--] COMMAND [ARGS...]`

The wrapper runs COMMAND. COMMAND prints tag lines, and the wrapper turns them into bars. Tag lines never reach the output. Every other line does, on its own stream.
- Bash tool: `bash "<plugin>/scripts/claude-progress.sh" -n NAME COMMAND`
- PowerShell tool: `& "<plugin>/scripts/claude-progress.ps1" -n NAME COMMAND`

## Options
- `-n`, `--name NAME`: the name of the root task. Default: the file name of COMMAND without its extension, so `./render.sh` gives `render`. Set it for `bash -c` and `ssh`.
- `--`: the end of the options.
- `--dir`: print the progress directory.
- `-h`, `--help`, or no arguments: print the help.

The first word that is not an option is COMMAND. Every later word goes to COMMAND, also words that start with `-`.

## Tags
A tag starts the line. A tag in the middle of a line is normal output. A command that prints no tags shows no bar. For one step that you cannot measure, or a script that you must not edit, print a status from your own command around it:
```bash
claude-progress -n build bash -c 'echo "[progress] Building the viewer"; ./build.sh'
```

| Tag | Updates |
| --- | --- |
| `[progress] VALUE [DETAIL]` | the root task of the run |
| `[progress:SUB] VALUE [DETAIL]` | the subtask SUB of the root task. SUB ends at the first `]`. |

| VALUE | Effect |
| --- | --- |
| `N/M` | N of M done. |
| `1.5G/4G` | Bytes. Units K, M, G, T, P, with optional `i` and `B`, are powers of 1024. The bar shows a rate. |
| `N%` | Percent. |
| `+N`, `+512M` | Add N to the count. Parallel workers can each print `+1`. |
| `total N` | Set the total. |
| text | Status. Keeps the count and the total. |
| `done [MSG]` | End: done. Fills the count to the total. |
| `fail [MSG]` | End: failed. |
| `clear` | Remove the task now. On the root, also its subtasks. |

Numbers: up to 15 digits, optional `,` groups, up to 6 decimals. `N/0` and a percent above 100 read as text. `stopped` reads as text: only the wrapper stops a task.

## Root tasks and subtasks
- Each run has one root task. A `[progress:SUB]` tag with no running root starts a root with no count.
- There is one layer of subtasks. A subtask shows on an indented row under its root.
- An end of the root ends each running subtask with the same state.
- An ended task is final. A later tag with the same name starts a new task with a new bar.

## Ends
- End each task with `done` or `fail`. Give true counts, such as `done 38 copied, 2 failed`. Use `fail` only when the whole task fails.
- When COMMAND exits, each running task ends: `done` after exit status 0, else `fail exit N: LAST LINE`. A task that a tag ended keeps that end.
- On `INT`, `TERM`, `HUP`, or `QUIT`, the wrapper sends the signal to COMMAND, waits for it, and ends the running tasks as `stopped`.
- The wrapper exits with the exit status of COMMAND, or 127 when COMMAND does not exist.

## Flush after each tag
In a pipe, many languages hold output in a buffer, and tags then arrive late. Flush after each tag:

| Language | Tag line |
| --- | --- |
| Bash | `echo "[progress] $i/$n"` (no buffer) |
| Python | `print(f"[progress] {i}/{n}", flush=True)` |
| Node | `console.log(\`[progress] ${i}/${n}\`)` (no buffer) |
| PowerShell | `Write-Output "[progress] $i/$n"` (no buffer) |
| C | `printf("[progress] %d/%d\n", i, n); fflush(stdout);` |
| Rust | `println!("[progress] {i}/{n}"); std::io::stdout().flush()?;` |
| Go | `fmt.Printf("[progress] %d/%d\n", i, n)` (no buffer) |
| Ruby | `$stdout.sync = true` once, then `puts "[progress] #{i}/#{n}"` |

The wrapper sets `PYTHONUNBUFFERED=1` for COMMAND, so local Python works without a flush. The variable does not cross SSH.

## The bar
- Status: `estimating…` until 3 counted updates or 2 s, then `~m:ss left`. `finishing…` at the total. `no update m:ss` (yellow) after 30 s with no tag. A subtask tag counts for its root.
- `done`: green, gone after 5 s. `fail` and `stopped`: red, gone after 10 s. These times do not depend on the wrapper or COMMAND.
- A root with subtasks has its own row, marked `▾`. A press on the row collapses its subtasks into `+N` with counts by state, marked `▸`. The band shows every row, and ends with `▴ show less` past 4 rows. A press on it keeps 4 rows and a `▸ N more: …` line. To press, click in fullscreen mode, or press `ctrl+x`, then `Tab`, then Enter on the row.
- A running bar stays while its wrapper runs, however long a step takes. If the wrapper stops without a chance to write, as after `KILL`, the bar shows `stopped` after 15 s.

## Background jobs
The wrapper must run as long as the job. Put it outside `nohup`, `&`, and `setsid`:
- Works: the Bash tool with `run_in_background`, or `nohup claude-progress -n render ./render.sh > render.log 2>&1 &`.
- Fails: `claude-progress -n render nohup ./render.sh &`. The wrapper ends at once, and later tags go nowhere.

## Remote jobs
Attached: the job runs inside the SSH connection. If the connection drops, the server usually stops the job.
```bash
claude-progress -n render ssh -q -o ServerAliveInterval=30 -o ServerAliveCountMax=3 HOST 'python -u render.py'
```
`-q` hides the server banner. The keep-alive options end SSH after about 90 s with no answer.

Detached: for long jobs. The job runs on the server with no connection, and writes a log there. Start it, then follow the log in the background:
```bash
ssh -q HOST 'nohup python -u render.py > render.log 2>&1 &'
claude-progress -n render ssh -q HOST 'tail -n +1 -F render.log'
```
`-n +1` replays the log from the start, so a new follower shows the full state. The bar ends at the job's `done` or `fail`. `tail -F` does not exit, so stop the follower after the end. If the follower connection drops, start it again.

## When a bar is wrong
- No bar: the command printed no tag, the run is outside Claude Code (no `CLAUDE_CODE_SESSION_ID`), the tag is not at the start of a line, or the output sits in a buffer. Check with `--dir` and list `<dir>/$CLAUDE_CODE_SESSION_ID`.
- Tags show in the output: the wrapper is not around the command, or the run is outside Claude Code.
- `stopped` while the job runs: the wrapper was killed, or the job is outside the wrapper.
- `no update`: no tag for 30 s. Print tags more often, or a text status.

## Behavior
- Run file: `${CLAUDE_CONFIG_DIR:-~/.claude}/progress/<session id>/<pid>-<start>`. The wrapper rewrites it after each tag, and at least every 5 s. Folders of ended sessions go after 1 hour.
- Tags cost no process, so print them at any rate.
- Outside Claude Code, the wrapper runs COMMAND and passes every line through, also tags.
