<template>
  <div class="kb-layout">
    <div class="panel">
      <div class="panel-head">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索专业知识 / 准则 / 事项"
          :prefix-icon="Search"
        />
      </div>
      <div class="panel-body tree-wrap">
        <el-divider content-position="left">知识域</el-divider>
        <el-tree
          :data="filteredDomainTree"
          node-key="id"
          highlight-current
          default-expand-all
          :expand-on-click-node="false"
          @node-click="onDomainClick"
        >
          <template #default="{ data }">
            <span>{{ data.label }}</span>
          </template>
        </el-tree>
        <el-divider content-position="left">关联审计事项</el-divider>
        <el-tree
          :data="filteredMatterTree"
          node-key="id"
          highlight-current
          default-expand-all
          :expand-on-click-node="false"
          @node-click="onMatterClick"
        >
          <template #default="{ data }">
            <span>{{ data.label }}</span>
          </template>
        </el-tree>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <strong>{{ panelTitle }}</strong>
        <el-tag v-if="view === 'domain' && currentDomain" size="small" type="warning">
          {{ currentDomain.pillar }}
        </el-tag>
        <el-button
          v-if="view === 'matter' && currentMatter"
          size="small"
          type="primary"
          link
          @click="goMatterLibrary"
        >
          在审计事项中打开全文
        </el-button>
      </div>
      <div class="panel-body kb-content">
        <template v-if="view === 'overview'">
          <div class="section-title">专业知识</div>
          <div class="meta-row">
            <span class="tag-soft">{{ kb.meta.source }}</span>
            <span class="stat-line">共 {{ kb.domains.length }} 个知识域</span>
          </div>
          <div class="content-block">
            <h4>说明</h4>
            <div class="content-text">
              本页仅沉淀专业知识：准则要点、核心知识点、审计落地动作及关联审计事项。
            </div>
          </div>
          <el-table :data="kb.domains" border stripe style="width:100%; margin-top:8px">
            <el-table-column prop="pillar" label="支柱" width="100" />
            <el-table-column prop="name" label="知识域" width="200" />
            <el-table-column prop="claim" label="内容概要" min-width="280" />
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
          </div>
          <div class="content-block">
            <h4>概要</h4>
            <div class="content-text">{{ currentDomain.claim }}</div>
          </div>
          <div class="content-block">
            <h4>依据准则 / 制度</h4>
            <ul class="kb-list">
              <li v-for="(s, i) in currentDomain.standards" :key="i">{{ s }}</li>
            </ul>
          </div>
          <div
            v-for="(block, i) in currentDomain.corePoints"
            :key="i"
            class="content-block"
          >
            <h4>{{ block.title }}</h4>
            <ul class="kb-list">
              <li v-for="(p, j) in block.points" :key="j">{{ p }}</li>
            </ul>
          </div>
          <div class="content-block">
            <h4>审计落地动作</h4>
            <ul class="kb-list">
              <li v-for="(h, i) in currentDomain.auditHooks" :key="i">{{ h }}</li>
            </ul>
          </div>
          <div class="content-block">
            <h4>关联审计事项</h4>
            <div class="kb-matter-chips">
              <el-button
                v-for="mid in currentDomain.linkedMatterIds"
                :key="mid"
                size="small"
                @click="openMatterById(mid)"
              >
                {{ matterName(mid) }}
              </el-button>
            </div>
          </div>
        </template>

        <template v-else-if="view === 'matter' && currentMatterIdx">
          <div class="section-title">{{ currentMatterIdx.name }}</div>
          <div class="meta-row">
            <span class="tag-soft">事项 ID {{ currentMatterIdx.matterId }}</span>
            <span class="stat-line">{{ currentMatterIdx.path }}</span>
          </div>
          <div class="content-block">
            <h4>为何纳入本知识库</h4>
            <div class="content-text">{{ currentMatterIdx.why }}</div>
          </div>
          <div class="content-block">
            <h4>覆盖知识域</h4>
            <div class="kb-matter-chips">
              <el-button
                v-for="did in currentMatterIdx.domains"
                :key="did"
                size="small"
                type="primary"
                plain
                @click="openDomainById(did)"
              >
                {{ domainName(did) }}
              </el-button>
            </div>
          </div>
          <template v-if="currentMatter">
            <div class="content-block">
              <h4>事项库 · 相关法律法规和监管规定</h4>
              <FullText :text="currentMatter.laws" />
            </div>
            <div class="content-block">
              <h4>事项库 · 审计程序和方法</h4>
              <FullText :text="currentMatter.procedures" />
            </div>
            <div class="content-block">
              <h4>事项库 · 重点关注内容</h4>
              <FullText :text="currentMatter.focus" />
            </div>
            <div class="content-block">
              <h4>事项库 · 风险点</h4>
              <FullText :text="currentMatter.riskPoints" />
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import kb from '../data/knowledge-base.json'
import matters from '../data/matters.json'
import FullText from '../components/FullText.vue'

