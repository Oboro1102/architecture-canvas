<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAIStore, AIMODE_LABEL } from '@/stores/ai'
import type { ProviderConnectionResult, ProviderId } from '@/types/llm'
import { Eye, EyeOff, KeyRound, Trash2, PlugZap, X } from '@lucide/vue'
import { useEscapeToClose } from '@/utils/useEscapeToClose'

const ai = useAIStore()
const open = defineModel<boolean>({ default: false })

useEscapeToClose(() => open.value && !confirmStep.value, () => (open.value = false))

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
  <Transition name="modal">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div class="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl" role="document">
        <!-- §47 first-time onboarding confirmation -->
        <template v-if="confirmStep">
          <h2 id="settings-title" class="text-base font-semibold">使用 Real AI</h2>
          <p class="mt-3 text-sm text-muted-foreground">Bring your own API key.</p>
          <p class="mt-2 rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
            你的 API Key 僅用於 AI 請求，本應用程式不會儲存它。API 請求由你的瀏覽器直接發送——
            瀏覽器不是可信執行環境，請勿使用權限或額度高於你願意暴露程度的金鑰。
          </p>
          <div class="mt-5 flex justify-end gap-3">
            <button class="btn-secondary" @click="confirmStep = false; open = false">取消</button>
            <button class="btn-primary" @click="doSwitchReal">繼續</button>
          </div>
        </template>

        <template v-else>
        <div class="flex items-start justify-between">
          <h2 id="settings-title" class="text-base font-semibold">AI Provider 設定</h2>
          <button class="icon-btn" aria-label="關閉設定" @click="open = false">
            <X class="size-4" aria-hidden="true" />
          </button>
        </div>

        <!-- 目前模式 -->
        <div class="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm">
          目前模式：
          <span class="font-medium">{{ AIMODE_LABEL[ai.mode] }}</span>
          <button class="btn-secondary ml-3 !py-1 !text-xs" @click="ai.switchMode('mock')">
            切換至模擬模式
          </button>
        </div>

        <!-- Provider -->
        <fieldset class="mt-5">
          <legend class="detail-label">Provider</legend>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="p in providerOptions"
              :key="p.id"
              class="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors"
              :class="
                p.ready && ai.providerId === p.id
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:bg-muted'
              "
            >
              <input v-model="ai.providerId" type="radio" name="provider" :value="p.id" :disabled="!p.ready" class="accent-accent" />
              {{ p.name }}
              <span v-if="!p.ready" class="text-[10px] tracking-wide text-muted-foreground">敬請期待</span>
            </label>
          </div>
        </fieldset>

        <!-- Model -->
        <div class="mt-4">
          <label for="model-select" class="detail-label block">Model</label>
          <select id="model-select" v-model="ai.model" class="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" :disabled="!models.length">
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
            <option v-if="!models.length" value="">此 Provider 尚未提供 Model</option>
          </select>
        </div>

        <!-- API Key -->
        <div class="mt-4">
          <label for="api-key-input" class="detail-label block">API Key</label>
          <div class="flex gap-2">
            <input
              id="api-key-input"
              v-model="keyInput"
              :type="showKey ? 'text' : 'password'"
              placeholder="••••••••••••••••"
              autocomplete="off"
              spellcheck="false"
              class="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 font-mono text-sm"
              @keydown.enter="saveKey"
            />
            <button class="btn-secondary" :aria-label="showKey ? '隱藏 API Key' : '顯示 API Key'" @click="showKey = !showKey">
              <EyeOff v-if="showKey" class="size-4" aria-hidden="true" />
              <Eye v-else class="size-4" aria-hidden="true" />
            </button>
          </div>

          <div class="mt-2 flex flex-wrap gap-2">
            <button v-if="!ai.hasKey" class="btn-primary" @click="saveKey">
              <KeyRound class="size-4" aria-hidden="true" /> 儲存 Key（僅存於記憶體）
            </button>
            <template v-else>
              <button class="btn-secondary" :disabled="testing || !ai.hasKey" @click="runTest">
                <PlugZap class="size-4" aria-hidden="true" />
                {{ testing ? '測試中…' : 'Test Connection' }}
              </button>
              <button class="btn-secondary" @click="clearKey">
                <Trash2 class="size-4" aria-hidden="true" /> 清除 Key
              </button>
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
          <button class="btn-primary" :disabled="!ai.hasKey" @click="switchToReal">切換至 Real AI</button>
        </div>

        <!-- Cost control (§38) -->
        <fieldset class="mt-5">
          <legend class="detail-label">成本控制</legend>
          <div class="grid grid-cols-3 gap-3">
            <label class="text-xs">
              <span class="mb-1 block text-muted-foreground">最大執行步驟</span>
              <input v-model.number="ai.maxSteps" type="number" min="1" max="100" class="w-full rounded-md border border-border bg-card px-2 py-1.5 font-mono text-sm" />
            </label>
            <label class="text-xs">
              <span class="mb-1 block text-muted-foreground">最大工具呼叫</span>
              <input v-model.number="ai.maxToolCalls" type="number" min="1" max="50" class="w-full rounded-md border border-border bg-card px-2 py-1.5 font-mono text-sm" />
            </label>
            <label class="text-xs">
              <span class="mb-1 block text-muted-foreground">最大重試</span>
              <input v-model.number="ai.maxRetry" type="number" min="0" max="5" class="w-full rounded-md border border-border bg-card px-2 py-1.5 font-mono text-sm" />
            </label>
          </div>
          <p class="mt-1.5 text-[11px] text-muted-foreground">超過上限時顯示「Execution limit reached」並停止 Workflow。</p>
        </fieldset>

        <!-- Security notice (§61 / §62) -->
        <p class="mt-4 rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          BYOK 安全性說明：你的 API Key 僅存在於這個瀏覽器分頁的記憶體中，重新整理即消失，本應用程式不會儲存它。
          API 請求由你的瀏覽器直接使用你自己的 Key 發送——請勿使用權限或額度高於你願意暴露給瀏覽器程度的金鑰。
        </p>
        </template>
      </div>
    </div>
  </Transition>
</template>
