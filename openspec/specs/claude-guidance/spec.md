# Claude Guidance Specification

## Purpose
The plugin teaches Claude when and how to report progress. A short section in the system prompt holds what Claude needs when it decides: when to use the command and its main forms. `USAGE.md` holds the rest, one file read away: the shim for each script language, the PowerShell details, and the full rules.

## Requirements

### Requirement: Prompt section
The plugin MUST add the section `simple-progress-bars:usage` at the end of the system prompt of each request. The section MUST name the command and its main forms. It MUST tell Claude to use it for work that runs longer than about `minSeconds` seconds (default 30, from 5 to 3600) and has measurable work, in three cases: in commands Claude runs, without being asked; in new standalone script files that a person runs and waits for; and in existing script files only after the user agrees, which Claude MUST ask first unless the user already asked for progress in that file. It MUST tell Claude not to use it in library or application code, services, tests, CI, unattended jobs, or code that already reports progress. When the user asks to see progress, the section MUST tell Claude to use it for all measurable work in that task, whatever its length, and still ask before it edits an existing script file. It MUST tell Claude to report at most about once a second, and to run a job that may outlast the tool timeout in the background.

#### Scenario: A custom threshold
- **WHEN** the setting `minSeconds` is 90
- **THEN** the section says `about 90 seconds`

#### Scenario: An existing script
- **WHEN** Claude edits a long script that the user wrote, and the user did not ask for progress reports
- **THEN** the section tells Claude to ask before it adds them

#### Scenario: The user asks for progress
- **WHEN** the user says "show progress" for a task with a 10-second loop
- **THEN** the section tells Claude to report progress for that loop

### Requirement: Usage file
The section MUST give the full path of `USAGE.md`, and tell Claude to read it before it writes a script file that reports progress or uses the command from another language, and to tell a subagent that gets such work to read it too. The section MUST NOT hold the shims.

#### Scenario: A Python script
- **WHEN** Claude writes a long Python batch script
- **THEN** the section has sent it to `USAGE.md`, which has the Python shim

### Requirement: PowerShell
When the request offers the PowerShell tool, the section MUST tell Claude to call `& $env:CLAUDE_PROGRESS_PS1` there with the same arguments. Otherwise it MUST leave PowerShell out.

#### Scenario: No PowerShell tool
- **WHEN** a request on Linux offers only the Bash tool
- **THEN** the section does not name `CLAUDE_PROGRESS_PS1`

### Requirement: Shims
`shim.sh`, `shim.ps1` and `shim.py` MUST each make the calls of a script in that language do nothing where the command is not installed, and exit 0. `USAGE.md` MUST hold every line of each. The Python shim MUST call the command through the bash that `shutil.which` finds, never by name.

#### Scenario: Outside Claude Code
- **WHEN** a script with a shim runs `claude-progress -n x 1/2` where the command is not installed
- **THEN** nothing happens, and the status is 0
