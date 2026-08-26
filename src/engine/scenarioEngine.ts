import { useAgentStore } from '@/stores/agents'
import { useTaskStore } from '@/stores/tasks'
import { useExecutionStore } from '@/stores/execution'
import { useCompanyStore } from '@/stores/company'
import type { WorkflowStep } from '@/types/workflow'

const TICK_MS = 50

/**
 * Mock Agent Engine — 以單一 interval tick 驅動預定義 workflow。
 * 不使用 LLM；所有行為來自 data/scenarios.ts。
 *
 * 設計原則：不用 promise chain（避免未處理 rejection 造成流程静默中斷），
 * 每個 tick 依「消耗時間 × 速度」推進步驟，UI 只透過 store 讀取狀態。
 */
export class ScenarioEngine {
  /** 每次都取「目前活躍」的 Pinia store，避免單例引擎綁死舊實例 */
  private get company() {
    return useCompanyStore()
  }
  private get agents() {
    return useAgentStore()
  }
  private get tasks() {
    return useTaskStore()
  }
  private get exec() {
    return useExecutionStore()
  }

  private timer: ReturnType<typeof setInterval> | null = null
  private stepIndex = -1
  /** 目前步驟已消耗的模擬時間（ms） */
  private consumed = 0
  private lastTickAt = 0

  // -------------------------------------------------- 公開控制

  start(scenarioId: string): void {
    // hardReset 會重設速度；先記住使用者選的速度再還原
    const speedToKeep = this.company.speed
    this.hardReset()
    this.company.setSpeed(speedToKeep)
    const scenario = this.company.scenarios.find((s) => s.id === scenarioId)
    if (!scenario || scenario.steps.length === 0) return

    this.company.startProject(scenario.name + ' 平台', scenario.requirement)
    this.exec.push({
      agentId: 'ceo',
      type: 'message',
      title: '專案已建立',
      description: `新專案啟動：${this.company.projectName}`,
    })
    this.beginStep(0)
  }

  pause(): void {
    if (this.company.runState === 'running') {
      this.company.setRunState('paused')
    }
  }

  resume(): void {
    if (this.company.runState === 'paused') {
      this.lastTickAt = Date.now()
      this.company.setRunState('running')
    }
  }

  /** 清除全部狀態並回到初始畫面 */
  reset(): void {
    this.hardReset()
  }

  /** 人類核准 → 流程完成 */
  approve(): void {
    if (this.company.runState !== 'awaiting_approval') return
    this.exec.push({
      agentId: 'ceo',
      type: 'approval_granted',
      title: '已核准',
      description: '使用者核准了專案，流程進入完成階段。',
    })
    this.agents.setStatus('ceo', 'completed')
    this.agents.setCurrentTask('ceo', undefined)
    this.company.setPhase('完成')
    this.company.setRunState('completed')
    this.stopTimer()
    void this.snapshot()
  }

  /** 人類否決 → 回到上一個階段繼續執行 */
  reject(): void {
    if (this.company.runState !== 'awaiting_approval') return
    this.exec.push({
      agentId: 'ceo',
      type: 'approval_rejected',
      title: '已否決',
      description: '使用者否決了專案，流程回到上一個階段。',
    })
    this.agents.setStatus('ceo', 'working')
    const step = this.currentStep
    const resumeId = step?.rejectResumeStepId
    const idx = resumeId
      ? Math.max(
          0,
          this.company.activeScenario.steps.findIndex((s) => s.id === resumeId),
        )
      : Math.max(0, this.stepIndex - 1)
    this.company.setRunState('running')
    this.beginStep(idx)
  }

  // -------------------------------------------------- 內部流程

  private get currentStep(): WorkflowStep | undefined {
    return this.company.activeScenario.steps[this.stepIndex]
  }

  private beginStep(index: number): void {
    const steps = this.company.activeScenario.steps
    if (index >= steps.length) {
      this.finish()
      return
    }
    this.stepIndex = index
    const step = steps[index]!
    this.company.currentStepId = step.id
    this.applyStepStart(step)
    this.consumed = 0
    this.lastTickAt = Date.now()
    this.ensureTimer()
  }

