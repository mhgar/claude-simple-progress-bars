#!/usr/bin/env bash
# 12 input files, and a per-file job that takes about a quarter of a second.
mkdir -p data
for i in $(seq -w 1 12); do printf 'record %s\n' "$i" > "data/item_$i.txt"; done
cat > process.sh <<'SH'
#!/usr/bin/env bash
sleep 0.25
sha256sum "$1"
SH
chmod +x process.sh
