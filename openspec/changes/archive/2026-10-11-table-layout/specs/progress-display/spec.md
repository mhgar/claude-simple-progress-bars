## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Subtask blocks
A root with at least one subtask on show MUST get a block, also when it is collapsed. The root MUST have a row of its own. When it is expanded, each subtask MUST have a row of its own under it, in the order of their start times. Each subtask name MUST start 4 cells to the right of the root names, inside the name column. Subtask names MUST be dim. The block MUST have no empty rows. A root whose subtasks have all hidden MUST show as a normal bar.

#### Scenario: A root with two subtasks
- **WHEN** the root `render` runs with the subtasks `frames` and `upload`, in a width of 200 cells
- **THEN** `▾ render` has one row, and `frames` and `upload` each have a row under it, with their names 4 cells to the right of `render`

#### Scenario: Not enough rows
- **WHEN** a block has more subtask rows than the rows that are left
- **THEN** the root row ends with `+N` for the subtasks that do not fit

### Requirement: Overflow
The plugin MUST fill rows group by group, in start order, oldest first. A group MUST be a root with subtasks on show, or a run of roots with none. When a group does not fit whole, every later group MUST go to the last line, and no later group MUST move up to fill a gap. A run that does not fit whole MUST show the roots that fit. A root with subtasks whose row fits MUST keep its place, show the subtask rows that fit, and show `+N` on its row for the rest. A root with subtasks whose row does not fit MUST go to the last line with its subtasks.

#### Scenario: A block that does not fit whole
- **WHEN** the band is compact, the root `render` has 8 subtasks, and the roots `encode` and `tests` started after it
- **THEN** `render` shows with 3 subtask rows and `+5` on its row, and the last line counts `encode` and `tests`