  private ensureTimer(): void {
    if (this.timer === null) {
      this.timer = setInterval(() => this.tick(), TICK_MS)
    }
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private hardReset(): void {
    this.stopTimer()
    this.stepIndex = -1
    this.consumed = 0
    this.tasks.reset()
    this.agents.reset()
    this.exec.reset()
    this.company.reset()
  }

  private finish(): void {
    this.stopTimer()
    this.company.setPhase('完成')
    this.company.setRunState('completed')
    void this.snapshot()
  }

  /** 每 50ms 推進一次；依即時速度累積模擬時間 */
  private tick(): void {
    if (this.company.runState !== 'running') return
    const now = Date.now()
    this.consumed += (now - this.lastTickAt) * this.company.speed
    this.lastTickAt = now

    const step = this.currentStep
    if (!step) return

    // 任務進度即時更新（依比例趨近 progressTo）
    if (step.taskId && step.progressTo !== undefined) {
      const ratio = Math.min(1, this.consumed / Math.max(1, step.duration))
      this.tasks.setProgress(step.taskId, Math.round(step.progressTo * ratio))
    }

    if (this.consumed < step.duration) return

    this.applyStepEnd(step)

    if (step.approvalRequired) {
      this.company.setRunState('awaiting_approval')
      this.exec.push({
        agentId: step.agentId,
        type: 'approval_required',
        title: '需要人工核准',
        description: 'CEO 在專案完成前請求人工核准。',
      })
      void this.snapshot()
      return // 引擎停止推進，直到 approve()/reject()
    }

    this.beginStep(this.stepIndex + 1)
  }

  // -------------------------------------------------- 步驟副作用

  private applyStepStart(step: WorkflowStep): void {
    this.company.setPhase(step.phase)
    this.agents.setStatus(step.agentId, step.statusDuring ?? 'working')

    for (const t of step.createsTasks ?? []) {
      this.tasks.createTask({ ...t, status: 'pending' })
    }
    if ((step.createsTasks?.length ?? 0) > 0) {
      this.tasks.refreshUnlocks()
    }

    if (step.taskId) {
      this.agents.setCurrentTask(step.agentId, step.taskId)
      const task = this.tasks.getById(step.taskId)
      if (task && task.status !== 'completed' && task.status !== 'blocked') {
        this.tasks.setStatus(step.taskId, 'in_progress')
      }
    }

    for (const tool of step.toolCalls ?? []) {
      this.exec.push({
        agentId: step.agentId,
        type: 'tool_call',
        title: `工具呼叫：${tool}`,
        description: `${step.title} — 呼叫了 ${tool} 工具（模擬）。`,
      })
    }

    this.applyScenarioBeats(step)

    this.exec.push({
      agentId: step.agentId,
      type: step.taskId ? 'task_started' : 'message',
      title: step.title,
      description: step.description,
    })

    // 下一 步是 blocked 時，提前顯示封鎖提示
    const next = this.company.activeScenario.steps[this.stepIndex + 1]
    if (next?.statusDuring === 'blocked') {
      this.exec.push({
        agentId: next.agentId,
        type: 'error',
        title: 'Agent 已阻塞',
        description: '前端工程師正在等待後端工程師提供 API 規格。',
      })
    }
  }

  /** 劇情事件：QA 第一次測試發現 Bug、前端修復 */
  private applyScenarioBeats(step: WorkflowStep): void {
    if (step.id === 'qa-run1') {
      this.tasks.addBug({
        id: 'BUG-001',
        title: '手機版導覽列問題',
        description: '在 768px 以下漢堡選單與內容重疊。',
        foundByTaskId: 'TASK-007',
        resolved: false,
      })
      this.tasks.addBug({
        id: 'BUG-002',
        title: '購物車缺少空狀態',
        description: '購物車沒有商品時顯示空白面板。',
        foundByTaskId: 'TASK-007',
        resolved: false,
      })
    }
    if (step.id === 'fe-fixes') {
      this.tasks.resolveBugs(['BUG-001', 'BUG-002'], 'frontend')
    }
  }

  private applyStepEnd(step: WorkflowStep): void {
    if (step.progressTo !== undefined && step.taskId) {
      this.tasks.setProgress(step.taskId, step.progressTo)
      const task = this.tasks.getById(step.taskId)
      if (task?.status === 'completed') {
        this.exec.push({
          agentId: step.agentId,
          type: 'task_completed',
          title: `已完成：${task.title}`,
          description: `${step.agentId.toUpperCase()} 完成了 ${task.id}。`,
          metadata: { taskId: task.id },
        })
      }
      this.tasks.refreshUnlocks()
    }
    if (!step.approvalRequired) {
      const next = this.company.activeScenario.steps[this.stepIndex + 1]
      if (!next || next.agentId !== step.agentId) {
        this.agents.setStatus(step.agentId, 'idle')
        this.agents.setCurrentTask(step.agentId, undefined)
      }
    }
    void this.snapshot()
  }

  /** 持久化快照（fire-and-forget，避免循環 import 問題） */
  private snapshot(): void {
    import('@/stores/persistence')
      .then((m) => m.snapshotAll())
      .catch(() => {})
  }
}

let engine: ScenarioEngine | null = null

export function getEngine(): ScenarioEngine {
  if (!engine) engine = new ScenarioEngine()
  return engine
}
