# claude-progress.ps1: run a command, and show its [progress] lines as Claude Code progress bars.
#
# The PowerShell twin of scripts/claude-progress.sh. It takes the same arguments, follows
# the same rules, and writes the same run file, <dir>/<session id>/<pid>-<start>. The
# plugin gives Claude this file's path:
#   & "<plugin>/scripts/claude-progress.ps1" -n render ./render.ps1

function Show-Usage {
  @'
claude-progress: run a command, and show its progress in Claude Code.

Usage:
  & claude-progress.ps1 [-n NAME] [--] COMMAND [ARGS...]

COMMAND prints tag lines to show progress. A tag starts the line:
  [progress] VALUE [DETAIL]          the root task of the run, named NAME
  [progress:SUB] VALUE [DETAIL]      the subtask SUB of the root task

VALUE forms:
  17/240          17 of 240 done. Sizes work too: 1.5G/4G, 300MiB/2GiB
  42%             percent done
  +1, +5, +512M   add to the count
  total 500       set the total
  Scanning disk   text with no number. The count and the total stay
  done [MSG]      the task is complete
  fail [MSG]      the task failed
  clear           remove the task now

Tag lines never reach the output. Every other line does. Flush the output after
each tag. End each task with done or fail. A tag after an end starts a new task.
When COMMAND exits, a task that is still running ends: done after exit status 0,
else fail. The wrapper exits with the exit status of COMMAND.

Options:
  -n NAME     name of the root task. Default: the file name of COMMAND
  --dir       print the progress directory, then exit
  -h, --help  show this reference

Outside a Claude Code session, the wrapper runs COMMAND and changes nothing.
Files: <dir>/<session id>/<pid>-<start>, where <dir> is $env:CLAUDE_CONFIG_DIR/progress,
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
    # The newest entry counts: a write changes a file, not its directory.
    $times = @($d.LastWriteTime) + @(Get-ChildItem -LiteralPath $d.FullName -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object { $_.LastWriteTime })
    $newest = ($times | Measure-Object -Maximum).Maximum
    if ($newest -lt (Get-Date).AddMinutes(-$minutes)) {
      Remove-Item -LiteralPath $d.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

# Quotes one argument for a Windows command line, by the rules that programs use to split it.
function ConvertTo-Argument([string]$Arg) {
  if ($Arg -ne '' -and $Arg -notmatch '[\s"]') { return $Arg }
  $out = '"'
  $slashes = 0
  foreach ($ch in $Arg.ToCharArray()) {
    if ($ch -eq '\') { $slashes++; continue }
    if ($ch -eq '"') { $out += '\' * ($slashes * 2 + 1) + '"' } else { $out += '\' * $slashes + $ch }
    $slashes = 0
  }
  return $out + ('\' * ($slashes * 2)) + '"'
}

# Quotes one argument for a .cmd or .bat file. cmd.exe reads the command line before the
# script does: it splits at & | < > ^ ( ), and expands %NAME%. Inside quotes these are
# text. "" keeps a quote inside quotes. A % gets an empty %cd:~,% after it, so no name
# can follow it.
function ConvertTo-BatchArgument([string]$Arg) {
  if ($Arg -ne '' -and $Arg -notmatch '[\s"&|<>^(),;=%]') { return $Arg }
  return '"' + ($Arg -replace '"', '""' -replace '%', '%%cd:~,%') + '"'
}

# --- Arguments ---------------------------------------------------------------

$configDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$base = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath((Join-Path $configDir 'progress'))

$words = @($args | ForEach-Object { [string]$_ })
if ($words.Count -eq 0 -or $words[0] -ceq '-h' -or $words[0] -ceq '--help') { Show-Usage; exit 0 }
if ($words[0] -ceq '--dir') { $base; exit 0 }

$rootName = ''
$i = 0
while ($i -lt $words.Count) {
  if ($words[$i] -cin '-n', '--name') {
    if ($i + 1 -ge $words.Count) { Write-Warn "$($words[$i]) needs a value"; exit 2 }
    $rootName = $words[$i + 1]
    $i += 2
  } elseif ($words[$i] -ceq '--') { $i++; break } else { break }
}
$command = @($words | Select-Object -Skip $i)
if ($command.Count -eq 0) { Write-Warn 'no command to run. See claude-progress --help'; exit 2 }

# Python holds its output in a buffer when it writes to a pipe. This goes to COMMAND only.
$env:PYTHONUNBUFFERED = '1'

$found = Get-Command -Name $command[0] -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $found) { Write-Warn "$($command[0]): command not found"; exit 127 }
$cmdArgs = @($command | Select-Object -Skip 1)

# A session ID is a plain name. Outside a session, the command runs as it is.
$session = [string]$env:CLAUDE_CODE_SESSION_ID
$inSession = $session -match '^[A-Za-z0-9_-]+$'

if (-not $rootName) {
  $leaf = ($command[0] -split '[\\/]')[-1]
  $rootName = if ([IO.Path]::GetFileNameWithoutExtension($leaf)) { [IO.Path]::GetFileNameWithoutExtension($leaf) } else { $leaf }
}
$rootName = $rootName -replace '[\r\n]', ' '
if ($rootName.Length -gt 80) { $rootName = $rootName.Substring(0, 80) }

# --- Tasks -------------------------------------------------------------------

$tasks = New-Object System.Collections.Generic.List[object]  # index 0 is task 1
$script:root = 0
$clock = [Diagnostics.Stopwatch]::StartNew()
function Get-Seconds { [long][Math]::Floor($clock.Elapsed.TotalSeconds) }

$num = '[0-9]{1,15}(,[0-9]{3})*(\.[0-9]{1,6})?'
$sizeRe = "^$num([KMGTP]i?B?|kB|B)?$"

function New-Task([string]$Root, [string]$Name) {
  $tasks.Add([pscustomobject]@{ Root = $Root; Name = $Name; State = 'run'; Count = ''; Total = ''; Sum = [long]0; XAdd = ''; Detail = ''; End = ''; EndAt = [long]0 })
  return $tasks.Count
}
function Get-Task([int]$Id) { $tasks[$Id - 1] }

function Use-Root {
  if ($script:root -eq 0 -or (Get-Task $script:root).State -ne 'run') { $script:root = New-Task '-' $rootName }
  return $script:root
}

function Use-Sub([string]$Name) {
  $r = Use-Root
  for ($id = $tasks.Count; $id -gt $r; $id--) {
    $t = Get-Task $id
    if ($t.Root -eq "$r" -and $t.State -eq 'run' -and $t.Name -ceq $Name) { return $id }
  }
  return New-Task "$r" $Name
}

function Stop-Task([int]$Id, [string]$State, [string]$Line) {
  $t = Get-Task $Id
  $t.State = $State; $t.End = $Line; $t.EndAt = Get-Seconds
  if ($t.Root -ne '-') { return }
  for ($s = $Id + 1; $s -le $tasks.Count; $s++) {
    $sub = Get-Task $s
    if ($sub.Root -eq "$Id" -and $sub.State -eq 'run') { $sub.State = $State; $sub.End = $State; $sub.EndAt = Get-Seconds }
  }
}

function Clear-Task([int]$Id) {
  $t = Get-Task $Id
  $t.State = 'gone'
  if ($t.Root -ne '-') { return }
  for ($s = $Id + 1; $s -le $tasks.Count; $s++) { if ((Get-Task $s).Root -eq "$Id") { (Get-Task $s).State = 'gone' } }
  $script:root = 0
}

function Test-Size([string]$Text) { $Text -cmatch $sizeRe }

function Test-Count([string]$Word) {
  $cut = $Word.IndexOf('/')
  if ($cut -lt 0) { return $false }
  $left = $Word.Substring(0, $cut); $right = $Word.Substring($cut + 1)
  return (Test-Size $left) -and (Test-Size $right) -and ($right -cmatch '[1-9]')
}

function Test-Percent([string]$Word) {
  if ($Word -cnotmatch '^([0-9]{1,3})(\.[0-9]{1,6})?%$') { return $false }
  $whole = [int]$Matches[1]
  return $whole -lt 100 -or ($whole -eq 100 -and ($Matches[2] -cmatch '^(\.0*)?$'))
}

# Applies one tag value to a task, the way the plugin folds it.
function Set-Value([int]$Id, [string]$Line) {
  $t = Get-Task $Id
  $cut = $Line.IndexOf(' ')
  $word = if ($cut -lt 0) { $Line } else { $Line.Substring(0, $cut) }
  $rest = if ($cut -lt 0) { '' } else { $Line.Substring($cut + 1) }
  if ($word -ieq 'done') { Stop-Task $Id 'done' $Line; return }
  if ($word -ieq 'fail' -or $word -ieq 'failed') { Stop-Task $Id 'fail' $Line; return }
  if ($word -ieq 'clear') { Clear-Task $Id; return }
  if ((Test-Count $word) -or (Test-Percent $word)) {
    # A new count replaces the count, the total, the adds, and the detail before it.
    $t.Count = $Line; $t.Total = ''; $t.Sum = [long]0; $t.XAdd = ''; $t.Detail = ''
  } elseif ($word.StartsWith('+') -and (Test-Size $word.Substring(1))) {
    if ($word.Substring(1) -cmatch '^[0-9]{1,15}$') { $t.Sum += [long]$word.Substring(1) } else { $t.XAdd += "[$Id] $word`n" }
    if ($rest) { $t.Detail = $rest }
  } elseif ($word -ieq 'total' -and (Test-Size $rest) -and ($rest -cmatch '[1-9]')) {
    $t.Total = "total $rest"
  } else {
    $t.Detail = $Line # text, also "stopped": only the wrapper ends a task as stopped
  }
}

# Returns @(name, value) for a tag line, with an empty name for the root, or $null for no tag.
function Get-Tag([string]$Line) {
  if ($Line.StartsWith('[progress] ', [StringComparison]::Ordinal)) {
    $name = ''; $value = $Line.Substring(11)
  } elseif ($Line.StartsWith('[progress:', [StringComparison]::Ordinal)) {
    $after = $Line.Substring(10)
    $close = $after.IndexOf(']')
    if ($close -lt 0 -or -not $after.Substring($close + 1).StartsWith(' ')) { return $null }
    $name = $after.Substring(0, $close); $value = $after.Substring($close + 2)
  } else { return $null }
  $value = $value.TrimStart(' ')
  if (-not $value) { return $null }
  if ($name.Length -gt 80) { $name = $name.Substring(0, 80) }
  return , @($name, $value)
}

# --- The run file --------------------------------------------------------------

$script:file = ''
$script:noFile = $false
$script:lastWrite = [long]0
# The plugin reads run files 4 times a second, so more writes only slow COMMAND down.
$writeMs = 200
$script:lastWriteMs = [long]-1000000
$script:dirty = $false
$utf8 = New-Object Text.UTF8Encoding $false

function Open-File {
  if ($script:file -or $script:noFile) { return }
  $dir = Join-Path $base $session
  if (-not (Test-Path -LiteralPath $dir)) {
    try { New-Item -ItemType Directory -Force -Path $dir | Out-Null } catch { Write-Warn "cannot create $dir"; $script:noFile = $true; return }
    if ($env:CLAUDE_PID -match '^\d+$') {
      try { [IO.File]::WriteAllText((Join-Path $dir '.owner'), "{`"pid`":$($env:CLAUDE_PID),`"procStart`":`"`"}`n", $utf8) } catch { }
    }
    try { Invoke-Sweep $base $dir } catch { } # A new session also removes what old sessions left.
  }
  $script:file = Join-Path $dir "$PID-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
}

# Rewrites the whole run file from memory.
function Write-RunFile {
  if (-not $script:file) { return }
  $now = Get-Seconds
  $sb = New-Object Text.StringBuilder
  for ($id = 1; $id -le $tasks.Count; $id++) {
    $t = Get-Task $id
    if ($t.State -eq 'gone') { continue }
    # An ended task leaves the file after the longest hold time of the plugin.
    if ($t.State -ne 'run' -and $now - $t.EndAt -ge 15) { $t.State = 'gone'; continue }
    [void]$sb.Append("task $id $($t.Root) $($t.Name)`n")
    if ($t.Count) { [void]$sb.Append("[$id] $($t.Count)`n") }
    if ($t.Total) { [void]$sb.Append("[$id] $($t.Total)`n") }
    if ($t.Sum -ne 0) { [void]$sb.Append("[$id] +$($t.Sum)`n") }
    [void]$sb.Append($t.XAdd)
    # +0 adds nothing, so a detail such as "3/8 files" never reads as a count.
    if ($t.Detail) { [void]$sb.Append("[$id] +0 $($t.Detail)`n") }
    if ($t.End) { [void]$sb.Append("[$id] $($t.End)`n") }
  }
  # The plugin uses a read only when it ends with this line, so a half-written file never counts.
  [void]$sb.Append("end`n")
  try { [IO.File]::WriteAllText($script:file, $sb.ToString(), $utf8) } catch {
    Write-Warn "cannot write $($script:file)"
    $script:noFile = $true; $script:file = ''
  }
  $script:lastWrite = $now
  $script:lastWriteMs = $clock.ElapsedMilliseconds
  $script:dirty = $false
}

function Complete-Run([string]$Line, [string]$State) {
  foreach ($t in $tasks) { if ($t.State -eq 'run') { $t.State = $State; $t.End = $Line; $t.EndAt = Get-Seconds } }
  Write-RunFile
}

# --- Run ---------------------------------------------------------------------

$info = New-Object Diagnostics.ProcessStartInfo
$isBatch = $false
switch ($found.CommandType) {
  'Application' { $info.FileName = $found.Source; $argList = $cmdArgs; $isBatch = $found.Source -match '\.(cmd|bat)$' }
  'ExternalScript' {
    $info.FileName = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $found.Source) + $cmdArgs
  }
  default {
    $info.FileName = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
    $quoted = @($command | ForEach-Object { "'" + ($_ -replace "'", "''") + "'" })
    $argList = @('-NoProfile', '-Command', "& $($quoted -join ' ')")
  }
}
$info.Arguments = (@($argList | ForEach-Object { if ($isBatch) { ConvertTo-BatchArgument $_ } else { ConvertTo-Argument $_ } }) -join ' ')
$info.UseShellExecute = $false
# Outside a session, COMMAND writes straight to the streams of the wrapper. Windows
# PowerShell 5.1 drops quotes inside the arguments of & COMMAND, so it starts the same way.
if (-not $inSession) {
  $proc = [Diagnostics.Process]::Start($info)
  $proc.WaitForExit()
  exit $proc.ExitCode
}
$info.RedirectStandardOutput = $true
$info.RedirectStandardError = $true
$info.StandardOutputEncoding = $utf8
$info.StandardErrorEncoding = $utf8

$finished = $false
$last = ''
try {
  $proc = [Diagnostics.Process]::Start($info)
  $readers = @{ out = $proc.StandardOutput; err = $proc.StandardError }
  $pending = @{ out = $readers.out.ReadLineAsync(); err = $readers.err.ReadLineAsync() }
  while ($pending.Count -gt 0) {
    $keys = @($pending.Keys)
    $index = [Threading.Tasks.Task]::WaitAny([Threading.Tasks.Task[]]@($keys | ForEach-Object { $pending[$_] }), $writeMs)
    if ($index -ge 0) {
      $key = $keys[$index]
      $line = $pending[$key].Result
      if ($null -eq $line) { $pending.Remove($key) } else {
        $pending[$key] = $readers[$key].ReadLineAsync()
        $tag = Get-Tag $line
        if ($tag) {
          Open-File
          $id = if ($tag[0]) { Use-Sub $tag[0] } else { Use-Root }
          Set-Value $id $tag[1]
          $script:dirty = $true
        } else {
          if ($key -eq 'out') { [Console]::Out.WriteLine($line) } else { [Console]::Error.WriteLine($line) }
          if ($line) { $last = $line }
        }
      }
    }
    if ($script:dirty -and $clock.ElapsedMilliseconds - $script:lastWriteMs -ge $writeMs) { Write-RunFile }
    if ($script:file -and (Get-Seconds) - $script:lastWrite -ge 5) { Write-RunFile }
  }
  $proc.WaitForExit()
  $status = $proc.ExitCode
  if ($status -eq 0) { Complete-Run 'done' 'done' } else {
    $tail = if ($last) { ": $(if ($last.Length -gt 200) { $last.Substring(0, 200) } else { $last })" } else { '' }
    Complete-Run "fail exit $status$tail" 'fail'
  }
  $finished = $true
  exit $status
} finally {
  # Any other way out, such as Ctrl+C, ends the running tasks as stopped.
  if (-not $finished) {
    Complete-Run 'stopped' 'stopped'
    if ($proc -and -not $proc.HasExited) { try { $proc.Kill() } catch { } }
  }
}
