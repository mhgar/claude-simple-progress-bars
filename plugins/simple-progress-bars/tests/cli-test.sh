#!/usr/bin/env bash
# Tests for bin/claude-progress. Run: tests/cli-test.sh
# Each check uses its own task. The checks write only to a temporary directory.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
P="$ROOT/bin/claude-progress"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
export PROGRESS_DIR="$TMP/pd" CLAUDE_CODE_SESSION_ID=test-session
D="$PROGRESS_DIR/$CLAUDE_CODE_SESSION_ID"
pass=0
fail=0

# field TASK KEY: prints one field of a task record.
field() {
  python3 -c 'import json,sys; v=json.load(open(sys.argv[1])).get(sys.argv[2]); print("" if v is None else v)' "$D/$1" "$2" 2>/dev/null
}

# check NAME EXPECTED ACTUAL
check() {
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FAIL: $1: expected '$2', got '$3'"
  fi
}

exists() { [ -e "$D/$1" ] && echo yes || echo no; }

# --- Direct reports

"$P" -n count 17/240 clip.mkv
check "a count sets done" 17.0 "$(field count 'done')"
check "a count sets the total" 240.0 "$(field count total)"
check "a count sets the detail" clip.mkv "$(field count detail)"
check "the owner is the caller" $$ "$(field count pid)"

"$P" -n sizes 1.5G/4GiB
check "sizes set the byte unit" B "$(field sizes unit)"
check "sizes scale the total" 4294967296.0 "$(field sizes total)"

"$P" -n pct 42% halfway
check "a percent sets its unit" % "$(field pct unit)"

"$P" -n text-keeps 3/9
"$P" -n text-keeps Scanning disk
check "a text update keeps the total" 9.0 "$(field text-keeps total)"
check "a text update sets the detail" "Scanning disk" "$(field text-keeps detail)"

"$P" -n detail-words 3/9 cp -p -- file.txt
check "words after VALUE are detail, also options and --" "cp -p -- file.txt" "$(field detail-words detail)"

out=$("$P" -n help-word 3/9 du -h /data)
check "-h in the detail prints no help" "" "$out"

"$P" -n workers -t 50
seq 50 | xargs -P8 -I{} "$P" -n workers +1
check "parallel +1 counts under a lock" 50.0 "$(field workers 'done')"

"$P" -n add-sizes +512M
"$P" -n add-sizes +1,000
check "+N takes sizes and thousands" 536871912.0 "$(field add-sizes 'done')"

bash -c "\"$P\" -n handover -t 20; true" # the shell outlives the call, then exits
bash -c "\"$P\" -n handover +1; true"
check "+N from a new call takes a live owner" "$(ps -o pgid= $$ | tr -d ' ')" "$(field handover pid)"

"$P" -n finished 3/10
"$P" -n finished "done"
check "done fills the count to the total" 10.0 "$(field finished 'done')"
check "done sets the state" 'done' "$(field finished state)"

"$P" -n failed 3/10
"$P" -n failed fail "disk full"
check "fail keeps the message" "disk full" "$(field failed msg)"

"$P" -n rerun 1/2
"$P" -n rerun "done"
"$P" -n rerun +1
check "+N after an end starts a new run" 1.0 "$(field rerun 'done')"

"$P" -n gone 1/2
"$P" -n gone clear
check "clear removes the file" no "$(exists gone)"

"$P" -n 'a/b/../c' 1/2
check "a name cannot leave the directory" 1.0 "$(field 'a-b-..-c' 'done')"
"$P" -n job.lock 1/2
check "a name cannot look like a lock file" 1.0 "$(field job.lock_ 'done')"

printf '#!/bin/bash\n"%s" 3/9\n' "$P" > "$TMP/convert-videos.sh"
bash "$TMP/convert-videos.sh"
check "the default name is the calling script" 3.0 "$(field convert-videos 'done')"

err=$("$P" -n bad -t abc 2>&1)
check "a bad total exits 0" 0 "$?"
check "a bad total warns" "claude-progress: bad total: 'abc'" "$err"

# --- Pipe modes

out=$(seq 1000 | "$P" -n lines -l -t 5000 | wc -l)
check "line mode passes the output through" 1000 "$out"
check "line mode counts lines" 1000.0 "$(field lines 'done')"
check "line mode ends at the real count" 1000.0 "$(field lines total)"

"$P" -n stdout-only -l -- sh -c 'seq 3; seq 5 >&2' >/dev/null 2>&1
check "line mode counts stdout only" 3.0 "$(field stdout-only 'done')"

# shellcheck disable=SC2016  # the inner shell expands these
"$P" -n tqdm -p -- bash -c 'for i in 1 2 3; do printf "\r%d%%| %d/3 [00:01<00:02]" $((i*33)) "$i" >&2; done; exit 3' 2>/dev/null
check "the exit status of COMMAND passes through" 3 "$?"
check "a non-zero exit is a failure" fail "$(field tqdm state)"
check "the failure names the exit status" "exit 3" "$(field tqdm msg)"

