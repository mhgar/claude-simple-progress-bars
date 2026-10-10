## 1. Plugin: run files and tasks

- [x] 1.1 `hooks/parse.ts`: fold `stopped`, keep a task final after its end, and add `parseRun` for run files: `task` lines, `[ID]` reports, the `end` line, and the root-end guard. Tests: `tests/parse.test.ts`.
- [x] 1.2 `hooks/bar.ts` and `types/index.d.ts`: tasks by run file and ID, the hold times of 5 s and 10 s, no 10-minute expiry, and the stale state. Tests: `tests/bar.test.ts`.
- [x] 1.3 `hooks/watch.ts`: ingest run files, keep the state of an incomplete read, end the running tasks of a stale file, and bring them back when it changes. Tests: `tests/watch.test.ts`.
- [x] 1.4 `hooks/register.tsx`: remove the Bash call tracking, and hide bars by run file and task ID. Tests: `tests/band.test.ts`.
- [x] 1.5 `hooks/layout.ts`: blocks for roots with subtasks, the indent of 4 cells, dim subtask names, `+N` on the root row, and root activity for the stall state. Tests: `tests/layout.test.ts`.

## 2. The wrapper

- [x] 2.1 `scripts/claude-progress.sh`: the wrapper, tags, roots and subtasks, ends, fallback ends, signals, the run file, the rewrite from memory, the heartbeat, and the child environment. Tests: `tests/cli-test.sh`.
- [x] 2.2 `scripts/claude-progress.ps1`: the same wrapper in PowerShell. Tests: `tests/cli-test.sh` compares its run files with the bash wrapper where PowerShell is installed.
- [x] 2.3 Delete `scripts/claude_progress.py`, `scripts/claude-progress.js`, and `shim.*`. Tests: `tests/cli-test.sh` no longer names them.

## 3. Guidance and documents

- [x] 3.1 `hooks/prompt.ts`: the new prompt section. Tests: `tests/prompt.test.ts`.
- [x] 3.2 `USAGE.md`: the wrapper and tag reference, flush examples, background jobs, and remote recipes.
- [x] 3.3 Both READMEs, `examples/demo.sh`, `openspec/config.yaml`, and the manifests: the new method and version 1.1.0.
- [x] 3.4 Evals: change the cases that check for command calls or shims, and add cases for a remote job and a detached remote job. Tests: `claude plugin eval`.

## 4. Release

- [x] 4.1 Run `tests/cli-test.sh`, `claude plugin test`, `claude plugin validate --strict`, and `openspec validate --strict`.
- [x] 4.2 Archive the change into `openspec/specs`, and update the Purpose text of `progress-command`, `progress-tracking`, and `claude-guidance`.
