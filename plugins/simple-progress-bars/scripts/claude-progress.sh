#!/usr/bin/env bash
# claude-progress: run a command, and show its [progress] lines as Claude Code progress bars.
#
# The wrapper reads the output of COMMAND. A line that starts with [progress] or
# [progress:NAME] updates a task and never reaches the output. The wrapper holds the
# tasks in memory, and rewrites one run file, <dir>/<session id>/<pid>-<start>, after
# a tag, at most every 0.2 seconds, and at least every 5 seconds. The plugin reads that
# file. The plugin gives Claude this file's path:
#   bash "<plugin>/scripts/claude-progress.sh" -n render ./render.sh

usage() {
  cat <<'EOF'
claude-progress: run a command, and show its progress in Claude Code.

Usage:
  claude-progress [-n NAME] [--] COMMAND [ARGS...]

COMMAND prints tag lines to show progress. A tag starts the line:
  [progress] VALUE [DETAIL]          the root task of the run, named NAME
  [progress:SUB] VALUE [DETAIL]      the subtask SUB of the root task

VALUE forms:
  17/240          17 of 240 done. Sizes work too: 1.5G/4G, 300MiB/2GiB
  42%             percent done
  +1, +5, +512M   add to the count
  total 500       set the total
  Scanning disk   text with no number. The count and the total stay
  done [MSG]      the task is complete
  fail [MSG]      the task failed
  clear           remove the task now

Tag lines never reach the output. Every other line does. Flush the output after
each tag. End each task with done or fail. A tag after an end starts a new task.
When COMMAND exits, a task that is still running ends: done after exit status 0,
else fail. The wrapper exits with the exit status of COMMAND.

Options:
  -n NAME     name of the root task. Default: the file name of COMMAND
  --dir       print the progress directory, then exit
  -h, --help  show this reference

Outside a Claude Code session, the wrapper runs COMMAND and changes nothing.
Files: <dir>/<session id>/<pid>-<start>, where <dir> is $CLAUDE_CONFIG_DIR/progress,
or ~/.claude/progress. A session directory stays while its Claude Code process
runs. After that it goes 1 hour after its last write.
EOF
}

warn() { printf 'claude-progress: %s\n' "$1" >&2; }

# --- Session owners ---------------------------------------------------------
# Each session directory has a dot file .owner with the pid and the start time
# of its Claude Code process, as Claude Code keeps in ~/.claude/sessions. The
# start time tells a live owner from a new process that got the same pid.

is_windows() { case $(uname -s) in MINGW* | MSYS* | CYGWIN*) return 0 ;; esac; return 1; }

# proc_start PID: prints the start time of a process, or nothing where it is unknown.
proc_start() {
  if [ -r "/proc/$1/stat" ] && ! is_windows; then
    local stat fields
    stat=$(cat "/proc/$1/stat" 2>/dev/null) || return 0
    # Field 22. The process name (field 2) can hold spaces, so count from after its ")".
    read -ra fields <<< "${stat##*) }"
    printf '%s' "${fields[19]-}"
  elif ! is_windows; then
    ps -o lstart= -p "$1" 2>/dev/null | tr -s ' '
  fi
}

# owner_state DIR: prints alive, dead, or unknown for the owner of a session directory.
owner_state() {
  local record pid start now
  record=$(cat "$1/.owner" 2>/dev/null) || { echo unknown; return; }
  pid=$(printf '%s' "$record" | sed -n 's/.*"pid":\([0-9][0-9]*\).*/\1/p')
  start=$(printf '%s' "$record" | sed -n 's/.*"procStart":"\([^"]*\)".*/\1/p')
  [ -n "$pid" ] || { echo unknown; return; }
  if is_windows; then
    # Git Bash kill knows only its own pids. CLAUDE_PID is a Windows pid.
    command -v tasklist >/dev/null || { echo unknown; return; }
    case " $(tasklist //FI "PID eq $pid" //NH 2>/dev/null | tr -s ' ') " in
      *" $pid "*) echo alive ;;
      *) echo dead ;;
    esac
    return
  fi
  case $(kill -0 "$pid" 2>&1) in
    '' | *[Pp]ermitted*) ;; # A process of another user is alive too.
    *) echo dead; return ;;
  esac
  now=$(proc_start "$pid")
  if [ -n "$start" ] && [ -n "$now" ] && [ "$start" != "$now" ]; then echo dead; else echo alive; fi
}

