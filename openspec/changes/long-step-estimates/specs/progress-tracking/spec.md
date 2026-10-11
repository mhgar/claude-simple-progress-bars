## ADDED Requirements

### Requirement: Long steps
The typical step MUST be the average time between count changes, and the average count change. While the current step takes at most the typical step time, the time left MUST count down. After that, the time left MUST be the estimate as if the current step ended now with a typical count change. When that leaves no count, the bar MUST show `finishing…`.

#### Scenario: Steps of 10 minutes
- **WHEN** each step takes 10 minutes, 5 steps remain, and the current step has run for 4 minutes
- **THEN** the bar shows about `~46:00 left`

#### Scenario: A step that takes longer
- **WHEN** each step took 10 minutes, 5 steps remain, and the current step has run for 20 minutes
- **THEN** the time left is more than 40 minutes, and it grows while the step runs

#### Scenario: The last step takes longer
- **WHEN** 1 step remains, and it runs longer than the typical step
- **THEN** the bar shows `finishing…`

### Requirement: Subtask progress
When a root has a total in items, and exactly one of its running subtasks has a total, the estimate of the root MUST use the root count plus the done part of that subtask, from 0 to 1. The bar MUST still show the root count. A drop that comes only from the end of that subtask MUST NOT start the estimate again.

#### Scenario: One batch at a time
- **WHEN** a root is at `2/10`, and its one running subtask `frames` is at `144/240`
- **THEN** the estimate of the root uses the progress 2.6 of 10, and the bar shows `2/10`

#### Scenario: Two subtasks at once
- **WHEN** a root is at `2/10`, and two of its subtasks run with totals
- **THEN** the estimate of the root uses only the root count

#### Scenario: A subtask ends first
- **WHEN** the subtask of a root at `2/10` ends `done`, and the root count moves to `3/10` one second later
- **THEN** the estimate of the root does not start again

## MODIFIED Requirements

### Requirement: Estimate
The rate MUST be an exponential moving average, where the weight of a sample grows with the time that it covers. Data older than the averaging time MUST keep a weight of 0.1 or less. The averaging time MUST be 3 typical step times, and at least 15 seconds. Only an update that changes the count MUST make a sample. The shown time left MUST count down between updates, and move to a new estimate only when the two differ by more than 10 percent. A new total, or a count that goes down, MUST start the estimate again.

#### Scenario: Repeated updates
- **WHEN** four updates repeat the count 2 of 100 in one second, and then the count 3 arrives
- **THEN** the rate stays 1 item a second, not 5

#### Scenario: A long step weighs more
- **WHEN** 10 steps took 1 second each, and the next step takes 60 seconds
- **THEN** the rate falls below 0.1 items a second

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
- **THEN** the bar stays for the whole hour, and shows its estimate
