## MODIFIED Requirements

### Requirement: Prompt section
The plugin MUST add the section `simple-progress-bars:usage` at the end of the system prompt of each request. The section MUST tell Claude to run work that makes the person wait longer than about `minSeconds` seconds (default 2, from 1 to 3600) through the wrapper, as `bash "<plugin root>/scripts/claude-progress.sh" -n NAME COMMAND`, with the full path of the plugin's folder. It MUST tell Claude to do this without being asked, and also when Claude is not sure that a command is quick, for ad hoc loops, chains of commands, inline scripts, test runs, batches, transfers, background jobs, and jobs on a remote server. It MUST tell Claude to give each task and subtask a short name that a person reads, under 24 characters, and that names can hold spaces. It MUST give the tag forms `[progress] VALUE` and `[progress:NAME] VALUE` with the main values: a count, bytes, a percent, `+1`, `total N`, text, `done`, and `fail`. It MUST tell Claude that tags start a line, that a script flushes its output after each tag, and that a script ends each task with `done` or `fail`. It MUST tell Claude that a command that prints no tags shows no bar, and to print a text status tag around one step that it cannot measure. It MUST tell Claude to add tags to new script files that a person runs and waits for, and to ask before it adds tags to an existing script file, unless the user already asked for progress in that file. Until then, it MUST tell Claude to print tags from its own command around the script. It MUST tell Claude not to use the wrapper for quick commands, or in library or application code, services, test files, or CI. It MUST NOT name unattended jobs or code that shows its own progress as cases to skip. When the user asks to see progress, the section MUST tell Claude to use the wrapper for all work in that task, whatever its length, and still ask before it edits an existing script file. It MUST tell Claude to put the wrapper outside `nohup` and `&`, and to run a job that can take longer than the tool timeout in the background.

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
