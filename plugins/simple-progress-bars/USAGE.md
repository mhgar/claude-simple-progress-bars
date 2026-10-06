# claude-progress in script files

Put the shim for the script's language near the top, then report through it. Without the plugin, the calls do nothing and never fail.

Forms: `-n NAME 17/240 [detail]`, `-n NAME 1.5G/4G`, `-n NAME 42%`, `-n NAME Some status`, `-n NAME -t 500` then `-n NAME +1` from parallel workers, `-n NAME done [message]`, `-n NAME fail message`.

- Count failed items, and give true counts in `done`, such as `done "38 copied, 2 failed"`. Use `fail` when the whole run fails.
- Keep progress code silent. The calls print nothing. Send errors of helper code, such as a line count of a file that does not exist yet, to `/dev/null`.
- In a fast loop, report every Nth item, at most about once a second.

## Bash

```bash
claude-progress() { [ -n "${CLAUDE_PROGRESS_SH:-}" ] && bash "$CLAUDE_PROGRESS_SH" "$@"; return 0; }
```

Then `claude-progress -n convert "$i/$n" "$file"`.

## PowerShell

```powershell
function claude-progress { if ($env:CLAUDE_PROGRESS_PS1) { & $env:CLAUDE_PROGRESS_PS1 @args } }
```

Quote values that PowerShell reads as numbers, such as `'+1'`.

## Python

```python
import os, sys
_bytecode, sys.dont_write_bytecode = sys.dont_write_bytecode, True  # no __pycache__ in the plugin
try:
    sys.path.insert(0, os.environ["CLAUDE_PROGRESS_DIR"]); from claude_progress import claude_progress
except Exception:
    def claude_progress(*args): pass
finally:
    sys.dont_write_bytecode = _bytecode
```

Then `claude_progress("-n", "convert", f"{i}/{n}", path)`.

## Node

CommonJS (`require`):

```js
// Makes the calls do nothing where claude-progress is not installed.
let claudeProgress = () => {}
try { ({ claudeProgress } = require(require('node:path').join(process.env.CLAUDE_PROGRESS_DIR, 'claude-progress.js'))) } catch {}
```

ES module (`import`):

```js
// Makes the calls do nothing where claude-progress is not installed.
const { pathToFileURL } = await import('node:url')
const { claudeProgress } = await import(pathToFileURL(`${process.env.CLAUDE_PROGRESS_DIR}/claude-progress.js`).href).catch(() => ({ claudeProgress() {} }))
```

Then `claudeProgress('-n', 'convert', `${i}/${n}`, file)`.

## Other languages

If `CLAUDE_PROGRESS_SH` is set, run `bash "$CLAUDE_PROGRESS_SH" ARGS...` and ignore every failure. On Windows, find bash on the PATH first, because a bare `bash` can start WSL.
