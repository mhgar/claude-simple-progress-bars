# Makes the calls do nothing where claude-progress is not installed.
function claude-progress { if ($env:CLAUDE_PROGRESS_PS1) { & $env:CLAUDE_PROGRESS_PS1 @args } }
