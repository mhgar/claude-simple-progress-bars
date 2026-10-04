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
Each bar MUST get at least 50 cells. The plugin MUST fit as many bars on a row as it can, with ` │ ` between them, balance them across rows, and show at most `maxRows` rows (default 3, from 1 to 6). The last row MUST end with `  +N` for the bars that do not fit. Bars MUST be in the order of their start times.

#### Scenario: Four bars in 200 cells
- **WHEN** four bars run in a width of 200 cells
- **THEN** the plugin draws two rows of two bars, not three and one

### Requirement: Bar text
A bar MUST show its name in bold, the detail, the track, the count, the percent, the byte rate, the elapsed time, and the status, and leave out the parts with no value. It MUST fill exactly its cells. When the track gets less than 10 cells, the plugin MUST drop the detail, the rate, the count, the elapsed time, and the name, in that order, and at the end draw the track alone. Wide characters MUST count as 2 cells, and a cut text MUST end with `…`.

#### Scenario: A narrow bar
- **WHEN** a bar gets 12 cells
- **THEN** it shows only the track, exactly 12 cells wide

### Requirement: Status
The status MUST be `failed`, `stopped`, or `done` for an ended bar. A running bar MUST show `no update m:ss` after 30 seconds with no update, `finishing…` at its total, `estimating…` before 3 counted updates or 2 seconds, and `~m:ss left` after that.

#### Scenario: A stall
- **WHEN** a running bar gets no update for 31 seconds
- **THEN** it shows `no update 0:31`

### Requirement: Colors
A running bar MUST be cyan, a stalled one yellow, a done one green, and a failed or stopped one red. A running task with no total MUST show a segment that moves back and forth.

#### Scenario: No total
- **WHEN** a task runs with only text and no total
- **THEN** a cyan segment moves back and forth across the track
