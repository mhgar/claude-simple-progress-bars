# Progress Command Specification

## Purpose
The `claude-progress` wrapper runs a command, and turns the `[progress]` tag lines of its output into a run file that the plugin reads. A command in any language, on any machine that its output comes from, can show progress by printing a line. The wrapper is a bash script that works on Linux, macOS, and Windows with Git Bash, and it needs no other runtime. Its twin `claude-progress.ps1` does the same in PowerShell.

## Requirements

### Requirement: Grammar
Options (`-n NAME` and its long form `--name NAME`) MUST come first. `--` MUST end the options. The first word that is not an option MUST be COMMAND, and every later word MUST be an argument of COMMAND, also words that start with `-`. With no arguments, or `-h` or `--help` first, the command MUST print its reference. With `--dir` first, it MUST print the progress directory.

#### Scenario: Option words in the arguments
- **WHEN** a script runs `claude-progress -n copy cp -n -p a b`
- **THEN** the wrapper runs `cp -n -p a b`, with the root name `copy`

#### Scenario: Option words in the detail
- **WHEN** COMMAND prints `[progress] 1/4 cp -p -- file.txt`
- **THEN** the detail of the root task is `cp -p -- file.txt`

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

### Requirement: Session owner
When a call creates a session directory and `CLAUDE_PID` is set, it MUST write `.owner` there: a JSON object with `pid` and `procStart`, the start time of that process, as Claude Code keeps them in `~/.claude/sessions`. The owner MUST count as alive while the process runs and its start time is the same. Windows MUST check the pid with `tasklist`.

#### Scenario: A reused pid
- **WHEN** the pid in `.owner` runs again, but with another start time
- **THEN** the owner counts as dead

### Requirement: Old sessions
When a call creates a new session directory, it MUST check the other session directories. A directory with a live owner MUST stay. One with a dead owner MUST go 1 hour after its newest write, and one with no owner record 7 days after it. The newest write MUST be the newest time of any entry in the directory.

#### Scenario: A long task
- **WHEN** a task of a live session has written nothing for 2 days
- **THEN** its session directory stays

#### Scenario: An append
- **WHEN** a dead owner's directory is 2 days old, but a file in it got an append 10 minutes ago
- **THEN** the directory stays

### Requirement: Twins
`scripts/claude-progress.ps1` MUST take the same arguments as the bash wrapper, `scripts/claude-progress.sh`, and MUST write the same run file content for the same output of COMMAND: UTF-8 with no byte order mark, and LF line ends. It MUST follow the same rules for the session ID, names, tags, ends, the heartbeat, owner records, old sessions, and exit status. Both wrappers MUST live in `scripts/`. The plugin MUST NOT have a `bin/` folder, and MUST NOT put any folder on the `PATH`. The plugin MUST NOT set environment variables of the session or change configuration.

#### Scenario: The same calls
- **WHEN** the same COMMAND output runs through the bash wrapper and through the PowerShell wrapper, in separate config directories
- **THEN** the run files hold the same content

### Requirement: Run a command
The wrapper MUST run COMMAND with its arguments, and give it the standard input of the wrapper. It MUST read the standard output and the standard error of COMMAND. It MUST write each line that is not a tag line to the stream that the line came from, and keep the order of the lines inside one stream. It MUST NOT write tag lines to either stream. When COMMAND exits, the wrapper MUST exit with the exit status of COMMAND. When COMMAND cannot start, the wrapper MUST exit with status 127.

#### Scenario: A failed command
- **WHEN** a script runs `claude-progress -n job bash -c 'echo "[progress] 1/2"; echo hello; exit 3'`
- **THEN** the standard output holds only `hello`, and the exit status is 3

#### Scenario: A missing command
- **WHEN** a script runs `claude-progress no-such-command`
- **THEN** the exit status is 127

### Requirement: Root name
The name of the root task MUST be the value of `-n`. Without `-n`, it MUST be the file name of COMMAND without its directory and its last extension. Line ends in the name MUST become spaces, and the name MUST be at most 80 characters.

#### Scenario: A name from the command
- **WHEN** a script runs `claude-progress ./tools/render.sh` and the script prints a tag
- **THEN** the root task has the name `render`

### Requirement: Tag lines
A tag line MUST start with `[progress]` or `[progress:NAME]` as the first characters of the line, then one space, then VALUE, then optional detail text. NAME MUST be the text up to the first `]`, cut to 80 characters. An empty NAME MUST read as `[progress]`. A line with a tag and no VALUE MUST NOT be a tag line. A `\r` before the line end MUST NOT count as part of the line. Tag lines on standard output and on standard error MUST both count.

#### Scenario: A tag in the middle of a line
- **WHEN** COMMAND prints `echo "[progress] 3/8"`
- **THEN** the line is not a tag line, and the wrapper writes it to the output

#### Scenario: Windows line ends
- **WHEN** COMMAND prints `[progress] 3/8\r\n`
- **THEN** the root task has the count 3 of 8

### Requirement: Values
VALUE MUST have the forms of the line folding in `progress-tracking`: a count `N/M` with optional sizes, a percent `N%`, an add `+N`, `total N`, `done [MSG]`, `fail [MSG]`, `clear`, or text. A tag with the value `stopped` MUST read as text.

#### Scenario: A script tries to stop a task
- **WHEN** COMMAND prints `[progress] stopped early`
- **THEN** the root task runs on, with the detail `stopped early`

