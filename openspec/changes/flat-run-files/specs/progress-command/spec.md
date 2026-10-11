## MODIFIED Requirements

### Requirement: Run file
The wrapper MUST create its run file at the first tag, as `<config>/progress/<session id>.<pid>-<start>`. `<config>` MUST be `$CLAUDE_CONFIG_DIR` or `~/.claude`, the session ID MUST come from `CLAUDE_CODE_SESSION_ID`, `<pid>` MUST be the process ID of the wrapper, and `<start>` its start time in whole seconds. Directories MUST have the mode 700 where the system has modes. The file MUST hold a line `task ID - NAME` for the root, `task ID ROOT NAME` for a subtask, and report lines `[ID] VALUE [DETAIL]`. Its last line MUST be `end`. IDs MUST start at 1 and go up in the order that tasks start.

#### Scenario: A root and a subtask
- **WHEN** a run of `claude-progress -n render ./job.sh` sees `[progress] 2/10` and then `[progress:frames] 5/40`
- **THEN** the run file holds `task 1 - render`, `[1] 2/10`, `task 2 1 frames`, `[2] 5/40`, and `end` as its last line

#### Scenario: The file name
- **WHEN** the session ID is `abc-123`, the wrapper has the process ID 4242, and it starts at 1700000000
- **THEN** the run file is `<config>/progress/abc-123.4242-1700000000`

### Requirement: Cleanup
With a valid session ID, after it starts COMMAND and before it reads any output, the wrapper MUST delete each file in `<config>/progress` that has had no write for 120 seconds. It MUST NOT delete a file with a write in the last 60 seconds. It MUST NOT delete anything in a subdirectory. The cleanup MUST NOT check any process. Without a valid session ID, the wrapper MUST delete nothing.

#### Scenario: A closed session
- **WHEN** `<config>/progress` holds run files of another session with no write for 3 minutes, and a wrapper starts
- **THEN** the wrapper deletes these files

#### Scenario: A live run of another session
- **WHEN** a run file of another session had a write 5 seconds ago, and a wrapper starts
- **THEN** that run file stays

#### Scenario: A file of an earlier version
- **WHEN** `<config>/progress` holds a session directory of version 1.2.4, with files that had no write for 3 minutes, and a wrapper starts
- **THEN** the directory and its files stay

#### Scenario: A run with no tag
- **WHEN** COMMAND prints no tag line, and old files exist
- **THEN** the wrapper deletes the old files, and creates no run file

#### Scenario: Outside Claude Code
- **WHEN** no session ID is set, and old files exist
- **THEN** the wrapper deletes nothing

### Requirement: Write again
After each failed write of the run file, the wrapper MUST create `<config>/progress` again, with the mode 700 where the system has modes, and write the whole file once more. When that write also fails, the wrapper MUST print its warning, but only the first time in the run. A failed write MUST NOT stop later writes.

#### Scenario: A paused wrapper after a cleanup
- **WHEN** a wrapper is paused, another wrapper deletes its run file, and the first wrapper then continues
- **THEN** its next write creates the run file again, with the full state of its tasks

#### Scenario: A deleted progress directory
- **WHEN** a person deletes `<config>/progress` while a wrapper runs
- **THEN** the next write of the wrapper creates the directory and the run file again

#### Scenario: A directory with no write access
- **WHEN** `<config>/progress` exists, and the wrapper cannot write in it
- **THEN** the wrapper prints one warning for the whole run, and COMMAND runs to its end

#### Scenario: Write access comes back
- **WHEN** writes to `<config>/progress` fail for a time, and then work again
- **THEN** the next write after that puts the full state of the tasks in the run file
