const fs = require('fs'), parser = require('@babel/parser')
const targets = ['app/page.jsx','app/relatorio/page.jsx','app/api/log-event/route.js','app/login/page.jsx']
let ok = true
targets.forEach(f => {
  try {
    parser.parse(fs.readFileSync(f,'utf8'), { sourceType:'module', plugins:['jsx'] })
    console.log('OK   ', f)
  } catch(e) { console.error('ERR  ', f, e.message); ok = false }
})
process.exit(ok ? 0 : 1)
