import { useAgentStore } from '@/stores/agents'
import { useTaskStore } from '@/stores/tasks'
import { useExecutionStore } from '@/stores/execution'
import { useCompanyStore } from '@/stores/company'
import { useAIStore } from '@/stores/ai'
import { useTraceStore } from '@/stores/trace'
import type { RealRunTrace } from './runtime/realAgentRuntime'
import type { Agent } from '@/types/agent'
import type { Project } from '@/types/project'
import { createAgentRuntime } from './runtime'
import type { AgentRuntime } from '@/types/agentRuntime'

/**
 * Phase 6 — Orchestrated Real Workflow (spec §22/§58).
 * The Workflow Engine controls WHO runs WHEN (order, dependency, approval,
 * state transition). The LLM only analyzes / decides / produces content.
 *
 * Runtime is resolved per step via createAgentRuntime(), so global mode can
 * be switched mid-run (§34) without restarting.
 */

const ORDER: Array<Pick<Agent, 'id'>> = [
  { id: 'ceo' },
  { id: 'product' },
  { id: 'cto' },
  { id: 'designer' },
  { id: 'frontend' },
  { id: 'backend' },
  { id: 'qa' },
  { id: 'ceo' }, // final review
]

const PHASE_BY_AGENT: Record<string, string> = {
  ceo: '需求分析',
  product: '功能定義',
  cto: '任務規劃',
  designer: 'UX 設計',
  frontend: '前端開發',
  backend: '後端開發',
  qa: '品質測試',
}

export class RealWorkflowEngine {
  private running = false
  private cancelled = false

  private get agents() {
    return useAgentStore()
  }
  private get tasks() {
    return useTaskStore()
  }
  private get exec() {
    return useExecutionStore()
  }
  private get company() {
    return useCompanyStore()
  }
  private get ai() {
    return useAIStore()
  }

  get isRunning(): boolean {
    return this.running
  }

  /** Spec §57 — start a real run from user-provided requirement. */
  async start(project: Project): Promise<void> {
    if (this.running) return
    this.running = true
    this.cancelled = false

    this.tasks.reset()
    this.agents.reset()
    // Keep existing events? §35 says history is preserved across switches;
    // but a NEW project starts a fresh log.
    this.exec.reset()
    this.company.startProject(project.name, project.description)

    const runtimeMode = this.ai.mode
    this.exec.push({
      agentId: 'ceo',
      type: 'message',
      title: `專案啟動（${runtimeMode === 'real' ? 'Real AI' : 'Simulation'}）`,
      description: `需求：${project.description}`,
      executionMode: runtimeMode,
    })

    try {
      await this.runSequence(project)
      if (!this.cancelled) this.finish()
    } finally {
      this.running = false
    }
  }

  cancel(): void {
    this.cancelled = true
  }

  /** §58 phase 2 — later roles run per task dependency. */
  private async runSequence(project: Project): Promise<void> {
    const results = []
    for (let i = 0; i < ORDER.length; i++) {
      if (this.cancelled) return
      // Spec §38 — cost control: stop when execution limit reached.
      if (i >= this.ai.maxSteps) {
        this.exec.push({
          agentId: 'ceo',
          type: 'error',
          title: 'Execution limit reached',
          description: `已達最大執行步驟數（${this.ai.maxSteps}），Workflow 停止。可於設定調整上限。`,
          executionMode: this.ai.mode,
        })
        return
      }
      const { id } = ORDER[i]!
      const agent = this.agents.getById(id)
      if (!agent) continue
      const isFinalReview = i === ORDER.length - 1

      this.company.setPhase(PHASE_BY_AGENT[id] ?? agent.role)
      this.agents.setStatus(id, isFinalReview ? 'reviewing' : 'working')

      // Spec §36/§37 — mixed execution: per-agent override, else global.
      const stepMode = this.ai.effectiveModeFor(id)
      const runtime: AgentRuntime = createAgentRuntime(stepMode)

      // Phase 8 — record observability trace for real runs.
      let lastTrace: RealRunTrace | undefined
      const onTrace = (t: RealRunTrace): void => {
        lastTrace = t
        useTraceStore().record(t)
      }
      const result = await this.runWithTrace(runtime, stepMode, onTrace, agent, {
        project,
        agent,
        tasks: [...this.tasks.tasks],
        recentEvents: this.exec.events.slice(-5).map((e) => ({
          agentId: e.agentId,
          title: e.title,
          description: e.description,
        })),
        availableTools: [],
        previousResults: results.slice(-3),
      })

      this.logResult(agent, result, stepMode, lastTrace)
      results.push(result)

      if (result.status === 'needs_approval' || isFinalReview) {
        const approved = await this.requestApproval(agent.id, result.message)
        if (!approved && !isFinalReview) {
          this.agents.setStatus(id, 'blocked')
          continue // workflow engine decides: skip to next role
        }
      } else if (result.status === 'failed') {
        this.agents.setStatus(id, 'blocked')
      } else {
        this.agents.setStatus(id, 'completed')
      }
      this.tasks.refreshUnlocks()
    }
  }

