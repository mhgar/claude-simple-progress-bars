#!/usr/bin/env bash
# Tests for bin/claude-progress, on Linux, macOS, and Git Bash on Windows.
# Run: tests/cli-test.sh. The checks write only to a temporary directory.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
P="$ROOT/bin/claude-progress"
TMP=$(mktemp -d)
trap 'chmod -R u+w "$TMP" 2>/dev/null; rm -rf "$TMP"' EXIT
export CLAUDE_CONFIG_DIR="$TMP/cfg" CLAUDE_CODE_SESSION_ID=test-session
BASE="$CLAUDE_CONFIG_DIR/progress"
D="$BASE/$CLAUDE_CODE_SESSION_ID"
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

lines() { tr '\n' '|' < "$D/$1" 2>/dev/null; }
exists() { [ -e "$1" ] && echo yes || echo no; }

# --- Reports

"$P" -n count 17/240 clip.mkv
check "a count writes one line" "17/240 clip.mkv|" "$(lines count)"
"$P" -n count 18/240 clip_018.mkv
check "a new count replaces the file" "18/240 clip_018.mkv|" "$(lines count)"
"$P" -n count Scanning disk
check "text appends" "18/240 clip_018.mkv|Scanning disk|" "$(lines count)"
"$P" -n count "done"
check "done appends" "18/240 clip_018.mkv|Scanning disk|done|" "$(lines count)"

"$P" -n pct 42% halfway
check "a percent replaces the file" "42% halfway|" "$(lines pct)"

"$P" -n failed fail "disk full"
check "fail appends with its message" "fail disk full|" "$(lines failed)"

"$P" -n workers -t 50
seq 50 | xargs -P8 -I{} "$P" -n workers +1
check "-t alone starts the file with the total" "total 50" "$(head -1 "$D/workers")"
check "parallel +1 appends every line" 50 "$(grep -c '^+1$' "$D/workers")"

"$P" -n both 3/9 -t 20
check "options after VALUE are detail text" "3/9 -t 20|" "$(lines both)"
"$P" -n both -t 20 3/9
check "a total with a count comes after it" "3/9|total 20|" "$(lines both)"

"$P" -n detail-words 1/4 cp -p -- file.txt
check "option words after VALUE are detail" "1/4 cp -p -- file.txt|" "$(lines detail-words)"

"$P" -n gone 1/2
"$P" -n gone clear
check "clear removes the file" no "$(exists "$D/gone")"

"$P" 1/2
check "the default name is task" "1/2|" "$(lines task)"

# --- Names

"$P" -n 'a/b/../c' 1/2
check "a slash becomes a dash" "1/2|" "$(lines 'a-b-..-c')"
"$P" -n .hidden 1/2
check "a name cannot start with a dot" "1/2|" "$(lines hidden)"
"$P" -n "$(printf 'line\nbreak')" 1/2
check "a line break becomes a dash" "1/2|" "$(lines line-break)"
long=$(printf 'x%.0s' $(seq 100))
"$P" -n "$long" 1/2
check "a name is cut to 80 characters" yes "$(exists "$D/${long:0:80}")"

# --- Things that never break a script

out=$("$P" -n x 2>&1)
check "nothing to report exits 0" 0 "$?"
check "nothing to report warns" "claude-progress: nothing to report. See claude-progress --help" "$out"
out=$("$P" -n 2>&1)
check "-n with no value warns" "claude-progress: -n needs a value" "$out"

env -u CLAUDE_CODE_SESSION_ID "$P" -n nosession 1/2
check "no session exits 0" 0 "$?"
check "no session writes nothing" no "$(exists "$D/nosession")"

CLAUDE_CODE_SESSION_ID=../escape "$P" -n x 1/2
check "a session ID with a path writes nothing" no "$(exists "$BASE/../escape")"

if [ -z "$IS_WINDOWS" ]; then
  mkdir -p "$BASE/ro-session" && chmod 500 "$BASE/ro-session"
  out=$(CLAUDE_CODE_SESSION_ID=ro-session "$P" -n x 1/2 2>&1)
  check "a write that fails exits 0" 0 "$?"
  # bash 3.2 (macOS) cannot parse a case pattern inside $( ), so this check uses [[ ]].
  check "a write that fails warns" yes "$([[ $out == 'claude-progress: cannot write'* ]] && echo yes || echo no)"
  chmod 700 "$BASE/ro-session"
  check "the session directory is private" 700 "$(stat -c %a "$D" 2>/dev/null || stat -f %Lp "$D")"
