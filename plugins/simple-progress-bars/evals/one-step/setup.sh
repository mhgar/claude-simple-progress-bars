#!/usr/bin/env bash
# A build that takes about 4 seconds and prints no progress of its own.
cat > build.sh <<'EOF'
#!/usr/bin/env bash
sleep 4
echo "Build OK"
EOF
chmod +x build.sh
