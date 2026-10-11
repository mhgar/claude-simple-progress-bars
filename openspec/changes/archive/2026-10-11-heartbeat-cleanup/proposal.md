## Why

The wrapper deletes old session directories by a check of the Claude Code process: a `.owner` record, `CLAUDE_PID`, and a process check for each OS. This check came before the heartbeat. Since 1.1.0, a live wrapper rewrites its run file at least every 5 seconds, so the age of a run file alone tells a live run from a dead one.

The process check is the largest part of each wrapper that differs between Linux, macOS, and Windows, and it is the hardest part to test. Old files also stay for 1 hour to 7 days.

## What Changes

- **Cleanup by age.** At each start inside a Claude Code session, the wrapper deletes every file in every session directory that has had no write for at least 60 seconds. Then it deletes each empty session directory. No process check.
- **Write again after a failure.** After each failed write, the wrapper creates the session directory again and writes once more. It prints its warning only once, and never stops writing. So a paused wrapper whose file or directory went shows its bars again at its next write.
- **Remove the owner record.** The wrapper no longer writes `.owner`, and no longer reads `CLAUDE_PID`.
- **Stale after 10 seconds.** The plugin shows the running tasks of a run file as `stopped` after 10 seconds with no write, not 15 seconds. A killed wrapper then shows `stopped` at 10 seconds, and its bars hide at 20 seconds. The heartbeat stays at 5 seconds.
- **No dot-file skip.** The plugin reads every file in a session directory. A file of an earlier version with no `end` line shows nothing.
- `USAGE.md`, the help text of both wrappers, and the comments in `examples/demo.sh`: the new stale time and the cleanup rule.
- Release 1.2.4.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `progress-command`: remove "Session owner" and "Old sessions". Add "Cleanup" and "Write again". Change "Twins".
- `progress-tracking`: change "Watched directories" and "Stale runs". Add a scenario to "Expiry": a stalled task with a heartbeat never hides.

## Impact

- `scripts/claude-progress.sh`: remove `is_windows`, `proc_start`, `owner_state`, and the `.owner` write. A new `sweep`, and a retry in `write_file`.
- `scripts/claude-progress.ps1`: remove `Get-OwnerState` and the `.owner` write. A new `Invoke-Sweep`, and a retry in `Write-RunFile`.
- `hooks/bar.ts`: `STALE_MS` becomes 10 seconds.
- `hooks/watch.ts` and `hooks/register.tsx`: remove `isRunName`.
- `USAGE.md`, `examples/demo.sh`, and `.claude-plugin/plugin.json`.
- Tests: `tests/cli-test.sh`, `tests/bar.test.ts`, and `tests/watch.test.ts`.
- No change to the run file format, the tags, the display, or the guidance for Claude.
