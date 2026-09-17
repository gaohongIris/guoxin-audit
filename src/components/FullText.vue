<template>
  <div v-if="!text" class="content-text" style="color:#94a3b8">（暂无内容）</div>
  <div v-else class="content-text">{{ text }}</div>
</template>

<script setup>
defineProps({
  text: { type: String, default: '' },
})
</script>
