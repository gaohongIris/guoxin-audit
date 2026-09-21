import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSXlib = XLSX?.readFile ? XLSX : require('xlsx');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, '国投');
const outDir = path.join(root, 'src', 'data');

fs.mkdirSync(outDir, { recursive: true });

function readSheet(fileName) {
  const filePath = path.join(dataDir, fileName);
  const wb = XLSXlib.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const rows = XLSXlib.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  return { sheetName, rows };
}

function clean(v) {
  if (v == null) return '';
  return String(v).trim();
}

const EXCLUDED_PLAN_NAMES = new Set([
  '乌干达经营管理审计',
  '模版[整改跟踪审计]生成',
  '方案查看',
  '自我后评价',
  '全面后评价',
  '华夏任中审计方案',
  '国投资产管理有限公司任期经济责任审计实施方案',
  '国投金城冶金原总经理杨志强同志任期经济责任审计方案',
  '谭培东离任经济责任审计',
  '研发资金投入专项审计',
]);

// ---- 审计方案主表 ----
const planBook = readSheet('审计方案_整理后.xlsx');
const plans = [];
const planNameSet = new Set();
let planId = 1;

for (const r of planBook.rows) {
  const name = clean(r['方案模板名称']);
  const level1 = clean(r['一级分类']);
  if (!name || EXCLUDED_PLAN_NAMES.has(name) || level1 === '其他') continue;
  // 去重：同名只保留第一条（优先有正文的后续可再合并）
  if (planNameSet.has(name)) {
    // 若已有空壳、当前有正文，则回填
    const existing = plans.find((p) => p.name === name);
    if (existing) {
      const fields = [
        'basis',
        'objective',
        'scope',
        'riskAssessment',
        'procedure',
        'focus',
      ];
      const map = {
        basis: clean(r['编制依据']),
        objective: clean(r['审计目标']),
        scope: clean(r['审计范围与重点']),
        riskAssessment: clean(r['重要性评估和风险评估']),
        procedure: clean(r['审计程序']),
        focus: clean(r['重点关注内容']),
      };
      for (const f of fields) {
        if (!existing[f] && map[f]) existing[f] = map[f];
      }
    }
    continue;
  }
  planNameSet.add(name);
  plans.push({
    id: planId++,
    level1,
    level2: clean(r['二级分类']),
    name,
    basis: clean(r['编制依据']),
    objective: clean(r['审计目标']),
    scope: clean(r['审计范围与重点']),
    riskAssessment: clean(r['重要性评估和风险评估']),
    procedure: clean(r['审计程序']),
    focus: clean(r['重点关注内容']),
  });
}

// ---- 审计方案明细 ----
const detailBook = readSheet('审计方案明细_分类整理.xlsx');
const details = [];
let detailId = 1;

for (const r of detailBook.rows) {
  // 表头语义：第一列实际是方案模板名称
  const keys = Object.keys(r);
  const planName = clean(r[keys[0]] ?? r['一级分类']);
  if (!planName || EXCLUDED_PLAN_NAMES.has(planName)) continue;

  // 列6/7 内容与表头可能对调：按语义判断
  let steps = clean(r['审计步骤和方法'] ?? r[keys[5]]);
  let risks = clean(r['审计风险'] ?? r[keys[6]]);
  // 启发式：若 steps 更像风险描述而 risks 像操作步骤，则交换
  const looksLikeStep = (t) =>
    /询问|检查|查阅|抽样|核实|获取|比对|访谈|穿行|复核|分析|计算|确认/.test(t);
  const looksLikeRisk = (t) =>
    /不规范|不准确|不完整|未|缺失|虚假|风险|违规|舞弊|错误|遗漏/.test(t);
  if (steps && risks && looksLikeRisk(steps) && looksLikeStep(risks)) {
    [steps, risks] = [risks, steps];
  }

  details.push({
    id: detailId++,
    planName,
    cat1: clean(r['二级分类'] ?? r[keys[1]]),
    cat2: clean(r['三级分类'] ?? r[keys[2]]),
    cat3: clean(r['四级分类'] ?? r[keys[3]]),
    matterName: clean(r['事项名称'] ?? r[keys[4]]),
    steps,
    risks,
    laws: clean(r['相关法律法规和监管规定'] ?? r[keys[7]]),
    focus: clean(r['重点关注内容'] ?? r[keys[8]]),
  });
}

