#!/usr/bin/env bash
# claude-progress: report the progress of a task to the Simple Progress Bars plugin.
#
# Each call writes a line to <dir>/<session id>/<task name>. The plugin reads the
# lines in order. A new count or percent replaces the file, and every other report
# appends a line, so the command needs no lock. The plugin gives Claude this file's path:
#   bash "<plugin>/scripts/claude-progress.sh" -n convert "$i/$n" "$file"

usage() {
  cat <<'EOF'
claude-progress: report the progress of a task to the Claude Code progress bars.

Usage:
  claude-progress [-n NAME] [-t TOTAL] VALUE [DETAIL...]
  claude-progress -n NAME -t TOTAL

Options come first. The first other word is VALUE, and every word after it is
DETAIL text.

VALUE forms:
  17/240          17 of 240 done. Sizes work too: 1.5G/4G, 300MiB/2GiB
  42%             percent done
  +1, +5, +512M   add to the count. Safe from parallel workers
  Scanning disk   text with no number. The count and the total stay
  done [MSG]      the task is complete
  fail [MSG]      the task failed
  clear           remove the task now

Options:
  -n NAME     task name. Default: task
  -t TOTAL    set the total. Alone, it starts the task at 0
  --dir       print the progress directory, then exit
  -h, --help  show this reference

The command reports nothing outside a Claude Code session, and it never fails
a script: it always exits 0. Each call starts a process, so report at most
about once a second.

Files: <dir>/<session id>/<name>, where <dir> is $CLAUDE_CONFIG_DIR/progress,
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
    # The newest entry counts: an append changes a file, not its directory.
    [ -z "$(find "$d" -mmin "-$minutes" -print 2>/dev/null | head -n 1)" ] && rm -rf "$d"
  done
}

base="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/progress"

case ${1-} in
  '' | -h | --help) usage; exit 0 ;;
  --dir) printf '%s\n' "$base"; exit 0 ;;
esac

name=task
total=
while [ $# -gt 0 ]; do
  case $1 in
    -n | --name | -t | --total)
      if [ $# -lt 2 ]; then warn "$1 needs a value"; exit 0; fi
      case $1 in -n | --name) name=$2 ;; *) total=$2 ;; esac
      shift 2 ;;
    *) break ;;
  esac
done

session=${CLAUDE_CODE_SESSION_ID-}
# A session ID is a plain name. Anything else reports nothing.
case $session in '' | *[!A-Za-z0-9_-]*) exit 0 ;; esac
if [ $# -eq 0 ] && [ -z "$total" ]; then warn 'nothing to report. See claude-progress --help'; exit 0; fi

# A task name is a file name: no path, no line break, and no leading dot.
name=${name//[\/\\$'\n'$'\r']/-}
while [ "${name#.}" != "$name" ]; do name=${name#.}; done
name=${name:0:80}
[ -n "$name" ] || name=task

dir="$base/$session"
if [ ! -d "$dir" ]; then
  (umask 077 && mkdir -p "$dir") 2>/dev/null || { warn "cannot create $dir"; exit 0; }
  if [ -n "${CLAUDE_PID-}" ]; then
    printf '{"pid":%s,"procStart":"%s"}\n' "$CLAUDE_PID" "$(proc_start "$CLAUDE_PID")" > "$dir/.owner" 2>/dev/null
  fi
  sweep # A new session also removes what old sessions left.
fi
file="$dir/$name"

value=${1-}
[ $# -gt 0 ] && shift
line=$value${*:+ $*}

out=
if [ -n "$value" ]; then out="$line"$'\n'; fi
if [ -n "$total" ]; then out+="total $total"$'\n'; fi

case $value in
  clear) rm -f "$file"; exit 0 ;;
  # A new count or percent, or a total alone, starts the file again. The plugin skips
  # dot files, so it never sees the temporary file before the rename.
  [0-9]*/[0-9]* | [0-9]*% | '')
    tmp="$dir/.$name.$$"
    { printf '%s' "$out" > "$tmp" && mv -f "$tmp" "$file"; } 2>/dev/null || { rm -f "$tmp"; warn "cannot write $file"; } ;;
  # Every other report appends. One small append is one write, so parallel workers need no lock.
  *) printf '%s' "$out" >> "$file" 2>/dev/null || warn "cannot write $file" ;;
esac
exit 0
