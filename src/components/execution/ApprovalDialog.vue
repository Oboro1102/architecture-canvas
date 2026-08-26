<script setup lang="ts">
import { useCompanyStore } from '@/stores/company'
import { useAIStore } from '@/stores/ai'
import { getEngine } from '@/engine/scenarioEngine'
import { resolveRealApproval } from '@/engine/realWorkflowEngine'

const company = useCompanyStore()
const ai = useAIStore()

function approve(): void {
  if (ai.mode === 'real') {
    resolveRealApproval(true)
    return
  }
  getEngine().approve()
}
function reject(): void {
  if (ai.mode === 'real') {
    resolveRealApproval(false)
    return
  }
  getEngine().reject()
}
</script>

<template>
  <Transition name="modal">
    <div
      v-if="company.runState === 'awaiting_approval'"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-title"
    >
      <div class="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <h2 id="approval-title" class="text-base font-semibold">需要人工核准</h2>
        <p v-if="ai.mode === 'mock'" class="mt-2 text-sm text-muted-foreground">
          執行長在專案完成前請求人工核准。
        </p>
        <p v-if="ai.mode === 'mock'" class="mt-1 text-sm text-muted-foreground">
          按「核准專案」完成整個流程；按「否決」會回到上一個階段（除錯修復），讓 Agent 繼續工作。
        </p>
        <p v-else class="mt-2 text-sm text-muted-foreground">
          AI Company 想要繼續執行。請檢閱時間軸上的最新結果後決定是否放行。
        </p>
        <div class="mt-5 flex justify-end gap-3">
          <button class="btn-secondary" @click="reject">否決</button>
          <button class="btn-primary" @click="approve">
            {{ ai.mode === 'real' ? '核准繼續' : '核准專案' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
