#!/usr/bin/env bash
# Eight test scripts that take about a second each and print nothing until they end. One of them fails.
mkdir -p tests
for i in 1 2 3 4 5 6 7 8; do
  printf '#!/usr/bin/env bash\nsleep 1\n' > "tests/test_$i.sh"
  if [ "$i" = 5 ]; then echo 'echo "expected 4, got 5"; exit 1' >> "tests/test_$i.sh"; else echo 'echo ok' >> "tests/test_$i.sh"; fi
  chmod +x "tests/test_$i.sh"
done
