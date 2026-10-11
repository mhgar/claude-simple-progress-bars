## Why

After 30 seconds with no tag, a running bar turns yellow and shows `no update m:ss` in place of its estimate. A script with steps of 10 minutes then loses a valid estimate for most of each step. Since 1.2.4, the heartbeat tells a live wrapper from a dead one, so "no tag for 30 seconds" only means that a step is long, and long steps are normal.

The estimate has two faults of its own. It weights each update the same, so a step of 1 second counts as much as a step of 10 minutes. And between updates it counts down to `~0:00 left`, and stays there while a step runs longer than usual.

A root also ignores its subtasks: a root at `2/10 batches` gets a new estimate only when a whole batch ends, although its subtask knows that the batch is 60% done. The guidance never tells Claude when to use a subtask, and no eval checks it.

## What Changes

- **BREAKING (display): no stalled state.** The yellow color, the `no update m:ss` status, and the `stalled` count of the last line go. A running bar keeps its estimate however long a step takes.
- **Time-weighted rate.** The weight of a rate sample depends on the time that it covers, not on the number of updates. Old data fades with its age.
- **An estimate that grows during a long step.** The estimate counts down as today while a step takes no longer than a typical step. When a step takes longer, the estimate grows, and it never shows `~0:00 left` while work remains. A last step that takes longer shows `finishing…`.
- **Subtask progress in the root's estimate.** When a root has a count, and exactly one of its subtasks runs with a total, the root's estimate uses the root count plus the done part of that subtask.
- **Guidance for subtasks.** The prompt section and `USAGE.md` tell Claude to use a subtask for each meaningful part with its own count: an inner loop, or a parallel worker. The root keeps the overall count.
- **Two new evals:** nested batches, and parallel workers.
- `USAGE.md`, the demo, and the README screenshot text: no stalled state.
- Release 1.3.0, because the display changes.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `progress-display`: change "Status", "Colors", and "Last line".
- `progress-tracking`: change "Estimate" and "Expiry".
- `claude-guidance`: change "Prompt section" and "Usage file".

## Impact

- `hooks/bar.ts`: a new estimator. `STALL_MS` and `activeAt` go.
- `hooks/watch.ts`: the root's progress with its subtask.
- `hooks/layout.ts`: no stalled state, and the estimate at read time.
- `hooks/prompt.ts`, `USAGE.md`, two new evals in `evals/`.
- `examples/demo.sh`, `README.md`, and `plugins/simple-progress-bars/README.md`: the stalled task and the screenshot text. The screenshot itself shows a yellow bar, so it needs a new capture.
- Tests: `tests/bar.test.ts`, `tests/watch.test.ts`, `tests/layout.test.ts`, `tests/band.test.ts`, `tests/prompt.test.ts`.
- No change to the wrappers or the run file.
