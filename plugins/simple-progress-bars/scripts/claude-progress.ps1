# claude-progress.ps1: report the progress of a task to the Simple Progress Bars plugin.
#
# The PowerShell twin of bin/claude-progress. It writes the same lines to the same
# files, <dir>/<session id>/<task name>, and follows the same rules: a new count or
# percent replaces the file, and every other report appends a line, so the command
# needs no lock. The plugin sets CLAUDE_PROGRESS_PS1 to this file's path:
#   & $env:CLAUDE_PROGRESS_PS1 -n convert "$i/$n" $file

function Show-Usage {
  @'
claude-progress: report the progress of a task to the Claude Code progress bars.

Usage:
  & $env:CLAUDE_PROGRESS_PS1 [-n NAME] [-t TOTAL] VALUE [DETAIL...]
  & $env:CLAUDE_PROGRESS_PS1 -n NAME -t TOTAL

Options come first. The first other word is VALUE, and every word after it is
DETAIL text. Quote a VALUE that PowerShell would read as a number, such as '+1'.

VALUE forms:
  17/240          17 of 240 done. Sizes work too: 1.5G/4G, 300MiB/2GiB
  42%             percent done
  +1, +5, +512M   add to the count. Safe from parallel workers
  Scanning disk   text with no number. The count and the total stay
  done [MSG]      the task is complete
  fail [MSG]      the task failed
  clear           remove the task now

Options:
  -n NAME     task name. Default: task
  -t TOTAL    set the total. Alone, it starts the task at 0
  --dir       print the progress directory, then exit
  -h, --help  show this reference

The command reports nothing outside a Claude Code session, and it never fails
a script: it always exits 0.

Files: <dir>/<session id>/<name>, where <dir> is $env:CLAUDE_CONFIG_DIR/progress,
or ~/.claude/progress. A session directory stays while its Claude Code process
runs. After that it goes 1 hour after its last write.
'@
}

function Write-Warn([string]$Message) { [Console]::Error.WriteLine("claude-progress: $Message") }

# Prints alive, dead, or unknown for the Claude Code process that owns a session directory.
function Get-OwnerState([string]$Dir) {
  $record = Join-Path $Dir '.owner'
  if (-not (Test-Path -LiteralPath $record)) { return 'unknown' }
  $match = [regex]::Match([IO.File]::ReadAllText($record), '"pid":(\d+)')
  if (-not $match.Success) { return 'unknown' }
  if (Get-Process -Id ([int]$match.Groups[1].Value) -ErrorAction SilentlyContinue) { return 'alive' }
  return 'dead'
}

# Removes the session directories of other sessions that are over. A directory stays
# while its owner runs. With a dead owner it goes 1 hour after its newest write, and
# with no owner record 7 days after it.
function Invoke-Sweep([string]$Base, [string]$Own) {
  foreach ($d in Get-ChildItem -LiteralPath $Base -Directory -Force -ErrorAction SilentlyContinue) {
    if ($d.FullName -eq $Own) { continue }
    $state = Get-OwnerState $d.FullName
    if ($state -eq 'alive') { continue }
    $minutes = if ($state -eq 'dead') { 60 } else { 10080 }
    # The newest entry counts: an append changes a file, not its directory.
    $times = @($d.LastWriteTime) + @(Get-ChildItem -LiteralPath $d.FullName -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.LastWriteTime })
    $newest = ($times | Measure-Object -Maximum).Maximum
    if ($newest -lt (Get-Date).AddMinutes(-$minutes)) {
      Remove-Item -LiteralPath $d.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

try {
  $configDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
  $base = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath((Join-Path $configDir 'progress'))

  $words = @($args | ForEach-Object { [string]$_ })
  if ($words.Count -eq 0 -or $words[0] -ceq '-h' -or $words[0] -ceq '--help') { Show-Usage; exit 0 }
  if ($words[0] -ceq '--dir') { $base; exit 0 }

  $name = 'task'
  $total = ''
  $i = 0
  while ($i -lt $words.Count -and $words[$i] -cin '-n', '--name', '-t', '--total') {
    if ($i + 1 -ge $words.Count) { Write-Warn "$($words[$i]) needs a value"; exit 0 }
    if ($words[$i] -cin '-n', '--name') { $name = $words[$i + 1] } else { $total = $words[$i + 1] }
    $i += 2
  }
  $rest = @($words | Select-Object -Skip $i)

  # A session ID is a plain name. Anything else reports nothing.
  $session = [string]$env:CLAUDE_CODE_SESSION_ID
  if ($session -notmatch '^[A-Za-z0-9_-]+$') { exit 0 }
  if ($rest.Count -eq 0 -and -not $total) { Write-Warn 'nothing to report. See claude-progress --help'; exit 0 }

  # A task name is a file name: no path, no line break, and no leading dot.
  $name = ($name -replace '[/\\\r\n]', '-').TrimStart('.')
  if ($name.Length -gt 80) { $name = $name.Substring(0, 80) }
  if (-not $name) { $name = 'task' }

  $dir = Join-Path $base $session
  if (-not (Test-Path -LiteralPath $dir)) {
    try { New-Item -ItemType Directory -Force -Path $dir | Out-Null } catch { Write-Warn "cannot create $dir"; exit 0 }
    if ($env:CLAUDE_PID -match '^\d+$') {
      $utf8 = New-Object Text.UTF8Encoding $false
      try { [IO.File]::WriteAllText((Join-Path $dir '.owner'), "{`"pid`":$($env:CLAUDE_PID),`"procStart`":`"`"}`n", $utf8) } catch { }
    }
    try { Invoke-Sweep $base $dir } catch { } # A new session also removes what old sessions left.
  }
  $file = Join-Path $dir $name

  $value = if ($rest.Count -gt 0) { $rest[0] } else { '' }
  $line = if ($rest.Count -gt 1) { "$value $(@($rest | Select-Object -Skip 1) -join ' ')" } else { $value }
  $out = ''
  if ($value) { $out += "$line`n" }
  if ($total) { $out += "total $total`n" }

  $utf8 = New-Object Text.UTF8Encoding $false
  if ($value -ceq 'clear') {
    Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
  } elseif ($value -match '^[0-9].*/[0-9]' -or $value -match '^[0-9].*%$' -or $value -eq '') {
    # A new count or percent, or a total alone, starts the file again. The plugin skips
    # dot files, so it never sees the temporary file before the rename.
    $tmp = Join-Path $dir ".$name.$PID"
    try {
      [IO.File]::WriteAllText($tmp, $out, $utf8)
      Move-Item -LiteralPath $tmp -Destination $file -Force
    } catch {
      Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
      Write-Warn "cannot write $file"
    }
  } else {
    # Every other report appends. One small append is one write, so parallel workers need no lock.
    try { [IO.File]::AppendAllText($file, $out, $utf8) } catch { Write-Warn "cannot write $file" }
  }
} catch {
  Write-Warn "$_"
}
exit 0
