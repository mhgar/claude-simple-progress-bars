# Claude Guidance Specification

## Purpose
The plugin teaches Claude when and how to report progress, through a section in its system prompt. It also gives a one-line shim, so that scripts that Claude writes still run where the command is not installed.

## Requirements

### Requirement: Prompt section
The plugin MUST add the section `simple-progress-bars:usage` at the end of the system prompt of each request. The section MUST name the command and its main forms. It MUST tell Claude to use it for work that runs longer than about `minSeconds` seconds (default 30, from 5 to 3600) and has measurable work, in three cases: in commands Claude runs, without being asked; in new standalone script files that a person runs and waits for; and in existing script files only after the user agrees, which Claude MUST ask first. It MUST tell Claude not to use it in library or application code, services, tests, CI, unattended jobs, or code that already reports progress. When the user asks to see progress, the section MUST tell Claude to use it for all measurable work in that task, whatever its length, and still ask before it edits an existing script file.

#### Scenario: A custom threshold
- **WHEN** the setting `minSeconds` is 90
- **THEN** the section says `about 90 seconds`

#### Scenario: An existing script
- **WHEN** Claude edits a long script that the user wrote, and the user did not ask for progress reports
- **THEN** the section tells Claude to ask before it adds them

#### Scenario: The user asks for progress
- **WHEN** the user says "show progress" for a task with a 10-second loop
- **THEN** the section tells Claude to report progress for that loop

### Requirement: Shim
The section MUST include the text of `shim.sh`, which defines `claude-progress` as a function that does nothing where the command is not on `PATH`. If `shim.sh` cannot be read, the section MUST leave that part out. The README MUST hold the same shim line.

#### Scenario: Outside Claude Code
- **WHEN** a script with the shim runs `claude-progress -n x 1/2` where the command is not installed
- **THEN** nothing happens, and the status is 0
