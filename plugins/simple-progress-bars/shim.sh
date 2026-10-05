# Makes the calls do nothing where claude-progress is not installed.
claude-progress() { [ -n "${CLAUDE_PROGRESS_SH:-}" ] && bash "$CLAUDE_PROGRESS_SH" "$@"; return 0; }
