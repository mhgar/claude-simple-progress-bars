## Why

Since 1.2.4, the cleanup deletes run files by their age, so a session directory has no job of its own any more. It only adds work: a second cleanup step for empty directories, a race where a cleanup deletes a directory that a new wrapper just made, and a list of directories in the plugin after `/clear`.

## What Changes

- **One directory.** The wrapper writes its run file as `<config>/progress/<session id>.<pid>-<start>`, not in a session directory. A session ID holds no `.`, so the prefix never matches another session.
- **Cleanup of one directory.** At each start in a session, the wrapper deletes the files in `<config>/progress` with no write for more than 60 seconds. No step for empty directories.
- **Write again.** After a failed write, the wrapper creates `<config>/progress` again, not a session directory, and writes once more. The rule is the same.
- **One list in the plugin.** The plugin lists `<config>/progress` once each read, and reads the files whose names start with one of its session IDs and `.`. After `/clear` or `/resume`, it adds the new session ID to a set, not a directory to a list.
- **No legacy cleanup.** The session directories of 1.2.4 stay on disk. Nothing reads or deletes them.
- `USAGE.md` and the help text of both wrappers: the new path.
- Release 1.2.5.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `progress-command`: change "Run file", "Cleanup", and "Write again".
- `progress-tracking`: change "Watched directories".

## Impact

- `scripts/claude-progress.sh` and `scripts/claude-progress.ps1`: the run file path, one cleanup step, and the retry creates `<config>/progress`.
- `hooks/register.tsx`: one list per read, filtered by session ID. `hooks/watch.ts`: a name filter.
- `USAGE.md` and `.claude-plugin/plugin.json`.
- Tests: `tests/cli-test.sh`, `tests/watch.test.ts`.
- No change to the run file content, the timing, the display, or the guidance for Claude.
