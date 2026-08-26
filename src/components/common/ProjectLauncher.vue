<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAIStore, AIMODE_LABEL } from '@/stores/ai'
import { useCompanyStore } from '@/stores/company'
import { getRealEngine } from '@/engine/realWorkflowEngine'
import { Rocket } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

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
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="outline" :disabled="running">
        <Rocket class="size-4" aria-hidden="true" />
        {{ AIMODE_LABEL[ai.mode] }} — 啟動新專案
      </Button>
    </PopoverTrigger>

    <PopoverContent class="w-80" align="start">
      <form aria-label="啟動 AI Company 專案" @submit.prevent="start">
        <p class="text-xs text-muted-foreground">
          目前模式：<span class="font-medium">{{ ai.mode === 'real' ? 'Real AI（使用真實 LLM）' : '模擬（離線、免 Key）' }}</span>
        </p>

        <div class="mt-3 grid gap-1.5">
          <Label for="rp-name">專案名稱</Label>
          <Input
            id="rp-name"
            v-model="projectName"
            type="text"
            placeholder="Personal Finance App"
          />
        </div>

        <div class="mt-3 grid gap-1.5">
          <Label for="rp-req">需求</Label>
          <Textarea
            id="rp-req"
            v-model="requirement"
            :rows="5"
            placeholder="Build an e-commerce website for selling handmade coffee products.&#10;- Google login&#10;- Product search&#10;- Shopping cart"
          ></Textarea>
        </div>
        <p v-if="ai.mode === 'real'" class="mt-1 text-[11px] text-muted-foreground">
          ⚠ 每個 Agent 步驟都會呼叫真實 LLM，消耗你的 API 額度。
        </p>

        <div class="mt-3 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" @click="open = false">取消</Button>
          <Button type="submit" size="sm" :disabled="!requirement.trim() || running">
            啟動 AI Company
          </Button>
        </div>
      </form>
    </PopoverContent>
  </Popover>
</template>
