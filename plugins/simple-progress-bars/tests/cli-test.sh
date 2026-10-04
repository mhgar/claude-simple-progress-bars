#!/usr/bin/env bash
# Tests for bin/progress. Run: tests/cli-test.sh
# It writes only to a temporary directory and needs python3.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
P="$ROOT/bin/progress"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export PROGRESS_DIR="$TMP/pd" CLAUDE_CODE_SESSION_ID=test-session
D="$PROGRESS_DIR/$CLAUDE_CODE_SESSION_ID"
pass=0 fail=0

# field NAME KEY: prints one JSON field of a task file.
field() { python3 -c 'import json,sys; v=json.load(open(sys.argv[1])).get(sys.argv[2]); print("" if v is None else v)' "$D/$1" "$2"; }

check() { # check DESCRIPTION EXPECTED ACTUAL
  if [ "$2" = "$3" ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL: $1: expected '$2', got '$3'"; fi
}

$P -n a 17/240 clip.mkv
check "count done" 17.0 "$(field a done)"
check "count total" 240.0 "$(field a total)"
check "count detail" clip.mkv "$(field a detail)"
check "count pid is the caller" $$ "$(field a pid)"

$P -n b 1.5G/4GiB
check "size unit" B "$(field b unit)"
check "size total" 4294967296.0 "$(field b total)"

$P -n c 42% halfway
check "percent unit" % "$(field c unit)"
$P -n d Scanning disk
check "text has no total" "" "$(field d total)"
check "text detail" "Scanning disk" "$(field d detail)"

$P -n e -t 50
seq 50 | xargs -P8 -I{} "$P" -n e +1
check "parallel +1 under a lock" 50.0 "$(field e done)"
check "workers keep the first pid" $$ "$(field e pid)"

out=$(seq 1000 | $P -n f -l -t 1000 | wc -l)
check "line mode passes output through" 1000 "$out"
check "line mode count" 1000.0 "$(field f done)"
check "line mode ends done" done "$(field f state)"

$P -n g -p -- bash -c 'for i in 1 2 3; do printf "\r%d%%| %d/3 [00:01<00:02]" $((i*33)) $i >&2; done; exit 3' 2>/dev/null
check "command exit status passes through" 3 "$?"
check "parse mode reads N/M" 3.0 "$(field g done)"
check "non-zero exit is fail" fail "$(field g state)"
check "fail message" "exit 3" "$(field g msg)"

$P -n a done
check "done" done "$(field a state)"
$P -n b fail "disk full"
check "fail with message" "disk full" "$(field b msg)"
$P -n c clear
check "clear removes the file" no "$([ -e "$D/c" ] && echo yes || echo no)"

err=$($P -n x -t abc 2>&1)
check "bad input exits 0" 0 "$?"
check "bad input warns" "progress: bad total: 'abc'" "$err"

env -u CLAUDE_CODE_SESSION_ID "$P" -n z 1/2
check "no session id exits 0" 0 "$?"
check "no session id writes nothing" no "$([ -e "$D/z" ] && echo yes || echo no)"
out=$(env -u CLAUDE_CODE_SESSION_ID "$P" -n z -p -- sh -c 'echo hi; exit 4')
check "no session id still runs the command" "4 hi" "$? $out"

printf '#!/bin/bash\n"%s" 3/9\n' "$P" > "$TMP/convert-videos.sh"
bash "$TMP/convert-videos.sh"
check "default name is the calling script" 3.0 "$(field convert-videos done)"

$P -n 'a/b/../c' 1/2
check "a name cannot leave the directory" 1.0 "$(field a-b-..-c done)"

ls "$D" | grep -q '\.tmp$' && found=yes || found=no
check "no temporary files are left" no "$found"

echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
