<template>
  <div class="am-layout">
    <div class="panel">
      <div class="panel-head">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索模型名称 / 分类 / 说明"
          :prefix-icon="Search"
        />
      </div>
      <div class="panel-body tree-wrap">
        <el-tree
          ref="treeRef"
          :data="filteredTree"
          node-key="id"
          highlight-current
          default-expand-all
          :expand-on-click-node="false"
          @node-click="onNodeClick"
        >
          <template #default="{ data }">
            <span class="tree-node">
              <el-icon v-if="data.type === 'domain'" style="margin-right:4px"><Folder /></el-icon>
              <el-icon v-else-if="data.type === 'category'" style="margin-right:4px"><FolderOpened /></el-icon>
              <el-icon v-else style="margin-right:4px"><DataAnalysis /></el-icon>
              <span>{{ data.label }}</span>
              <el-tag
                v-if="data.guoxin && data.type === 'domain'"
                size="small"
                type="warning"
                effect="plain"
                style="margin-left:6px"
              >精选</el-tag>
              <span
                v-if="data.type !== 'model' && data.modelCount != null"
                class="stat-line"
                style="margin-left:6px"
              >
                ({{ data.modelCount }})
              </span>
            </span>
          </template>
        </el-tree>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <strong>{{ panelTitle }}</strong>
        <el-tag size="small">共 {{ summary.models }} 个模型</el-tag>
        <el-tag size="small" type="warning">建议关注 {{ summary.guoxinModels || 0 }}</el-tag>
        <el-tag size="small" type="success">{{ summary.domains }} 个业务域</el-tag>
        <el-tag size="small" type="info">{{ summary.categories }} 个分类</el-tag>
        <el-radio-group v-model="viewMode" size="small" style="margin-left:auto">
          <el-radio-button value="list">分类列表</el-radio-button>
          <el-radio-button value="detail">模型详情</el-radio-button>
        </el-radio-group>
      </div>
      <div class="panel-body" style="padding:12px; overflow:auto">
        <template v-if="viewMode === 'list'">
          <div v-if="listContext" class="meta-row" style="margin-bottom:10px">
            <span class="tag-soft">{{ listContext.domain }}</span>
            <span v-if="listContext.category" class="tag-soft">{{ listContext.category }}</span>
            <span v-if="listContext.guoxin" class="tag-soft" style="background:#fff7ed;color:#c2410c">优先参考</span>
            <span class="stat-line">{{ listRows.length }} 个模型</span>
          </div>
          <el-table
            :data="listRows"
            stripe
            border
            highlight-current-row
            style="width:100%"
            @row-click="openModel"
          >
            <el-table-column prop="seq" label="序号" width="70" />
            <el-table-column prop="domain" label="来源业务域" width="110" />
            <el-table-column
              :prop="listFilter.guoxin ? 'guoxinCategory' : 'category'"
              :label="listFilter.guoxin ? '精选分类' : '分类'"
              width="150"
              show-overflow-tooltip
            />
            <el-table-column prop="name" label="模型名称" min-width="220" show-overflow-tooltip />
            <el-table-column prop="source" label="来源" width="140" show-overflow-tooltip />
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click.stop="openModel(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <template v-else-if="current">
          <div class="section-title">{{ current.name }}</div>
          <div class="meta-row">
            <span class="tag-soft">{{ current.domain }}</span>
            <span class="tag-soft">{{ current.category }}</span>
            <span
              v-if="current.guoxinApplicable"
              class="tag-soft"
              style="background:#fff7ed;color:#c2410c"
            >建议关注 · {{ current.guoxinCategory }}</span>
            <span v-if="current.seq" class="stat-line">序号 {{ current.seq }}</span>
          </div>

          <div v-if="current.description" class="content-block">
            <h4>说明</h4>
            <FullText :text="current.description" />
          </div>
          <div v-if="current.formula" class="content-block">
            <h4>指标公式</h4>
            <FullText :text="current.formula" />
          </div>
          <div v-if="current.logic" class="content-block">
            <h4>运算逻辑</h4>
            <FullText :text="current.logic" />
          </div>
          <div v-if="current.dataSource" class="content-block">
            <h4>数据来源</h4>
            <FullText :text="current.dataSource" />
          </div>
          <div v-if="current.riskResponse" class="content-block">
            <h4>风险应对（供参考）</h4>
            <FullText :text="current.riskResponse" />
          </div>
          <div v-if="current.source" class="content-block">
            <h4>来源</h4>
            <div class="content-text">{{ current.source }}</div>
          </div>

          <div v-if="extraFields.length" class="content-block">
            <h4>其他字段</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item
                v-for="f in extraFields"
                :key="f.key"
                :label="f.key"
              >
                <span style="white-space:pre-wrap">{{ f.value }}</span>
              </el-descriptions-item>
            </el-descriptions>
          </div>

          <div v-if="siblings.length" class="content-block">
            <h4>同分类模型（{{ siblings.length }}）</h4>
            <div class="chip-wrap">
              <el-button
                v-for="s in siblings"
                :key="s.id"
                size="small"
                :type="s.id === current.id ? 'primary' : 'default'"
                @click="openModel(s)"
              >
                {{ s.name }}
              </el-button>
            </div>
          </div>
        </template>

        <div v-else class="empty-tip">请在左侧选择业务域、分类或具体模型</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import models from '../data/analysis-models.json'
