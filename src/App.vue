<template>
  <el-container class="app-shell">
    <el-aside width="220px" class="app-aside">
      <div class="brand">
        <div class="brand-title">国新审计管理</div>
        <div class="brand-sub">基于国投资料整理</div>
      </div>
      <el-menu
        :default-active="active"
        router
        background-color="#0f2744"
        text-color="#c8d6e5"
        active-text-color="#ffffff"
      >
        <el-menu-item index="/plans">
          <el-icon><Document /></el-icon>
          <span>审计方案</span>
        </el-menu-item>
        <el-menu-item index="/matters">
          <el-icon><List /></el-icon>
          <span>审计事项</span>
        </el-menu-item>
        <el-menu-item index="/problem-categories">
          <el-icon><PriceTag /></el-icon>
          <span>问题分类</span>
        </el-menu-item>
        <el-menu-item index="/knowledge">
          <el-icon><Collection /></el-icon>
          <span>专业知识</span>
        </el-menu-item>
      </el-menu>
      <div class="aside-footer">
        <div>方案 {{ summary.plans }} 套</div>
        <div>明细 {{ summary.details }} 条</div>
        <div>事项库 {{ summary.matters }} 项</div>
        <div>问题分类 {{ pcSummary.totalRows }} 条</div>
        <div>知识域 4 个</div>
      </div>
    </el-aside>
    <el-container>
      <el-header class="app-header" height="56px">
        <div class="header-title">{{ pageTitle }}</div>
        <div class="header-hint">{{ headerHint }}</div>
      </el-header>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import summary from './data/summary.json'
import pcSummary from './data/problem-category-summary.json'

const route = useRoute()
const active = computed(() => route.path)
const pageTitle = computed(() => route.meta.title || '审计管理')
const headerHint = computed(() => {
  if (route.path === '/knowledge') return '准则要点 · 知识点 · 审计落地 · 事项对标'
  if (route.path === '/problem-categories') return '国投问题分类台账 · 上下级全量'
  return '主子表 · 上下级树 · 全文可见'
})
</script>