  private async runWithTrace(
    runtime: AgentRuntime,
    mode: 'mock' | 'real',
    onTrace: (t: RealRunTrace) => void,
    agent: Agent,
    context: Parameters<AgentRuntime['run']>[1],
  ): Promise<Awaited<ReturnType<AgentRuntime['run']>>> {
    if (mode !== 'real') return runtime.run(agent, context)
    // Rebuild a RealAgentRuntime with the trace hook (§29 observability).
    const { RealAgentRuntime } = await import('./runtime/realAgentRuntime')
    const ai = this.ai
    const real = new RealAgentRuntime(ai.buildProvider(), ai.model, onTrace)
    return real.run(agent, context)
  }

  /** Spec §41 — high-risk transitions pause for Human Approval. */
  private requestApproval(agentId: string, reason: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.company.setRunState('awaiting_approval')
      this.exec.push({
        agentId,
        type: 'approval_required',
        title: '需要人工核准',
        description: reason || 'AI Company 想要繼續執行。',
        executionMode: this.ai.mode,
      })
      approvalWaiters.push({ resolve, company: useCompanyStore() })
    })
  }

  private logResult(
    agent: Agent,
    result: Awaited<ReturnType<AgentRuntime['run']>>,
    executionMode: 'mock' | 'real',
    trace?: RealRunTrace,
  ): void {
    // §29/§30/§49 — observability metadata. Missing → omitted (UI shows N/A);
    // never includes API key or auth headers.
    const traceMeta = trace
      ? {
          provider: trace.providerId,
          model: trace.model,
          promptVersion: trace.promptVersion,
          durationMs: trace.durationMs,
          retries: trace.attempt,
          inputTokens: trace.usage?.inputTokens,
          outputTokens: trace.usage?.outputTokens,
          totalTokens: trace.usage?.totalTokens,
        }
      : {}
    this.exec.push({
      agentId: agent.id,
      type:
        result.createdTasks?.length
          ? 'task_created'
          : result.status === 'failed'
            ? 'error'
            : 'message',
      title: `${agent.name}：${result.status === 'failed' ? '執行失敗' : '完成階段工作'}`,
      description: result.message,
      executionMode,
      metadata: {
        nextAction: result.nextAction,
        createdTasks: result.createdTasks?.map((t) => t.id),
        ...traceMeta,
      },
    })
    for (const call of result.toolCalls ?? []) {
      this.exec.push({
        agentId: agent.id,
        type: 'tool_call',
        title: `工具呼叫：${call.name}`,
        description: JSON.stringify(call.result),
        executionMode,
      })
    }
  }

  private finish(): void {
    this.company.setPhase('完成')
    this.company.setRunState('completed')
  }
}

// ── Approval plumbing ────────────────────────────────────────────
type Waiter = { resolve: (ok: boolean) => void; company: ReturnType<typeof useCompanyStore> }
const approvalWaiters: Waiter[] = []

/** Called by the existing ApprovalDialog buttons when in real mode. */
export function resolveRealApproval(approved: boolean): void {
  const waiter = approvalWaiters.pop()
  if (!waiter) return
  waiter.resolve(approved)
  if (waiter.company.runState === 'awaiting_approval') {
    waiter.company.setRunState('running')
  }
}

let engine: RealWorkflowEngine | null = null

export function getRealEngine(): RealWorkflowEngine {
  if (!engine) engine = new RealWorkflowEngine()
  return engine
}