const route = useRoute()
const router = useRouter()
const keyword = ref('')
const view = ref('overview')
const currentDomain = ref(kb.domains[0] || null)
const currentMatterIdx = ref(null)

if (currentDomain.value) view.value = 'domain'

onMounted(() => {
  const id = route.query.domain
  if (id) {
    const d = kb.domains.find((x) => x.id === id)
    if (d) openDomain(d)
  }
})

const matterMap = new Map(matters.map((m) => [m.id, m]))

const currentMatter = computed(() => {
  if (!currentMatterIdx.value) return null
  return matterMap.get(currentMatterIdx.value.matterId) || null
})

const panelTitle = computed(() => {
  if (view.value === 'overview') return '专业知识总览'
  if (view.value === 'domain') return currentDomain.value?.name || '知识域'
  return currentMatterIdx.value?.name || '关联审计事项'
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
      domain: d,
    })
  }
  return [...pillars.values()]
})

const matterTree = computed(() =>
  kb.matterIndex.map((m) => ({
    id: `mi-${m.matterId}`,
    label: `${m.matterId}. ${m.name}`,
    type: 'matter',
    matter: m,
  }))
)

function filterNodes(nodes, kw) {
  if (!kw) return nodes
  const q = kw.toLowerCase()
  const walk = (list) => {
    const out = []
    for (const n of list) {
      const children = n.children ? walk(n.children) : []
      const blob = JSON.stringify(n.domain || n.matter || n).toLowerCase()
      if ((n.label || '').toLowerCase().includes(q) || blob.includes(q) || children.length) {
        out.push({ ...n, children })
      }
    }
    return out
  }
  return walk(nodes)
}

const filteredDomainTree = computed(() => filterNodes(domainTree.value, keyword.value))
const filteredMatterTree = computed(() => filterNodes(matterTree.value, keyword.value))

function openDomain(row) {
  currentDomain.value = row
  currentMatterIdx.value = null
  view.value = 'domain'
}

function openDomainById(id) {
  const d = kb.domains.find((x) => x.id === id)
  if (d) openDomain(d)
}

function openMatterById(id) {
  const m = kb.matterIndex.find((x) => x.matterId === id)
  if (m) {
    currentMatterIdx.value = m
    currentDomain.value = null
    view.value = 'matter'
  }
}

function onDomainClick(data) {
  if (data.type === 'domain' && data.domain) openDomain(data.domain)
}

function onMatterClick(data) {
  if (data.type === 'matter' && data.matter) openMatterById(data.matter.matterId)
}

function matterName(id) {
  return kb.matterIndex.find((x) => x.matterId === id)?.name || `事项${id}`
}

function domainName(id) {
  return kb.domains.find((x) => x.id === id)?.name || id
}

function goMatterLibrary() {
  router.push('/matters')
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

.kb-list {
  margin: 0;
  padding-left: 1.2em;
  line-height: 1.75;
  font-size: 13px;
  color: #243447;
}

.kb-matter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
