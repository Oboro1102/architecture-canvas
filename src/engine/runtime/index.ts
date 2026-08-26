import type { AgentRuntime } from '@/types/agentRuntime'
import type { AIMode } from '@/types/llm'
import { useAIStore } from '@/stores/ai'
import { MockAgentRuntime } from './mockAgentRuntime'
import { RealAgentRuntime } from './realAgentRuntime'

/** Spec §52 — Agent Runtime Factory. */
export function createAgentRuntime(mode: AIMode): AgentRuntime {
  if (mode === 'real') {
    const ai = useAIStore()
    return new RealAgentRuntime(ai.buildProvider(), ai.model)
  }
  return new MockAgentRuntime()
}
