<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAIStore, AIMODE_LABEL } from '@/stores/ai'
import { useCompanyStore } from '@/stores/company'
import { getRealEngine } from '@/engine/realWorkflowEngine'
import { Rocket } from '@lucide/vue'

const ai = useAIStore()
const company = useCompanyStore()

const open = ref(false)
const projectName = ref('')
const requirement = ref('')
const running = computed(() => getRealEngine().isRunning || ['running', 'awaiting_approval'].includes(company.runState))

function start(): void {
  if (!requirement.value.trim()) return
  open.value = false
  void getRealEngine().start({
    name: projectName.value.trim() || 'New Project',
    description: requirement.value.trim(),
    requirements: [requirement.value.trim()],
  })
}
</script>

<template>
  <div class="relative">
    <button class="btn-secondary" :disabled="running" @click="open = !open">
      <Rocket class="size-4" aria-hidden="true" />
      {{ AIMODE_LABEL[ai.mode] }} — 啟動新專案
    </button>

    <Transition name="modal">
      <form
        v-if="open"
        class="absolute left-0 top-full z-30 mt-2 w-80 rounded-lg border border-border bg-card p-4 shadow-xl"
        aria-label="啟動 AI Company 專案"
        @submit.prevent="start"
      >
        <p class="text-xs text-muted-foreground">
          目前模式：<span class="font-medium">{{ ai.mode === 'real' ? 'Real AI（使用真實 LLM）' : '模擬（離線、免 Key）' }}</span>
        </p>

        <label for="rp-name" class="detail-label mt-3 block">專案名稱</label>
        <input
          id="rp-name"
          v-model="projectName"
          type="text"
          placeholder="Personal Finance App"
          class="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        />

        <label for="rp-req" class="detail-label mt-3 block">需求</label>
        <textarea
          id="rp-req"
          v-model="requirement"
          rows="5"
          placeholder="Build an e-commerce website for selling handmade coffee products.&#10;- Google login&#10;- Product search&#10;- Shopping cart"
          class="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
        ></textarea>
        <p v-if="ai.mode === 'real'" class="mt-1 text-[11px] text-muted-foreground">
          ⚠ 每個 Agent 步驟都會呼叫真實 LLM，消耗你的 API 額度。
        </p>

        <div class="mt-3 flex justify-end gap-2">
          <button type="button" class="btn-secondary !py-1.5" @click="open = false">取消</button>
          <button type="submit" class="btn-primary !py-1.5" :disabled="!requirement.trim() || running">
            啟動 AI Company
          </button>
        </div>
      </form>
    </Transition>
  </div>
</template>
