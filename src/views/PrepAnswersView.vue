<template>
  <div class="kb-layout">
    <div class="panel">
      <div class="panel-head">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索问题 / 答案"
          :prefix-icon="Search"
        />
      </div>
      <div class="panel-body tree-wrap">
        <div class="kb-guide-card" @click="selectGuide">
          <div class="kb-guide-title">应答总则</div>
          <div class="kb-guide-sub">结构 · 禁忌 · 开场稿</div>
        </div>
        <el-divider content-position="left">按知识域备答</el-divider>
        <el-tree
          :data="filteredTree"
          node-key="id"
          highlight-current
          default-expand-all
          :expand-on-click-node="false"
          @node-click="onDomainClick"
        >
          <template #default="{ data }">
            <span class="tree-label">
              <el-tag
                v-if="data.level"
                size="small"
                type="success"
                effect="plain"
                style="margin-right:6px"
              >
                {{ data.level }}
              </el-tag>
              {{ data.label }}
            </span>
          </template>
        </el-tree>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <strong>{{ panelTitle }}</strong>
        <el-tag v-if="view === 'domain' && currentDomain" size="small" type="success">
          {{ currentDomain.level }}
        </el-tag>
      </div>
      <div class="panel-body kb-content">
        <template v-if="view === 'guide'">
          <div class="section-title">帮助 · 应答总则</div>
          <div class="content-block">
            <h4>定位一句话</h4>
            <div class="content-text">{{ kb.surveyGuide.positioning }}</div>
          </div>
          <div class="content-block">
            <h4>标准应答结构（三步）</h4>
            <ol class="kb-list">
              <li v-for="(s, i) in kb.surveyGuide.answerStructure" :key="i">{{ s }}</li>
            </ol>
          </div>
          <div class="content-block">
            <h4>应答禁忌</h4>
            <ul class="kb-list">
              <li v-for="(s, i) in kb.surveyGuide.doNot" :key="i">{{ s }}</li>
            </ul>
          </div>
          <div
            v-for="(card, i) in kb.quickCards"
            :key="i"
            class="content-block"
          >
            <h4>{{ card.title }}</h4>
            <div class="content-text">{{ card.body }}</div>
          </div>
          <el-divider />
          <div class="section-title" style="font-size:15px">分域备答入口</div>
          <el-table :data="kb.domains" border stripe style="width:100%; margin-top:8px">
            <el-table-column prop="pillar" label="支柱" width="100" />
            <el-table-column prop="name" label="知识域" width="180" />
            <el-table-column prop="level" label="备答级别" width="110" />
            <el-table-column label="问答数" width="90">
              <template #default="{ row }">
                {{ (row.likelyQuestions || []).length }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDomain(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <template v-else-if="view === 'domain' && currentDomain">
          <div class="section-title">{{ currentDomain.name }}</div>
          <div class="meta-row">
            <span class="tag-soft">{{ currentDomain.pillar }}</span>
            <span class="tag-soft">{{ currentDomain.level }}</span>
          </div>
          <div class="content-block">
            <h4>对外表述</h4>
            <div class="content-text">{{ currentDomain.claim }}</div>
          </div>
          <div class="content-block">
            <h4>客户可能问到的问题与准备答案</h4>
            <div
              v-for="(qa, i) in filteredQuestions"
              :key="i"
              class="qa-card"
            >
              <div class="qa-q">Q：{{ qa.q }}</div>
              <div class="qa-a">A：{{ qa.a }}</div>
            </div>
            <div v-if="!filteredQuestions.length" class="empty-tip">无匹配问答</div>
          </div>
          <div class="content-block">
            <h4>关联专业知识</h4>
            <el-button size="small" type="primary" plain @click="goKnowledge(currentDomain.id)">
              打开「{{ currentDomain.name }}」专业知识
            </el-button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import kb from '../data/knowledge-base.json'

const router = useRouter()
const keyword = ref('')
const view = ref('guide')
const currentDomain = ref(null)

const panelTitle = computed(() => {
  if (view.value === 'guide') return '应答总则'
  return currentDomain.value?.name || '帮助'
})

const domainTree = computed(() => {
  const pillars = new Map()
  for (const d of kb.domains) {
    if (!pillars.has(d.pillar)) {
      pillars.set(d.pillar, {
        id: `p-${d.pillar}`,
        label: d.pillar,
        type: 'pillar',
        children: [],
      })
    }
    pillars.get(d.pillar).children.push({
      id: d.id,
      label: d.name,
      type: 'domain',
      level: d.level,
      domain: d,
    })
  }
  return [...pillars.values()]
})

function filterNodes(nodes, kw) {
  if (!kw) return nodes
  const q = kw.toLowerCase()
  const walk = (list) => {
    const out = []
    for (const n of list) {
      const children = n.children ? walk(n.children) : []
      const qaHit =
        n.domain &&
        (n.domain.likelyQuestions || []).some(
          (qa) =>
            (qa.q || '').toLowerCase().includes(q) ||
            (qa.a || '').toLowerCase().includes(q)
        )
      const hit = (n.label || '').toLowerCase().includes(q) || qaHit
      if (hit || children.length) out.push({ ...n, children })
    }
    return out
  }
  return walk(nodes)
}

const filteredTree = computed(() => filterNodes(domainTree.value, keyword.value))

const filteredQuestions = computed(() => {
  if (!currentDomain.value) return []
  const list = currentDomain.value.likelyQuestions || []
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return list
  return list.filter(
    (qa) =>
      (qa.q || '').toLowerCase().includes(kw) ||
      (qa.a || '').toLowerCase().includes(kw)
  )
})

function selectGuide() {
  view.value = 'guide'
  currentDomain.value = null
}

function openDomain(row) {
  currentDomain.value = row
  view.value = 'domain'
}

function onDomainClick(data) {
  if (data.type === 'domain' && data.domain) openDomain(data.domain)
}

function goKnowledge(id) {
  router.push({ path: '/knowledge', query: { domain: id } })
}
</script>

<style scoped>
.kb-layout {
  display: grid;
  grid-template-columns: minmax(300px, 340px) 1fr;
  gap: 12px;
  height: 100%;
  min-width: 800px;
}

.kb-content {
  padding: 14px 16px;
  overflow: auto;
}

.kb-guide-card {
  margin: 4px 6px 10px;
  padding: 12px;
  border: 1px solid #dbe7f5;
  border-radius: 8px;
  background: #f3f8ff;
  cursor: pointer;
}

.kb-guide-card:hover {
  border-color: #1a5fb4;
}

.kb-guide-title {
  font-weight: 650;
  font-size: 14px;
}

.kb-guide-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7a90;
}

.kb-list {
  margin: 0;
  padding-left: 1.2em;
  line-height: 1.75;
  font-size: 13px;
  color: #243447;
}

.qa-card {
  border: 1px solid #e6ebf2;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: #fafbfc;
}

.qa-q {
  font-weight: 650;
  font-size: 13px;
  color: #1a5fb4;
  margin-bottom: 6px;
}

.qa-a {
  font-size: 13px;
  line-height: 1.7;
  color: #243447;
  white-space: pre-wrap;
}

.tree-label {
  display: inline-flex;
  align-items: center;
}
</style>
