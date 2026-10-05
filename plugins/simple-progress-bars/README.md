# Simple Progress Bars

![Progress bars above the Claude Code prompt: two running tasks with time estimates, one with a transfer size, a stalled task, and a failed upload in red](assets/screenshot.png)

Progress bars with time estimates for the long scripts that Claude Code runs. A script reports its progress with one command, for example `claude-progress -n convert 17/240`, and a bar with the count, the percent, the elapsed time, and a time estimate shows in the band above the prompt of Claude Code. Each update costs zero tokens.

The plugin sets `CLAUDE_PROGRESS_SH` to the `claude-progress` command, sets `CLAUDE_PROGRESS_DIR` and `CLAUDE_PROGRESS_PS1` so that PowerShell, Python, and Node scripts can find their versions of it, and adds a short section to Claude's system prompt about when and how to use it. [`USAGE.md`](USAGE.md) has the full reference, with a shim for bash, PowerShell, Python, and Node scripts.

The command is a bash script, `scripts/claude-progress.sh`. Its PowerShell, Python, and Node twins are readable scripts too, in the same folder. The plugin puts no folder on any `PATH`. The plugin ships no compiled programs and downloads nothing. The commands write only in `$CLAUDE_CONFIG_DIR/progress`, or `~/.claude/progress`. The plugin only reads that directory, and runs no processes. Neither part uses the network.

Requirements: Claude Code with function hooks (early access), on Linux, macOS, or Windows.

## What the plugin changes in Claude Code

| Hook | Change |
| --- | --- |
| `prompt.compose` | Adds one section, `simple-progress-bars:usage`, at the end of Claude's system prompt. It tells Claude when and how to call `claude-progress`, and gives the path of `USAGE.md`. No other part of the prompt changes. |
| `tool.call` (Bash, PowerShell) | Notes when each foreground shell call starts and ends. The command, its input, and its result do not change. |
| `ui.render` (`AbovePrompt`) | Draws the bars in the band above the prompt. The transcript and the status line stay as Claude Code draws them. |
| `session.start` | Reads `CLAUDE_CONFIG_DIR`, `HOME`, and `USERPROFILE` only to find the progress directory, and sets `CLAUDE_PROGRESS_SH` to `scripts/claude-progress.sh`, `CLAUDE_PROGRESS_DIR` to the `scripts` folder, and `CLAUDE_PROGRESS_PS1` to `scripts/claude-progress.ps1`. No value leaves the machine. |

## Environment variables it sets

At the start of each session, the plugin sets two environment variables with `env.set` (`hooks/register.tsx`, in `start`):

| Variable | Value | Why |
| --- | --- | --- |
| `CLAUDE_PROGRESS_SH` | The plugin's `scripts/claude-progress.sh` | The Bash tool and bash scripts run the command through this path: `bash "$CLAUDE_PROGRESS_SH" -n NAME 17/240`. |
| `CLAUDE_PROGRESS_DIR` | The plugin's `scripts` folder, for example `~/.claude/plugins/cache/simple-progress-bars/simple-progress-bars/<version>/scripts` | Python and Node scripts load `claude_progress.py` and `claude-progress.js` from it. |
| `CLAUDE_PROGRESS_PS1` | The same folder's `claude-progress.ps1` | PowerShell gets no plugin folder on its `PATH`, so the PowerShell tool and `.ps1` scripts call the command through this path. |

Scope:

- The variables exist only in the Claude Code process and in the processes it starts after that, such as the commands of Claude's Bash and PowerShell tools and the scripts they run. They go when Claude Code exits.
- The plugin does not change your user or system environment, your shell profiles, or any settings file. It changes no other variable, and no other configuration.
- The values are paths inside the plugin's own folder. They hold no secret, and nothing sends them anywhere.
- When a variable cannot be set, the plugin logs that to the debug log, and the bars still work. Only the scripts in that language report nothing.

See the [project README](https://github.com/mhgar/claude-simple-progress-bars#readme) for the API, how a bar ends, settings, and development notes.

License: MIT.
