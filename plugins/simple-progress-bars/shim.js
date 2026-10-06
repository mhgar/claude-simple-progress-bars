let claudeProgress = () => {}
try {
  const fs = require('fs'), c = (process.env.CLAUDE_CONFIG_DIR || require('os').homedir() + '/.claude') + '/plugins/cache/'
  const f = fs.readdirSync(c).flatMap(m => { try { return fs.readdirSync(`${c}${m}/simple-progress-bars`).map(v => `${c}${m}/simple-progress-bars/${v}/scripts/claude-progress.js`) } catch { return [] } })
  ;({ claudeProgress } = require(f.filter(fs.existsSync).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]))
} catch {}
