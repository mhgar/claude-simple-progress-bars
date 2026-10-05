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
"$P" -n 'win\path' 1/2
check "a backslash becomes a dash" "1/2|" "$(lines 'win-path')"
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

# --- Help, the shims, and USAGE.md

check "no arguments prints the help" yes "$("$P" | grep -q '^Usage:' && echo yes || echo no)"
out=$(env -u CLAUDE_CODE_SESSION_ID PATH=/usr/bin:/bin bash -c ". \"$ROOT/shim.sh\"; claude-progress -n x 1/2; echo \$?")
check "the shim makes the calls do nothing" 0 "$out"
# in_usage FILE: prints yes when USAGE.md holds every line of a shim, the comment aside.
in_usage() {
  local line
  while IFS= read -r line; do
    grep -qF -- "$line" "$ROOT/USAGE.md" || { echo no; return; }
  done < <(grep -v '^#' "$1")
  echo yes
}
for shim in shim.sh shim.ps1 shim.py shim.js shim.mjs; do
  check "USAGE.md gives $shim" yes "$(in_usage "$ROOT/$shim")"
done

# --- The other versions: PowerShell, Python, and Node, where each is installed
#
# Each runs the same calls as the bash command, and must write the same bytes.

PS=$(command -v pwsh || command -v powershell.exe || command -v powershell || true)
PY=$(command -v python3 || command -v python || true)
if [ -n "$PY" ] && ! "$PY" -c 'import sys' 2>/dev/null; then PY=; fi # the Windows store stub
NODE=$(command -v node || true)
# native PATH: the form a Windows program takes. Elsewhere, the path as it is.
native() { if [ -n "$IS_WINDOWS" ]; then cygpath -w "$1"; else printf '%s' "$1"; fi; }

# report IMPL ARGS...: one call through one version, run as a command.
report() {
  local impl=$1; shift
  case $impl in
    sh) "$P" "$@" ;;
    ps) "$PS" -NoProfile -ExecutionPolicy Bypass -File "$(native "$ROOT/bin/claude-progress.ps1")" "$@" ;;
    py) "$PY" "$(native "$ROOT/bin/claude_progress.py")" "$@" ;;
    js) "$NODE" "$(native "$ROOT/bin/claude-progress.js")" "$@" ;;
  esac
}
impls=sh
[ -n "$PS" ] && impls="$impls ps" || echo "skip: no PowerShell, so the PowerShell twin is not tested"
[ -n "$PY" ] && impls="$impls py" || echo "skip: no Python, so the Python twin is not tested"
[ -n "$NODE" ] && impls="$impls js" || echo "skip: no Node, so the Node twin is not tested"
for impl in $impls; do
  export CLAUDE_CODE_SESSION_ID=twin
  export CLAUDE_CONFIG_DIR; CLAUDE_CONFIG_DIR=$(native "$TMP/twin-$impl")
  report $impl -n count 17/240 clip.mkv
  report $impl -n count Scanning disk
  report $impl -n count done
  report $impl -n pct 42% halfway
  report $impl -n failed fail "disk full"
  report $impl -n workers -t 5
  report $impl -n workers +1
  report $impl -n workers +1
  report $impl -n both -t 20 3/9
  report $impl -n 'a\b/c' 1/2
  report $impl -n .hidden 1/2
  report $impl -n gone 1/2
  report $impl -n gone clear
  report $impl 1/2
  report $impl -n words 1/4 cp -p -- file.txt
  report $impl -n ünïcode 1/2 día
done
export CLAUDE_CONFIG_DIR="$TMP/cfg" CLAUDE_CODE_SESSION_ID=test-session
for impl in $impls; do
  [ $impl = sh ] && continue
  check "$impl writes the same files as bash" "" "$(diff -r --exclude=.owner "$TMP/twin-sh/progress/twin" "$TMP/twin-$impl/progress/twin" 2>&1)"
  check "$impl leaves no temporary files" 0 "$(find "$TMP/twin-$impl" -name '.*' ! -name .owner -type f | wc -l | tr -d ' ')"
  out=$(env -u CLAUDE_CODE_SESSION_ID bash -c "$(declare -f report native); P='$P' PS='$PS' PY='$PY' NODE='$NODE' ROOT='$ROOT' TMP='$TMP' IS_WINDOWS='$IS_WINDOWS' report $impl -n $impl-nosession 1/2"; echo "exit $?")
  check "$impl exits 0 with no session" "exit 0" "$(printf '%s' "$out" | tr -d '\r' | tail -1)"
  check "$impl writes nothing with no session" no "$(exists "$D/$impl-nosession")"
