# Simple Progress Bars

Progress bars with time estimates for the long scripts that Claude Code runs. A script reports its progress with one command, for example `progress -n convert 17/240`, and a bar with the count, the percent, the elapsed time, and a time estimate shows under the prompt. Each update costs zero tokens.

The plugin adds the `progress` command to the `PATH` of Claude's Bash tool, and adds a short section to Claude's system prompt about when and how to use it. Run `progress --help` for the full reference.

The plugin reads and writes only its own per-session directory under `$XDG_RUNTIME_DIR` (or `$TMPDIR`, or `/tmp`). It runs `mkdir`, `rm`, `find`, and `ps`, and it does not use the network.

Requirements: Claude Code with function hooks (early access), Python 3, and Linux or macOS.

See the [project README](https://github.com/mhgar/simple-progress-bars#readme) for the API, failure handling, settings, and development notes.

License: MIT.
