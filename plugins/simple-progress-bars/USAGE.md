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

## Python and Node

Both have a version of the command that writes the progress file itself, so it needs no bash and works on every system: `claude_progress.py` and `claude-progress.js`, in the folder that the plugin puts in `CLAUDE_PROGRESS_DIR`. A script loads it with a short shim, which turns the calls into no-ops where the plugin is missing. Neither version ever raises or throws.

Python:

```python
# Makes the calls do nothing where claude-progress is not installed.
try:
    import os, sys; sys.path.insert(0, os.environ["CLAUDE_PROGRESS_DIR"])
    from claude_progress import claude_progress
except Exception:
    def claude_progress(*args): pass
```

Then report with `claude_progress("-n", "convert", f"{i}/{n}", path)`.

Node, in a CommonJS script (`require`):

```js
// Makes the calls do nothing where claude-progress is not installed.
let claudeProgress = () => {}
try { ({ claudeProgress } = require(require('node:path').join(process.env.CLAUDE_PROGRESS_DIR, 'claude-progress.js'))) } catch {}
```

Node, in an ES module (`import`):

```js
// Makes the calls do nothing where claude-progress is not installed.
const { pathToFileURL } = await import('node:url')
const { claudeProgress } = await import(pathToFileURL(`${process.env.CLAUDE_PROGRESS_DIR}/claude-progress.js`).href).catch(() => ({ claudeProgress() {} }))
```

Then report with `claudeProgress('-n', 'convert', `${i}/${n}`, file)`.

## Other languages

Never run the command by name from a program: on Windows that fails. Run it through bash, and ignore every failure: `bash -c 'command -v claude-progress >/dev/null && exec claude-progress "$@"' _ ARGS...`. Find bash on the PATH first: on Windows, a bare `bash` can start the WSL launcher instead of Git Bash.

## Subagents

A subagent shares the session, so its reports show in the same bars. When you give a subagent long work that can be counted, tell it to report with `claude-progress`, and give it the path of this file.
