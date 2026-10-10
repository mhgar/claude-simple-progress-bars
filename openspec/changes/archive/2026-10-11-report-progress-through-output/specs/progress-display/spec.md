## ADDED Requirements

### Requirement: Subtask blocks
A root with visible subtasks MUST get a block. The root MUST have a row of its own at the full width. Its subtasks MUST pack into the rows under it, with the packing of "Rows", in the order of their start times. Each subtask row MUST start with an indent of 4 cells more than the root row. Subtask names MUST be dim. The block MUST have no empty rows. A root with no visible subtasks MUST pack as a normal bar.

#### Scenario: A root with two subtasks
- **WHEN** the root `render` runs with the subtasks `frames` and `upload`, in a width of 200 cells
- **THEN** `render` fills one row, and `frames` and `upload` share the next row, after an indent of 4 cells

#### Scenario: Not enough rows
- **WHEN** a block has more subtask rows than the rows that are left
- **THEN** the root row ends with `+N` for the subtasks that do not fit

## MODIFIED Requirements

### Requirement: Rows
Each bar MUST get at least 50 cells. The plugin MUST fit as many bars on a row as it can, with ` │ ` between them, balance them across rows, and show at most `maxRows` rows (default 3, from 1 to 6). The rows MUST go first to roots, and subtasks MUST get the rows that are left. The last row MUST end with `  +N` for the roots that do not fit. Roots MUST be in the order of their start times.

#### Scenario: Four bars in 200 cells
- **WHEN** four roots with no subtasks run in a width of 200 cells
- **THEN** the plugin draws two rows of two bars, not three and one

### Requirement: Status
The status MUST be `failed`, `stopped`, or `done` for an ended bar. A running bar MUST show `no update m:ss` after 30 seconds with no update, `finishing…` at its total, `estimating…` before 3 counted updates or 2 seconds, and `~m:ss left` after that. For a root, a report of any of its subtasks MUST count as an update.

#### Scenario: A stall
- **WHEN** a running bar gets no update for 31 seconds
- **THEN** it shows `no update 0:31`

#### Scenario: A quiet root with busy subtasks
- **WHEN** a root gets no report of its own for 60 seconds, and its subtask `frames` gets a report every second
- **THEN** the root does not show `no update`
