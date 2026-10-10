#!/usr/bin/env bash
# A stand-in for ssh, and the log of a detached render on the "server" that is at frame 25 of 40.
cat > ssh <<'SH'
#!/usr/bin/env bash
# Works like ssh HOST COMMAND, but runs COMMAND in this folder, as if on the server.
while [ "${1#-}" != "$1" ]; do case $1 in -o | -p | -i | -l) shift 2 ;; *) shift ;; esac; done
shift # the host
exec bash -c "$*"
SH
chmod +x ssh
{
  echo "render started"
  for i in $(seq 1 25); do echo "[progress] $i/40 frame_$i.exr"; done
} > render.log