fi

# --- Directories

check "--dir prints the progress directory" "$BASE" "$("$P" --dir)"
check "--dir uses ~/.claude without CLAUDE_CONFIG_DIR" "$HOME/.claude/progress" "$(env -u CLAUDE_CONFIG_DIR "$P" --dir)"

# --- Cleanup of old sessions

# The pid of a live process, as Claude Code gives it in CLAUDE_PID: a Windows pid in Git Bash.
if [ -n "$IS_WINDOWS" ]; then LIVE_PID=$(cat /proc/$$/winpid); else LIVE_PID=$$; fi
# stamp DAYS_AGO: prints a touch -t time, on GNU and BSD date.
stamp() {
  local t=$(($(date +%s) - $1 * 86400))
  date -d "@$t" +%Y%m%d%H%M 2>/dev/null || date -r "$t" +%Y%m%d%H%M
}
# session NAME OWNER_JSON DAYS_AGO: makes a session directory with one task, all that old.
session() {
  mkdir -p "$BASE/$1" && echo 1/2 > "$BASE/$1/task"
  if [ -n "$2" ]; then printf '%s' "$2" > "$BASE/$1/.owner"; fi
  # -c: create no file. The directory goes last, because a change inside it moves its time.
  touch -c -t "$(stamp "$3")" "$BASE/$1/"* "$BASE/$1/.owner" "$BASE/$1"
}
sweeps=0
sweep() { sweeps=$((sweeps + 1)); CLAUDE_CODE_SESSION_ID="sweeper-$sweeps" "$P" -n x 1/2; }

CLAUDE_CODE_SESSION_ID=owned CLAUDE_PID=$LIVE_PID "$P" -n x 1/2
check "a new session records its owner" yes "$(grep -q "\"pid\":$LIVE_PID" "$BASE/owned/.owner" && echo yes || echo no)"
touch -c -t "$(stamp 30)" "$BASE/owned/x" "$BASE/owned/.owner" "$BASE/owned"
CLAUDE_CODE_SESSION_ID=no-owner env -u CLAUDE_PID "$P" -n x 1/2
check "with no CLAUDE_PID, a session records no owner" no "$(exists "$BASE/no-owner/.owner")"

session dead-old '{"pid":999999,"procStart":"1"}' 1
session dead-recent '{"pid":999999,"procStart":"1"}' 0
session dead-appended '{"pid":999999,"procStart":"1"}' 1
touch "$BASE/dead-appended/task" # an append changes the file, not the directory
session orphan-recent '' 2
session orphan-old '' 8
[ -z "$IS_WINDOWS" ] && session reused "{\"pid\":$LIVE_PID,\"procStart\":\"123\"}" 1
sweep

check "a session with a live owner stays, however old" yes "$(exists "$BASE/owned")"
check "a dead owner's session goes after 1 hour" no "$(exists "$BASE/dead-old")"
check "a dead owner's session stays within 1 hour" yes "$(exists "$BASE/dead-recent")"
check "a recent append keeps a dead owner's session" yes "$(exists "$BASE/dead-appended")"
check "a session with no owner stays for 7 days" yes "$(exists "$BASE/orphan-recent")"
check "a session with no owner goes after 7 days" no "$(exists "$BASE/orphan-old")"
[ -z "$IS_WINDOWS" ] && check "a reused pid does not keep a session" no "$(exists "$BASE/reused")"

check "no temporary files are left" 0 "$(find "$BASE" -name '.*' ! -name .owner -type f | wc -l | tr -d ' ')"

# --- Help, the shim, and the README

check "no arguments prints the help" yes "$("$P" | grep -q '^Usage:' && echo yes || echo no)"
out=$(env -u CLAUDE_CODE_SESSION_ID PATH=/usr/bin:/bin bash -c ". \"$ROOT/shim.sh\"; claude-progress -n x 1/2; echo \$?")
check "the shim makes the calls do nothing" 0 "$out"
check "the README gives the same shim" yes "$(grep -qF -- "$(grep -v '^#' "$ROOT/shim.sh")" "$ROOT/../../README.md" && echo yes || echo no)"

echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
