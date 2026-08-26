import type { AgentResult, AgentRuntime } from '@/types/agentRuntime'
import type { Agent } from '@/types/agent'

/**
 * Spec §17 — Mock Agent Runtime. Deterministic results from the agent's own
 * role; no LLM, no network (§42/§43). Keeps V1 behaviour available under the
 * unified runtime interface.
 */
export class MockAgentRuntime implements AgentRuntime {
  async run(agent: Agent): Promise<AgentResult> {
    const canned: Record<string, { message: string; nextAction: string }> = {
      ceo: {
        message: '[Mock] 已分析需求並確立專案方向。',
        nextAction: 'delegate:product',
      },
      product: {
        message: '[Mock] 已將需求拆解為功能清單。',
        nextAction: 'delegate:cto',
      },
      cto: {
        message: '[Mock] 已完成技術規劃與任務分配。',
        nextAction: 'execute',
      },
      qa: {
        message: '[Mock] 測試完成，未發現阻斷性問題。',
        nextAction: 'review',
      },
    }
    const fallback = { message: `[Mock] ${agent.name} 已完成指派工作。`, nextAction: 'continue' }
    const result = canned[agent.role] ?? fallback
    return { status: 'success', ...result }
  }
}
