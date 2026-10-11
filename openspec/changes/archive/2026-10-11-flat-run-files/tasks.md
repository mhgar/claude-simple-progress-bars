## 1. Wrappers

- [x] 1.1 `scripts/claude-progress.sh`: the run file `<base>/<session>.<pid>-<start>`, a cleanup of one `find` at depth 1, and a retry that creates `<base>`. Help text and comments. Tests: `tests/cli-test.sh` "the run file name starts with the session ID and a dot", "a file with no write for 3 minutes goes", "a file with a write 5 seconds ago stays", "a session directory of an earlier version stays", "a deleted progress directory comes back at the next write", "the progress directory is private", and the existing write and cleanup checks.
- [x] 1.2 `scripts/claude-progress.ps1`: the same path, cleanup, and retry. Tests: `tests/cli-test.sh` "PowerShell writes the same run file as bash", "PowerShell: a file with no write for 3 minutes goes", "PowerShell: a deleted progress directory comes back at the next write".
- [x] 1.3 `tests/cli-test.sh`: the helpers find run files by the session prefix, not by a directory.

## 2. Plugin

- [x] 2.1 `hooks/watch.ts`: a function that tells whether a file name belongs to a set of session IDs. Tests: `tests/watch.test.ts` "a name with the session ID and a dot belongs", "a name of another session does not belong", "a session ID that starts another ID does not match".
- [x] 2.2 `hooks/register.tsx`: one list of `<config>/progress` per read, filtered by kind and by that function. A set of session IDs in place of the list of directories. Tests: `claude plugin test`, the type check.

## 3. Docs and release

- [x] 3.1 `USAGE.md`: the run file path, the check under "When a bar is wrong", and "How it works".
- [x] 3.2 `.claude-plugin/plugin.json`: version 1.2.5.

## 4. Checks

- [x] 4.1 Run `tests/cli-test.sh` on Linux with PowerShell. Get the macOS and Windows CI jobs green. Linux: 72 passed, with PowerShell 7.6.6. CI green on Linux, macOS, and Windows (run 38114387231).
- [x] 4.2 Run `claude plugin test`, the type check, `claude plugin validate --strict`, and `openspec validate flat-run-files --strict`.
- [x] 4.3 Hands-on: run the new wrapper in this session, and check that it writes a flat file and leaves the old session directory alone.
- [x] 4.4 Archive the change into `openspec/specs`.
