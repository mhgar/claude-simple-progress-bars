## MODIFIED Requirements

### Requirement: Watched directories
The plugin MUST read `<config>/progress/<session id>` every 250 ms, with `<config>` from `CLAUDE_CONFIG_DIR`, else `HOME`, else `USERPROFILE`, and `/.claude` after the last two. It MUST read a file again only when its modification time changes. It MUST NOT write or delete any file. After `/clear` or `/resume`, it MUST add the directory of the new session ID and keep the earlier ones.

#### Scenario: Clear
- **WHEN** a background wrapper writes to the old session directory, and the user runs `/clear`
- **THEN** the bars of that wrapper stay

#### Scenario: A file of an earlier version
- **WHEN** a session directory holds a `.owner` file
- **THEN** the plugin shows no bar for it

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

#### Scenario: A stalled task with a heartbeat
- **WHEN** a script prints no tag for 1 hour, and its wrapper writes the heartbeat
- **THEN** the bar stays for the whole hour, and shows `no update`

### Requirement: Stale runs
A run file that has not changed for 10 seconds MUST be stale. The plugin MUST end each running task of a stale file as stopped. When the file changes again, these tasks MUST run again with the state that the file holds. A task that the file itself ends MUST keep that end.

#### Scenario: A killed wrapper
- **WHEN** the wrapper of a running task gets `KILL`
- **THEN** the task shows `stopped` about 10 seconds after the last write of its file, and its bar goes 10 seconds after that

#### Scenario: The computer wakes up
- **WHEN** a run file was stale, its tasks show `stopped`, and the wrapper then rewrites the file
- **THEN** the running tasks of that file run again

#### Scenario: A deleted file comes back
- **WHEN** the bars of a stale run file went, a cleanup deleted the file, and the wrapper then writes it again
- **THEN** the running tasks of that file show again as running
