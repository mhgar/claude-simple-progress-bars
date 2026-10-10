## Context

Both wrappers apply a tag to the tasks in memory, and then rewrite the whole run file. The plugin reads the session folder every 250 ms (`TICK_MS` in `hooks/register.tsx`). It uses a read only when the file ends with `end`. The heartbeat rewrites the file when 5 s pass with no write.

The PowerShell wrapper starts COMMAND with `Diagnostics.Process` and builds the command line itself with `ConvertTo-Argument`. That function follows the rules of `CommandLineToArgvW`. For a `.cmd` or `.bat` file, Windows starts cmd.exe, and cmd.exe does not follow these rules.

## Goals / Non-Goals

**Goals:**
- A loop that prints many tags runs at nearly the speed that it has with no wrapper.
- The bar stays as fresh as the plugin can show it.
- The PowerShell wrapper passes each argument of a batch file to the script as one argument.

**Non-Goals:**
- Batch file quoting in the bash wrapper. Git Bash builds the command line of a Windows program itself, and the bash wrapper runs COMMAND as Git Bash does. A direct call from Git Bash has the same problem.
- A newline inside an argument of a batch file. cmd.exe cannot take one.
- A setting for the write interval.

## Decisions

### A write interval of 200 ms
After a tag, the wrapper marks the file as changed. At the end of each pass of its read loop, it writes the file when the file has changes and 200 ms passed since the last write. The read loop waits at most 200 ms for a line, so a held tag reaches the file when COMMAND is quiet. 200 ms is below the read interval of the plugin, so a bar does not show a value later than before by more than one tick.

The first tag writes at once, because the time of the last write starts far in the past. The end of the run writes at once, as before.

Alternatives:
- Write each Nth tag. A slow loop then shows no change for a long time.
- Write only on the heartbeat. Bars then move once in 5 s.

### A clock with no process
Bash 5 has `EPOCHREALTIME`. The wrapper takes its digits and drops the last 3, for milliseconds. This also works in a locale with a decimal comma. Bash 3 and 4 fall back to `SECONDS * 1000`. Bash 3 cannot read with a timeout below 1 s, so on bash 3 a held tag waits at most 1 s. PowerShell uses its `Stopwatch`.

### Partial lines in bash
When `read -t` times out in the middle of a line, bash puts the part that it read in the variable, and that part leaves the pipe. With a timeout of 1 s this was rare. With 0.2 s it is more likely, so the bash wrapper keeps the part, and puts it before the rest of the line at the next read. Bash 3 leaves the old value in the variable after a timeout with no input, so the wrapper empties the variable before each read.

### End of input under bash 3
Bash 4 and later return a status above 128 when `read -t` times out, and 1 at the end of input. Bash 3 returns 1 for both. A signal trap that interrupts the read gives a status above 128 in every version. The bash wrapper notes `SECONDS` before each read. Under bash 3, a status of 1 counts as the end of input only when `SECONDS` did not change during the read. A timeout always takes 1 s, so it always changes `SECONDS`. An end of input that crosses a second boundary costs one more read, which returns at once and ends the loop.

Alternatives:
- Wait for the `exit` token line. The lines of standard output can still come after it, so the token does not mark the end.
- Read with no timeout under bash 3. The heartbeat then stops while COMMAND is quiet.

### Batch quoting
`ConvertTo-BatchArgument` puts an argument in quotes when it is empty or holds white space or one of `" & | < > ^ ( ) , ; = %`. Inside quotes, cmd.exe treats `& | < > ^ ( )` as text. cmd.exe also splits batch arguments at `,`, `;` and `=`, so these get quotes too. A `"` becomes `""`, because cmd.exe has no other escape inside quotes. The script then sees each `"` doubled.

cmd.exe expands `%NAME%` also inside quotes. Each `%` gets `%cd:~,%` after it. That is an empty substring of `%cd%`, so cmd.exe removes it, and the `%` before it can no longer start a name. Rust uses the same method for its batch file fix (CVE-2024-24576).

The wrapper uses this function when `Get-Command` finds an application with the extension `.cmd` or `.bat`. Every other COMMAND keeps `ConvertTo-Argument`.

### One way to start COMMAND
Outside a session, the PowerShell wrapper used `& COMMAND @args`. Windows PowerShell 5.1 builds the command line of a native program by its own rules, and drops quotes inside an argument. The wrapper now builds the `ProcessStartInfo` first, for both cases. Outside a session, it starts COMMAND with no redirection, waits, and exits with its exit status. COMMAND then writes straight to the streams of the wrapper, as before.

A cmdlet, a function, or an alias now runs in a new PowerShell process also outside a session, as it does inside one.

## Risks / Trade-offs

- A script that reads a run file at once after a tag can see the old value for 200 ms. The plugin is the only reader, and it reads every 250 ms.
- `%cd:~,%` needs command extensions, which cmd.exe turns on by default.
