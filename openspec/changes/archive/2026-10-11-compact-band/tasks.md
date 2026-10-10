## 1. Layout

- [x] 1.1 `hooks/layout.ts`: groups, the `▾` and `▸` marks, `+N` with counts by state, the height table, the last line, and the overflow rules. `rows` returns each row with its press target. Tests: `tests/layout.test.ts`.

## 2. State and presses

- [x] 2.1 `types/index.d.ts`: add `collapsed` and `isCompact` to the plugin's state contract.
- [x] 2.2 `hooks/register.tsx`: draw rows with a target as plain buttons with stable keys, toggle the state on a press, forget the collapse of a root whose bar is gone, and remove `maxRows`. Tests: `tests/band.test.ts` presses a root row and the last line.

## 3. Setting, documents, and release

- [x] 3.1 `.claude-plugin/plugin.json`: remove `maxRows`, and release 1.2.0.
- [x] 3.2 `README.md` and `USAGE.md`: collapse and expand with a click or the keyboard, the compact band, and the last line.

## 4. Checks

- [x] 4.1 Run `claude plugin test`, the type check, `claude plugin validate --strict`, and `openspec validate --strict`.
- [x] 4.2 Hands-on test with the person: collapse and expand a root, and make the band compact, with a click and with the keyboard.
- [x] 4.3 Archive the change into `openspec/specs`.
