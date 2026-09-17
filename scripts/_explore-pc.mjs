import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dir = path.join(root, '国投')
const out = []

const files = fs.readdirSync(dir).filter((f) => /\.xlsx?$/i.test(f))
for (const f of files) {
  const wb = XLSX.readFile(path.join(dir, f))
  out.push(`\n========== FILE: ${f} ==========`)
  out.push(`SheetNames: ${JSON.stringify(wb.SheetNames)}`)
  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' })
    const cols = rows[0] ? Object.keys(rows[0]) : []
    out.push(`\n--- Sheet: ${sn} | rows: ${rows.length} ---`)
    out.push(`Columns: ${JSON.stringify(cols)}`)
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      out.push(`Sample[${i}]: ${JSON.stringify(rows[i])}`)
    }
  }
}

const matters = JSON.parse(fs.readFileSync(path.join(root, 'src/data/matters.json'), 'utf8'))
const plans = JSON.parse(fs.readFileSync(path.join(root, 'src/data/plans.json'), 'utf8'))
const pcs = JSON.parse(fs.readFileSync(path.join(root, 'src/data/problem-categories.json'), 'utf8'))

const tree = {}
for (const m of matters) {
  if (!tree[m.level1]) tree[m.level1] = {}
  const l2 = m.level2 || '(empty)'
  if (!tree[m.level1][l2]) tree[m.level1][l2] = []
  if (m.level3) tree[m.level1][l2].push(m.level3 + ' :: ' + m.name)
  else tree[m.level1][l2].push(m.name)
}
out.push('\n=== MATTER TAXONOMY ===')
out.push(JSON.stringify(tree, null, 2))

const pt = {}
for (const p of plans) {
  if (!pt[p.level1]) pt[p.level1] = new Set()
  pt[p.level1].add(p.level2 || '(empty)')
}
out.push('\n=== PLAN TAXONOMY ===')
for (const [k, v] of Object.entries(pt)) out.push(`${k} -> ${[...v].join(', ')}`)

const pcNames = new Set(pcs.map((p) => p.name))
const matterNames = new Set(
  matters.flatMap((m) => [m.name, m.level1, m.level2, m.level3].filter(Boolean))
)
const planCats = new Set()
const walk = (nodes) => {
  for (const n of nodes || []) {
    planCats.add(n.label)
    if (n.data) {
      ;['cat1', 'cat2', 'cat3', 'matterName'].forEach((k) => n.data[k] && planCats.add(n.data[k]))
    }
    walk(n.children)
  }
}
for (const p of plans) {
  planCats.add(p.level1)
  planCats.add(p.level2)
  planCats.add(p.name)
  walk(p.detailTree)
}
out.push(`\n=== Overlap PC vs Matter: ${[...pcNames].filter((n) => matterNames.has(n)).join(' | ') || '(none)'} ===`)
out.push(`=== Overlap PC vs Plan: ${[...pcNames].filter((n) => planCats.has(n)).join(' | ') || '(none)'} ===`)

const nameHits = matters.filter((m) =>
  /追责事项|违规事项|问题分类/.test([m.name, m.level1, m.level2, m.level3].join('|'))
)
out.push(`\n=== Matter category hits: ${nameHits.map((m) => m.name).join(', ') || '(none)'} ===`)

// fuzzy semantic: which PC names appear as substrings in matter names
const soft = []
for (const pc of pcs) {
  const hits = matters.filter((m) => m.name.includes(pc.name.replace(/方面(问题)?（失效）?$/, '').replace(/方面$/, '')) || pc.name.includes(m.name))
  if (hits.length) soft.push(`${pc.name} ~ ${hits.slice(0, 3).map((h) => h.name).join(', ')}`)
}
out.push('\n=== Soft name affinity (sample) ===')
out.push(soft.slice(0, 30).join('\n'))

const outPath = path.join(root, 'scripts', '_explore-pc-out.txt')
fs.writeFileSync(outPath, out.join('\n'), 'utf8')
console.log('Wrote', outPath)