done

if [ -n "$PS" ]; then
  out=$(CLAUDE_CODE_SESSION_ID=twin report ps -n x 2>&1; echo "exit $?")
  check "the twin warns when there is nothing to report" "claude-progress: nothing to report. See claude-progress --help|exit 0" "$(printf '%s' "$out" | tr -d '\r' | tr '\n' '|')"
  # The shim, as a .ps1 script uses it: values PowerShell reads as numbers are quoted.
  shim=$(native "$ROOT/shim.ps1"); PS1=$(native "$ROOT/bin/claude-progress.ps1")
  CLAUDE_PROGRESS_PS1=$PS1 "$PS" -NoProfile -ExecutionPolicy Bypass -Command ". '$shim'; claude-progress -n ps-shim 3/4 two words; claude-progress -n ps-shim '+1'"
  check "the PowerShell shim passes every argument" "3/4 two words|+1|" "$(lines ps-shim)"
  out=$(env -u CLAUDE_PROGRESS_PS1 "$PS" -NoProfile -ExecutionPolicy Bypass -Command ". '$shim'; claude-progress -n x 1/2; 'ok'" | tr -d '\r')
  check "the PowerShell shim does nothing without the plugin" ok "$out"
fi

# The shims, as scripts use them: they load the twin from CLAUDE_PROGRESS_DIR, and
# do nothing without it.
BIN=$(native "$ROOT/bin")
# shim_script FILE SHIM CALL: writes a script with the shim, then one call and "ok".
shim_script() { { cat "$ROOT/$2"; printf '%s\n' "$3"; } > "$TMP/$1"; }
if [ -n "$PY" ]; then
  shim_script use.py shim.py 'claude_progress("-n", "py-shim", "2/5", "a.wav"); print("ok")'
  out=$(CLAUDE_PROGRESS_DIR=$BIN "$PY" "$(native "$TMP/use.py")" | tr -d '\r')
  check "the Python shim reports" "ok 2/5 a.wav|" "$out $(lines py-shim)"
  out=$(env -u CLAUDE_PROGRESS_DIR "$PY" "$(native "$TMP/use.py")" 2>&1 | tr -d '\r'; echo "exit ${PIPESTATUS[0]}")
  check "the Python shim does nothing without the plugin" "ok exit 0" "$(printf '%s' "$out" | tr '\n' ' ')"
fi
if [ -n "$NODE" ]; then
  shim_script use.js shim.js 'claudeProgress("-n", "js-shim", "3/5", "b.wav"); console.log("ok")'
  shim_script use.mjs shim.mjs 'claudeProgress("-n", "esm-shim", "4/5", "c.wav"); console.log("ok")'
  for kind in js mjs; do
    name=$([ $kind = js ] && echo js-shim || echo esm-shim)
    CLAUDE_PROGRESS_DIR=$BIN "$NODE" "$(native "$TMP/use.$kind")" | tr -d '\r' >/dev/null
    check "the Node .$kind shim wrote its line" yes "$([ -s "$D/$name" ] && echo yes || echo no)"
    out=$(env -u CLAUDE_PROGRESS_DIR "$NODE" "$(native "$TMP/use.$kind")" 2>&1 | tr -d '\r'; echo "exit ${PIPESTATUS[0]}")
    check "the Node .$kind shim does nothing without the plugin" "ok exit 0" "$(printf '%s' "$out" | tr '\n' ' ')"
  done
  check "the CommonJS shim passes every argument" "3/5 b.wav|" "$(lines js-shim)"
  check "the ES module shim passes every argument" "4/5 c.wav|" "$(lines esm-shim)"
fi

echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
