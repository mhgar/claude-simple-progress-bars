## 1. Estimator

- [x] 1.1 `hooks/bar.ts`: the rate weighted by time, with `stepTime` and `stepSize`, and the estimate with 10 percent hysteresis. The estimator follows a progress number that it gets with each update. Tests: `tests/bar.test.ts` "repeated updates do not raise the next rate sample", "a long step weighs more", "steady steps give the expected estimate".
- [x] 1.2 `hooks/bar.ts`: a function for the time left at read time: the countdown up to `stepTime`, then the sample of the current step, and `finishing…` when no count remains. Tests: `tests/bar.test.ts` "steps of 10 minutes count down", "a step that takes longer grows the time left", "the two cases meet with no jump", "a long last step shows finishing".

## 2. Subtask progress and no stalled state

- [x] 2.1 `hooks/watch.ts`: the progress of each root with its one running subtask, and no restart on a drop that comes from the subtask. Remove `activeAt`. Tests: `tests/watch.test.ts` "a root with one running subtask follows its fraction", "a root with two running subtasks uses its own count", "a subtask that ends first does not restart the root's estimate".
- [x] 2.2 `hooks/layout.ts`, `types/index.d.ts`: remove `STALL_MS`, the yellow color, `no update`, and the `stalled` count. Use the time left from 1.2. Tests: `tests/layout.test.ts` "a long step keeps the estimate and the color", "the last line counts a quiet task as running", `tests/band.test.ts`.

## 3. Guidance and evals

- [x] 3.1 `hooks/prompt.ts`: the subtask sentence. Tests: `tests/prompt.test.ts` "tells Claude to use subtasks for inner loops and parallel workers".
- [x] 3.2 `USAGE.md`: when to use a subtask, with the batch and worker examples. No stalled state in "The bar" and "When a bar is wrong".
- [x] 3.3 `evals/nested-batches` and `evals/parallel-workers`: new cases. Tests: `claude plugin validate --strict`.

## 4. Docs, demo, and release

- [x] 4.1 `examples/demo.sh`: replace the stalled task with a task of long steps, one of which takes longer.
- [ ] 4.2 `README.md` and `plugins/simple-progress-bars/README.md`: the screenshot text. Capture a new screenshot with the demo. Open: the user captures the screenshot later. The README text still matches the old screenshot until then.
- [x] 4.3 `.claude-plugin/plugin.json`: version 1.3.0.

## 5. Checks

- [x] 5.1 Run `claude plugin test`, the type check, `claude plugin validate --strict`, `tests/cli-test.sh`, and `openspec validate long-step-estimates --strict`.
- [ ] 5.2 Push to a branch, and get CI green on Linux, macOS, and Windows.
- [ ] 5.3 Run the two new evals and the old evals with subtasks, at least once each.
- [ ] 5.4 Archive the change into `openspec/specs`.
