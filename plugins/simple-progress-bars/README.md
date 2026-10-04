# Simple Progress Bars

Progress bars with time estimates for the long scripts that Claude Code runs. A script reports its progress with one command, for example `claude-progress -n convert 17/240`, and a bar with the count, the percent, the elapsed time, and a time estimate shows under the prompt. Each update costs zero tokens.

The plugin adds the `claude-progress` command to the `PATH` of Claude's Bash tool, and adds a short section to Claude's system prompt about when and how to use it. Run `claude-progress --help` for the full reference.

The plugin reads and writes only its own progress directory: `$PROGRESS_DIR`, else `$XDG_RUNTIME_DIR/claude-progress`, else `$TMPDIR/claude-progress`, else `/tmp/claude-progress-<uid>`. It runs `mkdir`, `rm`, `find`, and `ps`, and it does not use the network.

Requirements: Claude Code with function hooks (early access), Python 3.8 or later, and Linux or macOS.

See the [project README](https://github.com/mhgar/simple-progress-bars#readme) for the API, failure handling, settings, limits, and development notes.

License: MIT.
