# Progress Display Specification

## Purpose
The plugin draws one progress bar for each task in the Claude Code terminal, in the band above the prompt. It covers where the bars go, how they fit the width, and the text and colors of each bar.

## Requirements

### Requirement: Position
The rows of bars MUST go in the band above the prompt, while a turn runs and after it, and MUST never go into the transcript. The plugin MUST give the band to a survey that holds it. The rows MUST have an indent of 2 cells, no rules, and MUST leave the last cell of the band free.

#### Scenario: An interrupted turn
- **WHEN** a turn is interrupted while a task runs
- **THEN** the bars stay above the prompt, and no line in the transcript has bars under it

### Requirement: Rows
Each bar MUST have a row of its own, at every width. Roots MUST be in the order of their start times. The plugin MUST keep its tree within the height that Claude Code gives the band. The plugin MUST NOT have a setting for the number of rows.

#### Scenario: Four bars in 200 cells
- **WHEN** four roots with no subtasks run in a width of 200 cells
- **THEN** the plugin draws four rows of one bar

### Requirement: Bar text
A bar MUST show its name, the detail, the track, the count, the percent, the byte rate, the elapsed time, and the status, in the columns of "Table columns". A root name MUST be bold. When the track gets less than 10 cells, the plugin MUST drop the counts after `+N`, then the detail, the rate, the count, and the elapsed time columns, in that order, then cut the name column to 8 characters, and then drop the percent and the status columns. A dropped column MUST go from every row. Wide characters MUST count as 2 cells, and a cut text MUST end with `…`.

#### Scenario: A narrow bar
- **WHEN** the band is 30 cells wide
- **THEN** each row shows only its gutter, its name cut to 8 characters, and its track

### Requirement: Status
The status MUST be `failed`, `stopped`, or `done` for an ended bar. A running bar MUST show `no update m:ss` after 30 seconds with no update, `finishing…` at its total, `estimating…` before 3 counted updates or 2 seconds, and `~m:ss left` after that. For a root, a report of any of its subtasks MUST count as an update.

#### Scenario: A stall
- **WHEN** a running bar gets no update for 31 seconds
- **THEN** it shows `no update 0:31`

#### Scenario: A quiet root with busy subtasks
- **WHEN** a root gets no report of its own for 60 seconds, and its subtask `frames` gets a report every second
- **THEN** the root does not show `no update`

### Requirement: Colors
A running bar MUST be cyan, a stalled one yellow, a done one green, and a failed or stopped one red. A running task with no total MUST show a segment that moves back and forth.

#### Scenario: No total
- **WHEN** a task runs with only text and no total
- **THEN** a cyan segment moves back and forth across the track

### Requirement: Subtask blocks
A root with at least one subtask on show MUST get a block, also when it is collapsed. The root MUST have a row of its own. When it is expanded, each subtask MUST have a row of its own under it, in the order of their start times. Each subtask name MUST start 4 cells to the right of the root names, inside the name column. Subtask names MUST be dim. The block MUST have no empty rows. A root whose subtasks have all hidden MUST show as a normal bar.

#### Scenario: A root with two subtasks
- **WHEN** the root `render` runs with the subtasks `frames` and `upload`, in a width of 200 cells
- **THEN** `▾ render` has one row, and `frames` and `upload` each have a row under it, with their names 4 cells to the right of `render`

#### Scenario: Not enough rows
- **WHEN** a block has more subtask rows than the rows that are left
- **THEN** the root row ends with `+N` for the subtasks that do not fit

### Requirement: Collapse a root
A press on the row of a root with subtasks MUST toggle its subtasks between shown and hidden. A root MUST start expanded, and the plugin MUST NOT collapse a root by itself. An expanded root MUST show `▾ ` before its name, and a collapsed root `▸ `. A collapsed root MUST show `+N` after its bar for its subtasks on show, then, when the row has room, a count by state. The plugin MUST forget that a root is collapsed when the root's bar hides.

#### Scenario: Collapse and expand
- **WHEN** the root `encode` has 3 subtasks on show, and the person presses its row twice
- **THEN** after the first press its row shows `▸ encode` and `+3`, and no subtask row, and after the second press its subtask rows show again under `▾ encode`

