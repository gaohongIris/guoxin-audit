<template>
  <div v-if="loading" class="empty-tip" style="padding:48px">正在加载方案数据，请稍候…</div>
  <div v-else-if="loadError" class="empty-tip" style="padding:48px">{{ loadError }}</div>
  <div v-else class="split-3">
    <!-- 左：方案分类树（上下级） -->
    <div class="panel">
      <div class="panel-head">
        <el-input
          v-model="planKeyword"
          clearable
          placeholder="搜索方案名称 / 分类"
          :prefix-icon="Search"
        />
      </div>
      <div class="panel-body tree-wrap">
        <el-tree
          ref="planTreeRef"
          :data="filteredPlanTree"
          node-key="id"
          :props="{ label: 'label', children: 'children' }"
          highlight-current
          default-expand-all
          :expand-on-click-node="false"
          @node-click="onPlanNodeClick"
        >
          <template #default="{ data }">
            <span class="tree-node">
              <el-icon v-if="data.type === 'category'" style="margin-right:4px"><Folder /></el-icon>
              <el-icon v-else style="margin-right:4px"><Document /></el-icon>
              <span>{{ data.label }}</span>
              <span v-if="data.type === 'plan'" class="stat-line" style="margin-left:6px">
                ({{ data.detailCount }})
              </span>
            </span>
          </template>
        </el-tree>
      </div>
    </div>

    <!-- 中：方案主表信息 + 明细树 -->
    <div class="panel">
      <div class="panel-head">
        <strong>方案主表</strong>
        <el-tag v-if="currentPlan" size="small" type="info">ID {{ currentPlan.id }}</el-tag>
        <el-tag v-if="currentPlan" size="small">明细 {{ currentPlan.detailCount }} 条</el-tag>
      </div>
      <div class="panel-body" style="padding:12px; overflow:auto">
        <template v-if="currentPlan">
          <div class="section-title">{{ currentPlan.name }}</div>
          <div class="meta-row">
            <span class="tag-soft">{{ currentPlan.level1 || '未分类' }}</span>
            <span v-if="currentPlan.level2" class="tag-soft">{{ currentPlan.level2 }}</span>
          </div>

          <div class="content-block">
            <h4>编制依据</h4>
            <FullText :text="currentPlan.basis" />
          </div>
          <div class="content-block">
            <h4>审计目标</h4>
            <FullText :text="currentPlan.objective" />
          </div>
          <div class="content-block">
            <h4>审计范围与重点</h4>
            <FullText :text="currentPlan.scope" />
          </div>
          <div class="content-block">
            <h4>重要性评估和风险评估</h4>
            <FullText :text="currentPlan.riskAssessment" />
          </div>
          <div class="content-block">
            <h4>审计程序</h4>
            <FullText :text="currentPlan.procedure" />
          </div>
          <div class="content-block">
            <h4>重点关注内容</h4>
            <FullText :text="currentPlan.focus" />
          </div>

          <el-divider content-position="left">子表 · 方案明细树</el-divider>
          <el-input
            v-model="detailKeyword"
            clearable
            size="small"
            placeholder="在明细树中搜索事项"
            style="margin-bottom:8px"
            :prefix-icon="Search"
          />
          <el-tree
            :data="filteredDetailTree"
            node-key="id"
            highlight-current
            default-expand-all
            :expand-on-click-node="false"
            @node-click="onDetailNodeClick"
          >
            <template #default="{ data }">
              <span>
                <el-icon v-if="data.type === 'category'" style="margin-right:4px"><FolderOpened /></el-icon>
                <el-icon v-else style="margin-right:4px"><Tickets /></el-icon>
                {{ data.label }}
              </span>
            </template>
          </el-tree>
        </template>
        <div v-else class="empty-tip">请在左侧选择一个审计方案</div>
      </div>
    </div>

    <!-- 右：明细全文 -->
    <div class="panel">
      <div class="panel-head">
        <strong>明细子表 · 全文</strong>
        <el-button
          v-if="currentPlan"
          size="small"
          @click="showAllDetails = !showAllDetails"
        >
          {{ showAllDetails ? '仅看选中项' : '展开全部明细内容' }}
        </el-button>
      </div>
      <div class="panel-body" style="padding:12px; overflow:auto">
        <template v-if="showAllDetails && currentPlan">
          <div
            v-for="d in filteredDetails"
            :key="d.id"
            class="detail-card"
            style="margin-bottom:12px"
          >
            <DetailBody :detail="d" />
          </div>
          <div v-if="!filteredDetails.length" class="empty-tip">无匹配明细</div>
        </template>
        <template v-else-if="currentDetail">
          <div class="detail-card">
            <DetailBody :detail="currentDetail" />
          </div>
        </template>
        <div v-else class="empty-tip">
          选择明细树中的事项查看全文，或点击「展开全部明细内容」
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { Search } from '@element-plus/icons-vue'
import plansUrl from '../data/plans.json?url'
import planCategoryTree from '../data/plan-category-tree.json'
import FullText from '../components/FullText.vue'
import DetailBody from '../components/DetailBody.vue'

