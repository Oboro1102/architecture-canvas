<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Grid3X3, Library, Redo2, Save, Undo2, ZoomIn, ZoomOut } from '@lucide/vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ArchitectureCanvas from '@/components/architecture/ArchitectureCanvas.vue'
import FloatingInspector from '@/components/architecture/FloatingInspector.vue'
import { NODE_GROUPS, NODE_LABELS, type NodeType } from '@/types/architecture'
import { useArchitectureStore } from '@/stores/architecture'

const store = useArchitectureStore()
const showLibrary = ref(false)
const template = ref('')

const selectedNode = computed(
  () => store.current.nodes.find((n) => n.id === store.selectedId) ?? null,
)

const TEMPLATE_TYPES: Record<string, NodeType[]> = {
  三層式: ['user', 'frontend', 'backend', 'database'],
  微服務: ['client', 'gateway', 'service', 'service', 'service', 'database'],
  事件驅動: ['client', 'message-broker', 'worker', 'worker', 'database'],
  無伺服器: ['client', 'gateway', 'backend', 'database', 'storage'],
}

function add(type: NodeType) {
  // Stagger new nodes so they don't stack perfectly on the same spot.
  const count = store.current.nodes.length
  store.addNode(type, 180 + (count % 4) * 190, 150 + Math.floor(count / 4) * 130)
}

function applyTemplate(value: unknown) {
  const v = value as string | null | undefined
  if (!v || !TEMPLATE_TYPES[v]) {
    template.value = ''
    return
  }
  store.newArchitecture(v)
  TEMPLATE_TYPES[v].forEach((t, i) =>
    store.addNode(t, 180 + (i % 4) * 210, 180 + Math.floor(i / 4) * 150),
  )
  template.value = ''
}

function exportJson() {
  const blob = new Blob(
    [JSON.stringify({ version: 1, type: 'architecture', ...store.current }, null, 2)],
    { type: 'application/json' },
  )
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${store.current.name}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

// Drag-and-drop from the floating component library onto the canvas.
function onDragStart(type: NodeType, e: DragEvent) {
  e.dataTransfer?.setData('application/vueflow', type)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}
</script>

<template>
  <!-- The canvas is the lowest layer (absolute inset-0, no z-index).
       Every UI surface below is a floating sibling with z-50+. -->
  <div class="relative h-screen w-screen overflow-hidden bg-[#080c16] text-slate-100">
    <ArchitectureCanvas />

    <!-- Top navbar (floating, high z) -->
    <header
      class="absolute inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-slate-800/70 bg-[#0d1424]/85 px-5 backdrop-blur"
    >
      <div class="flex items-center gap-3">
        <div class="grid size-8 place-items-center rounded-lg bg-cyan-400/15 text-cyan-300">⌘</div>
        <div>
          <h1 class="text-sm font-semibold tracking-wide">系統架構圖建構工具</h1>
          <input
            v-model="store.current.name"
            class="w-48 bg-transparent text-xs text-slate-400 outline-none"
            aria-label="架構名稱"
          />
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Select v-model="template" @update:modelValue="applyTemplate">
          <SelectTrigger class="h-8 w-[140px] text-xs" aria-label="選擇範本">
            <SelectValue placeholder="選擇範本…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="三層式">三層式</SelectItem>
            <SelectItem value="微服務">微服務</SelectItem>
            <SelectItem value="事件驅動">事件驅動</SelectItem>
            <SelectItem value="無伺服器">無伺服器</SelectItem>
          </SelectContent>
        </Select>

        <div class="flex items-center gap-1">
          <button class="icon-btn" aria-label="復原" :disabled="!store.canUndo" @click="store.undo">
            <Undo2 class="size-4" />
          </button>
          <button class="icon-btn" aria-label="重做" :disabled="!store.canRedo" @click="store.redo">
            <Redo2 class="size-4" />
          </button>
        </div>

        <button class="btn-secondary" @click="store.newArchitecture()">新增</button>
        <button class="btn-secondary" @click="store.save"><Save class="size-4" /> 儲存</button>
        <button class="btn-primary" @click="exportJson"><Download class="size-4" /> 匯出</button>
      </div>
    </header>

    <!-- Floating component-library toggle (fixed to the canvas, bottom-left) -->
    <div class="absolute bottom-4 left-4 z-50">
      <button
        class="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0d1424]/90 px-3 py-2 text-xs text-slate-200 shadow-lg backdrop-blur transition-colors hover:border-cyan-400/60 hover:text-cyan-200"
        :class="{ 'border-cyan-400/60 text-cyan-200': showLibrary }"
        aria-label="元件庫"
        @click="showLibrary = !showLibrary"
      >
        <Library class="size-4" />
        元件庫
      </button>

      <!-- The popup menu: appears above the toggle when open -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        leave-active-class="transition duration-120 ease-in"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div
          v-if="showLibrary"
          class="absolute bottom-[calc(100%+0.5rem)] left-0 max-h-[70vh] w-60 overflow-y-auto rounded-xl border border-slate-700 bg-[#0b1220]/95 p-4 shadow-2xl backdrop-blur"
        >
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-xs font-semibold tracking-widest text-slate-400">元件庫</h2>
            <button class="text-xs text-cyan-300" @click="showLibrary = false">隱藏</button>
          </div>
          <div v-for="group in NODE_GROUPS" :key="group.label" class="mb-5">
            <h3 class="mb-2 text-[10px] tracking-widest text-slate-500">{{ group.label }}</h3>
            <button
              v-for="type in group.types"
              :key="type"
              class="mb-1 flex w-full cursor-grab items-center gap-3 rounded-md px-2 py-2 text-left text-xs text-slate-300 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200 active:cursor-grabbing"
              draggable="true"
              @click="add(type)"
              @dragstart="onDragStart(type, $event)"
            >
              <span
                class="grid size-6 place-items-center rounded border border-slate-700 text-cyan-300"
                >◇</span
              >
              {{ NODE_LABELS[type] }}
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Floating zoom / grid controls (bottom-right) -->
    <div
      class="absolute bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0d1424]/90 px-3 py-2 text-xs text-slate-400 shadow-lg backdrop-blur"
    >
      <button
        class="hover:text-white"
        aria-label="切換格線"
        @click="store.current.settings.grid = !store.current.settings.grid"
      >
        <Grid3X3 class="inline size-3" /> 格線
      </button>
      <span>·</span>
      <button class="hover:text-white" aria-label="縮小" @click="store.zoomOut()">
        <ZoomOut class="inline size-3" />
      </button>
      <span>{{ Math.round(store.current.viewport.zoom * 100) }}%</span>
      <button class="hover:text-white" aria-label="放大" @click="store.zoomIn()">
        <ZoomIn class="inline size-3" />
      </button>
    </div>

    <!-- Floating inspector: pops near the clicked node (replaces the old
         right-side panel). It reads the node's screen rect from the canvas. -->
    <FloatingInspector :selected-node="selectedNode" />
  </div>
</template>