### Requirement: Root task and subtasks
Each run MUST have one root task at most at a time. `[progress]` MUST update the root. `[progress:NAME]` MUST update the subtask NAME of the root. When no root runs, a `[progress]` tag MUST start a root with its VALUE, and a `[progress:NAME]` tag MUST start a root with no count, and then the subtask. A task MUST keep its role, root or subtask, for its whole life.

#### Scenario: Subtasks only
- **WHEN** COMMAND prints only `[progress:frames] 1/240`, and the run has no root
- **THEN** the run has a root with no count, and `frames` is its subtask with the count 1 of 240

### Requirement: Ends
`done` and `fail` MUST end a task. An ended task MUST be final: a later tag with the same name MUST start a new task. An end of the root MUST end each running subtask with the same state and no message. A subtask that already ended MUST keep its end. `clear` MUST remove its task, and on the root also every subtask.

#### Scenario: A later tag with the same name
- **WHEN** COMMAND prints `[progress:frames] done`, and then `[progress:frames] 1/240`
- **THEN** the run file holds two tasks with the name `frames`: one ended `done`, and one with the count 1 of 240

#### Scenario: The root ends first
- **WHEN** the subtask `upload` runs at 3 of 10, and COMMAND prints `[progress] done`
- **THEN** the root and `upload` are both `done`

### Requirement: Fallback ends
When COMMAND exits, the wrapper MUST end each task that is still running: `done` after exit status 0, and `fail exit N: LAST` after any other status N. LAST MUST be the last line that COMMAND printed and that was not a tag line, cut to 200 characters. A task that a tag ended MUST keep that end.

#### Scenario: No end tag
- **WHEN** COMMAND prints `[progress] 2/5`, then `disk full`, and exits with status 1
- **THEN** the root task ends `fail` with the message `exit 1: disk full`

#### Scenario: An end tag and a failed exit
- **WHEN** COMMAND prints `[progress] done`, and exits with status 1
- **THEN** the root task stays `done`

### Requirement: Signals
On `INT`, `TERM`, `HUP`, or `QUIT`, the wrapper MUST send the same signal to COMMAND, wait for it to exit, end each running task as `stopped`, and exit with 128 plus the signal number. On any other exit of its own, the wrapper MUST end each running task as `stopped`. The wrapper MUST ignore `PIPE`, and MUST drop output that it cannot write. COMMAND MUST stay in the process group of the wrapper.

#### Scenario: Interrupt
- **WHEN** the subtask `frames` runs, and the wrapper gets `INT`
- **THEN** COMMAND gets `INT`, `frames` and the root end `stopped`, and the exit status is 130

#### Scenario: A closed output
- **WHEN** the reader of the wrapper's standard output closes it while COMMAND runs
- **THEN** COMMAND runs on, and the wrapper still writes the run file

### Requirement: Run file
The wrapper MUST create its run file at the first tag, as `<config>/progress/<session id>/<pid>-<start>`. `<config>` MUST be `$CLAUDE_CONFIG_DIR` or `~/.claude`, the session ID MUST come from `CLAUDE_CODE_SESSION_ID`, `<pid>` MUST be the process ID of the wrapper, and `<start>` its start time in whole seconds. Directories MUST have the mode 700 where the system has modes. The file MUST hold a line `task ID - NAME` for the root, `task ID ROOT NAME` for a subtask, and report lines `[ID] VALUE [DETAIL]`. Its last line MUST be `end`. IDs MUST start at 1 and go up in the order that tasks start.

#### Scenario: A root and a subtask
- **WHEN** a run of `claude-progress -n render ./job.sh` sees `[progress] 2/10` and then `[progress:frames] 5/40`
- **THEN** the run file holds `task 1 - render`, `[1] 2/10`, `task 2 1 frames`, `[2] 5/40`, and `end` as its last line

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

### Requirement: Heartbeat
While COMMAND runs, the wrapper MUST rewrite the run file when 5 seconds pass with no write. This MUST also happen while COMMAND prints lines that are not tag lines, and while COMMAND prints nothing.

#### Scenario: A long quiet step
- **WHEN** COMMAND prints `[progress] 1/2`, and then prints nothing for 60 seconds
- **THEN** the run file changes at least once every 6 seconds in that time

### Requirement: Child environment
The wrapper MUST set `PYTHONUNBUFFERED=1` in the environment of COMMAND. It MUST NOT change the environment of the session, or any configuration.

#### Scenario: A Python script
- **WHEN** a script runs `claude-progress python3 job.py`
- **THEN** `job.py` sees `PYTHONUNBUFFERED=1`

### Requirement: Batch files
When COMMAND is a `.cmd` or `.bat` file, the PowerShell wrapper MUST quote each argument for cmd.exe. Each argument MUST reach the script as one argument. The characters `& | < > ^ ( ) , ; =`, white space, and `%NAME%` MUST reach the script as text. A `"` in an argument MUST reach the script as `""`. For every other COMMAND, the wrapper MUST quote by the rules of `CommandLineToArgvW`.

#### Scenario: Special characters
- **WHEN** a script runs `claude-progress.ps1 t.cmd "a&b" "two words" "%PATH%" "x=y"`, and `t.cmd` prints `%~1`, `%~2`, `%~3`, and `%~4`
- **THEN** the output is `a&b`, `two words`, `%PATH%`, and `x=y`, and no other command runs
