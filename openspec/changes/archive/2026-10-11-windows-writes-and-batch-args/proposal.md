## Why

A test on Windows 11 found two problems in the wrappers.

- **Tags slow COMMAND down.** The wrapper rewrites the whole run file after each tag. A script that prints 2000 `+1` tags runs in 0.76 s alone, in 11.8 s through the PowerShell wrapper, and in 5.1 s through the bash wrapper under Git Bash. The pipe of COMMAND fills while the wrapper writes, so COMMAND waits. The plugin reads run files only 4 times a second, so most of these writes have no effect.
- **Arguments to a `.cmd` or `.bat` file break.** cmd.exe reads the command line before the script does. It splits at `&`, `|`, `<`, `>`, `^`, `(` and `)`, and it expands `%NAME%`. The PowerShell wrapper quotes an argument only when it holds a space or a `"`. With `-n x t.cmd "a&b"`, cmd.exe runs `b` as a command. Many Windows tools are batch files, such as `npm.cmd`. An argument value can also run as a command.

- **Quotes break outside a session.** With no session ID, the PowerShell wrapper runs `& COMMAND @args`. Windows PowerShell 5.1 then drops the quotes inside native arguments. `claude-progress.ps1 bash -c 'echo "[progress] 1/2"; exit 4'` prints `[progress]` and exits 0. The test "PowerShell outside a session passes tags through" fails on a machine with only Windows PowerShell 5.1. CI passes it because it finds `pwsh` 7 first.

- **CI is red on macOS and Windows** since 1.1.0. On macOS, "TERM exits with 143" gets 1. macOS has bash 3.2, and there `read -t` returns 1 on a timeout, the same status as at the end of input. The read loop then stops after 1 s of quiet output, and the wrapper exits 1 while COMMAND still runs. This breaks "Heartbeat" and "Signals" for every quiet command on a stock Mac, not only in CI. On Windows, "the session directory is private" expects mode 700, but NTFS under Git Bash has no modes. The spec asks for mode 700 only where the system has modes.

## What Changes

- **Fewer writes.** Both wrappers write the run file at most once in 200 ms. A tag that the wrapper holds back reaches the file within 200 ms, or within 1 s under bash 3. The run file content at each write, and at the end, does not change.
- **Batch file arguments.** The PowerShell wrapper quotes each argument of a `.cmd` or `.bat` COMMAND for cmd.exe. Special characters and `%NAME%` then reach the script as text.
- **One way to start COMMAND.** Outside a session, the PowerShell wrapper starts COMMAND with the same quoting as inside a session, with no redirection. COMMAND then has the console streams of the wrapper.
- **Bash 3 end of input.** Under bash 3, the wrapper takes a status of 1 from `read -t` as the end of input only when the read returned in the same second that it started. Else it reads again.
- **Tests on Windows.** The mode check runs only where the system has modes.
- **One hold time.** A done bar goes after 10 s, as a failed or stopped bar does. One rule is easier to learn than two, and a done bar no longer goes before a person can read it. A stalled bar is still running, so it does not change.
- `USAGE.md`: the new write rule, the batch file rule, and the hold time.
- Release 1.2.2.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `progress-command`: the write rule in "Rewrite from memory", the quoting rule in "Never breaks a script", and a new requirement "Batch files".
- `progress-tracking`: one hold time of 10 seconds in "Expiry".

## Impact

- `scripts/claude-progress.sh`: write throttle, and a read timeout of 0.2 s on bash 4 and later.
- `scripts/claude-progress.ps1`: write throttle, a wait of 200 ms, batch quoting, and one way to start COMMAND.
- `USAGE.md`: "How it works", and a note about batch files.
- `hooks/bar.ts`: one hold time.
- `.claude-plugin/plugin.json`: version 1.2.2.
- Tests: `tests/cli-test.sh`, `tests/bar.test.ts`, `tests/watch.test.ts`.
