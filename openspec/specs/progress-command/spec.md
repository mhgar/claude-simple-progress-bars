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

### Requirement: Old sessions
When a call creates a new session directory, it MUST first delete the directories in `<config>/progress` that are older than 24 hours.

#### Scenario: A new session
- **WHEN** an old session directory is 2 days old, and a new session writes its first task
- **THEN** the old directory is gone, and the directories of recent sessions stay
