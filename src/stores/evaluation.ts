import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { RealRunTrace } from '@/engine/runtime/realAgentRuntime'

/**
 * Phase 9 — AI Performance evaluation (spec §55/§56).
 * Derived purely from recorded traces — no fabricated numbers.
 * Empty state reports "unavailable" rather than fake data.
 */
export const useEvaluationStore = defineStore('evaluation', () => {
  // Reuse trace records via a mirror; the trace store owns the raw log.
  const traces = ref<RealRunTrace[]>([])

  function syncFrom(all: RealRunTrace[]): void {
    traces.value = all
  }

  const total = computed(() => traces.value.length)
  const successful = computed(() => traces.value.filter((t) => t.status === 'success').length)
  const failed = computed(() => traces.value.filter((t) => t.status === 'failed').length)

  const successRate = computed(() =>
    total.value === 0 ? null : Math.round((successful.value / total.value) * 100),
  )

  const averageDurationSec = computed(() => {
    if (total.value === 0) return null
    const sum = traces.value.reduce((acc, t) => acc + t.durationMs, 0)
    return sum / total.value / 1000
  })

  const averageToolCalls = computed(() => {
    if (total.value === 0) return null
    const sum = traces.value.reduce((acc, t) => acc + t.toolCalls.length, 0)
    return sum / total.value
  })

  /** §56 — if no provider reported usage, show unavailable. */
  const totalTokens = computed(() => {
    const withUsage = traces.value.filter((t) => t.usage?.totalTokens !== undefined)
    if (withUsage.length === 0) return null
    return withUsage.reduce((acc, t) => acc + (t.usage?.totalTokens ?? 0), 0)
  })

  const totalRetries = computed(() =>
    traces.value.reduce((acc, t) => acc + t.attempt, 0),
  )

  return {
    traces,
    syncFrom,
    total,
    successful,
    failed,
    successRate,
    averageDurationSec,
    averageToolCalls,
    totalTokens,
    totalRetries,
  }
})
