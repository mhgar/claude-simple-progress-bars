# Progress Tracking Specification

## Purpose
The plugin reads the task files, folds their lines into the state of each task, estimates the time left, and ends or hides bars. It only reads files, and it runs no processes. The drawing is in `progress-display`.

## Requirements

### Requirement: Watched directories
The plugin MUST read `<config>/progress/<session id>` every 250 ms, with `<config>` from `CLAUDE_CONFIG_DIR`, else `HOME`, else `USERPROFILE`, and `/.claude` after the last two. It MUST read a file again only when its modification time changes, and MUST skip dot files. After `/clear` or `/resume`, it MUST add the directory of the new session ID and keep the earlier ones.

#### Scenario: Clear
- **WHEN** a background script writes to the old session directory, and the user runs `/clear`
- **THEN** the bar of that script stays

### Requirement: Line folding
The plugin MUST apply the lines of a file in order. `N/M` and `N%` set the count, the total, and the detail. `+N` adds to the count. `total T` sets the total. `done` ends the task and fills the count to the total. `fail` ends the task with its message. Any other line sets the detail, and keeps the count and the total. A line after `done` or `fail` MUST start a new run.

#### Scenario: Text after a count
- **WHEN** a file holds `3/9` and then `Scanning disk`
- **THEN** the task has the count 3 of 9 and the detail `Scanning disk`

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

### Requirement: End with the Bash call
The plugin MUST note the start and the end of each foreground Bash call. A running bar MUST end when a call that it started in has ended, no running call started before it, and it got no update after that call ended. It MUST end done at its total, and stopped in all other cases. A stopped bar that gets an update MUST resume with its start time.

#### Scenario: Two calls at the same time
- **WHEN** a bar starts while calls A and B both run, and B ends first
- **THEN** the bar keeps running until A ends

### Requirement: Total reached while running
A bar that reaches its total MUST stay running until `done`, `fail`, or the end of its Bash call.

#### Scenario: The last item starts
- **WHEN** a script reports 3 of 3 before it works on the third item
- **THEN** the bar shows `finishing…`

### Requirement: Expiry
A done bar MUST go 2 seconds after it ends. A failed or stopped bar MUST go after 30 seconds. A running bar MUST stay while a Bash call can own it, and else go 10 minutes after its last update. A gone bar MUST stay hidden until its file changes, and a file that is deleted MUST lose its bar at the next read.

#### Scenario: A new run in an old file
- **WHEN** a bar went, and its file then gets a new line
- **THEN** the bar shows again
