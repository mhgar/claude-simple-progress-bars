# Simple Progress Bars

![Progress bars above the Claude Code prompt: two running tasks with time estimates, one with a transfer size, a stalled task, a finished task in green, and a failed upload in red](assets/screenshot.png)

Progress bars with time estimates for the long scripts that Claude Code runs. A script reports its progress with one command, for example `claude-progress -n convert 17/240`, and a bar with the count, the percent, the elapsed time, and a time estimate shows in the band above the prompt of Claude Code. Each update costs zero tokens.

The plugin adds a short section to Claude's system prompt about when and how to use the command, with the command's full path. Script files find the newest installed copy of the plugin through a short shim. The plugin sets no environment variables and changes no configuration. [`USAGE.md`](USAGE.md) has the shim for bash, PowerShell, Python, and Node scripts, and the rules for reports in a script.

The command is a bash script, `scripts/claude-progress.sh`. Its PowerShell, Python, and Node twins are readable scripts too, in the same folder. The plugin puts no folder on any `PATH`. The plugin ships no compiled programs and downloads nothing. The commands write only in `$CLAUDE_CONFIG_DIR/progress`, or `~/.claude/progress`. The plugin only reads that directory, and runs no processes. Neither part uses the network.

Requirements: Claude Code v2.1.287 or later, where mods are on by default, on Linux, macOS, or Windows.

## What the plugin changes in Claude Code

| Hook | Change |
| --- | --- |
| `prompt.compose` | Adds one section, `simple-progress-bars:usage`, at the end of Claude's system prompt. It tells Claude when and how to call `claude-progress`, and gives the full paths of the command and of `USAGE.md`. No other part of the prompt changes. |
| `tool.call` (Bash, PowerShell) | Notes when each foreground shell call starts and ends. The command, its input, and its result do not change. |
| `ui.render` (`AbovePrompt`) | Draws the bars in the band above the prompt. The transcript and the status line stay as Claude Code draws them. |
| `session.start` | Reads `CLAUDE_CONFIG_DIR`, `HOME`, and `USERPROFILE` only to find the progress directory. No value leaves the machine. |

See the [project README](https://github.com/mhgar/claude-simple-progress-bars#readme) for the API, how a bar ends, settings, and development notes.

License: MIT.
