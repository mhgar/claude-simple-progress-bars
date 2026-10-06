#!/usr/bin/env bash
# A fetch tool that takes about 3 seconds per document, and a list of 4 documents.
cat > fetch.sh <<'EOF'
#!/usr/bin/env bash
sleep 3
mkdir -p papers
name=$(basename "$1")
seq 1 $((RANDOM % 4000 + 1000)) | sed 's/^/word /' > "papers/$name.txt"
echo "Saved: papers/$name.txt"
EOF
chmod +x fetch.sh
printf '%s\n' https://example.org/papers/dendry https://example.org/papers/tzathas https://example.org/papers/grenier https://example.org/papers/cordonnier > papers.txt
