#!/usr/bin/env bash
# Six fake tasks that show each kind of bar, for about 45 seconds.
# From your own shell, no Bash call owns the tasks. So no bar shows "stopped".
# Run it in a Claude Code session with the plugin enabled: ! examples/demo.sh
set -u
: "${CLAUDE_PROGRESS_SH:=$(cd "$(dirname "$0")/.." && pwd)/plugins/simple-progress-bars/scripts/claude-progress.sh}"
export CLAUDE_PROGRESS_SH
claude-progress() { bash "$CLAUDE_PROGRESS_SH" "$@"; }
export -f claude-progress
if [ -z "${CLAUDE_CODE_SESSION_ID:-}" ]; then
  echo "Run this inside a Claude Code session."
  exit 1
fi

# A count with detail text, at an uneven speed.
convert() {
  local n=90 i
  for ((i = 1; i <= n; i++)); do
    claude-progress -n convert-videos "$i/$n" "$(printf 'clip_%03d.mkv' "$i")"
    sleep "0.$((RANDOM % 4 + 3))"
  done
  claude-progress -n convert-videos "done"
}

# Sizes, with a rate.
download() {
  local mb
  for ((mb = 0; mb <= 2048; mb += 40)); do
    claude-progress -n download-ubuntu-iso "${mb}M/2G"
    sleep 0.75
  done
  claude-progress -n download-ubuntu-iso "done"
}

# One total, then +1 from six parallel workers.
thumbnails() {
  claude-progress -n thumbnails -t 120
  # shellcheck disable=SC2016  # the worker shell expands these
  seq 120 | xargs -P6 -I{} bash -c 'sleep "0.$((RANDOM % 9 + 10))"; claude-progress -n thumbnails +1'
  claude-progress -n thumbnails "done"
}

# Text first, with no total, then a count.
scan() {
  local i
  claude-progress -n scan-library Scanning library
  sleep 12
  for ((i = 1; i <= 300; i++)); do
    if ((i % 10 == 0)); then claude-progress -n scan-library "$i/300"; fi
    sleep 0.1
  done
  claude-progress -n scan-library "done"
}

# A script that stops at 40 of 100 with no report: the bar shows "no update" after 30 s.
stalled() {
  local i
  for ((i = 1; i <= 40; i++)); do
    claude-progress -n stalled-script "$i/100"
    sleep 0.3
  done
}

# A task that fails with a message.
upload() {
  local i
  for ((i = 1; i <= 25; i++)); do
    claude-progress -n upload-to-nas "$i/60" "photo_$i.jpg"
    sleep 0.8
  done
  claude-progress -n upload-to-nas fail "server returned 503"
}

convert & download & thumbnails & scan & stalled & upload &
wait
