## 1. Table

- [x] 1.1 `hooks/layout.ts`: one bar per row, shared columns with the widths of their widest values, the track ratio, and the column drop order. Tests: `tests/layout.test.ts`.
- [x] 1.2 Check that collapse, the compact band, the last line, and the overflow rules still work with one bar per row. Tests: `tests/layout.test.ts`, `tests/band.test.ts`.

## 2. Names and release

- [x] 2.1 `hooks/prompt.ts`, `USAGE.md`: the name limit of 24 characters. Tests: `tests/prompt.test.ts`.
- [x] 2.2 `README.md`: the new look. `.claude-plugin/plugin.json`: version 1.2.1.

## 3. Checks

- [x] 3.1 Run `claude plugin test`, the type check, `claude plugin validate --strict`, and `openspec validate --strict`.
- [x] 3.2 Hands-on test with the person: the demo at a narrow, a normal, and a wide terminal width.
- [x] 3.3 Archive the change into `openspec/specs`.
