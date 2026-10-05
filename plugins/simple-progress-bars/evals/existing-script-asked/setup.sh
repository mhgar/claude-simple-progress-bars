#!/usr/bin/env bash
# The user's own script: copies every photo to a NAS, one file at a time.
cat > backup.sh <<'SH'
#!/usr/bin/env bash
# Copies every photo in ~/Pictures to the NAS.
for f in $(ls ~/Pictures/*.jpg); do
  scp $f nas:/backup/photos/
done
SH
chmod +x backup.sh
