# Makes the calls do nothing where claude-progress is not installed.
import glob, os, sys
_b, sys.dont_write_bytecode = sys.dont_write_bytecode, True  # no __pycache__ in the plugin
try:
    sys.path.insert(0, max(glob.glob(os.path.join(os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude"), "plugins/cache/*/simple-progress-bars/*/scripts")), key=os.path.getmtime))
    from claude_progress import claude_progress
except Exception:
    def claude_progress(*args): pass
finally:
    sys.dont_write_bytecode = _b
