#!/usr/bin/env bash
# A stand-in for ssh, and a render on the "server" that prints its own progress lines.
cat > ssh <<'SH'
#!/usr/bin/env bash
# Works like ssh HOST COMMAND, but runs COMMAND in this folder, as if on the server.
while [ "${1#-}" != "$1" ]; do case $1 in -o | -p | -i | -l) shift 2 ;; *) shift ;; esac; done
shift # the host
exec bash -c "$*"
SH
chmod +x ssh
cat > render.sh <<'SH'
#!/usr/bin/env bash
for i in $(seq 1 40); do echo "frame $i of 40"; sleep 0.7; done
echo "render complete"
SH
chmod +x render.sh
