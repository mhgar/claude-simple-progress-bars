## MODIFIED Requirements

### Requirement: Expiry
A done, failed, or stopped bar MUST go 10 seconds after it ends. This time MUST NOT depend on the wrapper or its command. A running bar MUST stay while its run file is not stale. The plugin MUST note a hidden bar by its run file and task ID, and a hidden bar MUST NOT show again. The one exception is a task that the plugin ended because its file was stale: it MUST show again when it runs again.

#### Scenario: Done while the command runs
- **WHEN** a remote script prints `[progress] done`, and its SSH command runs on
- **THEN** the bar goes 10 seconds after the end

#### Scenario: A new run in an old file
- **WHEN** a task ended and its bar went, and the script then prints a tag with the same name
- **THEN** a new bar shows for a new task, and the old bar stays hidden

#### Scenario: Other tasks of the same file
- **WHEN** a hidden subtask ended, and its run file changes for another task
- **THEN** the hidden subtask does not show again
