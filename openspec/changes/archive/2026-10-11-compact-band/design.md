## Context

Since 1.1.0, `rows` in `hooks/layout.ts` lays out the bars: roots with subtasks get a block, roots with no subtasks pack together, and anything past `maxRows` (default 3) becomes `+N`. The band only draws text, so the person has no control over it.

The mod API gives the band two things that this change uses:
- A `Button` can hold the `Text` parts of a row, so one row can be one control. It needs a stable `key`, and `plain` draws it with no brackets. The focus inverts the whole row.
- `e.props.maxRows` is the height that Claude Code gives the band. A tree of at most that many rows "shows whole". A taller tree scrolls in a window, under Claude Code's own `n more` row.

Claude Code also draws a `[-]` mark beside the band. The `[-]` mark and `ctrl+x ctrl+a` hide the whole band, and leave only "plugin panel hidden". The band hook gets no flag for that state.

## Goals / Non-Goals

**Goals:**
- The person can hide the subtasks of one root, and fold the band to a short summary.
- Everything shows by default.
- No bar moves on its own when it changes state, and no task disappears without a count.
- The plugin keeps its tree inside the band's height, so Claude Code never needs to scroll it.

**Non-Goals:**
- A summary in place of Claude Code's "plugin panel hidden". The hook cannot draw there.
- Hotkeys or a slash command. Claude Code's keys for a band are enough.
- A collapse that lasts across sessions.

## Decisions

### State
Two values, in the plugin's `$.state` contract next to `board`:
- `collapsed`: the keys of the roots that the person collapsed.
- `isCompact`: true while the band is compact. The default is false.

Each value changes only in an `onPress` handler, with `update($, atom, fn)`, as the mod API requires: a render hook never writes. The tick removes from `collapsed` each key whose bar is gone, so the plugin forgets a collapse when the root's bar hides. A task that ends is final, and a new task has a new key, so a forgotten root never comes back.

Alternative: module variables. A hot reload of the mod loses them, and they do not redraw the band. Rejected.

### The layout returns rows with a press target
`rows` returns a list of rows. Each row has its pieces and an optional target:
- `{ root: key }` for the row of a root with subtasks,
- `{ band: true }` for the "more" line or the "show less" line,
- none for every other row.

`register.tsx` draws a row with a target as a `plain` `Button`, with the key `root:<task key>` or `band`, and draws the other rows as today. `layout.ts` stays a pure function of the bars, the width, the time, and the state, so its tests need no engine.

### Groups
The layout first makes groups, in start order:
- **A block:** a root with at least one subtask on show. A collapsed subtask counts as on show. The root has a full row.
- **A run:** roots in a row with no subtasks on show. They pack together, at least 50 cells each, in balanced rows.

A block whose subtasks have all hidden is a run of one again, as in 1.1.0.

### The root row
A root row starts with a mark and one space: `▾` when it is expanded, `▸` when it is collapsed. Roots with no subtasks get no mark, and keep the indent of today. The mark takes 2 cells from the bar.

A collapsed root shows `+N` after the bar, for its subtasks on show. When the row has room, a count by state follows: `+3: 1 running, 1 failed, 1 done`. The counts give way first when the row is narrow, before any part of the bar. An expanded root whose subtasks do not all fit shows `+N` the same way, after the subtasks that fit.

### States and their words
| Bar state | Word |
|---|---|
| running | `running` |
| running, with no update for 30 s | `stalled` |
| failed | `failed` |
| stopped | `stopped` |
| complete | `done` |

The words go in this order, with a count before each, and states with a count of 0 are left out.

### Height
Let `H` be `e.props.maxRows`, and `R` the number of bar rows that all groups need.

| State | Condition | Rows of bars | Last line |
|---|---|---|---|
| Expanded | `R` ≤ 4 | `R` | none |
| Expanded | 4 < `R` < `H` | `R` | `▴ show less` |
| Expanded | `R` ≥ `H` | `H` − 1 | `▴ show less · N more: …` |
| Compact | `R` ≤ 4 | `R` | none |
| Compact | `R` > 4 | 4 | `▸ N more: …` |

In the last case, the compact band also stays inside `H`: with `H` < 5, it shows `H` − 1 rows of bars. A press on the last line toggles `isCompact`.

### Overflow
The layout fills rows group by group, in start order, until the rows run out:
1. A bar never splits.
2. A run that does not fit whole shows the roots that fit, and the rest go to "more".
3. A block whose root row fits keeps its place. It shows the subtask rows that fit, and the rest of its subtasks count as `+N` on its root row.
4. A block whose root row does not fit goes to "more", with its subtasks.
5. After the first group that does not fit whole, every later group goes to "more". A small group never moves up to fill a gap.

"more" counts roots and the subtasks of the roots that went to "more". It does not count the subtasks behind a `+N` on a root row that shows.

### Presses
- A click presses a row in Claude Code's fullscreen mode, where the terminal sends mouse clicks.
- The keyboard works in every mode: `ctrl+x`, then `Tab`, moves the focus to the band. Tab and the arrow keys move between the buttons, Enter presses one, and Esc goes back to the prompt.

The plugin adds no key of its own.

### The setting goes
`maxRows` leaves `plugin.json` and `register.tsx`. A value that a person set before stays in their settings, but the plugin no longer reads it.

## Risks / Trade-offs

- [A focus ring on a row that moves] When rows change while a button has the focus, the ring stays on its key. A root row keeps the key `root:<task key>` for its whole life, so the ring follows it. When that row goes to "more", the ring moves to the next button, as Claude Code decides.
- [Wide marks] `▾`, `▸`, and `▴` are one cell in most terminals. The layout counts them as one cell, as the width table of today does.
- [A narrow terminal] Under about 60 cells, a root row has little room. The counts give way first, then the parts of the bar, in the order of today.
- [A band shorter than 2 rows] With `H` of 1, the band shows only the last line. The person still sees the counts.
- [Breaking change] `maxRows` goes. Mitigation: release 1.2.0, and say it in the README.

## Migration Plan

1. Add the state values and the press targets, with the layout and its tests.
2. Draw buttons in `register.tsx`, with band tests that press them.
3. Remove `maxRows`, update the README and `USAGE.md`, and release 1.2.0.

Rollback: install 1.1.0 again. The run files do not change.

## Open Questions

None.
