## 1. Fewer writes

- [ ] 1.1 `scripts/claude-progress.sh`: mark the file as changed after a tag, write it when 200 ms passed since the last write, read with a timeout of 0.2 s on bash 4 and later. Tests: `tests/cli-test.sh` "a held tag reaches the file", and the existing twin and heartbeat checks.
- [ ] 1.2 `scripts/claude-progress.ps1`: the same rule, with a wait of 200 ms. Tests: `tests/cli-test.sh` "PowerShell writes the same run file as bash", and "PowerShell: a held tag reaches the file".
- [ ] 1.3 Measure 2000 `+1` tags through each wrapper on Windows, before and after.

## 2. Batch files

- [ ] 2.1 `scripts/claude-progress.ps1`: `ConvertTo-BatchArgument` for a `.cmd` or `.bat` COMMAND. Tests: `tests/cli-test.sh` "PowerShell passes batch arguments as text".
- [ ] 2.2 `scripts/claude-progress.ps1`: outside a session, start COMMAND from the same `ProcessStartInfo`, with no redirection. Tests: `tests/cli-test.sh` "PowerShell outside a session passes tags through and keeps the status", under Windows PowerShell 5.1.

## 3. CI

- [ ] 3.1 `scripts/claude-progress.sh`: under bash 3, a status of 1 from `read -t` is the end of input only when `SECONDS` did not change. Tests: `tests/cli-test.sh` "a quiet command keeps its wrapper", "TERM exits with 143", and "TERM ends the running tasks as stopped" on macOS CI.
- [ ] 3.2 `tests/cli-test.sh`: check mode 700 only where the system has modes, not under Git Bash. Tests: the Windows CI job.
- [ ] 3.3 Push the branch, and get all CI jobs green.

## 4. Docs and release

- [ ] 4.1 `USAGE.md`: the write rule in "How it works", and a note about batch files.
- [ ] 4.2 `.claude-plugin/plugin.json`: version 1.2.2.

## 5. Checks

- [ ] 5.1 Run `tests/cli-test.sh` under Git Bash, with PowerShell 5.1 for the twin. Run `claude plugin test`, the type check, `claude plugin validate --strict`, and `openspec validate --strict`.
- [ ] 5.2 Hands-on test on Windows through both the PowerShell path and the Git Bash path, with bars on screen.
- [ ] 5.3 Archive the change into `openspec/specs`.
