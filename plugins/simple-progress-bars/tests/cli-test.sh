#!/usr/bin/env bash
# Tests for scripts/claude-progress.sh, on Linux, macOS, and Git Bash on Windows.
# Where PowerShell is installed, they also compare scripts/claude-progress.ps1 with it.
# Run: tests/cli-test.sh. The checks write only to a temporary directory.
# shellcheck disable=SC2016 # the commands in single quotes run in their own shell
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
P="$ROOT/scripts/claude-progress.sh"
TMP=$(mktemp -d)
trap 'chmod -R u+w "$TMP" 2>/dev/null; rm -rf "$TMP"' EXIT
export CLAUDE_CONFIG_DIR="$TMP/cfg" CLAUDE_CODE_SESSION_ID=test-session
BASE="$CLAUDE_CONFIG_DIR/progress"
case $(uname -s) in MINGW* | MSYS* | CYGWIN*) IS_WINDOWS=1 ;; *) IS_WINDOWS= ;; esac
passed=0
failed=0

# check NAME EXPECTED ACTUAL
check() {
  if [ "$2" = "$3" ]; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    echo "FAIL: $1: expected '$2', got '$3'"
  fi
}

exists() { [ -e "$1" ] && echo yes || echo no; }
yes_if() { if "$@"; then echo yes; else echo no; fi; }
matches() { [[ $1 =~ $2 ]]; }
# runs SESSION: the number of run files in a session directory.
runs() { find "$BASE/$1" -type f ! -name '.*' 2>/dev/null | wc -l | tr -d ' '; }
# runfile SESSION: the lines of the one run file of a session, joined with |.
runfile() { local f; for f in "$BASE/$1"/*; do [ -f "$f" ] && tr '\n' '|' < "$f"; done; }
# wrap SESSION ARGS...: runs the wrapper in a session of its own, so that each run file is easy to find.
wrap() { local s=$1; shift; CLAUDE_CODE_SESSION_ID=$s "$P" "$@"; }

# --- Run a command

out=$(wrap fail -n job bash -c 'echo "[progress] 1/2"; echo hello; exit 3')
check "a failed command keeps its exit status" 3 "$?"
check "tag lines leave the output, other lines stay" hello "$out"

out=$(wrap missing no-such-command-xyz 2>&1)
check "a missing command exits 127" 127 "$?"
check "a missing command warns" "claude-progress: no-such-command-xyz: command not found" "$out"

check "standard input reaches the command" piped "$(echo piped | wrap stdin cat)"
check "standard error stays on standard error" "out|" "$(wrap streams sh -c 'echo out; echo bad >&2' 2>/dev/null | tr '\n' '|')"
check "a tag on standard error counts" "task 1 - err|[1] 1/3|[1] done|end|" "$(wrap err -n err sh -c 'echo "[progress] 1/3" >&2' 2>/dev/null; runfile err)"
check "a last line with no line end stays so" "a|b" "$(wrap partial printf 'a\nb' | tr '\n' '|')"
check "the command gets PYTHONUNBUFFERED=1" 1 "$(wrap env sh -c 'echo "$PYTHONUNBUFFERED"')"

# --- Grammar and the root name

check "option words after COMMAND are its arguments" "-n|-p|a|b|" "$(wrap words -n copy printf '%s|' -n -p a b)"
wrap detail -n copy sh -c 'echo "[progress] 1/4 cp -p -- file.txt"'
check "option words in a tag are its detail" "task 1 - copy|[1] 1/4 cp -p -- file.txt|[1] done|end|" "$(runfile detail)"
mkdir -p "$TMP/tools" && printf '#!/bin/sh\necho "[progress] 1/2"\n' > "$TMP/tools/render.sh" && chmod +x "$TMP/tools/render.sh"
wrap name "$TMP/tools/render.sh"
check "the root name comes from the file name of the command" "task 1 - render" "$(runfile name | cut -d'|' -f1)"
wrap dashes -- sh -c 'echo "[progress] 1/2"'
check "-- ends the options" "task 1 - sh" "$(runfile dashes | cut -d'|' -f1)"

# --- Tag lines and values

check "a tag in the middle of a line is output" 'echo "[progress] 3/8"' "$(wrap mid sh -c "echo 'echo \"[progress] 3/8\"'")"
check "a tag in the middle of a line makes no run file" 0 "$(runs mid)"
check "a tag with no value is output" "[progress]|[progress] |" "$(wrap novalue sh -c 'echo "[progress]"; echo "[progress] "' | tr '\n' '|')"
wrap crlf -n w sh -c 'printf "[progress] 3/8\r\n"; sleep 0'
check "a CR before the line end is no part of the tag" "[1] 3/8" "$(runfile crlf | cut -d'|' -f2)"
wrap emptyname -n w sh -c 'echo "[progress:] 2/9"'
check "an empty name is the root" "task 1 - w|[1] 2/9" "$(runfile emptyname | cut -d'|' -f1-2)"
wrap stopped -n w sh -c 'echo "[progress] stopped early"'
check "a script cannot stop a task" "[1] +0 stopped early|[1] done" "$(runfile stopped | cut -d'|' -f2-3)"

# --- Root task and subtasks

wrap subonly -n render sh -c 'echo "[progress:frames] 1/240"'
check "a subtask with no root starts a root with no count" "task 1 - render|[1] done|task 2 1 frames|[2] 1/240|[2] done|end|" "$(runfile subonly)"
wrap again -n r sh -c 'echo "[progress] 1/9"; echo "[progress:frames] done"; echo "[progress:frames] 1/240"'
check "a tag after an end starts a new task" "task 2 1 frames|[2] done|task 3 1 frames|[3] 1/240" "$(runfile again | cut -d'|' -f4-7)"
wrap rootfirst -n r sh -c 'echo "[progress:upload] 3/10"; echo "[progress] done"; exit 1'
check "an end of the root ends its subtasks the same" "task 1 - r|[1] done|task 2 1 upload|[2] 3/10|[2] done|end|" "$(runfile rootfirst)"
wrap clear -n r sh -c 'echo "[progress] 1/2"; echo "[progress:a] 1/2"; echo "[progress] clear"'
check "clear on the root removes it and its subtasks" "end|" "$(runfile clear)"

# --- Fallback ends

wrap noend -n r sh -c 'echo "[progress] 2/5"; echo "disk full"; exit 1' > /dev/null
check "a command that fails ends its tasks fail, with the last line" "[1] fail exit 1: disk full" "$(runfile noend | cut -d'|' -f3)"
wrap endtag -n r sh -c 'echo "[progress] done"; exit 1'
check "an end tag stays after a failed exit" "task 1 - r|[1] done|end|" "$(runfile endtag)"
wrap ok -n r sh -c 'echo "[progress] 2/5"'
check "a command that succeeds ends its tasks done" "[1] done" "$(runfile ok | cut -d'|' -f3)"

# --- Signals and a closed output

if [ -z "$IS_WINDOWS" ]; then
  # A background job of a script starts with INT ignored, so this test sends TERM.
  CLAUDE_CODE_SESSION_ID=sig "$P" -n sig sh -c 'echo "[progress] 1/5"; echo "[progress:sub] 1/2"; sleep 30' &
  w=$!
  sleep 1.5
  kill -TERM $w
  wait $w
  check "TERM exits with 143" 143 "$?"
  check "TERM ends the running tasks as stopped" "task 1 - sig|[1] 1/5|[1] stopped|task 2 1 sub|[2] 1/2|[2] stopped|end|" "$(runfile sig)"
fi
wrap closed -n c sh -c 'for i in 1 2 3; do echo line$i; echo "[progress] $i/3"; sleep 0.2; done' | head -1 > /dev/null
sleep 1
check "a closed output does not stop the command" "[1] 3/3|[1] done" "$(runfile closed | cut -d'|' -f2-3)"

# --- The run file

wrap format -n render sh -c 'echo "[progress] 2/10"; echo "[progress:frames] 5/40"; exit 1' > /dev/null
check "the run file holds tasks, reports, and end" "task 1 - render|[1] 2/10|[1] fail exit 1|task 2 1 frames|[2] 5/40|[2] fail exit 1|end|" "$(runfile format)"
name=$(basename "$(find "$BASE/format" -type f ! -name '.*')")
check "the run file is named <pid>-<start>" yes "$(yes_if matches "$name" '^[0-9]+-[0-9]{10}$')"
wrap adds -n r sh -c 'echo "[progress] total 1000"; i=0; while [ $i -lt 1000 ]; do echo "[progress] +1"; i=$((i + 1)); done; echo "[progress] fail stop"'
check "whole-number adds become one sum" "task 1 - r|[1] total 1000|[1] +1000|[1] fail stop|end|" "$(runfile adds)"
wrap sizes -n r sh -c 'echo "[progress] +1.5G"; echo "[progress] +2"; echo "[progress] +512M"; echo "[progress] fail x"'
check "adds with units stay as lines" "[1] +2|[1] +1.5G|[1] +512M" "$(runfile sizes | cut -d'|' -f2-4)"
wrap looks -n r sh -c 'echo "[progress] 2/10"; echo "[progress] +1 3/8 files"; echo "[progress] fail x"'
check "a detail that looks like a count is written as +0" "[1] 2/10|[1] +1|[1] +0 3/8 files" "$(runfile looks | cut -d'|' -f2-4)"
wrap textfirst -n r sh -c 'echo "[progress] Scanning"; echo "[progress] 3/9"; echo "[progress] fail x"'
check "a count drops the text before it" "task 1 - r|[1] 3/9|[1] fail x|end|" "$(runfile textfirst)"
check "the session directory is private" 700 "$(stat -c %a "$BASE/format" 2>/dev/null || stat -f %Lp "$BASE/format")"

# --- The heartbeat

CLAUDE_CODE_SESSION_ID=beat "$P" -n hb sh -c 'echo "[progress] 1/2"; sleep 8; echo "[progress] fail x"' &
w=$!
sleep 7
f=$(find "$BASE/beat" -type f ! -name '.*')
age=$(($(date +%s) - $(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f")))
check "the heartbeat keeps a quiet run file fresh" yes "$(yes_if [ "$age" -le 6 ])"
wait $w

# --- Things that never break a script

out=$(CLAUDE_CODE_SESSION_ID=../escape "$P" -n x sh -c 'echo "[progress] 1/2"')
check "a session ID with a path writes nothing" no "$(exists "$BASE/../escape")"
check "a session ID with a path passes tags through" "[progress] 1/2" "$out"
out=$(env -u CLAUDE_CODE_SESSION_ID "$P" sh -c 'echo "[progress] 1/2"; exit 4')
check "outside a session the exit status stays" 4 "$?"
check "outside a session tags reach the output" "[progress] 1/2" "$out"
out=$("$P" -n 2>&1)
check "-n with no value warns" "claude-progress: -n needs a value" "$out"
out=$("$P" -n x 2>&1)
check "no command warns" "claude-progress: no command to run. See claude-progress --help" "$out"
if [ -z "$IS_WINDOWS" ]; then
  mkdir -p "$BASE/ro-session" && chmod 500 "$BASE/ro-session"
  out=$(wrap ro-session -n x sh -c 'echo "[progress] 1/2"; echo ran; exit 5' 2>&1)
  check "a failed write keeps the exit status" 5 "$?"
  check "a failed write warns once, and the command runs" yes "$(yes_if matches "$out" '^claude-progress: cannot write[^'$'\n'']*'$'\n''ran$')"
  chmod 700 "$BASE/ro-session"
fi

# --- Directories and help

check "--dir prints the progress directory" "$BASE" "$("$P" --dir)"
check "--dir uses ~/.claude without CLAUDE_CONFIG_DIR" "$HOME/.claude/progress" "$(env -u CLAUDE_CONFIG_DIR "$P" --dir)"
check "no arguments prints the help" yes "$(yes_if eval '"$P" | grep -q "^Usage:"')"

# --- Cleanup of old sessions

# The pid of a live process, as Claude Code gives it in CLAUDE_PID: a Windows pid in Git Bash.
if [ -n "$IS_WINDOWS" ]; then LIVE_PID=$(cat /proc/$$/winpid); else LIVE_PID=$$; fi
# stamp DAYS_AGO: prints a touch -t time, on GNU and BSD date.
stamp() {
  local t=$(($(date +%s) - $1 * 86400))
  date -d "@$t" +%Y%m%d%H%M 2>/dev/null || date -r "$t" +%Y%m%d%H%M
}
# session NAME OWNER_JSON DAYS_AGO: makes a session directory with one run file, all that old.
session() {
  mkdir -p "$BASE/$1" && printf 'task 1 - x\nend\n' > "$BASE/$1/1-1700000000"
  if [ -n "$2" ]; then printf '%s' "$2" > "$BASE/$1/.owner"; fi
  # -c: create no file. The directory goes last, because a change inside it moves its time.
  touch -c -t "$(stamp "$3")" "$BASE/$1/"* "$BASE/$1/.owner" "$BASE/$1"
}
sweeps=0
sweep() { sweeps=$((sweeps + 1)); wrap "sweeper-$sweeps" sh -c 'echo "[progress] 1/2"'; }

CLAUDE_PID=$LIVE_PID wrap owned sh -c 'echo "[progress] 1/2"'
check "a new session records its owner" yes "$(yes_if grep -q "\"pid\":$LIVE_PID" "$BASE/owned/.owner")"
touch -c -t "$(stamp 30)" "$BASE/owned/"* "$BASE/owned/.owner" "$BASE/owned"
env -u CLAUDE_PID CLAUDE_CODE_SESSION_ID=no-owner "$P" sh -c 'echo "[progress] 1/2"'
check "with no CLAUDE_PID, a session records no owner" no "$(exists "$BASE/no-owner/.owner")"

session dead-old '{"pid":999999,"procStart":"1"}' 1
session dead-recent '{"pid":999999,"procStart":"1"}' 0
session dead-written '{"pid":999999,"procStart":"1"}' 1
touch "$BASE/dead-written/1-1700000000" # a write changes the file, not the directory
session orphan-recent '' 2
session orphan-old '' 8
[ -z "$IS_WINDOWS" ] && session reused "{\"pid\":$LIVE_PID,\"procStart\":\"123\"}" 1
sweep

check "a session with a live owner stays, however old" yes "$(exists "$BASE/owned")"
check "a dead owner's session goes after 1 hour" no "$(exists "$BASE/dead-old")"
check "a dead owner's session stays within 1 hour" yes "$(exists "$BASE/dead-recent")"
check "a recent write keeps a dead owner's session" yes "$(exists "$BASE/dead-written")"
check "a session with no owner stays for 7 days" yes "$(exists "$BASE/orphan-recent")"
check "a session with no owner goes after 7 days" no "$(exists "$BASE/orphan-old")"
[ -z "$IS_WINDOWS" ] && check "a reused pid does not keep a session" no "$(exists "$BASE/reused")"

check "no temporary files are left" 0 "$(find "$BASE" -name '.*' ! -name .owner -type f | wc -l | tr -d ' ')"

# --- The PowerShell twin, where it is installed
#
# The same output through both wrappers must give the same run file and the same output.

PS=$(command -v pwsh || command -v powershell.exe || command -v powershell || true)
# native PATH: the form a Windows program takes. Elsewhere, the path as it is.
native() { if [ -n "$IS_WINDOWS" ]; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
if [ -z "$PS" ]; then
  echo "skip: no PowerShell, so the PowerShell twin is not tested"
else
  JOB='echo "[progress] total 10"; echo hello; echo "[progress] 2/10 a.exr"; echo "[progress:frames] 5/40"; echo err >&2
echo "[progress] +1"; echo "[progress] +1 3/8 files"; echo "[progress] +1.5G"; echo "[progress] stopped early"
echo "[progress:frames] done"; echo "[progress:frames] 1/9"; echo "[progress:ünï code] 50%"; echo "[progress:gone] 1/2"
echo "[progress:gone] clear"; echo "[progress] fail boom"; exit 3'
  BASH_EXE=$(command -v bash)
  for impl in sh ps; do
    cfg="$TMP/twin-$impl"
    if [ $impl = sh ]; then
      CLAUDE_CONFIG_DIR=$cfg CLAUDE_CODE_SESSION_ID=twin "$P" -n render bash -c "$JOB" > "$TMP/$impl.out" 2> "$TMP/$impl.err"
    else
      CLAUDE_CONFIG_DIR=$(native "$cfg") CLAUDE_CODE_SESSION_ID=twin "$PS" -NoProfile -ExecutionPolicy Bypass \
        -File "$(native "$ROOT/scripts/claude-progress.ps1")" -n render "$(native "$BASH_EXE")" -c "$JOB" > "$TMP/$impl.out" 2> "$TMP/$impl.err"
    fi
    echo "$?" > "$TMP/$impl.status"
  done
  check "PowerShell keeps the exit status" "$(cat "$TMP/sh.status")" "$(cat "$TMP/ps.status")"
  check "PowerShell writes the same run file as bash" "" "$(diff "$TMP"/twin-sh/progress/twin/* "$TMP"/twin-ps/progress/twin/* 2>&1)"
  check "PowerShell writes the same output as bash" "$(cat "$TMP/sh.out")" "$(tr -d '\r' < "$TMP/ps.out")"
  check "PowerShell writes the same errors as bash" "$(cat "$TMP/sh.err")" "$(tr -d '\r' < "$TMP/ps.err")"
  out=$(env -u CLAUDE_CODE_SESSION_ID "$PS" -NoProfile -ExecutionPolicy Bypass -File "$(native "$ROOT/scripts/claude-progress.ps1")" "$(native "$BASH_EXE")" -c 'echo "[progress] 1/2"; exit 4' | tr -d '\r'; echo "exit ${PIPESTATUS[0]}")
  check "PowerShell outside a session passes tags through and keeps the status" "[progress] 1/2|exit 4|" "$(printf '%s\n' "$out" | tr '\n' '|')"
  out=$("$PS" -NoProfile -ExecutionPolicy Bypass -File "$(native "$ROOT/scripts/claude-progress.ps1")" no-such-command-xyz 2>&1 | tr -d '\r'; echo "exit ${PIPESTATUS[0]}")
  check "PowerShell exits 127 for a missing command" "claude-progress: no-such-command-xyz: command not found|exit 127|" "$(printf '%s\n' "$out" | tr '\n' '|')"
fi

echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
