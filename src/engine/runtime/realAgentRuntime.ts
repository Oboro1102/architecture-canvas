import type {
  AgentResult,
  AgentRuntime,
  AgentContext,
} from '@/types/agentRuntime'
import type { Agent } from '@/types/agent'
import type { LLMProvider, LLMResponse } from '@/types/llm'
import { buildSystemPrompt, buildUserMessage } from '@/engine/prompts'
import { toolRegistry, runToolCall } from '@/engine/tools/registry'
import { parseLLMJson, validateAgentOutput } from './schemaValidation'
import { useTaskStore } from '@/stores/tasks'
import { useAIStore } from '@/stores/ai'

export const MAX_RETRIES = 2 // spec §40

/**
 * Spec §18 — Real Agent Runtime.
 * Prompt construction → LLM request → parse → schema validation (with
 * limited retry) → tool execution for created tasks → AgentResult.
 */
export class RealAgentRuntime implements AgentRuntime {
  constructor(
    private provider: LLMProvider,
    private model: string,
    /** Observability hook (Phase 8 will persist these). */
    private onTrace?: (trace: RealRunTrace) => void,
  ) {}

  async run(agent: Agent, context: AgentContext): Promise<AgentResult> {
    const startedAt = Date.now()
    const tools = toolRegistry()
    const systemPrompt = buildSystemPrompt(
      agent,
      context.project,
      context.tasks,
      tools.map((t) => t.name),
    )

    let lastError: Error | null = null
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.provider.generate({
          model: this.model,
          systemPrompt,
          messages: [{ role: 'user', content: buildUserMessage(context.project, agent) }],
          temperature: 0.4,
        })

        // §25 — never trust LLM JSON directly.
        const validated = validateAgentOutput(parseLLMJson(response.content))

        // Execute declared tasks through the safe tool layer (§28),
        // respecting the maxToolCalls cost limit (§38).
        const taskStore = useTaskStore()
        const before = new Set(taskStore.tasks.map((t) => t.id))
        const toolCalls = []
        const limit = useAIStore().maxToolCalls
        for (const t of validated.tasks) {
          if (toolCalls.length >= limit) break
          toolCalls.push(await runToolCall({ name: 'createTask', arguments: t }))
        }
        const createdTasks = taskStore.tasks.filter((t) => !before.has(t.id))

        const trace: RealRunTrace = {
          agentId: agent.id,
          providerId: this.provider.id,
          model: this.model,
          durationMs: Date.now() - startedAt,
          attempt,
          usage: response.usage,
          finishReason: response.finishReason,
          promptVersion: 'agent-planner@1.0',
          toolCalls: toolCalls.map((c) => c.name),
          status: validated.status,
          error: undefined,
        }
        this.onTrace?.(trace)

        return {
          status: validated.status,
          message: validated.message,
          createdTasks,
          toolCalls,
          nextAction: validated.nextAction,
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        // §40 — only transient errors deserve a retry; validation gets limited retry too.
        const type = (error as { type?: string }).type
        if (type === 'authentication' || type === 'rate_limit') break
      }
    }

    this.onTrace?.({
      agentId: agent.id,
      providerId: this.provider.id,
      model: this.model,
      durationMs: Date.now() - startedAt,
      attempt: MAX_RETRIES,
      usage: undefined,
      finishReason: undefined,
      promptVersion: 'agent-planner@1.0',
      toolCalls: [],
      status: 'failed',
      error: lastError?.message ?? 'unknown',
    })

    return {
      status: 'failed',
      message: `Real AI 執行失敗：${lastError?.message ?? '未知錯誤'}`,
    }
  }
}

/** Phase 8 groundwork — one record per real run. */
export interface RealRunTrace {
  agentId: string
  providerId: string
  model: string
  durationMs: number
  attempt: number
  usage?: LLMResponse['usage']
  finishReason?: string
  promptVersion: string
  toolCalls: string[]
  status: string
  error?: string
}
