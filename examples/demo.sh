#!/bin/bash
# Six fake tasks that show each kind of bar. Run it from a Claude Code
# session with the plugin enabled, for example: ! examples/demo.sh
if ! command -v progress >/dev/null; then
  PATH="$(cd "$(dirname "$0")/.." && pwd)/plugins/simple-progress-bars/bin:$PATH"
fi
[ -n "${CLAUDE_CODE_SESSION_ID:-}" ] || { echo "Run this inside a Claude Code session."; exit 1; }
# 1. Count with detail, about 45 s.
( n=90; for i in $(seq $n); do progress -n convert-videos "$i/$n" "clip_$(printf %03d $i).mkv"; sleep 0.$((RANDOM % 4 + 3)); done; progress -n convert-videos done ) &
# 2. Bytes with a rate, about 40 s.
( for i in $(seq 0 40 2048); do progress -n download-ubuntu-iso "${i}M/2G"; sleep 0.75; done; progress -n download-ubuntu-iso done ) &
# 3. Parallel workers, 120 items, 6 at a time.
( progress -n thumbnails -t 120; seq 120 | xargs -P6 -I{} sh -c 'sleep 0.$((RANDOM % 9 + 10)); progress -n thumbnails +1'; progress -n thumbnails done ) &
# 4. tqdm-style output read with -p. The command exits 0.
( progress -n train-model -p -- python3 -c '
import sys, time
for i in range(1, 51):
    sys.stderr.write(f"\r{i*2:3d}%|{"#"*(i//5):10s}| {i}/50 [00:{i:02d}<00:{50-i:02d}, 1.2it/s]"); sys.stderr.flush(); time.sleep(0.6)
' 2>/dev/null ) &
# 5. A script that dies before done: the bar shows "stopped".
( bash -c 'for i in $(seq 100); do progress -n flaky-script "$i/100"; sleep 0.3; [ $i = 40 ] && kill -9 $$; done' ) &
# 6. A task that fails with a message.
( for i in $(seq 25); do progress -n upload-to-nas "$i/60" "photo_$i.jpg"; sleep 0.8; done; progress -n upload-to-nas fail "server returned 503" ) &
wait
