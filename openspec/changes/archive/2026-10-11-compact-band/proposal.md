## Why

Since 1.1.0, a root task with subtasks takes a row of its own, and its subtasks take more rows under it. A few jobs with subtasks can fill the screen above the prompt. Today the only control is the `maxRows` setting, which hides every task past its limit behind a number. People usually want to see their progress bars, so the band shows everything by default. When it is too much, the person can fold it down.

## What Changes

**Roots**
- **Collapse a root.** A press on the row of a root with subtasks hides its subtasks. Another press shows them again. A root starts expanded. It stays collapsed until the person expands it, and the plugin never collapses a root by itself.
- A collapsed root shows `▸` before its name and `+N` for its hidden subtasks, with a count by state when the row has room: `+3: 1 running, 1 failed, 1 done`. An expanded root shows `▾`.
- **A root with subtasks has its own row** while it has a subtask on show, also when it is collapsed. When all its subtasks have hidden, it packs with other roots as a normal bar, as in 1.1.0.
- The plugin forgets that a root is collapsed when the root's bar hides.

**The band**
- **Expanded, by default.** The band shows every row, up to the height that Claude Code gives it. When it has more than 4 rows of bars, a last line, `▴ show less`, makes the band compact.
- **Compact, on request.** The band shows at most 4 rows of bars, and then a line `▸ N more: …` when more is there. The line counts the hidden tasks by state, done included while it is on show: `▸ 6 more: 2 running, 1 stalled, 1 failed, 1 stopped, 1 done`. A press on the line expands the band.
- **Too tall for Claude Code.** When the expanded band needs more rows than Claude Code gives it, the last line joins both: `▴ show less · 3 more: 2 running, 1 failed`. It has no `▸`, because nothing more can expand.
- The band keeps its state until the person changes it.
- Claude Code's own `[-]` mark beside the band, and `ctrl+x ctrl+a`, still hide the whole band. They leave only "plugin panel hidden", with no summary, so the compact band is the way to keep a summary on screen.

**Overflow rules**, for the compact band and for a band that is too tall
- Groups go in start order, oldest first: a root with its subtasks, or a run of roots with no subtasks.
- A bar never splits. When a group does not fit, it and every later group go to the "more" line. A smaller group after it never moves up to fill a gap.
- A root row that fits keeps its place. It stays expanded (`▾`), shows the subtasks that fit, and counts the rest as `+N`.

**Presses**
- A click presses a row, in Claude Code's fullscreen mode, where the terminal sends mouse clicks.
- The keyboard works in every mode. `ctrl+x`, then `Tab`, moves the focus to the band, Tab and the arrow keys move between the rows that can be pressed, Enter presses one, and Esc goes back to the prompt. These are Claude Code's own keys for a band. The plugin adds none.

**Setting**
- **BREAKING**: Remove the `maxRows` setting. The compact height is fixed at 4 rows of bars, and the expanded height is the height of the band.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `progress-display`: collapse of roots, the expanded and compact band, the "more" and "show less" lines, the overflow rules, and presses. `maxRows` goes.

## Impact

- `hooks/layout.ts`: groups, the overflow rules, the collapse marks, the state counts, and the "more" and "show less" lines.
- `hooks/register.tsx`: buttons in the band, and the state of the band and of each root.
- `types/index.d.ts`: the new state values in the plugin contract.
- `.claude-plugin/plugin.json`: remove `maxRows`, and release 1.2.0.
- `README.md`, `USAGE.md`: how to collapse and expand with a click or the keyboard, and how to read the "more" line.
- Tests: `tests/layout.test.ts`, `tests/band.test.ts`.
