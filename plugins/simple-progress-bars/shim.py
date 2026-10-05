# Makes the calls do nothing where claude-progress is not installed.
import shutil, subprocess
_BASH = shutil.which("bash")
def claude_progress(*args):
    if _BASH:
        subprocess.run([_BASH, "-c", 'command -v claude-progress >/dev/null && exec claude-progress "$@"', "_", *map(str, args)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
