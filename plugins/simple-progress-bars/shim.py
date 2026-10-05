# Makes the calls do nothing where claude-progress is not installed.
try:
    import os, sys; sys.path.insert(0, os.environ["CLAUDE_PROGRESS_DIR"])
    from claude_progress import claude_progress
except Exception:
    def claude_progress(*args): pass
