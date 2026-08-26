import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { SCENARIOS } from '@/data/scenarios'
import type { DemoScenario } from '@/types/workflow'

export type RunState =
  | 'idle'
  | 'running'
  | 'paused'
  | 'awaiting_approval'
  | 'completed'

/** 執行狀態的中文標籤 */
export const RUN_STATE_LABEL: Record<RunState, string> = {
  idle: '待機中',
  running: '執行中',
  paused: '已暫停',
  awaiting_approval: '等待核准',
  completed: '已完成',
}

export const useCompanyStore = defineStore('company', () => {
  const projectName = ref<string>('')
  const requirement = ref<string>('')
  const scenarioId = ref<string>(SCENARIOS[0]!.id)
  const runState = ref<RunState>('idle')
  /** 目前（或暫停時下一個）執行的步驟 id */
  const currentStepId = ref<string>('')
  const phase = ref<string>('')
  const speed = ref<number>(1)

  const scenarios = computed<DemoScenario[]>(() => SCENARIOS)
  const activeScenario = computed(
    () => SCENARIOS.find((s) => s.id === scenarioId.value) ?? SCENARIOS[0]!,
  )

  function selectScenario(id: string): void {
    const s = SCENARIOS.find((x) => x.id === id)
    if (!s || !s.available) return
    scenarioId.value = id
  }

  function startProject(name: string, req: string): void {
    projectName.value = name
    requirement.value = req
    runState.value = 'running'
    phase.value = '啟動'
  }

  function setPhase(phaseName: string): void {
    phase.value = phaseName
  }

  function setRunState(state: RunState): void {
    runState.value = state
  }

  function setSpeed(value: number): void {
    speed.value = value > 0 ? value : 1
  }

  function reset(): void {
    projectName.value = ''
    requirement.value = ''
    runState.value = 'idle'
    currentStepId.value = ''
    phase.value = ''
    speed.value = 1
  }

  function hydrate(data: {
    projectName: string
    requirement: string
    scenarioId: string
    runState: RunState
    currentStepId: string
    phase: string
    speed: number
  }): void {
    projectName.value = data.projectName
    requirement.value = data.requirement
    scenarioId.value = data.scenarioId
    runState.value = data.runState
    currentStepId.value = data.currentStepId
    phase.value = data.phase
    speed.value = data.speed
  }

  return {
    projectName,
    requirement,
    scenarioId,
    runState,
    currentStepId,
    phase,
    speed,
    scenarios,
    activeScenario,
    selectScenario,
    startProject,
    setPhase,
    setRunState,
    setSpeed,
    reset,
    hydrate,
  }
})
