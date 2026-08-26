<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAIStore, AIMODE_LABEL } from '@/stores/ai'
import type { ProviderConnectionResult, ProviderId } from '@/types/llm'
import { Eye, EyeOff, KeyRound, Trash2, PlugZap } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ai = useAIStore()
const open = defineModel<boolean>({ default: false })

const keyInput = ref('')
const showKey = ref(false)
const testing = ref(false)
const testResult = ref<ProviderConnectionResult | null>(null)
/** Spec §47 — first-time Real AI confirmation step. */
const confirmStep = ref(false)

const providerOptions: Array<{ id: Exclude<ProviderId, 'mock'>; name: string; ready: boolean }> = [
  { id: 'openai', name: 'OpenAI', ready: true },
  { id: 'gemini', name: 'Gemini', ready: false },
  { id: 'claude', name: 'Claude', ready: false },
]

const models = computed(() => ai.modelsFor(ai.providerId))

function onProviderChange(id: unknown): void {
  ai.providerId = String(id) as typeof ai.providerId
}

function saveKey(): void {
  const trimmed = keyInput.value.trim()
  if (!trimmed) return
  // Runtime memory only (spec §8) — never persisted.
  ai.apiKey = trimmed
  if (!models.value.some((m) => m.id === ai.model)) {
    ai.model = models.value[0]?.id ?? ''
  }
  testResult.value = null
}

async function runTest(): Promise<void> {
  testing.value = true
  testResult.value = null
  try {
    testResult.value = await ai.testConnection()
  } finally {
    testing.value = false
  }
}

/** Spec §9 — immediate removal. */
function clearKey(): void {
  keyInput.value = ''
  ai.clearKey()
  testResult.value = null
}

function switchToReal(): void {
  // §47 — first time switching to Real AI shows the BYOK confirmation.
  if (!ai.onboarded) {
    confirmStep.value = true
    return
  }
  doSwitchReal()
}

