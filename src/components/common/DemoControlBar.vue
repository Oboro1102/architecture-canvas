<script setup lang="ts">
import { useCompanyStore, RUN_STATE_LABEL } from '@/stores/company'
import { useTaskStore } from '@/stores/tasks'
import { useAgentStore } from '@/stores/agents'
import { getEngine } from '@/engine/scenarioEngine'
import ProgressBar from '@/components/common/ProgressBar.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Play, Pause, RotateCcw, Gauge } from '@lucide/vue'

const company = useCompanyStore()
const tasks = useTaskStore()
const agents = useAgentStore()

const speeds = [0.5, 1, 2, 4]

function start(): void {
  getEngine().start(company.scenarioId)
}
function pauseResume(): void {
  const engine = getEngine()
  if (company.runState === 'running') engine.pause()
  else if (company.runState === 'paused') engine.resume()
}
function reset(): void {
  getEngine().reset()
}
</script>

<template>
  <section
    aria-label="示範控制列"
    class="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2"
  >
    <Button
      v-if="company.runState === 'idle' || company.runState === 'completed'"
      :disabled="!company.activeScenario.available"
      @click="start"
    >
      <Play class="size-4" aria-hidden="true" />
      開始示範
    </Button>
    <Button v-else variant="outline" @click="pauseResume">
      <Pause v-if="company.runState === 'running'" class="size-4" aria-hidden="true" />
      <Play v-else class="size-4" aria-hidden="true" />
      {{ company.runState === 'running' ? '暫停' : '繼續' }}
    </Button>

    <Button variant="outline" :disabled="company.runState === 'idle'" @click="reset">
      <RotateCcw class="size-4" aria-hidden="true" />
      重設
    </Button>

    <!-- 執行狀態 -->
    <Badge v-if="company.runState !== 'idle'" variant="secondary" role="status">
      {{ RUN_STATE_LABEL[company.runState] }}
    </Badge>

    <div class="ml-auto flex items-center gap-1.5 text-xs">
      <Gauge class="size-4 text-muted-foreground" aria-hidden="true" />
      <span class="text-muted-foreground">速度</span>
      <Button
        v-for="s in speeds"
        :key="s"
        size="xs"
        font-mono
        :variant="company.speed === s ? 'default' : 'ghost'"
        :class="company.speed !== s && 'font-mono text-muted-foreground'"
        :aria-pressed="company.speed === s"
        @click="company.setSpeed(s)"
      >
        {{ s }}x
      </Button>
    </div>

    <div v-if="company.runState !== 'idle'" class="w-full sm:w-auto sm:min-w-48">
      <div class="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>{{ company.projectName }}</span>
        <span class="font-mono tabular-nums">總進度 {{ tasks.overallProgress }}%</span>
      </div>
      <ProgressBar :model-value="tasks.overallProgress" />
    </div>

    <p v-if="agents.activeCount || tasks.tasks.length" class="sr-only" role="status">
      目前有 {{ agents.activeCount }} 位 Agent 工作中，已完成 {{ tasks.completedCount }} / {{
        tasks.tasks.length
      }} 項任務。目前階段：{{ company.phase }}
    </p>
  </section>
</template>
