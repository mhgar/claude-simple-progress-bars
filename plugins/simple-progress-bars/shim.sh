# Lets a bash script run where claude-progress is not installed: direct reports
# do nothing, pipe modes pass their input through, and "-- COMMAND" runs COMMAND.
command -v claude-progress >/dev/null || claude-progress() {
  local pipe=
  while [ $# -gt 0 ]; do
    case $1 in
      -n | --name | -t | --total) shift; [ $# -gt 0 ] && shift ;;
      -l | --lines | -b | --bytes | -p | --parse) pipe=1; shift ;;
      --) shift; "$@"; return ;;
      *) [ -z "$pipe" ] && return 0; shift ;; # VALUE ends a direct report. In a pipe mode, detail text.
    esac
  done
  if [ -n "$pipe" ]; then cat; fi
}