// 为明细匹配 planId；主表没有的方案（原先会落到「其他」）直接丢弃
const planByName = new Map(plans.map((p) => [p.name, p]));
const keptDetails = [];
for (const d of details) {
  if (EXCLUDED_PLAN_NAMES.has(d.planName)) continue;
  const plan = planByName.get(d.planName);
  if (!plan || plan.level1 === '其他') continue;
  d.planId = plan.id;
  keptDetails.push(d);
}
details.length = 0;
details.push(...keptDetails);

function contentScore(d) {
  return (
    (d.steps || '').length +
    (d.risks || '').length +
    (d.laws || '').length +
    (d.focus || '').length
  );
}

function exactKey(d) {
  return JSON.stringify({
    planId: d.planId,
    cat1: d.cat1,
    cat2: d.cat2,
    cat3: d.cat3,
    matterName: d.matterName,
    steps: d.steps,
    risks: d.risks,
    laws: d.laws,
    focus: d.focus,
  });
}

function matterPathKey(d) {
  return [d.planId, d.cat1, d.cat2, d.cat3, d.matterName].join('\u0001');
}

// 同一方案下去掉重复明细：先去完全相同内容，再按分类路径+事项名保留内容更全的一条
const beforeDetailCount = details.length;
const seenExact = new Set();
const byPath = new Map();
for (const d of details) {
  const ek = exactKey(d);
  if (seenExact.has(ek)) continue;
  seenExact.add(ek);
  const pk = matterPathKey(d);
  const prev = byPath.get(pk);
  if (!prev || contentScore(d) > contentScore(prev)) {
    byPath.set(pk, d);
  }
}
details.length = 0;
let nextDetailId = 1;
for (const d of byPath.values()) {
  d.id = nextDetailId++;
  details.push(d);
}
console.log(
  `Details deduped: ${beforeDetailCount} -> ${details.length} (removed ${beforeDetailCount - details.length})`
);

// 构建每个方案下的树
function buildDetailTree(planDetails) {
  const root = [];
  const l1Map = new Map();

  function attachMatter(parent, d) {
    const label = d.matterName || '(未命名事项)';
    // 分类名与事项名相同：把正文挂到分类节点上，避免树上出现同名两项
    if (parent.type === 'category' && parent.label === label && !parent.data) {
      parent.type = 'matter';
      parent.data = d;
      parent.id = `d-${d.id}`;
      if (!parent.children) parent.children = [];
      return;
    }
    parent.children.push({
      id: `d-${d.id}`,
      label,
      type: 'matter',
      level: (parent.level || 1) + 1,
      data: d,
      children: [],
    });
  }

  for (const d of planDetails) {
    const c1 = d.cat1 || '未分类';
    const c2 = d.cat2 || '';
    const c3 = d.cat3 || '';

    if (!l1Map.has(c1)) {
      const node = { id: `c1-${c1}`, label: c1, type: 'category', level: 1, children: [] };
      l1Map.set(c1, node);
      root.push(node);
    }
    const n1 = l1Map.get(c1);

    let parent = n1;
    if (c2) {
      let n2 = n1.children.find((x) => x.label === c2 && (x.type === 'category' || x.type === 'matter'));
      if (!n2) {
        n2 = { id: `c2-${c1}-${c2}`, label: c2, type: 'category', level: 2, children: [] };
        n1.children.push(n2);
      }
      parent = n2;
      if (c3) {
        let n3 = n2.children.find((x) => x.label === c3 && (x.type === 'category' || x.type === 'matter'));
        if (!n3) {
          n3 = {
            id: `c3-${c1}-${c2}-${c3}`,
            label: c3,
            type: 'category',
            level: 3,
            children: [],
          };
          n2.children.push(n3);
        }
        parent = n3;
      }
    }

    attachMatter(parent, d);
  }
  return root;
}

const plansWithTree = plans.map((p) => {
  const planDetails = details.filter((d) => d.planId === p.id);
  return {
    ...p,
    detailCount: planDetails.length,
    detailTree: buildDetailTree(planDetails),
  };
});

// ---- 审计事项库 ----
const matterBook = readSheet('审计事项库_分类整理.xlsx');
const matters = [];
let matterId = 1;

for (const r of matterBook.rows) {
  const name = clean(r['名称']);
  if (!name) continue;

  let procedures = clean(r['审计程序和方法']);
  let riskPoints = clean(r['风险点']);
  const looksLikeStep = (t) =>
    /询问|检查|查阅|抽样|核实|获取|比对|访谈|穿行|复核|分析|计算|确认/.test(t);
  const looksLikeRisk = (t) =>
    /不规范|不准确|不完整|未|缺失|虚假|风险|违规|舞弊|错误|遗漏/.test(t);
  if (
    procedures &&
    riskPoints &&
    looksLikeRisk(procedures) &&
    looksLikeStep(riskPoints)
  ) {
    [procedures, riskPoints] = [riskPoints, procedures];
  }

  matters.push({
    id: matterId++,
    level1: clean(r['一级分类']),
    level2: clean(r['二级分类']),
    level3: clean(r['三级分类']),
    name,
    laws: clean(r['相关法律法规和监管规定']),
    procedures,
    focus: clean(r['重点关注内容']),
    riskPoints,
  });
}

