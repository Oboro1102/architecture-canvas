<script setup lang="ts">
import { ref } from 'vue'
import { Bot, LayoutDashboard, Building2, KanbanSquare, GitBranch, BarChart3 } from '@lucide/vue'
import { useCompanyStore } from '@/stores/company'
import { restoreAll } from '@/stores/persistence'
import DemoControlBar from '@/components/common/DemoControlBar.vue'
import ScenarioSelector from '@/components/common/ScenarioSelector.vue'

export type TabKey = 'dashboard' | 'office' | 'tasks' | 'workflow' | 'evaluation'

const company = useCompanyStore()
const mobileOpen = ref(false)
restoreAll()

const tabs: Array<{ key: TabKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'dashboard', label: '總覽', icon: LayoutDashboard },
  { key: 'office', label: '辦公室', icon: Building2 },
  { key: 'tasks', label: '任務', icon: KanbanSquare },
  { key: 'workflow', label: '流程', icon: GitBranch },
  { key: 'evaluation', label: '評估', icon: BarChart3 },
]

const activeTab = defineModel<TabKey>({ default: 'dashboard' })
</script>

<template>
  <div class="flex h-dvh flex-col bg-background text-foreground">
    <!-- 頂部列 -->
    <header class="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
      <Bot class="size-5 shrink-0 text-accent" aria-hidden="true" />
      <h1 class="text-sm font-semibold tracking-tight">AI Company OS</h1>
      <span class="hidden min-w-0 truncate text-xs text-muted-foreground sm:block">
        · {{ company.projectName || '目前沒有執行中的專案' }}
      </span>

      <button
        class="btn-secondary ml-auto !py-1 lg:hidden"
        :aria-expanded="mobileOpen"
        aria-controls="scenario-sheet"
        @click="mobileOpen = !mobileOpen"
      >
        選擇情境 ▼
      </button>
    </header>

    <DemoControlBar />

    <!-- 分頁列（所有寬度顯示） -->
    <nav
      v-if="company.runState !== 'idle'"
      class="flex overflow-x-auto border-b border-border bg-card px-2"
      aria-label="主要區塊"
    >
      <button
        v-for="t in tabs"
        :key="t.key"
        class="shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors focus-visible:focus-ring sm:text-sm"
        :class="
          activeTab === t.key
            ? 'border-accent text-accent'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        :aria-current="activeTab === t.key ? 'page' : undefined"
        @click="activeTab = t.key"
      >
        {{ t.label }}
      </button>
    </nav>

    <div class="flex min-h-0 flex-1">
      <!-- 側邊欄（桌機） -->
      <aside
        id="scenario-sheet"
        class="w-56 shrink-0 space-y-4 overflow-y-auto border-r border-border bg-card p-3 max-lg:hidden"
        aria-label="側邊欄"
      >
        <ScenarioSelector />
        <p
          v-if="company.runState !== 'idle'"
          class="px-2 pt-2 text-[10px] tracking-wide text-muted-foreground"
        >
          ※ 模擬資料
        </p>
      </aside>
      <!-- 手機版情境選單 -->
      <div
        v-if="mobileOpen"
        class="absolute inset-x-0 top-[104px] z-40 border-b border-border bg-card p-3 shadow-lg lg:hidden"
      >
        <ScenarioSelector @close="mobileOpen = false" />
      </div>

      <!-- 主要內容 + 右側面板 -->
      <div class="relative flex min-w-0 flex-1">
        <main class="min-w-0 flex-1 overflow-y-auto p-4 lg:p-6">
          <slot :tab="activeTab" />
        </main>

        <aside
          class="hidden w-72 shrink-0 flex-col border-l border-border bg-card p-3 xl:flex"
          aria-label="執行時間軸面板"
        >
          <slot name="timeline" />
        </aside>

        <!-- Agent 詳細資訊（由父層渲染） -->
        <slot name="detail" />
      </div>
    </div>
  </div>
</template>
