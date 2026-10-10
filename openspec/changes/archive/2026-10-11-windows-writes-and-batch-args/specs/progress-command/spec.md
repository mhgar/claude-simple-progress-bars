## MODIFIED Requirements

### Requirement: Never breaks a script
The wrapper MUST NOT change the output or the exit status of COMMAND, apart from the removal of tag lines and the exit statuses in "Signals". A usage error or a failed write MUST print one warning that starts with `claude-progress: ` to standard error, and the wrapper MUST still run COMMAND. With no session ID, or a session ID with a character other than `A`-`Z`, `a`-`z`, `0`-`9`, `_`, and `-`, it MUST write no file, and MUST write every line of COMMAND to its stream, also tag lines. With or without a session ID, the PowerShell wrapper MUST pass the arguments of COMMAND by the same quoting rules.

#### Scenario: A session ID with a path
- **WHEN** `CLAUDE_CODE_SESSION_ID` is `../escape`, and COMMAND prints `[progress] 1/2`
- **THEN** the wrapper writes no file, and the standard output holds `[progress] 1/2`

#### Scenario: Outside Claude Code
- **WHEN** no session ID is set, and a person runs `claude-progress ./job.sh` in a terminal
- **THEN** the person sees every line of `job.sh`, also its tag lines

#### Scenario: Quotes outside a session in Windows PowerShell 5.1
- **WHEN** no session ID is set, and a script runs `claude-progress.ps1 bash -c 'echo "[progress] 1/2"; exit 4'` in Windows PowerShell 5.1
- **THEN** the standard output holds `[progress] 1/2`, and the exit status is 4

### Requirement: Rewrite from memory
After a tag, the wrapper MUST rewrite the whole run file at once, and MUST NOT start a process for it. The wrapper MUST NOT rewrite the file more than once in 200 milliseconds. A tag MUST reach the file within 200 milliseconds, or within 1 second under bash 3. When COMMAND exits, the wrapper MUST write the file at once. For each task, the file MUST hold only the newest `total`, the newest count or percent, one `+N` with the sum of the whole-number adds after that count, each add with a unit or a decimal point, `+0 DETAIL` for the newest detail when it came after the newest count, and the end line. The wrapper MUST drop a task from the file 15 seconds after it ends.

#### Scenario: Many adds
- **WHEN** COMMAND prints `[progress] total 1000` and then 1000 lines of `[progress] +1`
- **THEN** the report lines of the root are `[1] total 1000` and `[1] +1000`

#### Scenario: A detail that looks like a count
- **WHEN** COMMAND prints `[progress] 2/10`, and then `[progress] +1 3/8 files`
- **THEN** the run file holds `[1] 2/10`, `[1] +1`, and `[1] +0 3/8 files`

#### Scenario: Two quick tags and a quiet step
- **WHEN** COMMAND prints `[progress] 1/3` and `[progress] 2/3` at once, and then prints nothing for 3 seconds
- **THEN** the run file holds `[1] 2/3` 1 second after the second tag

## ADDED Requirements

### Requirement: Batch files
When COMMAND is a `.cmd` or `.bat` file, the PowerShell wrapper MUST quote each argument for cmd.exe. Each argument MUST reach the script as one argument. The characters `& | < > ^ ( ) , ; =`, white space, and `%NAME%` MUST reach the script as text. A `"` in an argument MUST reach the script as `""`. For every other COMMAND, the wrapper MUST quote by the rules of `CommandLineToArgvW`.

#### Scenario: Special characters
- **WHEN** a script runs `claude-progress.ps1 t.cmd "a&b" "two words" "%PATH%" "x=y"`, and `t.cmd` prints `%~1`, `%~2`, `%~3`, and `%~4`
- **THEN** the output is `a&b`, `two words`, `%PATH%`, and `x=y`, and no other command runs
