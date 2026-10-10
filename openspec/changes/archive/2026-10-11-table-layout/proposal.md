## Why

The band packs several bars on one row, each at least 50 cells wide. Each bar then has little room: names get cut after a few characters, the detail text often goes, and the numbers of the bars do not line up. The band has collapse and a compact state now, so it can use more rows. One bar per row, in aligned columns, is easier to read and leaves room for real names.

## What Changes

- **One bar per row**, for roots and for subtasks, at every width. No two bars share a row.
- **A table.** All rows share columns: a gutter for the `▾` and `▸` marks, the name, the detail, the track, the count, the percent, the rate, the elapsed time, the status, and `+N`. Each column has the width of its widest value on screen. Text columns align left, and number columns align right. A column with no value on screen takes no space.
- **An ideal ratio.** The track gets the width that is left, but at most as much as all the text columns together. On a wide terminal the table stops growing, so the bars do not stretch across the whole screen.
- **Narrow terminals.** When the track gets less than 10 cells, the table drops whole columns, the same column in every row, so the rows stay aligned.
- **Longer names.** The name column follows the longest name on screen, up to a quarter of the band width, and the detail column up to a fifth. Past that, a text is cut with `…`. The prompt section tells Claude to keep names under 24 characters.
- Subtask names start 4 cells to the right of root names, inside the name column.
- Collapse, the compact band, the last line, and the overflow rules stay as in 1.2.0. Each group now needs one row for each bar on show.
- Release 1.2.1.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `progress-display`: one bar per row, the table columns, the ideal ratio, and the column drop order.
- `claude-guidance`: the name limit is 24 characters.

## Impact

- `hooks/layout.ts`: the table layout.
- `hooks/prompt.ts`, `USAGE.md`, `README.md`: the name limit, and the new look.
- `.claude-plugin/plugin.json`: version 1.2.1.
- Tests: `tests/layout.test.ts`, `tests/band.test.ts`, `tests/prompt.test.ts`.
