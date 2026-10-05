#!/usr/bin/env bash
# 120 input files, and a per-file job that takes about a quarter of a second.
mkdir -p data
for i in $(seq -w 1 120); do printf 'record %s\n' "$i" > "data/item_$i.txt"; done
cat > process.sh <<'SH'
#!/usr/bin/env bash
sleep 0.25
sha256sum "$1"
SH
chmod +x process.sh
cat > run-all.sh <<'SH'
#!/usr/bin/env bash
# The user's own script: checksums every file in data/.
for f in data/*; do ./process.sh "$f"; done > checksums.txt
SH
chmod +x run-all.sh
