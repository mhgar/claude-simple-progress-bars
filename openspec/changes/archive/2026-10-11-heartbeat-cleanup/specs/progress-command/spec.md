## ADDED Requirements

### Requirement: Cleanup
With a valid session ID, after it starts COMMAND and before it reads any output, the wrapper MUST delete each file in each session directory under `<config>/progress` that has had no write for 120 seconds. It MUST NOT delete a file with a write in the last 60 seconds. Then it MUST delete each empty session directory. The cleanup MUST NOT check any process. Without a valid session ID, the wrapper MUST delete nothing.

#### Scenario: A closed session
- **WHEN** the directory of another session holds only run files with no write for 3 minutes, and a wrapper starts
- **THEN** the wrapper deletes these files and the directory

#### Scenario: A live run of another session
- **WHEN** a run file of another session had a write 5 seconds ago, and a wrapper starts
- **THEN** that run file stays

#### Scenario: A file of an earlier version
- **WHEN** a session directory holds a `.owner` file with no write for 2 days, and a wrapper starts
- **THEN** the wrapper deletes `.owner`

#### Scenario: A run with no tag
- **WHEN** COMMAND prints no tag line, and old files exist
- **THEN** the wrapper deletes the old files, and creates no run file and no directory

#### Scenario: Outside Claude Code
- **WHEN** no session ID is set, and old files exist
- **THEN** the wrapper deletes nothing

### Requirement: Write again
After each failed write of the run file, the wrapper MUST create the session directory again, with the mode 700 where the system has modes, and write the whole file once more. When that write also fails, the wrapper MUST print its warning, but only the first time in the run. A failed write MUST NOT stop later writes.

#### Scenario: A paused wrapper after a cleanup
- **WHEN** a wrapper is paused, another wrapper deletes its run file and its session directory, and the first wrapper then continues
- **THEN** its next write creates the directory and the run file again, with the full state of its tasks

#### Scenario: A directory with no write access
- **WHEN** the session directory exists, and the wrapper cannot write in it
- **THEN** the wrapper prints one warning for the whole run, and COMMAND runs to its end

#### Scenario: Write access comes back
- **WHEN** writes to the session directory fail for a time, and then work again
- **THEN** the next write after that puts the full state of the tasks in the run file

## MODIFIED Requirements

### Requirement: Twins
`scripts/claude-progress.ps1` MUST take the same arguments as the bash wrapper, `scripts/claude-progress.sh`, and MUST write the same run file content for the same output of COMMAND: UTF-8 with no byte order mark, and LF line ends. It MUST follow the same rules for the session ID, names, tags, ends, the heartbeat, the cleanup, the write again after a failure, and exit status. Both wrappers MUST live in `scripts/`. The plugin MUST NOT have a `bin/` folder, and MUST NOT put any folder on the `PATH`. The plugin MUST NOT set environment variables of the session or change configuration.

#### Scenario: The same calls
- **WHEN** the same COMMAND output runs through the bash wrapper and through the PowerShell wrapper, in separate config directories
- **THEN** the run files hold the same content

## REMOVED Requirements

### Requirement: Session owner
**Reason**: The heartbeat tells a live run from a dead one. The age of a run file replaces the process check.
**Migration**: None. The cleanup deletes the `.owner` files of earlier versions.

### Requirement: Old sessions
**Reason**: Replaced by "Cleanup", which deletes files by their age, in every session directory.
**Migration**: None. The first cleanup of the new version deletes the old files.