# sweep: removes the session directories of other sessions that are over. A directory
# stays while its owner runs. With a dead owner it goes 1 hour after its newest write,
# and with no owner record 7 days after it.
sweep() {
  local d minutes
  for d in "$base"/*/; do
    [ -d "$d" ] && [ "${d%/}" != "$dir" ] || continue
    case $(owner_state "${d%/}") in
      alive) continue ;;
      dead) minutes=60 ;;
      *) minutes=10080 ;;
    esac
    # The newest entry counts: a write changes a file, not its directory.
    [ -z "$(find "$d" -mmin "-$minutes" -print 2>/dev/null | head -n 1)" ] && rm -rf "$d"
  done
}

# --- Arguments ---------------------------------------------------------------

base="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/progress"

case ${1-} in
  '' | -h | --help) usage; exit 0 ;;
  --dir) printf '%s\n' "$base"; exit 0 ;;
esac

root_name=
while [ $# -gt 0 ]; do
  case $1 in
    -n | --name)
      if [ $# -lt 2 ]; then warn "$1 needs a value"; exit 2; fi
      root_name=$2
      shift 2 ;;
    --) shift; break ;;
    *) break ;;
  esac
done
if [ $# -eq 0 ]; then warn 'no command to run. See claude-progress --help'; exit 2; fi

# Python holds its output in a buffer when it writes to a pipe. This goes to COMMAND only.
export PYTHONUNBUFFERED=1

session=${CLAUDE_CODE_SESSION_ID-}
# A session ID is a plain name. Outside a session, the command runs as it is.
case $session in '' | *[!A-Za-z0-9_-]*) exec "$@" ;; esac

if [ -z "$root_name" ]; then
  root_name=${1##*/}
  root_name=${root_name##*\\}
  [ "${root_name%.*}" = "" ] || root_name=${root_name%.*}
fi
root_name=${root_name//[$'\r\n']/ }
root_name=${root_name:0:80}

# --- Tasks -------------------------------------------------------------------
# Task i has a name, a root (- for a root task, or the root's ID), a state (run, done,
# fail, stopped, or gone), and the report lines that make its current state. Bash 3.2
# has no associative arrays, so each field is an indexed array.

T_NAME=() T_ROOT=() T_STATE=() T_COUNT=() T_TOTAL=() T_SUM=() T_XADD=() T_DETAIL=() T_END=() T_ENDAT=()
tasks=0  # the highest task ID
root=0   # the ID of the current root task, or 0
t=0      # the task that the current tag updates

NUM='[0-9]{1,15}(,[0-9]{3})*(\.[0-9]{1,6})?'
SIZE_RE="^${NUM}([KMGTP]i?B?|kB|B)?\$"
PCT_RE='^[0-9]{1,3}(\.[0-9]{1,6})?%$'
INT_RE='^[0-9]{1,15}$'

new_task() { # ROOT NAME: starts a task, and sets t to it
  tasks=$((tasks + 1))
  t=$tasks
  T_ROOT[t]=$1 T_NAME[t]=$2 T_STATE[t]=run T_COUNT[t]='' T_TOTAL[t]='' T_SUM[t]=0 T_XADD[t]='' T_DETAIL[t]='' T_END[t]='' T_ENDAT[t]=0
}

use_root() { # sets t to the running root task, and starts one where none runs
  if [ "$root" -eq 0 ] || [ "${T_STATE[root]}" != run ]; then
    new_task - "$root_name"
    root=$t
  fi
  t=$root
}

use_sub() { # NAME: sets t to the running subtask NAME of the root, and starts one where none runs
  local i
  use_root
  for ((i = tasks; i > root; i--)); do
    if [ "${T_ROOT[i]}" = "$root" ] && [ "${T_STATE[i]}" = run ] && [ "${T_NAME[i]}" = "$1" ]; then t=$i; return; fi
  done
  new_task "$root" "$1"
}

end_task() { # ID STATE LINE: ends a task. A root ends its running subtasks with the same state.
  local i
  T_STATE[$1]=$2 T_END[$1]=$3 T_ENDAT[$1]=$SECONDS
  [ "${T_ROOT[$1]}" = - ] || return 0
  for ((i = $1 + 1; i <= tasks; i++)); do
    if [ "${T_ROOT[i]}" = "$1" ] && [ "${T_STATE[i]}" = run ]; then
      T_STATE[i]=$2 T_END[i]=$2 T_ENDAT[i]=$SECONDS
    fi
  done
}

clear_task() { # ID: removes a task, and on a root also its subtasks
  local i
  T_STATE[$1]=gone
  [ "${T_ROOT[$1]}" = - ] || return 0
  for ((i = $1 + 1; i <= tasks; i++)); do [ "${T_ROOT[i]}" = "$1" ] && T_STATE[i]=gone; done
}

is_size() { [[ $1 =~ $SIZE_RE ]]; }
# has_amount TEXT: true when a size is more than 0. Units hold no digits.
has_amount() { [[ $1 =~ [1-9] ]]; }

is_count() { # WORD: N/M with sizes and M above 0, as the plugin reads it
  local left=${1%%/*} right=${1#*/}
  [ "$left" != "$1" ] && is_size "$left" && is_size "$right" && has_amount "$right"
}

is_percent() { # WORD: N% from 0 to 100
  [[ $1 =~ $PCT_RE ]] || return 1
  local n=${1%\%} whole frac
  whole=${n%%.*} frac=${n#"$whole"}
  [ $((10#$whole)) -lt 100 ] || { [ $((10#$whole)) -eq 100 ] && [[ $frac =~ ^(\.0*)?$ ]]; }
}

apply_value() { # VALUE: applies one tag value to task t, the way the plugin folds it
  local line=$1 word rest
  word=${line%% *}
  rest=${line#"$word"}
  rest=${rest# }
  case $word in
    [Dd][Oo][Nn][Ee]) end_task "$t" 'done' "$line"; return ;;
    [Ff][Aa][Ii][Ll] | [Ff][Aa][Ii][Ll][Ee][Dd]) end_task "$t" fail "$line"; return ;;
    [Cc][Ll][Ee][Aa][Rr]) clear_task "$t"; [ "$t" = "$root" ] && root=0; return ;;
  esac
  if is_count "$word" || is_percent "$word"; then
    # A new count replaces the count, the total, the adds, and the detail before it.
    T_COUNT[t]=$line T_TOTAL[t]='' T_SUM[t]=0 T_XADD[t]='' T_DETAIL[t]=''
  elif [ "${word#+}" != "$word" ] && is_size "${word#+}"; then
    if [[ ${word#+} =~ $INT_RE ]]; then
      T_SUM[t]=$((T_SUM[t] + 10#${word#+}))
    else
      T_XADD[t]+="[$t] $word"$'\n' # bash cannot add decimals or units
    fi
    [ -z "$rest" ] || T_DETAIL[t]=$rest
  elif case $word in [Tt][Oo][Tt][Aa][Ll]) true ;; *) false ;; esac && is_size "$rest" && has_amount "$rest"; then
    T_TOTAL[t]="total $rest"
  else
    T_DETAIL[t]=$line # text, also "stopped": only the wrapper ends a task as stopped
  fi
}

# tag LINE: sets tag_name (empty for the root) and tag_value. False for a line that is no tag.
tag() {
  local after
  case $1 in
    '[progress] '*) tag_name='' tag_value=${1#'[progress] '} ;;
    '[progress:'*) after=${1#'[progress:'}
      [ "${after#*]}" != "$after" ] || return 1
      tag_name=${after%%]*}
      after=${after#*]}
      [ "${after# }" != "$after" ] || return 1
      tag_value=${after# } ;;
    *) return 1 ;;
  esac
  tag_value=${tag_value#"${tag_value%%[! ]*}"}
  tag_name=${tag_name:0:80}
  [ -n "$tag_value" ]
}

# --- The run file --------------------------------------------------------------

file=
no_file=
last_write=0
# The plugin reads run files 4 times a second, so more writes only slow COMMAND down.
write_ms=200
last_ms=-1000000
dirty=

now_ms() { # sets now to a clock in milliseconds, with no new process. Bash 3 counts whole seconds.
  if [ -n "${EPOCHREALTIME-}" ]; then
    now=${EPOCHREALTIME//[!0-9]/}
    now=${now:0:${#now}-3}
  else
    now=$((SECONDS * 1000))
  fi
}

open_file() { # creates the session directory and names the run file, at the first tag
  [ -z "$file" ] && [ -z "$no_file" ] || return 0
  dir="$base/$session"
  if [ ! -d "$dir" ]; then
    if ! (umask 077 && mkdir -p "$dir") 2>/dev/null; then warn "cannot create $dir"; no_file=1; return 0; fi
    if [ -n "${CLAUDE_PID-}" ]; then
      printf '{"pid":%s,"procStart":"%s"}\n' "$CLAUDE_PID" "$(proc_start "$CLAUDE_PID")" > "$dir/.owner" 2>/dev/null
    fi
    sweep # A new session also removes what old sessions left.
  fi
  file="$dir/$$-$(date +%s)"
}

write_file() { # rewrites the whole run file from memory, with no new process
  [ -n "$file" ] || return 0
  local out='' i
  for ((i = 1; i <= tasks; i++)); do
    case ${T_STATE[i]} in
      gone) continue ;;
      # An ended task leaves the file after the longest hold time of the plugin.
      'done' | fail | stopped) if ((SECONDS - T_ENDAT[i] >= 15)); then T_STATE[i]=gone; continue; fi ;;
    esac
    out+="task $i ${T_ROOT[i]} ${T_NAME[i]}"$'\n'
    [ -z "${T_COUNT[i]}" ] || out+="[$i] ${T_COUNT[i]}"$'\n'
    [ -z "${T_TOTAL[i]}" ] || out+="[$i] ${T_TOTAL[i]}"$'\n'
    [ "${T_SUM[i]}" = 0 ] || out+="[$i] +${T_SUM[i]}"$'\n'
    out+=${T_XADD[i]}
    # +0 adds nothing, so a detail such as "3/8 files" never reads as a count.
    [ -z "${T_DETAIL[i]}" ] || out+="[$i] +0 ${T_DETAIL[i]}"$'\n'
    [ -z "${T_END[i]}" ] || out+="[$i] ${T_END[i]}"$'\n'
  done
  # The plugin uses a read only when it ends with this line, so a half-written file never counts.
  out+=end$'\n'
  if ! printf '%s' "$out" 2>/dev/null > "$file"; then
    [ -n "$no_file" ] || warn "cannot write $file"
    no_file=1 file=
  fi
  last_write=$SECONDS
  dirty=
  now_ms
  last_ms=$now
}

finish() { # LINE STATE: ends each running task, and writes the file
  local i
  for ((i = 1; i <= tasks; i++)); do
    [ "${T_STATE[i]}" = run ] && T_STATE[i]=$2 T_END[i]=$1 T_ENDAT[i]=$SECONDS
  done
  write_file
}

# --- Run ---------------------------------------------------------------------

token="claude-progress-$$-$RANDOM$RANDOM"
child=
signal_status=
finished=

# prefix MARK LAST: copies lines with MARK first. A last line with no line end gets
# the mark LAST, so the wrapper writes it back with no line end.
prefix() {
  local l
  while IFS= read -r l; do printf '%s%s\n' "$1" "$l"; done
  [ -z "$l" ] || printf '%s%s\n' "$2" "$l"
}

# launch COMMAND...: runs the command, and writes both of its streams to one pipe.
# Lines of standard output start with o, and lines of standard error with e. The
# process ID and the exit status go through the same pipe, after the token. The
# pipe closes after the last line of both streams.
launch() {
  exec 4>&1
  {
    {
      "$@" <&5 2>&1 1>&3 3>&- 4>&- 5<&- &
      printf '%s pid %s\n' "$token" "$!" >&4
      wait "$!"
      printf '%s exit %s\n' "$token" "$?" >&4
    } | prefix e E >&4
  } 3>&1 | prefix o O
}

# shellcheck disable=SC2329 # run by a trap
on_signal() { # NAME NUMBER: sends the signal to the command, and waits for it to exit
  signal_status=$((128 + $2))
  [ -z "$child" ] || kill -s "$1" "$child" 2>/dev/null
}

# shellcheck disable=SC2329 # run by a trap
on_exit() { # any exit before the end of the run ends the running tasks as stopped
  [ -n "$finished" ] || finish stopped stopped
}

if ! command -v -- "$1" >/dev/null; then warn "$1: command not found"; exit 127; fi

exec 5<&0
exec 6< <(launch "$@")
# Set after the launch, so that COMMAND does not inherit the ignored signal.
trap '' PIPE
trap 'on_signal INT 2' INT
trap 'on_signal TERM 15' TERM
trap 'on_signal HUP 1' HUP
trap 'on_signal QUIT 3' QUIT
trap on_exit EXIT

status=
last=
held=
# Bash 3 reads whole seconds only.
wait_s=1
((BASH_VERSINFO[0] < 4)) || wait_s=0.2
while :; do
  read_at=$SECONDS
  if IFS= read -r -t "$wait_s" line <&6; then
    line=$held$line held=
    case $line in
      "$token pid "*) child=${line#"$token pid "} ;;
      "$token exit "*) status=${line#"$token exit "} ;;
      [oeOE]*)
        text=${line:1}
        if tag "${text%$'\r'}"; then
          open_file
          if [ -z "$tag_name" ]; then use_root; else use_sub "$tag_name"; fi
          apply_value "$tag_value"
          dirty=1
        else
          case ${line:0:1} in
            o) printf '%s\n' "$text" 2>/dev/null ;;
            e) printf '%s\n' "$text" >&2 2>/dev/null ;;
            O) printf '%s' "$text" 2>/dev/null ;;
            E) printf '%s' "$text" >&2 2>/dev/null ;;
          esac
          [ -z "${text%$'\r'}" ] || last=${text%$'\r'}
        fi ;;
    esac
  else
    # Above 128: a timeout or a signal. Bash 3 returns 1 also for a timeout, but a
    # timeout takes 1 s. So 1 in the same second is the end: the pipe closed.
    if [ $? -le 128 ] && { ((BASH_VERSINFO[0] >= 4)) || ((SECONDS == read_at)); }; then break; fi
    held+=$line # a timeout keeps the part of a line that it read
  fi
  if [ -n "$dirty" ]; then
    now_ms
    ((now - last_ms < write_ms)) || write_file
  fi
  if [ -n "$file" ] && ((SECONDS - last_write >= 5)); then write_file; fi
done

if [ -n "$signal_status" ]; then
  finish stopped stopped
  finished=1
  exit "$signal_status"
fi
status=${status:-1}
if [ "$status" -eq 0 ]; then
  finish 'done' 'done'
else
  finish "fail exit $status${last:+: ${last:0:200}}" fail
fi
finished=1
exit "$status"
