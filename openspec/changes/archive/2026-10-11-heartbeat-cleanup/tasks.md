## 1. Bash wrapper

- [x] 1.1 `scripts/claude-progress.sh`: remove `is_windows`, `proc_start`, `owner_state`, and the `.owner` write. Tests: `tests/cli-test.sh` "a run writes no .owner file, also with CLAUDE_PID set". The old owner tests go.
- [x] 1.2 `scripts/claude-progress.sh`: a new `sweep` with `find -mindepth 2 -maxdepth 2 -type f -mmin +1 -delete`, then `find -mindepth 1 -maxdepth 1 -type d -empty -delete`. Run it once per run, inside a session, after the launch of COMMAND and before the read loop. Tests: `tests/cli-test.sh` "a file with no write for 3 minutes goes", "a file with a write 5 seconds ago stays", "an old .owner goes", "an empty session directory goes", "a run with no tag cleans up", "outside a session nothing goes".
- [x] 1.3 `scripts/claude-progress.sh`: in `write_file`, after each failed write, create the directory with `umask 077` and write once more. Warn once per run. Never stop later writes. Tests: `tests/cli-test.sh` "a deleted session directory comes back at the next write", "the new directory is private", "a directory with no write access warns once", "writes work again after write access comes back".
- [x] 1.4 `scripts/claude-progress.sh`: the cleanup rule in the help text and the header comment.

## 2. PowerShell wrapper

- [x] 2.1 `scripts/claude-progress.ps1`: remove `Get-OwnerState` and the `.owner` write. Tests: the check from 1.1, for PowerShell.
- [x] 2.2 `scripts/claude-progress.ps1`: a new `Invoke-Sweep` that deletes files at depth 2 with `LastWriteTimeUtc` older than 60 seconds, then empty directories at depth 1. Run it at the same point as in bash. Tests: `tests/cli-test.sh` "PowerShell: a file with no write for 3 minutes goes", "PowerShell: a file with a write 5 seconds ago stays".
- [x] 2.3 `scripts/claude-progress.ps1`: in `Write-RunFile`, the same retry and warning rule as in 1.3. Tests: `tests/cli-test.sh` "PowerShell: a deleted session directory comes back at the next write".
- [x] 2.4 `scripts/claude-progress.ps1`: the cleanup rule in the help text and the header comment. Tests: `tests/cli-test.sh` "PowerShell writes the same run file as bash".

## 3. Plugin

- [x] 3.1 `hooks/bar.ts`: `STALE_MS` becomes 10 seconds. Tests: `tests/bar.test.ts` "stale", `tests/watch.test.ts` "settle", with the times moved to 10 seconds. A new test: a stalled bar of a fresh file does not expire after 1 hour.
- [x] 3.2 `hooks/watch.ts` and `hooks/register.tsx`: remove `isRunName`. Tests: `tests/watch.test.ts` "a file with no end line shows no bar", in place of the `isRunName` tests.

## 4. Docs and release

- [x] 4.1 `USAGE.md`: stale after 10 seconds, and the cleanup rule in "How it works".
- [x] 4.2 `examples/demo.sh`: a done bar stays 10 seconds, as every ended bar does. Check the stated times of the stalled and stopped tasks against the new stale time.
- [x] 4.3 `.claude-plugin/plugin.json`: version 1.2.4.

## 5. Checks

- [x] 5.1 Run `tests/cli-test.sh` on Linux. Get the macOS and Windows CI jobs green. Linux: 73 passed, with PowerShell 7.6.6 for the twin. macOS and Windows: CI green for 1.2.4.
- [x] 5.2 Run `claude plugin test`, the type check, `claude plugin validate --strict`, and `openspec validate heartbeat-cleanup --strict`.
- [ ] 5.3 Hands-on: run `examples/demo.sh`, and check that every state shows. Kill a wrapper with `KILL`, and check `stopped` at about 10 seconds and no bar at about 20 seconds. Done on disk: the migration emptied the real progress folder, and a killed wrapper wrote nothing more. The check on screen needs the 1.2.4 plugin.
- [x] 5.4 Archive the change into `openspec/specs`.
