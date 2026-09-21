import { createRouter, createWebHashHistory } from 'vue-router'
import AuditPlanView from './views/AuditPlanView.vue'
import AuditMatterView from './views/AuditMatterView.vue'
import KnowledgeBaseView from './views/KnowledgeBaseView.vue'
import ProblemCategoryView from './views/ProblemCategoryView.vue'
import AnalysisModelView from './views/AnalysisModelView.vue'

const routes = [
  { path: '/', redirect: '/plans' },
  { path: '/plans', name: 'plans', component: AuditPlanView, meta: { title: '审计方案' } },
  { path: '/matters', name: 'matters', component: AuditMatterView, meta: { title: '审计事项' } },
  {
    path: '/problem-categories',
    name: 'problem-categories',
    component: ProblemCategoryView,
    meta: { title: '问题分类' },
  },
  {
    path: '/analysis-models',
    name: 'analysis-models',
    component: AnalysisModelView,
    meta: { title: '数据分析模型' },
  },
  {
    path: '/knowledge',
    name: 'knowledge',
    component: KnowledgeBaseView,
    meta: { title: '专业知识' },
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
