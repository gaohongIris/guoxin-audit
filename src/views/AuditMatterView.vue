<template>
  <div class="split">
    <!-- 左：事项分类树 -->
    <div class="panel">
      <div class="panel-head">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索事项名称 / 分类 / 正文"
          :prefix-icon="Search"
        />
      </div>
      <div class="panel-body tree-wrap">
        <el-tree
          :data="filteredTree"
          node-key="id"
          highlight-current
          default-expand-all
          :expand-on-click-node="false"
          @node-click="onNodeClick"
        >
          <template #default="{ data }">
            <span>
              <el-icon v-if="data.type === 'category'" style="margin-right:4px"><Folder /></el-icon>
              <el-icon v-else style="margin-right:4px"><Collection /></el-icon>
              {{ data.label }}
            </span>
          </template>
        </el-tree>
      </div>
    </div>

    <!-- 右：主信息 + 全文 / 或列表主表 -->
    <div class="panel">
      <div class="panel-head">
        <strong>审计事项库</strong>
        <el-tag size="small">共 {{ matters.length }} 项</el-tag>
        <el-radio-group v-model="viewMode" size="small" style="margin-left:auto">
          <el-radio-button value="detail">详情全文</el-radio-button>
          <el-radio-button value="table">主表列表</el-radio-button>
        </el-radio-group>
      </div>
      <div class="panel-body" style="padding:12px; overflow:auto">
        <template v-if="viewMode === 'table'">
          <el-table
            :data="filteredMatters"
            stripe
            border
            height="100%"
            highlight-current-row
            @current-change="onTableSelect"
          >
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="level1" label="一级分类" width="120" show-overflow-tooltip />
            <el-table-column prop="level2" label="二级分类" width="140" show-overflow-tooltip />
            <el-table-column prop="level3" label="三级分类" width="140" show-overflow-tooltip />
            <el-table-column prop="name" label="名称" min-width="160" />
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openMatter(row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <template v-else-if="current">
          <div class="meta-row">
            <span class="tag-soft">{{ current.level1 || '未分类' }}</span>
            <span v-if="current.level2" class="tag-soft">{{ current.level2 }}</span>
            <span v-if="current.level3" class="tag-soft">{{ current.level3 }}</span>
            <span class="stat-line">事项 ID：{{ current.id }}</span>
          </div>
          <div class="section-title">{{ current.name }}</div>

          <div class="content-block">
            <h4>相关法律法规和监管规定</h4>
            <FullText :text="current.laws" />
          </div>
          <div class="content-block">
            <h4>审计程序和方法</h4>
            <FullText :text="current.procedures" />
          </div>
          <div class="content-block">
            <h4>重点关注内容</h4>
            <FullText :text="current.focus" />
          </div>
          <div class="content-block">
            <h4>风险点</h4>
            <FullText :text="current.riskPoints" />
          </div>
        </template>
        <div v-else class="empty-tip">请在左侧树中选择审计事项，或切换到「主表列表」</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import matters from '../data/matters.json'
import matterTree from '../data/matter-tree.json'
import FullText from '../components/FullText.vue'

const keyword = ref('')
const viewMode = ref('detail')
const current = ref(matters[0] || null)

function filterTree(nodes, keywordVal) {
  if (!keywordVal) return nodes
  const kw = keywordVal.toLowerCase()
  const walk = (list) => {
    const out = []
    for (const n of list) {
      const children = n.children ? walk(n.children) : []
      const labelHit = (n.label || '').toLowerCase().includes(kw)
      const dataHit =
        n.data &&
        [n.data.laws, n.data.procedures, n.data.focus, n.data.riskPoints]
          .join('\n')
          .toLowerCase()
          .includes(kw)
      if (labelHit || dataHit || children.length) {
        out.push({ ...n, children })
      }
    }
    return out
  }
  return walk(nodes)
}

const filteredTree = computed(() => filterTree(matterTree, keyword.value))

const filteredMatters = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return matters
  return matters.filter((m) => {
    const blob = [
      m.level1,
      m.level2,
      m.level3,
      m.name,
      m.laws,
      m.procedures,
      m.focus,
      m.riskPoints,
    ]
      .join('\n')
      .toLowerCase()
    return blob.includes(kw)
  })
})

function onNodeClick(data) {
  if (data.type === 'matter' && data.data) {
    current.value = data.data
    viewMode.value = 'detail'
  }
}

function openMatter(row) {
  current.value = row
  viewMode.value = 'detail'
}

function onTableSelect(row) {
  if (row) current.value = row
}
</script>
