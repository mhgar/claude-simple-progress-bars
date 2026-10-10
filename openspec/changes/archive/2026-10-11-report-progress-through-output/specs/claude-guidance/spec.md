## MODIFIED Requirements

### Requirement: Prompt section
The plugin MUST add the section `simple-progress-bars:usage` at the end of the system prompt of each request. The section MUST tell Claude to run work that makes the person wait longer than about `minSeconds` seconds (default 2, from 1 to 3600) through the wrapper, as `bash "<plugin root>/scripts/claude-progress.sh" -n NAME COMMAND`, with the full path of the plugin's folder. It MUST tell Claude to do this without being asked, and also when Claude is not sure that a command is quick, for ad hoc loops, chains of commands, inline scripts, test runs, batches, transfers, background jobs, and jobs on a remote server. It MUST give the tag forms `[progress] VALUE` and `[progress:NAME] VALUE` with the main values: a count, bytes, a percent, `+1`, `total N`, text, `done`, and `fail`. It MUST tell Claude that tags start a line, that a script flushes its output after each tag, and that a script ends each task with `done` or `fail`. It MUST tell Claude that a command that prints no tags shows no bar, and to print a text status tag around one step that it cannot measure. It MUST tell Claude to add tags to new script files that a person runs and waits for, and to ask before it adds tags to an existing script file, unless the user already asked for progress in that file. Until then, it MUST tell Claude to print tags from its own command around the script. It MUST tell Claude not to use the wrapper for quick commands, or in library or application code, services, test files, or CI. It MUST NOT name unattended jobs or code that shows its own progress as cases to skip. When the user asks to see progress, the section MUST tell Claude to use the wrapper for all work in that task, whatever its length, and still ask before it edits an existing script file. It MUST tell Claude to put the wrapper outside `nohup` and `&`, and to run a job that can take longer than the tool timeout in the background.

#### Scenario: A custom threshold
- **WHEN** the setting `minSeconds` is 90
- **THEN** the section says `about 90 seconds`

#### Scenario: An existing script
- **WHEN** Claude runs a long script that the user wrote, and the user did not ask for progress reports
- **THEN** the section tells Claude to print tags from its own command around the script, and to ask before it adds tags to the script

#### Scenario: One step
- **WHEN** Claude runs a build of about 4 seconds that prints no progress
- **THEN** the section tells Claude to print a text status tag before the build, inside the wrapper

#### Scenario: The user asks for progress
- **WHEN** the user says "show progress" for a task with a 10-second loop
- **THEN** the section tells Claude to run that loop through the wrapper

#### Scenario: A remote job
- **WHEN** Claude starts a long render on a remote server over SSH
- **THEN** the section tells Claude to run the SSH command through the wrapper

### Requirement: Usage file
The section MUST give the full path of `USAGE.md`, and tell Claude to read it before it writes a script file with tags, or when a bar does not act as Claude expects, and to tell a subagent that gets such work to read it too. `USAGE.md` MUST hold the full reference of the wrapper and the tags, root tasks and subtasks, how a bar behaves, what to do when a bar is wrong, one flush example for each common language, the rule for background jobs, and recipes for attached and detached remote jobs. The detached recipe MUST follow the log with `tail -n +1 -F`.

#### Scenario: A Python script
- **WHEN** Claude writes a long Python batch script
- **THEN** the section has sent it to `USAGE.md`, which shows `print(..., flush=True)` for a tag

#### Scenario: A detached remote job
- **WHEN** Claude follows the log of a detached job on a server
- **THEN** `USAGE.md` has shown it `claude-progress -n NAME ssh HOST 'tail -n +1 -F LOG'`

### Requirement: PowerShell
When the request offers the PowerShell tool, the section MUST tell Claude to run the wrapper there as `& "<plugin root>/scripts/claude-progress.ps1" -n NAME COMMAND`. Otherwise it MUST leave PowerShell out.

#### Scenario: No PowerShell tool
- **WHEN** a request on Linux offers only the Bash tool
- **THEN** the section does not name `claude-progress.ps1`

## REMOVED Requirements

### Requirement: Shims
**Reason**: Scripts print tag lines, so no language needs a shim to find the command.
**Migration**: Remove the shim from a script, and print tags. Run the script through `claude-progress`.
