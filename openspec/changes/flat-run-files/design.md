## Context

See proposal.md, "Why". The heartbeat-cleanup change (1.2.4) made the age of a run file the only liveness signal. Each wrapper deletes old files at its start, and the plugin only reads.

## Goals / Non-Goals

**Goals:**
- One directory for all run files.
- No delete of a directory in normal operation.
- One list per read in the plugin, also after `/clear`.

**Non-Goals:**
- A cleanup of the session directories of 1.2.4. They stay until a person deletes them.
- A change to the run file content, the timing, or the display.

## Decisions

### The session ID is a prefix of the file name
The run file is `<config>/progress/<session id>.<pid>-<start>`. The wrapper accepts only a session ID of `A`-`Z`, `a`-`z`, `0`-`9`, `_`, and `-`. So the first `.` in a name always ends the session ID. The plugin keeps a file when its name starts with `<id>.` for one of its session IDs. The `.` also stops the ID `abc` from matching a file of the session `abc-2`.

Alternative: keep one directory per session. Rejected: the directory has no job since the cleanup goes by age, and its delete makes a race with a new wrapper.

### The cleanup has one step
Bash: `find "$base" -mindepth 1 -maxdepth 1 -type f -mmin +1 -delete`. PowerShell: the files of `$base` with `LastWriteTimeUtc` older than 60 seconds. The age limits stay as in 1.2.4. GNU and BSD `find` both match more than 60 seconds.

The cleanup never deletes a directory, so `<config>/progress` stays. A paused wrapper whose file went then needs no retry: `>` in bash and `WriteAllText` in PowerShell create the file again.

### Write again stays
The retry now creates `<config>/progress`, not a session directory. In normal operation it never runs. It covers a person who deletes `<config>/progress`, and a directory that comes back from no write access. The code is the same size as in 1.2.4, so it stays.

### The plugin lists one directory
Each read lists `<config>/progress` once. The plugin filters the entries by kind (`file`) and by name prefix, then reads the changed files as before. `/clear` and `/resume` add an ID to a set. The plugin checks the session ID once a second, as before.

Performance: the list now also returns the names of other sessions' files. With the cleanup at 60 seconds, the directory holds the live runs of all sessions, and the runs that ended in the last minute or two. That is tens of names in normal use. 20 sessions with 5 live runs each give 100 names per list, 4 times a second. The plugin reads only the files with its own prefix and a new modification time.

### Mode 700
The wrapper creates `<config>/progress` with mode 700 where the system has modes: `umask 077` in bash, and `UnixFileMode` in PowerShell 7. Run files keep the mode of the umask, as before.

## Risks / Trade-offs

- [A 1.2.4 run during the update] A 1.2.4 wrapper that still runs writes into its session directory, which the new plugin does not read. Its bar goes until the run ends. → Accept. It happens once, only for runs that span the update.
- [Old session directories] The session directories of 1.2.4 stay on disk, with a few files each. → Accept. A person can delete them. The cleanup never touches subdirectories.
- [Many sessions] Each read lists the names of all sessions' files. → Tens to a few hundred names. Accept.

## Migration Plan

1. Change both wrappers, the plugin, the tests, and `USAGE.md`. Release 1.2.5.
2. No migration step. New runs write flat files. Old session directories stay.

Rollback: install 1.2.4 again. It ignores the flat files, and its cleanup deletes only files in subdirectories, so the flat files stay until a 1.2.5 run deletes them.
