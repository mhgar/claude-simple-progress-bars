# Makes the calls do nothing where claude-progress is not installed.
claude-progress() { local c; c=$(ls -dt "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/*/simple-progress-bars/*/scripts/claude-progress.sh 2>/dev/null | head -n 1); [ -n "$c" ] && bash "$c" "$@"; return 0; }
