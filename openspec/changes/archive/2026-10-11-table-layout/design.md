## Context

`rows` in `hooks/layout.ts` packs bars of at least 50 cells side by side, and `layout` fits one bar into its cells. Each bar drops its own parts when it is narrow, so two bars on top of each other rarely line up. Since 1.2.0, the band has collapse, a compact state, and a last line that counts what does not show.

## Goals / Non-Goals

**Goals:**
- One bar per row, with every column aligned across the band.
- Real names: the name column follows the longest name on screen, up to a quarter of the band width.
- A table that keeps a good balance of track and text at every width.

**Non-Goals:**
- Column headers. The values explain themselves.
- A setting for the columns or the ratio.

## Decisions

### Columns
Each row has these columns, in this order. Two spaces separate columns.

| Column | Content | Align | Width |
|---|---|---|---|
| gutter | `▾ ` or `▸ ` on a root with subtasks, else 2 spaces | left | 2 |
| name | the name. A subtask name has 4 spaces before it. | left | widest, at most a quarter of the band width |
| detail | the detail text | left | widest, at most a fifth of the band width |
| track | the bar | — | see "Ratio" |
| count | `64/90`, `1.3G/2.0G` | right | widest |
| percent | `71%` | right | widest |
| rate | `34M/s` | right | widest |
| elapsed | `0:39` | right | widest |
| status | `~0:15 left`, `no update 0:31`, `done` | left | widest |
| more | `+N`, then `: COUNTS` when the row has room | left | widest `+N` |

The name and detail columns are at least 8 cells, also on a narrow band. A column takes no space when no row on screen has a value for it. A value that is longer than its column is cut with `…`. The widths come from the rows that show, so the table changes width only when the rows on screen change.

### Ratio
Let `T` be the width of all columns but the track, with their gaps. The track gets `w − T` cells, but at most `T` cells. So the track is never wider than the text, and the table is at most twice as wide as its text. On a wide terminal, the empty space stays at the right of the band.

Alternative: a fixed table width, such as 140 cells. A table with little text then still has a very wide track. Rejected.

### Narrow terminals
When the track gets less than 10 cells, the table drops one column and measures again. The order: the counts after `+N`, the detail, the rate, the count, and the elapsed time, then the name column shrinks to 8 cells, then the percent and the status go. At the end, a row shows only its gutter, name, and track. The same column goes from every row, so the rows stay aligned.

### Styles
The styles of 1.2.0 stay: a root name is bold, and a subtask name dim. The detail and the numbers have the color of the bar's state, and dim while the bar runs normally. The track keeps its colors and its moving segment.

### Rows and height
Each bar has its own row. A run of roots with no subtasks needs one row for each root. A block needs one row for its root and, while it is open, one row for each subtask. The height table, the last line, and the overflow rules of 1.2.0 stay as they are.

### `layout`
`layout`, which fits one bar into a width, stays for tests and for the narrowest case. `rows` draws through the table instead.

## Risks / Trade-offs

- [More rows] A band of 10 tasks uses 10 rows, where 1.2.0 used about 6. Mitigation: the compact band, collapse, and the last line already handle a full band.
- [Width changes] A new task with a longer name makes the name column wider, and the tracks of all rows shorten a little. This is a small move, and it happens only when the rows on screen change.
- [Wide characters] Names with wide characters count 2 cells for each such character, as today.

## Migration Plan

1. Replace the packing in `rows` with the table, with tests.
2. Change the name limit in the prompt section and the docs, and release 1.2.1.

Rollback: install 1.2.0 again.

## Open Questions

None.
