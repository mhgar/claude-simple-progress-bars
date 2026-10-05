// claude-progress.js: report the progress of a task to the Simple Progress Bars plugin.
//
// The Node twin of scripts/claude-progress.sh. It writes the same lines to the same files,
// <dir>/<session id>/<task name>, so it needs no bash. A script loads it from the
// folder in CLAUDE_PROGRESS_DIR, which the plugin sets; USAGE.md has the shim for
// CommonJS and for ES modules. It never throws, and outside a Claude Code session
// it does nothing.
//
//   claudeProgress('-n', 'convert', `${i}/${n}`, file)
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

/** Reports one VALUE, with options first and detail text after, as the bash command takes them. */
function claudeProgress(...args) {
  try {
    const sid = process.env.CLAUDE_CODE_SESSION_ID ?? ''
    let a = args.map(String), name = 'task', total = ''
    while (['-n', '--name', '-t', '--total'].includes(a[0])) {
      if (a.length < 2) return
      if (a[0] === '-n' || a[0] === '--name') name = a[1]; else total = a[1]
      a = a.slice(2)
    }
    if (!/^[A-Za-z0-9_-]+$/.test(sid) || !(a.length || total)) return
    name = name.replace(/[/\\\r\n]/g, '-').replace(/^\.+/, '').slice(0, 80) || 'task'
    const d = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'progress', sid)
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true })
      if (/^\d+$/.test(process.env.CLAUDE_PID ?? '')) fs.writeFileSync(path.join(d, '.owner'), `{"pid":${process.env.CLAUDE_PID},"procStart":""}\n`)
    }
    const value = a[0] ?? '', file = path.join(d, name)
    const out = (value ? a.join(' ') + '\n' : '') + (total ? `total ${total}\n` : '')
    if (value === 'clear') fs.rmSync(file, { force: true })
    else if (value === '' || /^[0-9].*\/[0-9]/.test(value) || /^[0-9].*%$/.test(value)) {
      const tmp = path.join(d, `.${name}.${process.pid}`)
      fs.writeFileSync(tmp, out)
      fs.renameSync(tmp, file)
    } else fs.appendFileSync(file, out)
  } catch {}
}

exports.claudeProgress = claudeProgress

if (require.main === module) claudeProgress(...process.argv.slice(2))
