#!/usr/bin/env bash
# Fake tasks that show each kind of bar, for about 75 seconds. Each task runs
# through the claude-progress wrapper, and prints tag lines.
# From about 39 s to 44 s, bars show running, stalled, failed, stopped, and done
# at the same time, while most tasks still run.
# Run it in a Claude Code session with the plugin enabled: ! examples/demo.sh
set -u
WRAPPER=$(cd "$(dirname "$0")/.." && pwd)/plugins/simple-progress-bars/scripts/claude-progress.sh
if [ -z "${CLAUDE_CODE_SESSION_ID:-}" ]; then
  echo "Run this inside a Claude Code session."
  exit 1
fi

# task NAME FUNCTION: runs FUNCTION through the wrapper, with no output. The wrapper
# takes the place of the subshell, so $! after `task ... &` is the wrapper's pid.
task() { exec bash "$WRAPPER" -n "$1" bash -c "$(declare -f "$2"); $2" > /dev/null 2>&1; }

# Running to the end: a count with detail text, at an uneven speed. About 75 s.
convert() {
  local n=90 i
  for ((i = 1; i <= n; i++)); do
    printf '[progress] %d/%d clip_%03d.mkv\n' "$i" "$n" "$i"
    sleep "0.$((RANDOM % 4 + 7))"
  done
  echo "[progress] done"
}

# Running to the end: sizes, with a rate. About 61 s.
download() {
  local mb
  for ((mb = 0; mb <= 2048; mb += 32)); do
    echo "[progress] ${mb}M/2G"
    sleep 0.95
  done
  echo "[progress] done"
}

# Running to the end: a root task with subtasks, frames and then an upload of each batch. About 50 s.
render() {
  local batch frame
  echo "[progress] 0/3 batches"
  for ((batch = 1; batch <= 3; batch++)); do
    for ((frame = 1; frame <= 24; frame++)); do
      echo "[progress:frames] $frame/24 batch $batch"
      sleep 0.6
    done
    echo "[progress:frames] done"
    echo "[progress:upload] 0/3"
    for ((frame = 1; frame <= 3; frame++)); do echo "[progress:upload] $frame/3"; sleep 0.8; done
    echo "[progress:upload] done"
    echo "[progress] $batch/3 batches"
  done
  echo "[progress] done 72 frames"
}

# Running to the end: text first, with no total, then a count. About 54 s.
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

# Stalled: no tag after about 8 s, so the bar shows "no update" from about 38 s.
stalled() {
  local i
  for ((i = 1; i <= 40; i++)); do
    echo "[progress] $i/100"
    sleep 0.2
  done
  sleep 62
}

# Failed: a fail tag at about 37 s. A failed bar stays 10 s.
upload() {
  local i
  for ((i = 1; i <= 25; i++)); do
    echo "[progress] $i/60 photo_$i.jpg"
    sleep 1.5
  done
  echo "[progress] fail server returned 503"
}

# Done: complete at about 39 s. A done bar stays 5 s.
thumbnails() {
  local i
  for ((i = 1; i <= 120; i++)); do
    echo "[progress] $i/120"
    sleep 0.325
  done
  echo "[progress] done"
}

# Stopped: the demo sends TERM to its wrapper at 38 s. Short sleeps let it end at once.
backup() {
  local i
  for ((i = 1; i <= 400; i++)); do
    echo "[progress] $i/400 table_$i"
    sleep 0.5
  done
}

task "Convert videos" convert & task "Download Ubuntu" download & task "Render shots" render &
task "Scan library" scan & task "Stalled script" stalled & task "Upload photos" upload &
task Thumbnails thumbnails & task "Back up DB" backup &
backup_pid=$!
sleep 38
kill -TERM "$backup_pid" 2>/dev/null
wait
