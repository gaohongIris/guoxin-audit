import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const filePath = path.join(root, '国投', '审计数据分析模型.xlsx')
const outDir = path.join(root, 'src', 'data')

fs.mkdirSync(outDir, { recursive: true })

function clean(v) {
  return String(v ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function findHeaderRow(aoa) {
  for (let i = 0; i < Math.min(8, aoa.length); i++) {
    const cells = (aoa[i] || []).map(clean)
    if (cells.includes('序号') && cells.some((c) => /名称|指标名称|模型名称/.test(c))) {
      return i
    }
  }
  return -1
}

function colIndex(headers, patterns) {
  for (let i = 0; i < headers.length; i++) {
    if (patterns.some((p) => p.test(headers[i]))) return i
  }
  return -1
}

const wb = XLSX.readFile(filePath)
const models = []
let modelId = 1
const domains = []

for (const sheetName of wb.SheetNames) {
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: false,
  })
  const headerIdx = findHeaderRow(aoa)
  if (headerIdx < 0) {
    console.warn('Skip sheet without header:', sheetName)
    continue
  }

  const headers = (aoa[headerIdx] || []).map(clean)
  const usefulCols = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => h && h !== '返回' && i < 20)

  const idxNo = colIndex(headers, [/^序号$/])
  const idxCat = colIndex(headers, [/类别/, /分类/, /模型分类/, /指标类别/])
  const idxName = colIndex(headers, [/指标名称/, /模型名称/, /^名称$/])
  const idxFormula = colIndex(headers, [/公式/])
  const idxDesc = colIndex(headers, [/说明/, /模型说明/])
  const idxRisk = colIndex(headers, [/风险应对/])
  const idxSource = colIndex(headers, [/^来源$/])
  const idxDataSource = colIndex(headers, [/数据来源/])
  const idxLogic = colIndex(headers, [/运算逻辑/, /逻辑/])

  let lastCat = ''
  const domainModels = []

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const row = aoa[r] || []
    const name = clean(idxName >= 0 ? row[idxName] : '')
    if (!name) continue

    let category = clean(idxCat >= 0 ? row[idxCat] : '')
    if (category) lastCat = category
    else category = lastCat

    const fields = {}
    for (const { h, i } of usefulCols) {
      const val = clean(row[i])
      if (val) fields[h] = val
    }

    const item = {
      id: modelId++,
      domain: sheetName,
      category: category || '未分类',
      name,
      description: clean(idxDesc >= 0 ? row[idxDesc] : ''),
      formula: clean(idxFormula >= 0 ? row[idxFormula] : ''),
      riskResponse: clean(idxRisk >= 0 ? row[idxRisk] : ''),
      source: clean(idxSource >= 0 ? row[idxSource] : ''),
      dataSource: clean(idxDataSource >= 0 ? row[idxDataSource] : ''),
      logic: clean(idxLogic >= 0 ? row[idxLogic] : ''),
      seq: clean(idxNo >= 0 ? row[idxNo] : '') || String(domainModels.length + 1),
      fields,
    }
    models.push(item)
    domainModels.push(item)
  }

  const catMap = new Map()
  for (const m of domainModels) {
    if (!catMap.has(m.category)) catMap.set(m.category, [])
    catMap.get(m.category).push(m)
  }

  domains.push({
    id: `domain-${sheetName}`,
    name: sheetName,
    modelCount: domainModels.length,
    categories: [...catMap.entries()].map(([cat, list]) => ({
      name: cat,
      modelCount: list.length,
    })),
  })
}

function buildTree() {
  return domains.map((d) => {
    const domainModels = models.filter((m) => m.domain === d.name)
    const catMap = new Map()
    for (const m of domainModels) {
      if (!catMap.has(m.category)) catMap.set(m.category, [])
      catMap.get(m.category).push(m)
    }

    // 若只有一个「未分类」或分类名等于域名，模型直接挂在域名下
    const cats = [...catMap.keys()]
    const flatten =
      cats.length === 1 && (cats[0] === '未分类' || cats[0] === d.name)

    if (flatten) {
      return {
        id: d.id,
        label: d.name,
        type: 'domain',
        modelCount: domainModels.length,
        children: domainModels.map((m) => ({
          id: `model-${m.id}`,
          label: m.name,
          type: 'model',
          modelId: m.id,
          children: [],
        })),
      }
    }

    return {
      id: d.id,
      label: d.name,
      type: 'domain',
      modelCount: domainModels.length,
      children: [...catMap.entries()].map(([cat, list]) => ({
        id: `cat-${d.name}-${cat}`,
        label: cat,
        type: 'category',
        modelCount: list.length,
        children: list.map((m) => ({
          id: `model-${m.id}`,
          label: m.name,
          type: 'model',
          modelId: m.id,
          children: [],
        })),
      })),
    }
  })
}

/**
 * 建议关注（投资控股场景精选）：
 * 侧重股权/基金投资、司库资金、财务绩效、集团合规与负责人薪酬；
 * 剔除存货/货物、产销制造、工程建设、券商营业部等偏经营实体模型。
 */
