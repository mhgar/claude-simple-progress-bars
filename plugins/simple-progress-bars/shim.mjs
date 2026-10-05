// Makes the calls do nothing where claude-progress is not installed.
const { pathToFileURL } = await import('node:url')
const { claudeProgress } = await import(pathToFileURL(`${process.env.CLAUDE_PROGRESS_DIR}/claude-progress.js`).href).catch(() => ({ claudeProgress() {} }))
