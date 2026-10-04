# Progress Command Specification

## Purpose
The `claude-progress` command lets a script report the progress of one task with a single call. It is a bash script that works on Linux, macOS, and Windows with Git Bash, and it needs no other runtime.

## Requirements

### Requirement: Grammar
Options (`-n NAME`, `-t TOTAL`, and their long forms) MUST come first. The first other word MUST be VALUE, and every later word MUST be detail text, also words that start with `-`. With no arguments, or `-h` or `--help` first, the command MUST print its reference. With `--dir` first, it MUST print the progress directory.

#### Scenario: Option words in the detail
- **WHEN** a script runs `claude-progress -n copy 1/4 cp -p -- file.txt`
- **THEN** the detail of the task is `cp -p -- file.txt`

### Requirement: Task file
Each call MUST write to `<config>/progress/<session id>/<name>`, where `<config>` is `$CLAUDE_CONFIG_DIR` or `~/.claude`, and the session ID comes from `CLAUDE_CODE_SESSION_ID`. The name MUST default to `task`, MUST turn `/`, CR, and LF into `-`, MUST lose leading dots, and MUST be at most 80 characters. Directories MUST have the mode 700 where the system has modes.

#### Scenario: A name with a path
- **WHEN** a script runs `claude-progress -n 'a/b/../c' 1/2`
- **THEN** the task file is `a-b-..-c`, in the session directory

### Requirement: Lines
A call MUST write its VALUE and detail text as one line, and a line `total TOTAL` after it when `-t` is given. A count `N/M`, a percent `N%`, or `-t` with no VALUE MUST replace the file through a rename of a dot file. Every other VALUE MUST append, so parallel workers need no lock. `clear` MUST delete the file.

#### Scenario: Parallel workers
- **WHEN** a script runs `claude-progress -n thumbs -t 50`, and then 50 parallel workers each run `claude-progress -n thumbs +1`
- **THEN** the file holds `total 50` and 50 lines of `+1`

### Requirement: Never breaks a script
The command MUST exit 0 in all cases. A usage error or a failed write MUST print one warning that starts with `claude-progress: ` to standard error. With no session ID, or a session ID with a character other than `A`-`Z`, `a`-`z`, `0`-`9`, `_`, and `-`, it MUST write nothing.

#### Scenario: A session ID with a path
- **WHEN** `CLAUDE_CODE_SESSION_ID` is `../escape`
- **THEN** the command writes nothing and exits 0

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
