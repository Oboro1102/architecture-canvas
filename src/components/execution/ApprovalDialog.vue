<script setup lang="ts">
import { computed } from 'vue'
import { useCompanyStore } from '@/stores/company'
import { useAIStore } from '@/stores/ai'
import { getEngine } from '@/engine/scenarioEngine'
import { resolveRealApproval } from '@/engine/realWorkflowEngine'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const company = useCompanyStore()
const ai = useAIStore()

/** shadcn Dialog is controlled — open while awaiting approval. */
const open = computed({
  get: () => company.runState === 'awaiting_approval',
  set: () => {
    /* 不允許點背景關閉 — 必須明確核准或否決 */
  },
})

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
  <Dialog v-model:open="open">
    <DialogContent
      class="max-w-md"
      :show-close-button="false"
      :interact-outside="(e: Event) => e.preventDefault()"
      aria-describedby="approval-desc"
    >
      <DialogHeader>
        <DialogTitle>需要人工核准</DialogTitle>
        <DialogDescription id="approval-desc">
          {{ ai.mode === 'mock'
            ? '執行長在專案完成前請求人工核准。按「核准專案」完成整個流程；按「否決」會回到上一個階段（除錯修復），讓 Agent 繼續工作。'
            : 'AI Company 想要繼續執行。請檢閱時間軸上的最新結果後決定是否放行。' }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="reject">否決</Button>
        <Button @click="approve">
          {{ ai.mode === 'real' ? '核准繼續' : '核准專案' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
