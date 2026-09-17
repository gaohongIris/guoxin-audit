<template>
  <div class="pc-layout">
    <!-- 左：分类树 -->
    <div class="panel">
      <div class="panel-head">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索问题分类"
          :prefix-icon="Search"
        />
      </div>
      <div class="panel-body tree-wrap">
        <div class="filter-row">
          <el-checkbox v-model="showInactive">含失效</el-checkbox>
          <el-checkbox v-model="onlyInspection">仅巡视专用</el-checkbox>
        </div>
        <el-tree
          :data="filteredTree"
          node-key="id"
          highlight-current
          default-expand-all
          :expand-on-click-node="false"
          @node-click="onNodeClick"
        >
          <template #default="{ data }">
            <span class="tree-node">
              <el-icon v-if="data.type === 'root'" style="margin-right:4px"><Folder /></el-icon>
              <el-icon v-else style="margin-right:4px"><PriceTag /></el-icon>
              <span>{{ data.label }}</span>
              <el-tag
                v-if="data.data?.inactive"
                size="small"
                type="info"
                effect="plain"
                style="margin-left:6px"
              >失效</el-tag>
              <el-tag
                v-if="data.data?.inspectionOnly"
                size="small"
                type="warning"
                effect="plain"
                style="margin-left:4px"
              >巡视</el-tag>
            </span>
          </template>
        </el-tree>
      </div>
    </div>

    <!-- 右：主表 + 详情 -->
    <div class="panel">
      <div class="panel-head">
        <strong>问题分类台账</strong>
        <el-tag size="small">共 {{ summary.totalRows }} 条</el-tag>
        <el-tag size="small" type="success">审计问题下 {{ summary.auditProblemChildren }} 类</el-tag>
        <el-tag size="small" type="info">失效 {{ summary.inactiveCount }}</el-tag>
        <el-tag size="small" type="warning">巡视专用 {{ summary.inspectionCount }}</el-tag>
        <el-radio-group v-model="viewMode" size="small" style="margin-left:auto">
          <el-radio-button value="table">主表列表</el-radio-button>
          <el-radio-button value="detail">分类详情</el-radio-button>
        </el-radio-group>
      </div>
      <div class="panel-body" style="padding:12px; overflow:auto">
        <template v-if="viewMode === 'table'">
          <el-table
            :data="filteredTable"
            stripe
            border
            height="100%"
            highlight-current-row
            @current-change="onTableSelect"
          >
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="name" label="分类名称" min-width="220" show-overflow-tooltip />
            <el-table-column prop="parent" label="上级分类" min-width="180" show-overflow-tooltip />
            <el-table-column prop="path" label="完整路径" min-width="260" show-overflow-tooltip />
            <el-table-column prop="childCount" label="子类数" width="80" align="center" />
            <el-table-column label="标记" width="140">
              <template #default="{ row }">
                <el-tag v-if="row.inactive" size="small" type="info">失效</el-tag>
                <el-tag v-if="row.inspectionOnly" size="small" type="warning" style="margin-left:4px">巡视专用</el-tag>
                <span v-if="!row.inactive && !row.inspectionOnly" style="color:#94a3b8">—</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDetail(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <template v-else-if="current">
          <div class="section-title">{{ current.name }}</div>
          <div class="meta-row">
            <span class="tag-soft">ID {{ current.id }}</span>
            <span v-if="current.inactive" class="tag-soft" style="background:#f1f5f9;color:#64748b">失效</span>
            <span v-if="current.inspectionOnly" class="tag-soft" style="background:#fff7ed;color:#c2410c">巡视专用</span>
            <span class="stat-line">子分类 {{ current.childCount }} 个</span>
          </div>

          <div class="content-block">
            <h4>上级分类</h4>
            <div class="content-text">{{ current.parent || '（根节点）' }}</div>
          </div>
          <div class="content-block">
            <h4>完整路径</h4>
            <div class="content-text">{{ current.path }}</div>
          </div>
          <div class="content-block">
            <h4>下级分类</h4>
            <template v-if="childrenOfCurrent.length">
              <el-table :data="childrenOfCurrent" border size="small">
                <el-table-column prop="id" label="ID" width="60" />
                <el-table-column prop="name" label="分类名称" min-width="200" />
                <el-table-column label="标记" width="140">
                  <template #default="{ row }">
                    <el-tag v-if="row.inactive" size="small" type="info">失效</el-tag>
                    <el-tag v-if="row.inspectionOnly" size="small" type="warning">巡视专用</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="90">
                  <template #default="{ row }">
                    <el-button link type="primary" @click="openDetail(row)">查看</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </template>
            <div v-else class="content-text" style="color:#94a3b8">（无下级）</div>
          </div>

          <div v-if="siblings.length" class="content-block">
            <h4>同级分类（共 {{ siblings.length }} 个）</h4>
            <div class="chip-wrap">
              <el-button
                v-for="s in siblings"
                :key="s.id"
                size="small"
                :type="s.id === current.id ? 'primary' : 'default'"
                @click="openDetail(s)"
              >
                {{ s.name }}
              </el-button>
            </div>
          </div>
        </template>
        <div v-else class="empty-tip">请在左侧树或主表中选择一个问题分类</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import categories from '../data/problem-categories.json'
import categoryTree from '../data/problem-category-tree.json'
import summary from '../data/problem-category-summary.json'

const keyword = ref('')
const showInactive = ref(true)
const onlyInspection = ref(false)
const viewMode = ref('table')
const current = ref(categories.find((c) => c.parent === '审计问题') || categories[0] || null)

function matchItem(it, kw) {
  if (onlyInspection.value && !it.inspectionOnly) return false
  if (!showInactive.value && it.inactive) return false
  if (!kw) return true
  const q = kw.toLowerCase()
  return [it.name, it.parent, it.path].join('\n').toLowerCase().includes(q)
}

const filteredTable = computed(() =>
  categories.filter((c) => matchItem(c, keyword.value.trim()))
)

function filterTree(nodes) {
  const kw = keyword.value.trim().toLowerCase()
  const walk = (list) => {
    const out = []
    for (const n of list) {
      const data = n.data
      if (data && !data.isVirtualRoot) {
        if (onlyInspection.value && !data.inspectionOnly) {
          const children = n.children ? walk(n.children) : []
          if (children.length) out.push({ ...n, children })
          continue
        }
        if (!showInactive.value && data.inactive) {
          const children = n.children ? walk(n.children) : []
          if (children.length) out.push({ ...n, children })
          continue
        }
      }
      const children = n.children ? walk(n.children) : []
      const hit = !kw || (n.label || '').toLowerCase().includes(kw)
      if (hit || children.length || n.type === 'root') {
        // root always kept if has children after filter
        if (n.type === 'root' && kw && !hit && !children.length) continue
        out.push({ ...n, children })
      }
    }
    return out
  }
  return walk(categoryTree)
}

const filteredTree = computed(() => filterTree(categoryTree))

const childrenOfCurrent = computed(() => {
  if (!current.value) return []
  return categories.filter((c) => c.parent === current.value.name)
})

const siblings = computed(() => {
  if (!current.value) return []
  return categories.filter((c) => c.parent === current.value.parent)
})

function openDetail(row) {
  current.value = row
  viewMode.value = 'detail'
}

function onNodeClick(data) {
  if (data.data && !data.data.isVirtualRoot) {
    const row = categories.find((c) => c.id === data.data.id)
    if (row) openDetail(row)
  }
}

function onTableSelect(row) {
  if (row) current.value = row
}
</script>

<style scoped>
.pc-layout {
  display: grid;
  grid-template-columns: minmax(300px, 360px) 1fr;
  gap: 12px;
  height: 100%;
  min-width: 900px;
}

.filter-row {
  display: flex;
  gap: 12px;
  padding: 0 8px 10px;
  font-size: 13px;
}

.tree-node {
  display: inline-flex;
  align-items: center;
  max-width: 300px;
}

.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