"$P" -n rsync -p -- sh -c 'printf "  1,234,567  45%%  12.34MB/s  0:00:05 (xfr#5, to-chk=1000/1100)\n"; exit 1' >/dev/null
check "a percent wins over a count in the same line" 45.0 "$(field rsync 'done')"

"$P" -n pip -p -- sh -c 'printf "Downloading torch 4.5/9.0 MB\n"; sleep 0.4' >/dev/null
check "a spaced unit applies to both numbers" B "$(field pip unit)"

"$P" -n pages -p -- sh -c 'printf "Rendered 17/240 pages\n"; sleep 0.4' >/dev/null
check "a word after a count is not a unit" 240.0 "$(field pages total)"

out=$(timeout 5 "$P" -n cidr -p -- sh -c 'echo "inet 192.168.1.10/24"; seq 2000' | wc -l)
check "an address does not stop the output" 2001 "$out"

start=$(date +%s%N)
timeout 10 "$P" -n slow -p -- python3 -c 'print("1," * 30000)' >/dev/null
check "long runs of digits scan fast" yes "$([ $(( ($(date +%s%N) - start) / 1000000 )) -lt 2000 ] && echo yes || echo no)"

timeout 10 "$P" -n buffered -p -- python3 -c 'import time
for i in range(1, 6): print(f"step {i}/5"); time.sleep(0.3)' >/dev/null &
sleep 1.1
check "a Python child is not buffered" yes "$([ "$(field buffered 'done')" != "" ] && [ "$(field buffered 'done')" != 0.0 ] && echo yes || echo no)"
wait

timeout 10 "$P" -n broken -p -- seq 2000000 | head -1 >/dev/null
check "a closed reader does not hang" 0 "$([ "${PIPESTATUS[0]}" -eq 124 ] && echo 124 || echo 0)"

start=$(date +%s%N)
timeout 10 "$P" -n grandchild -p -- sh -c '(sleep 4) & echo started' >/dev/null
check "a background grandchild does not hold progress" yes "$([ $(( ($(date +%s%N) - start) / 1000000 )) -lt 3000 ] && echo yes || echo no)"

{ "$P" -n killed -p -- sh -c 'kill -TERM $$'; } 2>/dev/null
check "a signal death passes through as 128+N" 143 "$?"
check "a signal death is a failure" "signal 15" "$(field killed msg)"

"$P" -n missing -p -- /nonexistent/cmd 2>/dev/null
check "a missing command exits 127" 127 "$?"
printf 'echo hi\n' > "$TMP/noexec.sh"
"$P" -n noexec -p -- "$TMP/noexec.sh" 2>/dev/null
check "a command with no execute bit exits 126" 126 "$?"

# --- Outside a session, and bad input

env -u CLAUDE_CODE_SESSION_ID "$P" -n nosession 1/2
check "no session exits 0" 0 "$?"
check "no session writes nothing" no "$(exists nosession)"
out=$(env -u CLAUDE_CODE_SESSION_ID "$P" -n nosession -p -- sh -c 'echo hi; exit 4')
check "no session still runs COMMAND" "4 hi" "$? $out"
env -u CLAUDE_CODE_SESSION_ID "$P" -p -- /nonexistent/cmd 2>/dev/null
check "no session keeps exit 127" 127 "$?"

out=$(seq 1000 | "$P" -n badtotal -l -t "" 2>/dev/null | wc -l)
check "a bad total in a pipe still passes the input through" 1000 "$out"
"$P" -t abc -p -- sh -c 'exit 5' 2>/dev/null
check "a bad total before -- still runs COMMAND" 5 "$?"

# --- The shim for scripts outside Claude Code

shim=$(sed -n "s/^  '\(command -v claude-progress.*\)' +$/\1/p; s/^  '\(while \[.*\)'$/\1/p" "$ROOT/hooks/prompt.ts" | tr -d '\n')
out=$(env -u CLAUDE_CODE_SESSION_ID PATH=/usr/bin:/bin bash -c "$shim"'
claude-progress -n x 1/2 && claude-progress -n x done && seq 3 | claude-progress -n y -l | wc -l && claude-progress -n z -p -- sh -c "exit 6"; echo $?')
check "the shim does nothing, passes input, and runs COMMAND" "3 6" "$(echo "$out" | tr '\n' ' ' | sed 's/ $//')"
check "the README gives the same shim" yes "$(grep -qF -- "$shim" "$ROOT/../../README.md" && echo yes || echo no)"

# --- Files

found=$(find "$D" -name '*.tmp' | wc -l)
check "no temporary files are left" 0 "$found"
check "the session directory is private" 700 "$(stat -c %a "$D" 2>/dev/null || stat -f %Lp "$D")"
check "--dir prints PROGRESS_DIR" "$PROGRESS_DIR" "$("$P" --dir)"
check "--dir falls back to a per-user /tmp directory" "/tmp/claude-progress-$(id -u)" "$(env -u PROGRESS_DIR -u XDG_RUNTIME_DIR -u TMPDIR "$P" --dir)"

echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
