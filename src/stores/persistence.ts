import { saveState, clearState, loadState } from '@/utils/persistence'
import { useCompanyStore } from '@/stores/company'
import { useAgentStore } from '@/stores/agents'
import { useTaskStore } from '@/stores/tasks'
import { useExecutionStore } from '@/stores/execution'
import type { Agent } from '@/types/agent'
import type { Task, Bug } from '@/types/task'
import type { ExecutionEvent } from '@/types/execution'

export interface PersistedSnapshot {
  company: {
    projectName: string
    requirement: string
    scenarioId: string
    runState: ReturnType<typeof useCompanyStore>['runState']
    currentStepId: string
    phase: string
    speed: number
  }
  agents: Agent[]
  tasks: Task[]
  bugs: Bug[]
  events: ExecutionEvent[]
}

export function snapshotAll(): void {
  const company = useCompanyStore()
  const agents = useAgentStore()
  const tasks = useTaskStore()
  const exec = useExecutionStore()
  const snapshot: PersistedSnapshot = {
    company: {
      projectName: company.projectName,
      requirement: company.requirement,
      scenarioId: company.scenarioId,
      runState: company.runState,
      currentStepId: company.currentStepId,
      phase: company.phase,
      speed: company.speed,
    },
    agents: JSON.parse(JSON.stringify(agents.agents)) as Agent[],
    tasks: JSON.parse(JSON.stringify(tasks.tasks)) as Task[],
    bugs: JSON.parse(JSON.stringify(tasks.bugs)) as Bug[],
    events: JSON.parse(JSON.stringify(exec.events)) as ExecutionEvent[],
  }
  saveState('snapshot', snapshot)
}

export function restoreAll(): boolean {
  const saved = loadState<PersistedSnapshot>('snapshot')
  if (!saved) return false
  try {
    const company = useCompanyStore()
    const agents = useAgentStore()
    const tasks = useTaskStore()
    const exec = useExecutionStore()
    company.hydrate(saved.company)
    agents.hydrate(saved.agents)
    tasks.hydrate(saved.tasks, saved.bugs)
    exec.hydrate(saved.events)
    return true
  } catch {
    return false
  }
}

export function clearAll(): void {
  clearState()
}

import { getEngine } from '@/engine/scenarioEngine'

export function resetEverything(): void {
  getEngine().reset()
  clearState()
}