const GUOXIN_EXCLUDE_NAME = [
  // 存货 / 货物 / 两金（含存货）
  /存货/,
  /两金/,
  /货物/,
  /产成品/,
  /库存商品|原材料/,
  /采购竞价|采购现金结算/,
  // 产销制造 / 物流
  /卷烟/,
  /销量.*物流|物流费用增长率/,
  /生产制造类/,
  /进货、发货、装卸、包装/,
  /月销售业务毛利/,
  /主营业务成本倒轧/,
  /主营业务成本为负/,
  /主营业务成本率/,
  /毛利率/,
  // 工程 / 固投建设
  /工程现金付款/,
  /工程项目/,
  /违规违法获取工程/,
  /未批先建/,
  /固投超概/,
  /建设项目停滞/,
  /在建工程/,
  // 其他行业专属
  /全省重点费用/,
  /无证经营新办证/,
]

const GUOXIN_EXCLUDE_CATEGORY = new Set(['固定资产投资项目', '现金管理'])

const GUOXIN_EXCLUDE_DOMAIN = new Set(['证券行业'])

const GUOXIN_BUCKET_ORDER = [
  '财务与绩效指标',
  '股权与基金投资',
  '司库查询与分析',
  '资金管理与账户风险',
  '经营合规与风险预警',
  '薪酬与负责人监督',
  '预算与决算分析',
]

function guoxinBucketOf(m) {
  if (GUOXIN_EXCLUDE_DOMAIN.has(m.domain)) return null
  if (GUOXIN_EXCLUDE_CATEGORY.has(m.category)) return null
  if (GUOXIN_EXCLUDE_NAME.some((re) => re.test(m.name))) return null

  // 现金实物/结算类（财务比率如「现金流动负债比率」仍保留）
  if (/库存现金|现金结算|现金支付|现金支出|现金坐支|使用现金/.test(m.name)) {
    return null
  }
  switch (m.domain) {
    case '财务指标':
      return '财务与绩效指标'
    case '投资管理':
      return '股权与基金投资'
    case '司库':
      return '司库查询与分析'
    case '资金管理':
      return '资金管理与账户风险'
    case '经营管理':
      return '经营合规与风险预警'
    case '薪酬管理':
      return '薪酬与负责人监督'
    case '预算管理':
      return '预算与决算分析'
    default:
      return null
  }
}

for (const m of models) {
  const bucket = guoxinBucketOf(m)
  m.guoxinApplicable = Boolean(bucket)
  m.guoxinCategory = bucket || ''
}

function buildGuoxinTree() {
  const applicable = models.filter((m) => m.guoxinApplicable)
  const byBucket = new Map(GUOXIN_BUCKET_ORDER.map((b) => [b, []]))
  for (const m of applicable) {
    if (!byBucket.has(m.guoxinCategory)) byBucket.set(m.guoxinCategory, [])
    byBucket.get(m.guoxinCategory).push(m)
  }

  const children = GUOXIN_BUCKET_ORDER.filter(
    (b) => (byBucket.get(b) || []).length > 0
  ).map((bucket) => {
    const list = byBucket.get(bucket)
    return {
      id: `cat-建议关注-${bucket}`,
      label: bucket,
      type: 'category',
      modelCount: list.length,
      guoxin: true,
      children: list.map((m) => ({
        id: `gx-model-${m.id}`,
        label: m.name,
        type: 'model',
        modelId: m.id,
        guoxin: true,
        children: [],
      })),
    }
  })

  return {
    id: 'domain-建议关注',
    label: '建议关注',
    type: 'domain',
    modelCount: applicable.length,
    guoxin: true,
    hint: '投资控股场景下可能适用的模型精选，供优先参考',
    children,
  }
}

const sourceTree = buildTree()
const guoxinTree = buildGuoxinTree()
const tree = [guoxinTree, ...sourceTree]

const guoxinCount = models.filter((m) => m.guoxinApplicable).length
const summary = {
  domains: domains.length,
  categories: domains.reduce((s, d) => s + d.categories.length, 0),
  models: models.length,
  guoxinModels: guoxinCount,
  guoxinCategories: guoxinTree.children.length,
}

fs.writeFileSync(path.join(outDir, 'analysis-models.json'), JSON.stringify(models), 'utf8')
fs.writeFileSync(
  path.join(outDir, 'analysis-model-tree.json'),
  JSON.stringify(tree),
  'utf8'
)
fs.writeFileSync(
  path.join(outDir, 'analysis-model-summary.json'),
  JSON.stringify(summary, null, 2),
  'utf8'
)
fs.writeFileSync(
  path.join(outDir, 'analysis-model-domains.json'),
  JSON.stringify(domains, null, 2),
  'utf8'
)

console.log('Parsed analysis models OK:', summary)
console.log(
  `建议关注: ${guoxinCount} 模型 / ${guoxinTree.children.length} 分类 →`,
  guoxinTree.children.map((c) => `${c.label}(${c.modelCount})`).join('、')
)
for (const d of domains) {
  console.log(
    ` - ${d.name}: ${d.modelCount} 模型 / ${d.categories.length} 分类`,
    d.categories.map((c) => c.name).join('、')
  )
}
