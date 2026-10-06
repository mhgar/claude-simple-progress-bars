# claude-progress reference

`claude-progress [-n NAME] [-t TOTAL] VALUE [DETAIL...]`

Options first. The first other word is VALUE. Every later word is DETAIL, also words that start with `-`.
- Bash tool: `bash "<plugin>/scripts/claude-progress.sh" ...`
- PowerShell tool: `& "<plugin>/scripts/claude-progress.ps1" ...`
- Script files: the shims at the end.

## Options
- `-n`, `--name NAME`: the task. One bar per name. Default `task`. `/`, `\`, CR, and LF become `-`. Leading dots go. 80 characters at most.
- `-t`, `--total TOTAL`: set the total. Alone, it starts the task at 0.
- `--dir`: print the progress directory.
- `-h`, `--help`, or no arguments: print the help.

## VALUE
| VALUE | Effect |
| --- | --- |
| `N/M` | N of M done. Replaces the task file. |
| `1.5G/4G` | Bytes. Units K, M, G, T, P, with optional `i` and `B`, are powers of 1024. The bar shows a rate. |
| `N%` | Percent. Replaces the task file. |
| `+N`, `+512M` | Add N to the count. Appends, so parallel workers need no lock. |
| text | Status. Keeps the count and the total. |
| `done [MSG]` | End: done. Fills the count to the total. |
| `fail [MSG]` | End: failed. |
| `clear` | Remove the bar now. |

Numbers: up to 15 digits, optional `,` groups, up to 6 decimals. `N/0` and a percent above 100 read as text. A report after `done` or `fail` starts a new run.

## The bar
- Status: `estimating…` until 3 counted updates or 2 s, then `~m:ss left`. `finishing…` at the total. `no update m:ss` (yellow) after 30 s with no report.
- At the total, a bar stays running until `done`, `fail`, or the end of its shell call.
- `done`: green, gone after 2 s. `fail`: red, stays 30 s.
- A bar started in a foreground Bash or PowerShell call ends with that call: `done` at its total, else `stopped` (red). A later report resumes it. A bar from a background job keeps running, and goes 10 min after its last report.

## Behavior
- Exit status is always 0. Nothing goes to stdout. A warning goes to stderr and starts with `claude-progress: `.
- Outside Claude Code (no `CLAUDE_CODE_SESSION_ID`), a call writes nothing.
- Task file: `${CLAUDE_CONFIG_DIR:-~/.claude}/progress/<session id>/<name>`. Folders of ended sessions go after 1 hour.
- Each call starts a process. Report at most once a second: in a fast loop, every Nth item.

## Rules
- Give true counts in `done`, such as `done "38 copied, 2 failed"`. Skip a failed item with a message, or count it. Use `fail` only when the whole run fails.
- Progress code prints nothing. Send errors of helper code, such as a line count of a file that does not exist yet, to `/dev/null`.

## When a bar is wrong
- No bar: the call ran outside Claude Code, or the name has a typo. Check with `--dir` and list `<dir>/$CLAUDE_CODE_SESSION_ID`.
- `stopped`: the shell call ended before the total and without `done`. Report `done`, or run the job in the background.
- `no update`: no report for 30 s. Report more often, or report a text status.
- Two bars: two different names.

## Script shims
Each shim runs the newest installed copy of the plugin, or does nothing.

Bash:
```bash
claude-progress() { local c; c=$(ls -dt "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/*/simple-progress-bars/*/scripts/claude-progress.sh 2>/dev/null | head -n 1); [ -n "$c" ] && bash "$c" "$@"; return 0; }
```

PowerShell:
```powershell
function claude-progress { $d = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }; $c = Get-ChildItem (Join-Path $d 'plugins/cache/*/simple-progress-bars/*/scripts/claude-progress.ps1') -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1; if ($c) { & $c.FullName @args } }
```

Python, then `claude_progress("-n", "x", f"{i}/{n}")`:
```python
import glob, os, sys
_b, sys.dont_write_bytecode = sys.dont_write_bytecode, True  # no __pycache__ in the plugin
try:
    sys.path.insert(0, max(glob.glob(os.path.join(os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude"), "plugins/cache/*/simple-progress-bars/*/scripts")), key=os.path.getmtime))
    from claude_progress import claude_progress
except Exception:
    def claude_progress(*args): pass
finally:
    sys.dont_write_bytecode = _b
```

Node, then `claudeProgress('-n', 'x', `${i}/${n}`)`. In an ES module, put `const require = (await import('node:module')).createRequire(import.meta.url)` first.
```js
let claudeProgress = () => {}
try {
  const fs = require('fs'), c = (process.env.CLAUDE_CONFIG_DIR || require('os').homedir() + '/.claude') + '/plugins/cache/'
  const f = fs.readdirSync(c).flatMap(m => { try { return fs.readdirSync(`${c}${m}/simple-progress-bars`).map(v => `${c}${m}/simple-progress-bars/${v}/scripts/claude-progress.js`) } catch { return [] } })
  ;({ claudeProgress } = require(f.filter(fs.existsSync).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]))
} catch {}
```

Other languages: run the bash command from the newest `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/cache/*/simple-progress-bars/*/scripts/`, and ignore failures. On Windows, use the `bash` on the PATH, not WSL.
