## Context

See proposal.md, "Why". Each wrapper run writes one run file, `<config>/progress/<session id>/<pid>-<start>`. The wrapper holds the state of all its tasks in memory, and each write replaces the whole file. The plugin reads the run files of its session IDs every 250 ms.

Terms in this document:
- **Write**: one rewrite of a run file by its wrapper, after a tag or for the heartbeat.
- **Age**: the time since the last write of a file, from its modification time.
- **Cleanup**: the delete step that this change gives to each wrapper.
- **Stalled**: a running task with no tag for 30 seconds. Its wrapper still writes the heartbeat. The bar is yellow and shows `no update`.
- **Stale**: a run file with no write for 10 seconds. Its wrapper is dead or paused. Its running tasks show `stopped`.

## Goals / Non-Goals

**Goals:**
- The age of a run file is the only signal that a run is alive.
- A bar whose run file gets heartbeats never hides.
- The plugin stays read-only.
- A delete never loses data that a live or paused wrapper still needs.

**Non-Goals:**
- Cleanup when no wrapper runs. Files stay until the next run in any session.
- A fix for file systems that store modification times in whole seconds. This is a follow-up. See "Risks".
- A change to the run file format, the tags, the heartbeat, or the display.

## Decisions

### The wrapper deletes, the plugin only reads
The mod API has no call that deletes a file. `$.fs` has `read`, `write`, `list`, `exists`, `stat`, and `ancestors`. A delete from the plugin needs `$.process.run`, which is "CLI only", and needs separate code for each OS. The project context also states that the mod runs no processes.

Alternative: the plugin deletes through `$.process.run`. Rejected: it does not work in the Desktop app, and it adds a process path to a read-only mod.

### Age is the only liveness signal
A live wrapper writes at least every 5 seconds. So a file with an age of 60 seconds or more belongs to a wrapper that exited, crashed, got `KILL`, or is paused. The first three never write again. A paused wrapper writes the whole file again when it continues (see "Write again"). So a delete is safe at any age well above the heartbeat.

Alternative: keep the `.owner` check. Rejected: it duplicates what the heartbeat already tells, and it needs `/proc`, `ps`, or `tasklist`.

### The cleanup runs at each start, inside a session
The wrapper runs the cleanup once per run, after it starts COMMAND and before it reads the first line of output. So the cleanup never delays COMMAND. It delays only the first line of output, by about 2 ms. The wrapper waits for the cleanup. A background cleanup saves 2 ms, but leaves a process that can outlive a short run.

Outside a session, the wrapper changes nothing, so it also deletes nothing. A person who runs the wrapper in a terminal never loses files.

The cleanup scans every session directory, not only its own. So the files of a closed session go at the next run in any session.

Measured on Linux (btrfs) with GNU `find`, 2 `find` calls:

| Session directories × files | Time |
|---|---|
| 1 × 8 | 1.6 ms |
| 10 × 10 | 2.1 ms |
| 100 × 10 | 7.3 ms |
| 1000 × 10 | 61 ms |

Each run cleans up, so the normal case is the first two rows.

Alternatives:
- Clean up only at the first tag. Rejected: runs with no tags then never clean up, and a session of such runs keeps old files.
- Clean up only when a run creates a session directory, as today. Rejected: a long session then never cleans up.

### What the cleanup deletes
1. Each regular file at depth 2 under `<config>/progress` with an age over the limit. This includes `.owner` files and run files of earlier versions.
2. Then each empty directory at depth 1. This can include the session directory of the wrapper itself.

A directory can be empty only for a moment. Example: wrapper A creates its directory, and wrapper B deletes it before A writes. "Write again" covers this case: A creates the directory again at its next write.

Alternative: delete only empty directories with an age over the limit. Rejected: a delete inside a directory changes its modification time. So a closed session directory then needs a second cleanup to go.

### The age limit
The spec allows a delete from 60 seconds to 120 seconds. The plugin is done with a quiet file after 20 seconds: 10 seconds to stale, then 10 seconds of hold.

- **bash**: `find -mmin +1`. GNU `find` 4.11 compares the exact age, and BSD `find` on macOS rounds the age up to whole minutes. Both match a file with an age of more than 60 seconds. Git Bash on Windows has GNU `find`. Other `find` programs can round down, for example `bfs`, which Claude Code maps to `find` in its own shell. A script never gets that mapping, because it is a shell function that is not exported.
- **PowerShell**: `LastWriteTimeUtc` older than 60 seconds, an exact compare.

