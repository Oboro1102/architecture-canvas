import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RealRunTrace } from '@/engine/runtime/realAgentRuntime'

/**
 * Phase 8 — Execution Trace store (spec §29/§30/§49).
 * Records what is observable about each agent run. NEVER records API keys
 * or authorization headers (§49). Missing values stay undefined → UI shows
 * N/A (§29: 不得偽造).
 */
export const useTraceStore = defineStore('trace', () => {
  const traces = ref<RealRunTrace[]>([])

  function record(trace: RealRunTrace): void {
    // Whitelist copy — guarantees no secret fields (§49) ever enter the store.
    traces.value.push({
      agentId: trace.agentId,
      providerId: trace.providerId,
      model: trace.model,
      durationMs: trace.durationMs,
      attempt: trace.attempt,
      usage: trace.usage
        ? {
            inputTokens: trace.usage.inputTokens,
            outputTokens: trace.usage.outputTokens,
            totalTokens: trace.usage.totalTokens,
          }
        : undefined,
      finishReason: trace.finishReason,
      promptVersion: trace.promptVersion,
      toolCalls: [...trace.toolCalls],
      status: trace.status,
      error: trace.error,
    })
    if (traces.value.length > 500) traces.value.shift()
  }

  function forAgent(agentId: string): RealRunTrace[] {
    return traces.value.filter((t) => t.agentId === agentId)
  }

  function lastForAgent(agentId: string): RealRunTrace | undefined {
    return forAgent(agentId).at(-1)
  }

  function reset(): void {
    traces.value = []
  }

  return { traces, record, forAgent, lastForAgent, reset }
})
