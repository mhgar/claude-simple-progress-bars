## Context

See proposal.md, "Why". Today `run()` in `hooks/bar.ts` folds each count change into an EMA (exponential moving average) of the rate with the weight 0.3, and stores an estimate. `statusOf()` in `hooks/layout.ts` counts that estimate down from the last count change, stops at 0, and after 30 seconds with no update shows `no update`. `settle()` in `hooks/watch.ts` gives each root the newest update time of its subtasks (`activeAt`) only for that stalled state.

Terms in this document:
- **Progress**: the number that the estimator follows. For most bars it is the count. For a root with one running subtask, it is the root count plus the done part of that subtask.
- **Step**: one change of progress. **Step time** and **step size**: the time and the progress of one step.
- **Gap**: the time since the last step.
- **τ (tau)**: the averaging time of the rate.

## Goals / Non-Goals

**Goals:**
- An estimate that suits steps of any length, from a fraction of a second to many minutes.
- No status that hides an estimate while the wrapper is alive.
- An estimate that never shows `~0:00 left` while work remains.
- Claude uses subtasks for inner loops and parallel workers.

**Non-Goals:**
- A change to bars with no total. They show no estimate, as today.
- A change to the wrappers or the run file.
- More than one subtask in the root's progress.

## Research

| Program | Rate | During a long step |
|---|---|---|
| tqdm | EMA per update, weight 0.3 | The estimate freezes |
| rich | Average over a window of 30 seconds | The estimate freezes, then `-:--:--` |
| progressbar2 | EMA, or the last 10 updates | The estimate freezes |
| curl | Average over the whole transfer | The estimate grows |
| indicatif | EMA by time: weight `0.1^(age / 15 s)`, smoothed twice | The gap counts as a sample of 0 steps, so the estimate grows |

None of them has a stalled status. indicatif fits our case best, because it weights data by time and it handles a gap. Its fixed 15 seconds suits fast transfers, not steps of 10 minutes.

## Decisions

### A rate weighted by time
For each step, with progress change `dd` over time `dt`:

```
τ        = max(15 s, 3 × stepTime)      // stepTime before this step
w        = 0.1 ^ (dt / τ)
rate     = w × rate + (1 − w) × dd / dt
stepTime = 0.3 × dt + 0.7 × stepTime
stepSize = 0.3 × dd + 0.7 × stepSize
```

The first step sets `rate = dd / dt`, `stepTime = dt`, and `stepSize = dd`.

A long step gets a large weight, and many short steps fade with their age. With steps of 1 second, `w` is 0.86, so a new step has a weight of 0.14. With steps of 10 minutes, τ is 30 minutes, and a step has a weight of 0.54.

The estimate at a step is `(total − progress) / rate`, with the 10 percent hysteresis of today.

Alternatives:
- Keep the EMA per update. Rejected: a step of 1 second weighs the same as a step of 10 minutes.
- Smooth twice, as indicatif does. Rejected: our 10 percent hysteresis already stops the jumps that the second EMA is for.
- A fixed τ of 15 seconds. Rejected: with steps of 10 minutes, each step would erase all older data.

### The estimate during a long step
At each read, with the gap `g`:
- **`g ≤ stepTime`**: the time left counts down, `estimate − g`, as today.
- **`g > stepTime`**: the estimator acts as if the current step ended now with a typical step size. It folds that sample into the rate, `w = 0.1 ^ (g / τ)`, `r′ = w × rate + (1 − w) × stepSize / g`. The time left is `(total − progress − stepSize) / r′`.
- When `total − progress − stepSize ≤ 0`, the last step runs long, and the bar shows `finishing…`.

At `g = stepTime`, `stepSize / g` equals the rate, so the two cases meet with no jump. As `g` grows, `r′` falls toward `stepSize / g`, so the time left grows in proportion to the gap. A step that takes twice as long as usual makes the later steps look twice as long too. A stuck job then shows a rising estimate.

Alternative: the decay of indicatif, `rate × 0.1^(g / τ)`. Rejected: it grows the estimate exponentially, about 10 times after one extra τ, which overstates a step that is only a little long.

Example: steps of 10 minutes, 5 steps remain, τ is 30 minutes.

| Time in the step | Time left |
|---|---|
| 4 minutes | 46 minutes, by the countdown |
| 10 minutes | 40 minutes, where the two cases meet |
| 20 minutes | 66 minutes |
| 60 minutes | about 230 minutes |

### The root's progress with its subtask
`ingest()` in `hooks/watch.ts` sees all tasks of a run file at once. After it applies the reports, it computes the progress of each root:
- The root has a total, and its unit is items, not bytes or percent.
- Exactly one of its running subtasks has a total.
- Then progress = root count + `min(1, done / total)` of that subtask. Else progress = root count.

The estimator gets this progress, and the bar keeps showing the root count. So a root at `2/10` with `frames 144/240` follows 2.6. Subtask reports now move the root's estimate, so `activeAt` has no job left, and it goes.

A drop of progress restarts the estimate only when the root count goes down or the total changes. When a subtask ends before the root count moves, progress drops from about 2.99 to 2 for a moment. The estimator ignores that drop: no sample, and no restart.

Alternative: the progress of all running subtasks, averaged. Rejected: parallel workers do not each cover one root step, so an average has no clear meaning.

### No stalled state
`STALL_MS`, `activeAt`, the yellow color, `no update m:ss`, and the `stalled` count go. A wrapper that is gone still shows `stopped` after 10 seconds, from the heartbeat.

### Guidance for subtasks
The prompt section gets one sentence: use a subtask for each meaningful part with its own count, such as an inner loop or a parallel worker, and keep the overall count on the root. `USAGE.md` gets two examples:
- Batches: `[progress] 3/10 batches` on the root, `[progress:frames] 120/240` for the current batch.
- Workers: `[progress] total 500` on the root, then `+1` from each worker, and `[progress:worker 2] file_213.wav` for each worker.

Two eval cases check the guidance: `nested-batches` and `parallel-workers`. Each grader checks for a subtask tag and a root count.

## Risks / Trade-offs

- [A wrong estimate when steps vary for no reason] A step that takes twice as long by chance makes the estimate grow until the step ends. → It comes back down at the next step, when the real sample enters the rate.
- [Parallel subtasks give no fraction] A root with two running subtasks uses only its own count. → Accept. The guidance tells Claude to keep the overall count on the root, with `+1` from each worker.
- [The screenshot shows a yellow bar] → A new capture with the demo. Until then, the README text describes the new screenshot only after the capture.
- [The display changes] → Release 1.3.0, not 1.2.6.

## Migration Plan

1. Change the plugin, the guidance, the evals, the demo, and the docs. Release 1.3.0.
2. No data migration. The estimator state lives only in memory.
