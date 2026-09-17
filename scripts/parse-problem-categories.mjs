import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const filePath = path.join(root, '国投', '问题分类台账_分类整理.xlsx')
const outDir = path.join(root, 'src', 'data')

fs.mkdirSync(outDir, { recursive: true })

function clean(v) {
  return String(v ?? '').trim()
}

const wb = XLSX.readFile(filePath)
const rows = XLSX.utils.sheet_to_json(wb.Sheets['问题分类'], { defval: '' })

const items = rows.map((r, i) => {
  const name = clean(r['分类名称'])
  const parent = clean(r['上级分类'])
  return {
    id: i + 1,
    name,
    parent,
    inactive: /失效/.test(name) || /失效/.test(parent),
    inspectionOnly: /巡视专用/.test(name) || /巡视专用/.test(parent),
  }
})

const childrenOf = new Map()
const nameSet = new Set(items.map((i) => i.name))
const parentSet = new Set(items.map((i) => i.parent).filter(Boolean))

for (const it of items) {
  const p = it.parent || '__ROOT__'
  if (!childrenOf.has(p)) childrenOf.set(p, [])
  childrenOf.get(p).push(it)
}

const orphanParents = [...parentSet].filter((p) => !nameSet.has(p))

function buildNodes(parentName, level = 1, ancestors = new Set()) {
  const kids = childrenOf.get(parentName) || []
  const nextAncestors = new Set(ancestors)
  nextAncestors.add(parentName)
  return kids
    .filter((it) => it.name !== parentName && !ancestors.has(it.name))
    .map((it) => ({
      id: `pc-${it.id}`,
      label: it.name,
      type: 'category',
      level,
      data: it,
      children: buildNodes(it.name, level + 1, nextAncestors),
    }))
}

// 主树：审计问题优先；其余根节点按名称排序
const orderedRoots = [
  ...orphanParents.filter((p) => p === '审计问题'),
  ...orphanParents.filter((p) => p !== '审计问题').sort((a, b) => a.localeCompare(b, 'zh')),
]

const tree = orderedRoots.map((p) => ({
  id: `root-${p}`,
  label: p,
  type: 'root',
  level: 0,
  data: {
    id: 0,
    name: p,
    parent: '',
    inactive: /失效/.test(p),
    inspectionOnly: /巡视专用/.test(p),
    isVirtualRoot: true,
  },
  children: buildNodes(p, 1),
}))

// 主表视图：每条分类一行，带路径与标签
const byName = new Map(items.map((i) => [i.name, i]))
function pathOf(it) {
  const parts = [it.name]
  let cur = it
  const guard = new Set()
  while (cur.parent && !guard.has(cur.parent)) {
    guard.add(cur.parent)
    parts.unshift(cur.parent)
    cur = byName.get(cur.parent) || { parent: '' }
  }
  return parts.join(' / ')
}

const tableRows = items.map((it) => ({
  ...it,
  path: pathOf(it),
  childCount: (childrenOf.get(it.name) || []).length,
}))

const summary = {
  totalRows: items.length,
  rootCount: tree.length,
  auditProblemChildren: (childrenOf.get('审计问题') || []).length,
  inactiveCount: items.filter((i) => i.inactive).length,
  inspectionCount: items.filter((i) => i.inspectionOnly).length,
  domainRootCount: orphanParents.filter((p) => p !== '审计问题').length,
}

fs.writeFileSync(path.join(outDir, 'problem-categories.json'), JSON.stringify(tableRows, null, 0), 'utf8')
fs.writeFileSync(path.join(outDir, 'problem-category-tree.json'), JSON.stringify(tree, null, 0), 'utf8')
fs.writeFileSync(path.join(outDir, 'problem-category-summary.json'), JSON.stringify(summary, null, 2), 'utf8')

console.log('Parsed problem categories OK:', summary)
console.log(
  'Roots:',
  tree.map((t) => `${t.label}(${t.children.length})`).join(' | ')
)