function doSwitchReal(): void {
  if (ai.switchMode('real')) {
    confirmStep.value = false
    open.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[85dvh] max-w-lg overflow-y-auto">
      <DialogHeader v-if="confirmStep" class="sr-only">
        <DialogTitle>使用 Real AI</DialogTitle>
      </DialogHeader>

      <!-- §47 first-time onboarding confirmation -->
      <template v-if="confirmStep">
        <h2 class="text-base font-semibold">使用 Real AI</h2>
        <p class="text-sm text-muted-foreground">Bring your own API key.</p>
        <p class="rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          你的 API Key 僅用於 AI 請求，本應用程式不會儲存它。API 請求由你的瀏覽器直接發送——
          瀏覽器不是可信執行環境，請勿使用權限或額度高於你願意暴露程度的金鑰。
        </p>
        <DialogFooter>
          <Button variant="outline" @click="confirmStep = false; open = false">取消</Button>
          <Button @click="doSwitchReal">繼續</Button>
        </DialogFooter>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle>AI Provider 設定</DialogTitle>
          <DialogDescription>
            目前模式：{{ AIMODE_LABEL[ai.mode] }}
          </DialogDescription>
        </DialogHeader>

        <!-- 目前模式 -->
        <div class="flex items-center rounded-md border border-border bg-muted/40 p-3 text-sm">
          <span class="font-medium">{{ AIMODE_LABEL[ai.mode] }}</span>
          <Button variant="outline" size="xs" class="ml-3" @click="ai.switchMode('mock')">
            切換至模擬模式
          </Button>
        </div>

        <!-- Provider -->
        <fieldset class="mt-5">
          <legend class="detail-label">Provider</legend>
          <RadioGroup
            :model-value="ai.providerId"
            class="flex flex-wrap gap-2"
            @update:model-value="onProviderChange"
          >
            <Label
              v-for="p in providerOptions"
              :key="p.id"
              :for="`provider-${p.id}`"
              :disabled="!p.ready"
              class="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-normal transition-colors has-[button[data-state=checked]]:border-accent has-[button[data-state=checked]]:bg-accent/10 hover:bg-muted"
            >
              <RadioGroupItem :id="`provider-${p.id}`" :value="p.id" :disabled="!p.ready" />
              {{ p.name }}
              <span v-if="!p.ready" class="text-[10px] tracking-wide text-muted-foreground">敬請期待</span>
            </Label>
          </RadioGroup>
        </fieldset>

        <!-- Model -->
        <div class="mt-4 grid gap-1.5">
          <Label for="model-select">Model</Label>
          <Select
            v-model="ai.model"
            :disabled="!models.length"
          >
            <SelectTrigger id="model-select" class="w-full">
              <SelectValue :placeholder="models.length ? '選擇 Model' : '此 Provider 尚未提供 Model'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- API Key -->
        <div class="mt-4 grid gap-1.5">
          <Label for="api-key-input">API Key</Label>
          <div class="flex gap-2">
            <Input
              id="api-key-input"
              v-model="keyInput"
              :type="showKey ? 'text' : 'password'"
              placeholder="••••••••••••••••"
              autocomplete="off"
              spellcheck="false"
              class="min-w-0 flex-1 font-mono"
              @keydown.enter="saveKey"
            />
            <Button
              variant="outline"
              size="icon"
              :aria-label="showKey ? '隱藏 API Key' : '顯示 API Key'"
              @click="showKey = !showKey"
            >
              <EyeOff v-if="showKey" aria-hidden="true" />
              <Eye v-else aria-hidden="true" />
            </Button>
          </div>

          <div class="mt-2 flex flex-wrap gap-2">
            <Button v-if="!ai.hasKey" @click="saveKey">
              <KeyRound aria-hidden="true" /> 儲存 Key（僅存於記憶體）
            </Button>
            <template v-else>
              <Button variant="outline" :disabled="testing || !ai.hasKey" @click="runTest">
                <PlugZap aria-hidden="true" />
                {{ testing ? '測試中…' : 'Test Connection' }}
              </Button>
              <Button variant="outline" @click="clearKey">
                <Trash2 aria-hidden="true" /> 清除 Key
              </Button>
            </template>
          </div>

          <!-- Status -->
          <p class="mt-2 flex items-center gap-2 text-sm" role="status">
            <template v-if="testing"><span>○ 測試中…</span></template>
            <template v-else-if="testResult">
              <span>{{ testResult.ok ? '● 已連線' : '✕ 連線失敗' }}</span>
              <span class="text-muted-foreground">{{ testResult.message }}</span>
            </template>
            <template v-else-if="ai.hasKey">
              <span>● 已儲存（未測試）</span>
            </template>
            <template v-else>
              <span class="text-muted-foreground">○ 未連線</span>
            </template>
          </p>
        </div>

        <!-- 啟用 Real AI -->
        <div class="mt-5 flex items-center justify-between rounded-md border border-border p-3">
          <div class="text-sm">
            <p class="font-medium">啟用 Real AI 模式</p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              {{ ai.hasKey ? `使用 ${providerOptions.find((p) => p.id === ai.providerId)?.name} · ${ai.model}` : '需要先輸入 API Key' }}
            </p>
          </div>
          <Button :disabled="!ai.hasKey" @click="switchToReal">切換至 Real AI</Button>
        </div>

        <!-- Cost control (§38) -->
        <fieldset class="mt-5">
          <legend class="detail-label">成本控制</legend>
          <div class="grid grid-cols-3 gap-3">
            <label class="grid gap-1 text-xs">
              <span class="block text-muted-foreground">最大執行步驟</span>
              <Input v-model.number="ai.maxSteps" type="number" min="1" max="100" class="font-mono" />
            </label>
            <label class="grid gap-1 text-xs">
              <span class="block text-muted-foreground">最大工具呼叫</span>
              <Input v-model.number="ai.maxToolCalls" type="number" min="1" max="50" class="font-mono" />
            </label>
            <label class="grid gap-1 text-xs">
              <span class="block text-muted-foreground">最大重試</span>
              <Input v-model.number="ai.maxRetry" type="number" min="0" max="5" class="font-mono" />
            </label>
          </div>
          <p class="mt-1.5 text-[11px] text-muted-foreground">超過上限時顯示「Execution limit reached」並停止 Workflow。</p>
        </fieldset>

        <!-- Security notice (§61 / §62) -->
        <p class="rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          BYOK 安全性說明：你的 API Key 僅存在於這個瀏覽器分頁的記憶體中，重新整理即消失，本應用程式不會儲存它。
          API 請求由你的瀏覽器直接使用你自己的 Key 發送——請勿使用權限或額度高於你願意暴露給瀏覽器程度的金鑰。
        </p>
      </template>
    </DialogContent>
  </Dialog>
</template>
