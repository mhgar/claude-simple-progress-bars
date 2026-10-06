"""claude_progress: report the progress of a task to the Simple Progress Bars plugin.

The Python twin of scripts/claude-progress.sh. It writes the same lines to the same files,
<dir>/<session id>/<task name>, so it needs no bash. A script imports it from the
newest installed copy of the plugin; USAGE.md has the import shim.
It never raises, and outside a Claude Code session it does nothing.

    claude_progress("-n", "convert", f"{i}/{n}", path)
"""
import os, re, sys

__all__ = ["claude_progress"]


def claude_progress(*args):
    """Reports one VALUE, with options first and detail text after, as the bash command takes them."""
    try:
        sid = os.environ.get("CLAUDE_CODE_SESSION_ID", "")
        a, name, total = [str(x) for x in args], "task", ""
        while a and a[0] in ("-n", "--name", "-t", "--total"):
            if len(a) < 2: return
            name, total = (a[1], total) if a[0] in ("-n", "--name") else (name, a[1])
            a = a[2:]
        if not re.fullmatch(r"[A-Za-z0-9_-]+", sid) or not (a or total): return
        name = re.sub(r"[/\\\r\n]", "-", name).lstrip(".")[:80] or "task"
        d = os.path.join(os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(os.path.expanduser("~"), ".claude"), "progress", sid)
        if not os.path.isdir(d):
            os.makedirs(d, exist_ok=True)
            if os.environ.get("CLAUDE_PID", "").isdigit():
                with open(os.path.join(d, ".owner"), "w", newline="") as f: f.write('{"pid":%s,"procStart":""}\n' % os.environ["CLAUDE_PID"])
        value, path = (a[0] if a else ""), os.path.join(d, name)
        out = (" ".join(a) + "\n" if value else "") + ("total %s\n" % total if total else "")
        if value == "clear":
            os.remove(path)
        elif value == "" or re.match(r"[0-9].*/[0-9]", value) or re.fullmatch(r"[0-9].*%", value):
            tmp = os.path.join(d, ".%s.%d" % (name, os.getpid()))
            with open(tmp, "w", encoding="utf-8", newline="") as f: f.write(out)
            os.replace(tmp, path)
        else:
            with open(path, "a", encoding="utf-8", newline="") as f: f.write(out)
    except Exception:
        pass


if __name__ == "__main__":
    claude_progress(*sys.argv[1:])