#### Scenario: Counts on a collapsed root
- **WHEN** a collapsed root has a running, a failed, and a done subtask, in a width of 200 cells
- **THEN** its row ends with `+3: 1 running, 1 failed, 1 done`

#### Scenario: A narrow row
- **WHEN** a collapsed root with 3 subtasks gets 60 cells
- **THEN** its row ends with `+3`, with no counts

### Requirement: Band states
The band MUST start expanded. In the expanded state, it MUST show every row that fits in the height that Claude Code gives the band. In the compact state, it MUST show at most 4 rows of bars. A press on the last line MUST toggle the state. The state MUST stay until the person changes it.

#### Scenario: Show less
- **WHEN** the bars need 7 rows, the band has a height of 20, and the person presses `▴ show less`
- **THEN** the band shows 4 rows of bars and a line that starts with `▸ ` and counts the rest

### Requirement: Last line
The band MUST end with one line in these cases, and with none in other cases:
- expanded, with more than 4 rows of bars that all fit: `▴ show less`,
- expanded, with more rows of bars than fit: `▴ show less · N more: COUNTS`,
- compact, with more than 4 rows of bars: `▸ N more: COUNTS`.

COUNTS MUST count the tasks that do not show, by state, in the order `running`, `stalled`, `failed`, `stopped`, `done`, and leave out states with a count of 0. A running task with no update for 30 seconds MUST count as `stalled`. The last line MUST count in the height of the band.

#### Scenario: Four rows or fewer
- **WHEN** the bars need 3 rows, in either state
- **THEN** the band has no last line

#### Scenario: Too tall for the band
- **WHEN** the band is expanded, has a height of 6, and the bars need 9 rows
- **THEN** the band shows 5 rows of bars, and a last line that starts with `▴ show less · ` and counts the tasks that do not show

### Requirement: Overflow
The plugin MUST fill rows group by group, in start order, oldest first. A group MUST be a root with subtasks on show, or a run of roots with none. When a group does not fit whole, every later group MUST go to the last line, and no later group MUST move up to fill a gap. A run that does not fit whole MUST show the roots that fit. A root with subtasks whose row fits MUST keep its place, show the subtask rows that fit, and show `+N` on its row for the rest. A root with subtasks whose row does not fit MUST go to the last line with its subtasks.

#### Scenario: A block that does not fit whole
- **WHEN** the band is compact, the root `render` has 8 subtasks, and the roots `encode` and `tests` started after it
- **THEN** `render` shows with 3 subtask rows and `+5` on its row, and the last line counts `encode` and `tests`

### Requirement: Presses
The row of a root with subtasks, and the last line, MUST be buttons with no brackets. A button MUST keep its key while it shows: `root:<task key>` for a root row, and `band` for the last line. The plugin MUST NOT add keys of its own.

#### Scenario: The keyboard
- **WHEN** the person presses `ctrl+x`, then `Tab`, and then Enter on the row of the root `render`
- **THEN** `render` collapses

### Requirement: Table columns
All rows MUST share columns, in this order: a gutter of 2 cells for the mark, the name, the detail, the track, the count, the percent, the rate, the elapsed time, the status, and `+N`. Two spaces MUST separate columns. Each column MUST have the width of its widest value on screen. The name column MUST be at most a quarter of the band width, and the detail column at most a fifth, each at least 8 cells. Text columns MUST align left, and number columns right. A column with no value on screen MUST take no space. A value that is longer than its column MUST be cut with `…`.

#### Scenario: Aligned rows
- **WHEN** the roots `Convert videos` at 64 of 90 and `Thumbnails` at 120 of 120 show
- **THEN** their tracks start in the same column, and their percents end in the same column

#### Scenario: A long name
- **WHEN** a root has the name `Download the Ubuntu desktop image`, in a band of 100 cells
- **THEN** its name shows as its first 24 characters and `…`, in 25 cells

### Requirement: Track ratio
The track MUST get the width that the other columns leave, but at most the width of all other columns together, and at least 10 cells. Every row MUST have the same width.

#### Scenario: A wide terminal
- **WHEN** the other columns take 80 cells, in a width of 300 cells
- **THEN** each track is 80 cells wide, and each row is 160 cells wide
