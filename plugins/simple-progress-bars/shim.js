// Makes the calls do nothing where claude-progress is not installed.
let claudeProgress = () => {}
try { ({ claudeProgress } = require(require('node:path').join(process.env.CLAUDE_PROGRESS_DIR, 'claude-progress.js'))) } catch {}
