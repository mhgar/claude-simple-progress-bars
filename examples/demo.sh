#!/usr/bin/env bash
# Six fake tasks that show each kind of bar, for about 45 seconds.
# Run it in a Claude Code session with the plugin enabled: ! examples/demo.sh
set -u
if ! command -v claude-progress >/dev/null; then
  PATH="$(cd "$(dirname "$0")/.." && pwd)/plugins/simple-progress-bars/bin:$PATH"
fi
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

# tqdm-style output, read with -p. The command exits 0.
train() {
  claude-progress -n train-model -p -- python3 -c '
import sys, time
for i in range(1, 51):
    bar = "#" * (i // 5)
    sys.stderr.write("\r%3d%%|%-10s| %d/50 [00:%02d<00:%02d, 1.2it/s]" % (i * 2, bar, i, i, 50 - i))
    sys.stderr.flush()
    time.sleep(0.6)
' 2>/dev/null
}

# A script that is killed at 40 of 100: the bar shows "stopped".
flaky() {
  # shellcheck disable=SC2016  # the inner shell expands these
  bash -c 'for i in $(seq 100); do claude-progress -n flaky-script "$i/100"; sleep 0.3; [ "$i" = 40 ] && kill -9 $$; done'
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

convert & download & thumbnails & train & flaky & upload &
wait
