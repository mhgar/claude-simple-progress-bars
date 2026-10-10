# Progress Tracking Specification

## Purpose
The plugin reads the run files, folds the reports of each task into its state, estimates the time left, and ends or hides bars. It only reads files, and it runs no processes. The drawing is in `progress-display`.

## Requirements

### Requirement: Watched directories
The plugin MUST read `<config>/progress/<session id>` every 250 ms, with `<config>` from `CLAUDE_CONFIG_DIR`, else `HOME`, else `USERPROFILE`, and `/.claude` after the last two. It MUST read a file again only when its modification time changes, and MUST skip dot files. After `/clear` or `/resume`, it MUST add the directory of the new session ID and keep the earlier ones.

#### Scenario: Clear
- **WHEN** a background wrapper writes to the old session directory, and the user runs `/clear`
- **THEN** the bars of that wrapper stay

### Requirement: Line folding
The plugin MUST apply the reports of a task in order. `N/M` and `N%` set the count, the total, and the detail. `+N` adds to the count, and its rest, when given, sets the detail. `total T` sets the total. `done` ends the task and fills the count to the total. `fail` ends the task with its message. `stopped` ends the task as stopped with its message. `clear` removes the task. Any other report sets the detail, and keeps the count and the total. A task MUST NOT change after its end.

#### Scenario: Text after a count
- **WHEN** a task has the reports `3/9` and then `Scanning disk`
- **THEN** the task has the count 3 of 9 and the detail `Scanning disk`

#### Scenario: A detail with no change of count
- **WHEN** a task has the reports `2/10`, `+1`, and `+0 3/8 files`
- **THEN** the task has the count 3 of 10 and the detail `3/8 files`

### Requirement: Sizes
A number MUST have 1 to 15 digits, optional groups of `,` and 3 digits, and an optional `.` with 1 to 6 digits. A unit attached to it (`K`, `M`, `G`, `T`, or `P`, with optional `i` and `B`, or `kB`, or `B`) MUST mean a power of 1024 and mark the task as bytes. A count with a total of 0, a percent above 100, and `total` with no size MUST read as text.

#### Scenario: A count of 0
- **WHEN** a file holds `3/0`
- **THEN** the task has no total, and its detail is `3/0`

### Requirement: Estimate
The rate MUST be an exponential moving average with the weight 0.3 for the newest sample. Only an update that changes the count MUST make a sample. The shown time left MUST count down between updates, and MUST move to a new estimate only when the two differ by more than 10 percent. A new total, or a count that goes down, MUST start the estimate again.

#### Scenario: Repeated updates
- **WHEN** four updates repeat the count 2 of 100 in one second, and then the count 3 arrives
- **THEN** the rate stays 1 item a second, not 5

### Requirement: Total reached while running
A task that reaches its total MUST stay running until it ends.

#### Scenario: The last item starts
- **WHEN** a script reports 3 of 3 before it works on the third item
- **THEN** the bar shows `finishing…`

### Requirement: Expiry
A done bar MUST go 5 seconds after it ends. A failed or stopped bar MUST go 10 seconds after it ends. These times MUST NOT depend on the wrapper or its command. A running bar MUST stay while its run file is not stale. The plugin MUST note a hidden bar by its run file and task ID, and a hidden bar MUST NOT show again. The one exception is a task that the plugin ended because its file was stale: it MUST show again when it runs again.

#### Scenario: Done while the command runs
- **WHEN** a remote script prints `[progress] done`, and its SSH command runs on
- **THEN** the bar goes 5 seconds after the end

#### Scenario: A new run in an old file
- **WHEN** a task ended and its bar went, and the script then prints a tag with the same name
- **THEN** a new bar shows for a new task, and the old bar stays hidden

#### Scenario: Other tasks of the same file
- **WHEN** a hidden subtask ended, and its run file changes for another task
- **THEN** the hidden subtask does not show again

### Requirement: Run files
The plugin MUST read each run file as a set of tasks. A line `task ID - NAME` MUST declare a root, and a line `task ID ROOT NAME` MUST declare a subtask of the root ROOT. A line `[ID] VALUE [DETAIL]` MUST be a report for the task ID. The plugin MUST fold the reports of each task in order, and MUST ignore lines of any other form. A task that is no longer in a complete file MUST lose its bar at that read.

#### Scenario: Two tasks with one name
- **WHEN** a run file declares `task 2 1 frames` and `task 4 1 frames`
- **THEN** the plugin has two separate subtasks with the name `frames`

### Requirement: Complete reads
The plugin MUST use a read of a run file only when its last line is `end`. For any other read, it MUST keep the state of the last complete read.

#### Scenario: A read during a rewrite
- **WHEN** the plugin reads a run file that holds only `task 1 - render`
- **THEN** the bars of that run keep the state of the last complete read

### Requirement: Stale runs
A run file that has not changed for 15 seconds MUST be stale. The plugin MUST end each running task of a stale file as stopped. When the file changes again, these tasks MUST run again with the state that the file holds. A task that the file itself ends MUST keep that end.

#### Scenario: A killed wrapper
- **WHEN** the wrapper of a running task gets `KILL`
- **THEN** the task shows `stopped` about 15 seconds after the last write of its file

#### Scenario: The computer wakes up
- **WHEN** a run file was stale, its tasks show `stopped`, and the wrapper then rewrites the file
- **THEN** the running tasks of that file run again

### Requirement: Root ends
When a root ends, the plugin MUST end each running subtask of that root with the same state. A subtask that already ended MUST keep its end.

#### Scenario: A file from an old wrapper
- **WHEN** a run file holds an ended root, and a subtask of it with no end
- **THEN** the plugin shows the subtask with the end state of the root
