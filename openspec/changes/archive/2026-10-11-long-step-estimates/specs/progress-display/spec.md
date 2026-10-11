## MODIFIED Requirements

### Requirement: Status
The status MUST be `failed`, `stopped`, or `done` for an ended bar. A running bar MUST show `finishing…` at its total, `estimating…` before 3 counted updates or 2 seconds, and `~m:ss left` after that. A running bar MUST NOT show a status for a time with no update.

#### Scenario: A stall
- **WHEN** a running bar with steps of 1 second gets no update for 31 seconds, and 5 steps remain
- **THEN** it shows `~m:ss left` with an estimate above 0, and no `no update` text

#### Scenario: A quiet root with busy subtasks
- **WHEN** a root gets no report of its own for 60 seconds, and its subtask `frames` gets a report every second
- **THEN** the root shows `~m:ss left` or `estimating…`, and no `no update` text

### Requirement: Colors
A running bar MUST be cyan, a done one green, and a failed or stopped one red. A running bar MUST keep its color however long it gets no update. A running task with no total MUST show a segment that moves back and forth.

#### Scenario: No total
- **WHEN** a task runs with only text and no total
- **THEN** a cyan segment moves back and forth across the track

#### Scenario: A long step
- **WHEN** a running bar gets no update for 10 minutes, and its wrapper writes the heartbeat
- **THEN** the bar stays cyan

### Requirement: Last line
The band MUST end with one line in these cases, and with none in other cases:
- expanded, with more than 4 rows of bars that all fit: `▴ show less`,
- expanded, with more rows of bars than fit: `▴ show less · N more: COUNTS`,
- compact, with more than 4 rows of bars: `▸ N more: COUNTS`.

COUNTS MUST count the tasks that do not show, by state, in the order `running`, `failed`, `stopped`, `done`, and leave out states with a count of 0. The last line MUST count in the height of the band.

#### Scenario: Four rows or fewer
- **WHEN** the bars need 3 rows, in either state
- **THEN** the band has no last line

#### Scenario: Too tall for the band
- **WHEN** the band is expanded, has a height of 6, and the bars need 9 rows
- **THEN** the band shows 5 rows of bars, and a last line that starts with `▴ show less · ` and counts the tasks that do not show

#### Scenario: A quiet task in the counts
- **WHEN** a task that does not show has had no update for 5 minutes, and its wrapper writes the heartbeat
- **THEN** COUNTS counts it as `running`
