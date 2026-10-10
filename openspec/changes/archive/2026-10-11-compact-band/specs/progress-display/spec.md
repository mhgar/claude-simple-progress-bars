## ADDED Requirements

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
The plugin MUST fill rows group by group, in start order, oldest first. A group MUST be a root with subtasks on show, or a run of roots with none. A bar MUST NOT split over rows. When a group does not fit whole, every later group MUST go to the last line, and no later group MUST move up to fill a gap. A run that does not fit whole MUST show the roots that fit. A root with subtasks whose row fits MUST keep its place, show the subtask rows that fit, and show `+N` on its row for the rest. A root with subtasks whose row does not fit MUST go to the last line with its subtasks.

#### Scenario: A block that does not fit whole
- **WHEN** the band is compact, the root `render` has 8 subtasks in a width of 120 cells, and the roots `encode` and `tests` started after it
- **THEN** `render` shows with 6 subtasks in 3 rows and `+2` on its row, and the last line counts `encode` and `tests`

### Requirement: Presses
The row of a root with subtasks, and the last line, MUST be buttons with no brackets. A button MUST keep its key while it shows: `root:<task key>` for a root row, and `band` for the last line. The plugin MUST NOT add keys of its own.

#### Scenario: The keyboard
- **WHEN** the person presses `ctrl+x`, then `Tab`, and then Enter on the row of the root `render`
- **THEN** `render` collapses

## MODIFIED Requirements

### Requirement: Rows
Each bar MUST get at least 50 cells. The plugin MUST fit as many bars on a row as it can, with ` │ ` between them, and balance them across rows. Roots with no subtasks on show MUST pack together. Roots MUST be in the order of their start times. The plugin MUST keep its tree within the height that Claude Code gives the band. The plugin MUST NOT have a setting for the number of rows.

#### Scenario: Four bars in 200 cells
- **WHEN** four roots with no subtasks run in a width of 200 cells
- **THEN** the plugin draws two rows of two bars, not three and one

### Requirement: Subtask blocks
A root with at least one subtask on show MUST get a block, also when it is collapsed. The root MUST have a row of its own at the full width. When it is expanded, its subtasks MUST pack into the rows under it, with the packing of "Rows", in the order of their start times. Each subtask row MUST start with an indent of 4 cells more than the root row. Subtask names MUST be dim. The block MUST have no empty rows. A root whose subtasks have all hidden MUST pack as a normal bar.

#### Scenario: A root with two subtasks
- **WHEN** the root `render` runs with the subtasks `frames` and `upload`, in a width of 200 cells
- **THEN** `▾ render` fills one row, and `frames` and `upload` share the next row, after an indent of 4 cells

#### Scenario: Not enough rows
- **WHEN** a block has more subtask rows than the rows that are left
- **THEN** the root row ends with `+N` for the subtasks that do not fit
