import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AIMode, ProviderId, ProviderConnectionResult } from '@/types/llm'
import { createLLMProvider, MockProvider } from '@/engine/providers'
import type { LLMProvider } from '@/types/llm'
import { OPENAI_MODELS } from '@/engine/providers/openai'

/**
 * V2 — Global AI mode + BYOK state (spec §4, §8, §32–33).
 *
 * API key lives in RUNTIME MEMORY ONLY (§8): a plain ref that is never
 * written to sessionStorage / localStorage and never persisted. A page
 * refresh clears it. `clearKey()` removes it immediately.
 */
export const useAIStore = defineStore('ai', () => {
  // ── Runtime memory only — deliberately NOT persisted (spec §8) ──
  const apiKey = ref<string | null>(null)
  const providerId = ref<Exclude<ProviderId, 'mock'>>('openai')
  const model = ref<string>('gpt-4o-mini')

  /** Global mode (§33). 'real' requires a configured key; enforced in switchMode(). */
  const mode = ref<AIMode>('mock')
  /** One-shot toast for Real→Mock switch notice (§34). */
  const modeNotice = ref<string | null>(null)
  /** First-time Real AI onboarding gate (§47). */
  const onboarded = ref(false)
  /** Spec §37 — per-agent overrides. 'global' = follow global mode. */
  const agentModes = ref<Record<string, 'global' | 'mock' | 'real'>>({})
  /** Spec §38 — cost control limits. */
  const maxSteps = ref(20)
  const maxToolCalls = ref(10)
  const maxRetry = ref(2)

  const hasKey = computed(() => apiKey.value !== null && apiKey.value.length > 0)
  /** Real AI is selectable only with a tested key present. */
  const realReady = computed(() => hasKey.value && model.value.length > 0)

  /** Effective mode for one agent (§37): override wins, else global. */
  function effectiveModeFor(agentId: string): AIMode {
    const override = agentModes.value[agentId] ?? 'global'
    if (override === 'mock') return 'mock'
    if (override === 'real') return realReady.value ? 'real' : 'mock'
    return mode.value
  }

  function setAgentMode(agentId: string, value: 'global' | 'mock' | 'real'): void {
    if (value === 'global') delete agentModes.value[agentId]
    else agentModes.value[agentId] = value
  }

  function resetAgentModes(): void {
    agentModes.value = {}
  }

  function modelsFor(id: ProviderId): Array<{ id: string; name: string }> {
    if (id === 'openai') return OPENAI_MODELS
    return []
  }

  function buildProvider(): LLMProvider {
    if (!hasKey.value) return new MockProvider()
    return createLLMProvider({ provider: providerId.value, apiKey: apiKey.value!, model: model.value })
  }

  async function testConnection(): Promise<ProviderConnectionResult> {
    if (!hasKey.value) return { ok: false, message: '請先輸入 API Key。' }
    try {
      const provider = buildProvider()
      return await provider.testConnection()
    } catch {
      return { ok: false, errorType: 'unknown', message: '連線測試失敗。' }
    }
  }

  /** Spec §33 — switching to Real without a key is rejected; UI shows Connect panel. */
  function switchMode(next: AIMode): boolean {
    if (next === 'real' && !realReady.value) return false
    if (next === mode.value) return true
    mode.value = next
    if (next === 'mock') {
      // Spec §34 — explicit notice, never silent fallback.
      modeNotice.value = '已切換至模擬模式。後續 Agent 執行將使用模擬結果。'
    } else {
      modeNotice.value = '已啟用 Real AI 模式。'
      onboarded.value = true
    }
    return true
  }

  /** Spec §9 — immediate key removal. */
  function clearKey(): void {
    apiKey.value = null
    if (mode.value === 'real') {
      mode.value = 'mock'
      modeNotice.value = 'API Key 已清除，已切回模擬模式。'
    }
  }

  function dismissNotice(): void {
    modeNotice.value = null
  }

  return {
    apiKey,
    providerId,
    model,
    mode,
    modeNotice,
    onboarded,
    agentModes,
    maxSteps,
    maxToolCalls,
    maxRetry,
    hasKey,
    realReady,
    effectiveModeFor,
    setAgentMode,
    resetAgentModes,
    modelsFor,
    buildProvider,
    testConnection,
    switchMode,
    clearKey,
    dismissNotice,
  }
})

/** Labels for the always-visible mode indicator (§32 — never color-only). */
export const AIMODE_LABEL: Record<AIMode, string> = {
  mock: '● 模擬模式',
  real: '● Real AI',
}