function buildMatterTree(list) {
  const root = [];
  const l1Map = new Map();

  function attachMatter(parent, m) {
    const label = m.name;
    if (parent.type === 'category' && parent.label === label && !parent.data) {
      parent.type = 'matter';
      parent.data = m;
      parent.id = `matter-${m.id}`;
      if (!parent.children) parent.children = [];
      return;
    }
    // 已有同名事项则跳过
    if (parent.children.some((x) => x.type === 'matter' && x.label === label)) {
      return;
    }
    parent.children.push({
      id: `matter-${m.id}`,
      label,
      type: 'matter',
      level: (parent.level || 1) + 1,
      data: m,
      children: [],
    });
  }

  for (const m of list) {
    const c1 = m.level1 || '未分类';
    if (!l1Map.has(c1)) {
      const node = { id: `m1-${c1}`, label: c1, type: 'category', level: 1, children: [] };
      l1Map.set(c1, node);
      root.push(node);
    }
    const n1 = l1Map.get(c1);

    let parent = n1;
    if (m.level2) {
      let n2 = n1.children.find((x) => x.label === m.level2);
      if (!n2) {
        n2 = {
          id: `m2-${c1}-${m.level2}`,
          label: m.level2,
          type: 'category',
          level: 2,
          children: [],
        };
        n1.children.push(n2);
      }
      parent = n2;
      if (m.level3) {
        let n3 = n2.children.find((x) => x.label === m.level3);
        if (!n3) {
          n3 = {
            id: `m3-${c1}-${m.level2}-${m.level3}`,
            label: m.level3,
            type: 'category',
            level: 3,
            children: [],
          };
          n2.children.push(n3);
        }
        parent = n3;
      }
    }

    attachMatter(parent, m);
  }
  return root;
}

const matterTree = buildMatterTree(matters);

// 方案分类树（左侧导航）
function buildPlanCategoryTree(planList) {
  const root = [];
  const l1Map = new Map();
  for (const p of planList) {
    const c1 = p.level1 || '未分类';
    if (!l1Map.has(c1)) {
      const node = { id: `p1-${c1}`, label: c1, type: 'category', children: [] };
      l1Map.set(c1, node);
      root.push(node);
    }
    const n1 = l1Map.get(c1);
    if (p.level2) {
      let n2 = n1.children.find((x) => x.type === 'category' && x.label === p.level2);
      if (!n2) {
        n2 = { id: `p2-${c1}-${p.level2}`, label: p.level2, type: 'category', children: [] };
        n1.children.push(n2);
      }
      n2.children.push({
        id: `plan-${p.id}`,
        label: p.name,
        type: 'plan',
        planId: p.id,
        detailCount: p.detailCount,
        children: [],
      });
    } else {
      n1.children.push({
        id: `plan-${p.id}`,
        label: p.name,
        type: 'plan',
        planId: p.id,
        detailCount: p.detailCount,
        children: [],
      });
    }
  }
  return root;
}

const planCategoryTree = buildPlanCategoryTree(plansWithTree);

const summary = {
  plans: plansWithTree.length,
  details: details.length,
  matters: matters.length,
  planCategoryTreeNodes: planCategoryTree.length,
};

fs.writeFileSync(
  path.join(outDir, 'plans.json'),
  JSON.stringify(plansWithTree, null, 0),
  'utf8'
);
fs.writeFileSync(
  path.join(outDir, 'plan-category-tree.json'),
  JSON.stringify(planCategoryTree, null, 0),
  'utf8'
);
fs.writeFileSync(
  path.join(outDir, 'matters.json'),
  JSON.stringify(matters, null, 0),
  'utf8'
);
fs.writeFileSync(
  path.join(outDir, 'matter-tree.json'),
  JSON.stringify(matterTree, null, 0),
  'utf8'
);
fs.writeFileSync(
  path.join(outDir, 'summary.json'),
  JSON.stringify(summary, null, 2),
  'utf8'
);

console.log('Parsed OK:', summary);
console.log('Sample plan:', plansWithTree[0]?.name, 'details', plansWithTree[0]?.detailCount);
console.log('Sample matter:', matters[0]?.name);