The bash wrapper MUST NOT use `-mmin +0`. With GNU and BSD `find`, it matches a file with an age of 1 second, and it deletes live files between heartbeats.

### Write again
Today, a failed write prints one warning and stops all later writes. Now each failed write first runs `mkdir -p` with `umask 077`, or `New-Item -Force` in PowerShell, and writes once more. The warning prints only once in a run. A failed write never stops later writes.

So a paused wrapper whose file went needs no special case. `>` in bash and `WriteAllText` in PowerShell create a missing file. A missing directory makes the first write fail, and the retry creates it.

The cost: in a directory with no write access, each write runs one `mkdir`. Writes happen at most every 200 ms, and only after a tag or a heartbeat. Accept.

### Timing

| Value | Today | New | Part |
|---|---|---|---|
| Fastest write after a tag | 200 ms | 200 ms | Wrapper |
| Heartbeat | 5 s | 5 s | Wrapper |
| Ended task leaves the file | 15 s | 15 s | Wrapper |
| Read | 250 ms | 250 ms | Plugin |
| Stale: running shows `stopped` | 15 s | 10 s | Plugin |
| Hold of an ended bar: `done`, `fail`, `stopped` | 10 s | 10 s | Plugin |
| Stalled: no tag, shows `no update` | 30 s | 30 s | Plugin |
| Cleanup age | 1 h to 7 days, by owner | 60 s to 120 s | Wrapper |

The values meet these rules:
- **Each read can see a new state.** The fastest write, 200 ms, is shorter than the read interval, 250 ms.
- **A late heartbeat does not look dead.** Stale is 2 times the heartbeat. A false `stopped` needs a heartbeat that is 5 seconds late. Under bash 3, the read loop wakes once a second, so a heartbeat is at most about 1 second late. A false `stopped` also ends at the next write.
- **An ended task stays in the file for its whole hold.** The plugin sees an end within 0.45 seconds, and hides it 10 seconds later. The wrapper counts whole seconds, so it drops the task after 14 to 15 seconds.
- **Every bar is hidden before its file can go.** Hidden at 20 seconds, delete at 60 seconds or later.
- **Stopped comes before stalled.** Stale (10 seconds) is shorter than stalled (30 seconds). So a task that runs normally when its wrapper dies shows `stopped`, not yellow, as today.
- **A bar with heartbeats never hides.** Only ended bars expire. A stalled bar is still running, so it stays as long as the heartbeat comes.

### The plugin reads every file
`isRunName` skipped dot files only for `.owner`. Without it, the plugin also lists `.owner` in a session directory of an earlier version. That file has no `end` line, so the parser returns no tasks and the plugin shows nothing. The cleanup deletes it at the next run.

## Risks / Trade-offs

- [A false `stopped` on a busy machine] A heartbeat that is more than 5 seconds late makes the bar show `stopped`. → The next write makes it run again. Today the margin is 10 seconds.
- [Coarse modification times] HFS+ and FAT store times in whole seconds or 2 seconds. The plugin reads a file again only when its time changes, so a final write in the same second as the last read is missed. The bar then shows `stopped` at 10 seconds, not `done`. → This risk exists today, and this change does not make it worse. A follow-up can compare the file size too.
- [Files in the progress directory] The cleanup deletes any old file in a session directory. → The directory belongs to the plugin. `USAGE.md` states the rule.
- [No cleanup without runs] When no wrapper runs again, the last files stay. → Each file holds a few hundred bytes. Accept.
- [A paused run comes back as new bars] The plugin dropped the bars of the deleted file, so it starts their rate and estimate again. → Accept. The counts and the names are correct.
- [macOS not measured] BSD `find` has `-mmin`, `-mindepth`, `-maxdepth`, `-empty`, and `-delete`. → The macOS CI job runs the cleanup tests.

## Migration Plan

1. Change both wrappers, the plugin, the tests, and the docs. Release 1.2.4.
2. The first run of 1.2.4 deletes the old run files and `.owner` files with an age over the limit.
3. Mixed versions are safe:
   - A 1.2.3 wrapper that still runs writes every 5 seconds, the same heartbeat.
   - A 1.2.3 wrapper in another session keeps a directory with no `.owner` for 7 days. So it never deletes a 1.2.4 directory early.
   - A 1.2.4 cleanup can delete the `.owner` of a live 1.2.3 session. That session then keeps its directory for 7 days by the old rule.

Rollback: install 1.2.3 again. It handles directories with no `.owner` by its 7-day rule.
