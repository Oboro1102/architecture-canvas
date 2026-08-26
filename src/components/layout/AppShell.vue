<script setup lang="ts">
import { ref } from 'vue'
import { Bot, LayoutDashboard, Building2, KanbanSquare, GitBranch, BarChart3, Settings } from '@lucide/vue'
import { useCompanyStore } from '@/stores/company'
import { useAIStore, AIMODE_LABEL } from '@/stores/ai'
import { restoreAll } from '@/stores/persistence'
import DemoControlBar from '@/components/common/DemoControlBar.vue'
import ScenarioSelector from '@/components/common/ScenarioSelector.vue'
import ProjectLauncher from '@/components/common/ProjectLauncher.vue'
import AISettingsDialog from '@/components/settings/AISettingsDialog.vue'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type TabKey = 'dashboard' | 'office' | 'tasks' | 'workflow' | 'evaluation'

const company = useCompanyStore()
const ai = useAIStore()
const mobileOpen = ref(false)
const settingsOpen = ref(false)
restoreAll()

const tabs: Array<{ key: TabKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'dashboard', label: '總覽', icon: LayoutDashboard },
  { key: 'office', label: '辦公室', icon: Building2 },
  { key: 'tasks', label: '任務', icon: KanbanSquare },
  { key: 'workflow', label: '流程', icon: GitBranch },
  { key: 'evaluation', label: '評估', icon: BarChart3 },
]

const activeTab = defineModel<TabKey>({ default: 'dashboard' })

/** §33 — selecting Real without a key opens Settings instead. */
function onModeSelect(mode: string): void {
  const next = (mode || 'mock') as 'mock' | 'real'
  if (!ai.switchMode(next)) {
    settingsOpen.value = true
  }
}
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

      <Button
        variant="outline"
        size="sm"
        class="ml-auto lg:hidden"
        :aria-expanded="mobileOpen"
        aria-controls="scenario-sheet"
        @click="mobileOpen = !mobileOpen"
      >
        選擇情境 ▼
      </Button>

      <!-- AI Mode indicator + switch (spec §32/§33 — text label, never color-only) -->
      <div class="ml-auto flex items-center gap-2 max-lg:ml-2">
        <div class="flex items-center gap-2 text-xs">
          <span class="text-muted-foreground">AI 模式</span>
          <Select
            :model-value="ai.mode"
            @update:model-value="onModeSelect($event as string)"
          >
            <SelectTrigger size="sm" aria-label="切換 AI 模式" class="font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mock">{{ AIMODE_LABEL.mock }}</SelectItem>
              <SelectItem value="real" :disabled="!ai.realReady">
                {{ ai.realReady ? AIMODE_LABEL.real : '● Real AI（需設定 API Key）' }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span
          class="hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide sm:inline-block"
          :class="ai.mode === 'real' && 'bg-accent/15 text-accent'"
          role="status"
        >
          {{ ai.mode === 'real' ? 'REAL AI' : 'SIMULATION' }}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="開啟 AI Provider 設定"
          @click="settingsOpen = true"
        >
          <Settings class="size-4" aria-hidden="true" />
        </Button>
      </div>
    </header>

    <DemoControlBar />

    <!-- Real workflow launcher (§57) -->
    <div class="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
      <ProjectLauncher />
      <span class="text-xs text-muted-foreground">
        或使用下方示範控制列播放離線模擬情境
      </span>
    </div>

    <!-- 分頁列（所有寬度顯示） -->
    <nav
      v-if="company.runState !== 'idle'"
      class="flex overflow-x-auto border-b border-border bg-card px-2"
      aria-label="主要區塊"
    >
      <Button
        v-for="t in tabs"
        :key="t.key"
        variant="ghost"
        size="sm"
        class="shrink-0 rounded-b-none border-b-2 px-3 py-2 text-xs sm:text-sm"
        :class="
          activeTab === t.key
            ? 'border-accent text-accent'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        "
        :aria-current="activeTab === t.key ? 'page' : undefined"
        @click="activeTab = t.key"
      >
        {{ t.label }}
      </Button>
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

    <!-- Mode switch notice (§34) -->
    <Transition name="modal">
      <div
        v-if="ai.modeNotice"
        class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-border bg-popover px-4 py-2.5 text-sm text-popover-foreground shadow-xl"
        role="status"
      >
        <div class="flex items-center gap-3">
          <span>{{ ai.modeNotice }}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="關閉提示"
            @click="ai.dismissNotice()"
          >✕</Button>
        </div>
      </div>
    </Transition>

    <AISettingsDialog v-model="settingsOpen" />
  </div>
</template>
