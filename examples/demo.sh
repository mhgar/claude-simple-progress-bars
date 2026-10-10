#!/usr/bin/env bash
# Fake tasks that show each kind of bar, for about 75 seconds. Each task runs
# through the claude-progress wrapper, and prints tag lines.
# Run it in a Claude Code session with the plugin enabled: ! examples/demo.sh
set -u
WRAPPER=$(cd "$(dirname "$0")/.." && pwd)/plugins/simple-progress-bars/scripts/claude-progress.sh
if [ -z "${CLAUDE_CODE_SESSION_ID:-}" ]; then
  echo "Run this inside a Claude Code session."
  exit 1
fi

# task NAME FUNCTION: runs FUNCTION through the wrapper, with no output.
task() { bash "$WRAPPER" -n "$1" bash -c "$(declare -f "$2"); $2" > /dev/null 2>&1; }

# A count with detail text, at an uneven speed.
convert() {
  local n=90 i
  for ((i = 1; i <= n; i++)); do
    printf '[progress] %d/%d clip_%03d.mkv\n' "$i" "$n" "$i"
    sleep "0.$((RANDOM % 4 + 7))"
  done
  echo "[progress] done"
}

# Sizes, with a rate.
download() {
  local mb
  for ((mb = 0; mb <= 2048; mb += 32)); do
    echo "[progress] ${mb}M/2G"
    sleep 0.95
  done
  echo "[progress] done"
}

# A root task with subtasks: frames, then an upload of each batch.
render() {
  local batch frame
  echo "[progress] 0/3 batches"
  for ((batch = 1; batch <= 3; batch++)); do
    for ((frame = 1; frame <= 24; frame++)); do
      echo "[progress:frames] $frame/24 batch $batch"
      sleep 0.15
    done
    echo "[progress:frames] done"
    echo "[progress:upload] 0/3"
    for ((frame = 1; frame <= 3; frame++)); do echo "[progress:upload] $frame/3"; sleep 0.8; done
    echo "[progress:upload] done"
    echo "[progress] $batch/3 batches"
  done
  echo "[progress] done 72 frames"
}

# Text first, with no total, then a count.
scan() {
  local i
  echo "[progress] Scanning library"
  sleep 12
  for ((i = 1; i <= 300; i++)); do
    echo "[progress] $i/300"
    sleep 0.14
  done
  echo "[progress] done"
}

# A script that stops reporting at 40 of 100: the bar shows "no update" after 30 s.
stalled() {
  local i
  for ((i = 1; i <= 40; i++)); do
    echo "[progress] $i/100"
    sleep 0.3
  done
  sleep 60
}

# A task that fails with a message.
upload() {
  local i
  for ((i = 1; i <= 25; i++)); do
    echo "[progress] $i/60 photo_$i.jpg"
    sleep 1.6
  done
  echo "[progress] fail server returned 503"
}

task convert-videos convert & task download-ubuntu-iso download & task render-shots render &
task scan-library scan & task stalled-script stalled & task upload-to-nas upload &
wait
