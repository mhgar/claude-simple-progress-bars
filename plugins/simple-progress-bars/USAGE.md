# claude-progress usage

`claude-progress` shows a live progress bar for a task in the Claude Code interface. Reports cost no tokens. Outside a Claude Code session the command does nothing, and it always exits 0, so it never breaks a script.

## Calls

Options come first, then one VALUE, then detail text. Always name the task with `-n`. Each name gets its own bar.

| Call | Meaning |
| --- | --- |
| `claude-progress -n NAME 17/240 [detail]` | 17 of 240 done. Sizes work too: `1.5G/4G` shows a transfer rate |
| `claude-progress -n NAME 42% [detail]` | A percent |
| `claude-progress -n NAME -t 500`, then `claude-progress -n NAME +1` | A total, then one step at a time. Safe from parallel workers |
| `claude-progress -n NAME Scanning disk` | A text status, with no number |
| `claude-progress -n NAME done [message]` | The task is complete |
| `claude-progress -n NAME fail [message]` | The task failed |
| `claude-progress -n NAME clear` | Remove the bar now |

## Rules

- Report `done` at the end, or `fail` with a message when the run as a whole fails. A failed item can be skipped with a message instead.
- Report at most about once a second. Each call starts a process, which takes about 50 ms on Windows, so in a fast loop report every Nth item.
- A foreground bar ends when its tool call ends. Run a job that may outlast the tool timeout in the background: its bar keeps going.
- Calls write nothing to stdout, so they never change the output of a script.

## Bash tool and bash scripts

`claude-progress` is on the PATH of the Bash tool. In a bash script file that people may run outside Claude Code, put this shim near the top:

```bash
command -v claude-progress >/dev/null || claude-progress() { :; }
```

## PowerShell tool and .ps1 scripts

The command is not on the PATH of PowerShell. The plugin sets `CLAUDE_PROGRESS_PS1` to its PowerShell twin, which takes the same arguments:

```powershell
& $env:CLAUDE_PROGRESS_PS1 -n convert "$i/$n" $file.Name
```

Quote values that PowerShell reads as numbers, such as `'+1'`. In a .ps1 script file, put this shim near the top, then call `claude-progress` as in bash:

```powershell
function claude-progress { if ($env:CLAUDE_PROGRESS_PS1) { & $env:CLAUDE_PROGRESS_PS1 @args } }
```

## Python

Never run the command by name from Python: on Windows that fails. Put this shim near the top. It calls the command through bash, and does nothing when bash or the command is missing:

```python
import shutil, subprocess
_BASH = shutil.which("bash")
def claude_progress(*args):
    if _BASH:
        subprocess.run([_BASH, "-c", 'command -v claude-progress >/dev/null && exec claude-progress "$@"', "_", *map(str, args)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
```

Then report with `claude_progress("-n", "convert", f"{i}/{n}", path)`.

## Node and other languages

Use the same pattern: run `bash -c 'command -v claude-progress >/dev/null && exec claude-progress "$@"' _ ARGS...`, find bash on the PATH first, and ignore every failure. In Node:

```js
const { spawnSync } = require('child_process')
const guard = 'command -v claude-progress >/dev/null && exec claude-progress "$@"'
const claudeProgress = (...args) => spawnSync('bash', ['-c', guard, '_', ...args.map(String)])
```

`spawnSync` reports a missing bash as `result.error` and never throws.

## Subagents

A subagent shares the session, so its reports show in the same bars. When you give a subagent long work that can be counted, tell it to report with `claude-progress`, and give it the path of this file.
