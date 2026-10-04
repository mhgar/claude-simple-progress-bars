# Makes the calls do nothing where claude-progress is not installed.
command -v claude-progress >/dev/null || claude-progress() { :; }