const planKeyword = ref('')
const detailKeyword = ref('')
const plans = ref([])
const loading = ref(true)
const loadError = ref('')
const currentPlanId = ref(null)
const currentDetail = ref(null)
const showAllDetails = ref(false)
const planTreeRef = ref()

onMounted(async () => {
  try {
    const res = await fetch(plansUrl)
    if (!res.ok) throw new Error(`方案数据加载失败（${res.status}）`)
    plans.value = await res.json()
    const richPlan = plans.value.find((p) => p.basis || p.objective || p.scope) || plans.value[0]
    currentPlanId.value = richPlan?.id || null
  } catch (err) {
    loadError.value = err?.message || '方案数据加载失败，请检查网络后刷新'
  } finally {
    loading.value = false
  }
})

const planMap = computed(() => new Map(plans.value.map((p) => [p.id, p])))
const currentPlan = computed(() => planMap.value.get(currentPlanId.value) || null)

function collectDetails(nodes, out = []) {
  for (const n of nodes || []) {
    if (n.data) out.push(n.data)
    if (n.children?.length) collectDetails(n.children, out)
  }
  return out
}

function filterTree(nodes, keyword) {
  if (!keyword) return nodes
  const kw = keyword.toLowerCase()
  const walk = (list) => {
    const out = []
    for (const n of list) {
      const children = n.children ? walk(n.children) : []
      const hit = (n.label || '').toLowerCase().includes(kw)
      if (hit || children.length) {
        out.push({ ...n, children })
      }
    }
    return out
  }
  return walk(nodes)
}

const filteredPlanTree = computed(() => filterTree(planCategoryTree, planKeyword.value))

const filteredDetailTree = computed(() => {
  if (!currentPlan.value) return []
  return filterTree(currentPlan.value.detailTree || [], detailKeyword.value)
})

const filteredDetails = computed(() => {
  if (!currentPlan.value) return []
  const kw = detailKeyword.value.trim().toLowerCase()
  const details = collectDetails(currentPlan.value.detailTree || [])
  if (!kw) return details
  return details.filter((d) => {
    const blob = [
      d.matterName,
      d.cat1,
      d.cat2,
      d.cat3,
      d.steps,
      d.risks,
      d.laws,
      d.focus,
    ]
      .join('\n')
      .toLowerCase()
    return blob.includes(kw)
  })
})

function onPlanNodeClick(data) {
  if (data.type === 'plan') {
    currentPlanId.value = data.planId
    currentDetail.value = null
    showAllDetails.value = false
    detailKeyword.value = ''
  }
}

function onDetailNodeClick(data) {
  if (data.type === 'matter' && data.data) {
    currentDetail.value = data.data
    showAllDetails.value = false
  }
}

watch(currentPlanId, () => {
  currentDetail.value = null
})
</script>

<style scoped>
.tree-node {
  display: inline-flex;
  align-items: center;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
