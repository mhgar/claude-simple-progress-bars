# Claude Guidance Specification

## Purpose
The plugin teaches Claude when and how to report progress, through a section in its system prompt. It also gives a one-line shim, so that scripts that Claude writes still run where the command is not installed.

## Requirements

### Requirement: Prompt section
The plugin MUST add the section `simple-progress-bars:usage` at the end of the system prompt of each request. The section MUST name the command and its main forms, and tell Claude to use it only for a script that runs longer than about `minSeconds` seconds (default 30, from 5 to 3600) and has measurable work.

#### Scenario: A custom threshold
- **WHEN** the setting `minSeconds` is 90
- **THEN** the section says `about 90 seconds`

### Requirement: Shim
The section MUST include the text of `shim.sh`, which defines `claude-progress` as a function that does nothing where the command is not on `PATH`. If `shim.sh` cannot be read, the section MUST leave that part out. The README MUST hold the same shim line.

#### Scenario: Outside Claude Code
- **WHEN** a script with the shim runs `claude-progress -n x 1/2` where the command is not installed
- **THEN** nothing happens, and the status is 0
