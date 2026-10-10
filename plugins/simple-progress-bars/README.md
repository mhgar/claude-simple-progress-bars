# Simple Progress Bars

![Progress bars above the Claude Code prompt, one task per row in aligned columns: running tasks with time estimates and a transfer rate, a stalled task in yellow, a finished task in green, a failed upload and a stopped backup in red, and a render task with a subtask on an indented row under it](assets/screenshot.png)

Progress bars with time estimates for the long scripts that Claude Code runs. Claude runs a command through the `claude-progress` wrapper, and the command prints tag lines, for example `[progress] 17/240`. A bar with the count, the percent, the elapsed time, and a time estimate shows in the band above the prompt of Claude Code. Tag lines never reach Claude, so they cost zero tokens.

The plugin adds a short section to Claude's system prompt about when and how to use the wrapper, with the wrapper's full path. Any language works, because a tag is a line of output. Jobs on a remote server work too, through `ssh` inside the wrapper. The plugin sets no environment variables and changes no configuration. [`USAGE.md`](USAGE.md) has the full reference, flush examples for each language, and recipes for background and remote jobs.

The wrapper is a bash script, `scripts/claude-progress.sh`, with a PowerShell twin, `scripts/claude-progress.ps1`. The plugin puts no folder on any `PATH`, ships no compiled programs, and downloads nothing. The wrapper writes only in `$CLAUDE_CONFIG_DIR/progress`, or `~/.claude/progress`, and sets `PYTHONUNBUFFERED=1` only for the command that it runs. The plugin only reads that directory, and runs no processes. Neither part uses the network.

Requirements: Claude Code v2.1.287 or later, where mods are on by default, on Linux, macOS, or Windows.

## What the plugin changes in Claude Code

| Hook | Change |
| --- | --- |
| `prompt.compose` | Adds one section, `simple-progress-bars:usage`, at the end of Claude's system prompt. It tells Claude when and how to use `claude-progress`, and gives the full paths of the wrapper and of `USAGE.md`. No other part of the prompt changes. |
| `ui.render` (`AbovePrompt`) | Draws the bars in the band above the prompt. The transcript and the status line stay as Claude Code draws them. |
| `session.start` | Reads `CLAUDE_CONFIG_DIR`, `HOME`, and `USERPROFILE` only to find the progress directory. No value leaves the machine. |

See the [project README](https://github.com/mhgar/claude-simple-progress-bars#readme) for the tags, how a bar ends, settings, and development notes.

License: MIT.