import tree from '../data/analysis-model-tree.json'
import summary from '../data/analysis-model-summary.json'
import FullText from '../components/FullText.vue'

const keyword = ref('')
const viewMode = ref('list')
const currentId = ref(null)
const listFilter = ref({ domain: '建议关注', category: '', guoxin: true })
const treeRef = ref()

const modelMap = new Map(models.map((m) => [m.id, m]))
const current = computed(() => modelMap.get(currentId.value) || null)

const knownFieldKeys = new Set([
  '序号',
  '类别',
  '分类',
  '模型分类',
  '指标类别',
  '名称',
  '指标名称',
  '模型名称',
  '说明',
  '模型说明',
  '指标说明',
  '指标公式',
  '风险应对（供参考）',
  '来源',
  '数据来源',
  '运算逻辑',
])

const extraFields = computed(() => {
  if (!current.value?.fields) return []
  return Object.entries(current.value.fields)
    .filter(([k, v]) => v && !knownFieldKeys.has(k))
    .map(([key, value]) => ({ key, value }))
})

const siblings = computed(() => {
  if (!current.value) return []
  if (listFilter.value.guoxin && current.value.guoxinCategory) {
    return models.filter((m) => m.guoxinCategory === current.value.guoxinCategory)
  }
  return models.filter(
    (m) =>
      m.domain === current.value.domain &&
      m.category === current.value.category
  )
})

const panelTitle = computed(() => {
  if (viewMode.value === 'detail' && current.value) return current.value.name
  if (listFilter.value.category) return listFilter.value.category
  if (listFilter.value.domain) return listFilter.value.domain
  return '数据分析模型'
})

const listContext = computed(() => {
  if (!listFilter.value.domain && !listFilter.value.category) return null
  return listFilter.value
})

const listRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return models.filter((m) => {
    if (listFilter.value.guoxin) {
      if (!m.guoxinApplicable) return false
      if (listFilter.value.category && m.guoxinCategory !== listFilter.value.category) {
        return false
      }
    } else {
      if (listFilter.value.domain && m.domain !== listFilter.value.domain) return false
      if (listFilter.value.category && m.category !== listFilter.value.category) return false
    }
    if (!kw) return true
    const blob = [
      m.domain,
      m.category,
      m.guoxinCategory,
      m.name,
      m.description,
      m.formula,
      m.logic,
      m.source,
      m.dataSource,
      m.riskResponse,
    ]
      .join('\n')
      .toLowerCase()
    return blob.includes(kw)
  })
})

function filterTree(nodes, kw) {
  if (!kw) return nodes
  const q = kw.toLowerCase()
  const walk = (list) => {
    const out = []
    for (const n of list) {
      const children = n.children ? walk(n.children) : []
      const hit = (n.label || '').toLowerCase().includes(q)
      const modelHit =
        n.type === 'model' &&
        (() => {
          const m = modelMap.get(n.modelId)
          if (!m) return false
          return [m.name, m.description, m.category, m.domain, m.guoxinCategory]
            .join('\n')
            .toLowerCase()
            .includes(q)
        })()
      if (hit || modelHit || children.length) {
        out.push({ ...n, children })
      }
    }
    return out
  }
  return walk(nodes)
}

const filteredTree = computed(() => filterTree(tree, keyword.value.trim()))

function onNodeClick(data) {
  if (data.type === 'model') {
    openModel(modelMap.get(data.modelId), { guoxin: Boolean(data.guoxin) })
    return
  }
  if (data.type === 'domain') {
    listFilter.value = {
      domain: data.label,
      category: '',
      guoxin: Boolean(data.guoxin) || data.label === '建议关注',
    }
    viewMode.value = 'list'
    currentId.value = null
    return
  }
  if (data.type === 'category') {
    const parentDomain = findDomainLabel(data.id)
    const guoxin = Boolean(data.guoxin) || parentDomain === '建议关注'
    listFilter.value = {
      domain: parentDomain || '',
      category: data.label,
      guoxin,
    }
    viewMode.value = 'list'
    currentId.value = null
  }
}

function findDomainLabel(catId) {
  for (const d of tree) {
    if ((d.children || []).some((c) => c.id === catId)) return d.label
  }
  return ''
}

function openModel(row, opts = {}) {
  if (!row) return
  currentId.value = row.id
  const guoxin = opts.guoxin ?? listFilter.value.guoxin
  listFilter.value = guoxin
    ? {
        domain: '建议关注',
        category: row.guoxinCategory || '',
        guoxin: true,
      }
    : { domain: row.domain, category: row.category, guoxin: false }
  viewMode.value = 'detail'
}
</script>

<style scoped>
.am-layout {
  display: grid;
  grid-template-columns: minmax(300px, 360px) 1fr;
  gap: 12px;
  height: 100%;
  min-width: 900px;
}

.tree-node {
  display: inline-flex;
  align-items: center;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
