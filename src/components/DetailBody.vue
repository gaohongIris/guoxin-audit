<template>
  <div>
    <div class="meta-row" style="margin-bottom:10px">
      <span class="tag-soft">{{ pathText }}</span>
      <span class="stat-line">明细 ID：{{ detail.id }}</span>
    </div>
    <div class="section-title">{{ detail.matterName || '(未命名事项)' }}</div>

    <div class="content-block">
      <h4>审计步骤和方法</h4>
      <FullText :text="detail.steps" />
    </div>
    <div class="content-block">
      <h4>审计风险</h4>
      <FullText :text="detail.risks" />
    </div>
    <div class="content-block">
      <h4>相关法律法规和监管规定</h4>
      <FullText :text="detail.laws" />
    </div>
    <div class="content-block">
      <h4>重点关注内容</h4>
      <FullText :text="detail.focus" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import FullText from './FullText.vue'

const props = defineProps({
  detail: { type: Object, required: true },
})

const pathText = computed(() => {
  const parts = [props.detail.cat1, props.detail.cat2, props.detail.cat3].filter(Boolean)
  return parts.join(' / ') || '未分类'
})
</script>
