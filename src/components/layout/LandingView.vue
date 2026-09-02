<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Download, Upload, Grid3X3, Library, Plus, ZoomIn, ZoomOut, Maximize2, PenLine } from '@lucide/vue'
import ArchitectureCanvas from '@/components/architecture/ArchitectureCanvas.vue'
import FloatingInspector from '@/components/architecture/FloatingInspector.vue'
import {
  NODE_GROUPS,
  NODE_LABELS,
  TEMPLATE_LABELS,
  buildTemplate,
  type NodeType,
} from '@/types/architecture'
import { useArchitectureStore } from '@/stores/architecture'
import { useConfirm } from '@/composables/useConfirm'
import Tooltip from '@/components/common/AppTooltip.vue'

const store = useArchitectureStore()
const { confirm } = useConfirm()
const showLibrary = ref(false)
const showTemplates = ref(false)
const templateMenu = ref<HTMLElement | null>(null)

function onTemplateClickOutside(e: MouseEvent) {
  if (templateMenu.value && !templateMenu.value.contains(e.target as Node)) {
    showTemplates.value = false
  }
}
window.addEventListener('click', onTemplateClickOutside)
onBeforeUnmount(() => window.removeEventListener('click', onTemplateClickOutside))

const selectedNode = computed(
  () => store.current.nodes.find((n) => n.id === store.selectedId) ?? null,
)

// Copyright line: starts at 2026; if the current year is later, show a
// "2026 - 20XX" range. XX is the current year beyond 2026.
const START_YEAR = 2026
const copyright = computed(() => {
  const year = new Date().getFullYear()
  const base = `© ${START_YEAR} Design & Coding by ツキノリュウ with Hermes Agent.`
  return year > START_YEAR
    ? `© ${START_YEAR} - ${year} Design & Coding by ツキノリュウ with Hermes Agent.`
    : base
})

function add(type: NodeType) {
  // Stagger new nodes so they don't stack perfectly on the same spot.
  const count = store.current.nodes.length
  store.addNode(type, 180 + (count % 4) * 190, 150 + Math.floor(count / 4) * 130)
}

function applyTemplate(value: unknown) {
  const v = value as string | null | undefined
  const built = v ? buildTemplate(v) : null
  if (!built) {
    return
  }
  store.replace(built)
  store.select(null)
  // The canvas watches the nodes array reference and auto-fits once the new
  // template's nodes are measured — no explicit fit() call needed here.
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

const fileInput = ref<HTMLInputElement | null>(null)
function triggerImport() {
  fileInput.value?.click()
}
function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    const ok = store.importJson(String(reader.result))
    if (!ok) {
      await confirm({
        title: '匯入失敗',
        description: '檔案不是有效的架構 JSON。',
        confirmText: '確定',
        cancelText: '關閉',
      })
    } else {
      // Canvas watches the nodes array reference and auto-fits the imported
      // architecture once its nodes are measured.
    }
  }
  reader.readAsText(file)
  input.value = '' // allow re-importing the same file
}

function onDragStart(type: NodeType, e: DragEvent) {
  e.dataTransfer?.setData('application/vueflow', type)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}
// Drag a "group" container from the library onto the canvas.
function onDragStartGroup(e: DragEvent) {
  e.dataTransfer?.setData('application/vueflow-group', 'group')
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}

// Grouping: drop a container onto the canvas center (or use the click short-
// cut). If a node is currently selected, it gets dropped into the new group.
function createGroup(x?: number, y?: number) {
  const px = x ?? 160 + store.current.nodes.length * 8
  const py = y ?? 120 + store.current.nodes.length * 8
  const id = store.addContainer(px, py)
  if (store.selectedId && store.current.nodes.some((n) => n.id === store.selectedId)) {
    store.addNodeToContainer(store.selectedId, id)
  }
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
          <div class="flex w-48 items-center gap-1.5 border-b border-slate-600/80 pb-0.5 transition-colors focus-within:border-cyan-400">
            <PenLine class="size-3 shrink-0 text-cyan-400/70" aria-hidden="true" />
            <input
              v-model="store.current.name"
              class="min-w-0 flex-1 bg-transparent text-xs text-slate-400 outline-none"
              aria-label="架構名稱（可編輯）"
            />
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div ref="templateMenu" class="relative inline-flex">
          <Tooltip text="選擇範本">
            <button
              class="icon-btn"
              :class="{ 'text-cyan-300 hover:text-cyan-200': showTemplates }"
              aria-label="選擇範本"
              aria-haspopup="menu"
              :aria-expanded="showTemplates"
              @click="showTemplates = !showTemplates"
            >
              <Grid3X3 class="size-4" />
            </button>
          </Tooltip>

          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 scale-95"
            leave-active-class="transition duration-120 ease-in"
            leave-to-class="opacity-0 scale-95"
          >
            <div
              v-if="showTemplates"
              class="absolute right-0 top-full z-[60] mt-2 w-40 rounded-xl border border-slate-700 bg-[#0b1220]/95 p-1.5 shadow-2xl backdrop-blur"
              role="menu"
            >
              <button
                v-for="t in TEMPLATE_LABELS"
                :key="t"
                class="flex w-full items-center rounded-md px-3 py-2 text-left text-xs text-slate-300 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200"
                role="menuitem"
                @click="applyTemplate(t); showTemplates = false"
              >
                {{ t }}
              </button>
            </div>
          </Transition>
        </div>

        <Tooltip text="新增">
          <button class="icon-btn" aria-label="新增" @click="store.newArchitecture()">
            <Plus class="size-4" />
          </button>
        </Tooltip>
        <Tooltip text="匯出（儲存為 JSON）">
          <button
            class="icon-btn text-cyan-300 hover:text-cyan-200"
            aria-label="匯出"
            @click="exportJson"
          >
            <Upload class="size-4" />
          </button>
        </Tooltip>
        <Tooltip text="匯入 JSON">
          <button class="icon-btn" aria-label="匯入" @click="triggerImport">
            <Download class="size-4" />
          </button>
        </Tooltip>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="onImportFile"
        />
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

          <!-- Group container: a canvas element (NOT a canvas operation) so it
               lives alongside the other building blocks in the library. -->
          <div class="mb-1">
            <h3 class="mb-2 text-[10px] tracking-widest text-slate-500">組織</h3>
            <button
              class="mb-1 flex w-full cursor-grab items-center gap-3 rounded-md px-2 py-2 text-left text-xs text-slate-300 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200 active:cursor-grabbing"
              draggable="true"
              @click="createGroup()"
              @dragstart="onDragStartGroup($event)"
            >
              <span
                class="grid size-6 place-items-center rounded border border-dashed border-slate-600 text-slate-300"
                >▢</span
              >
              群組
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
        class="inline-flex items-center gap-1 hover:text-white"
        aria-label="切換格線"
        @click="store.current.settings.grid = !store.current.settings.grid"
      >
        <Grid3X3 class="size-3" /> 格線
      </button>
      <span>·</span>
      <button
        class="inline-flex items-center gap-1 hover:text-white"
        aria-label="縮小"
        @click="store.zoomOut()"
      >
        <ZoomOut class="size-3" />
      </button>
      <span>{{ Math.round(store.current.viewport.zoom * 100) }}%</span>
      <button
        class="inline-flex items-center gap-1 hover:text-white"
        aria-label="放大"
        @click="store.zoomIn()"
      >
        <ZoomIn class="size-3" />
      </button>
      <span>·</span>
      <button
        class="inline-flex items-center gap-1 hover:text-white"
        aria-label="符合畫布"
        title="符合畫布"
        @click="store.fit()"
      >
        <Maximize2 class="size-3" /> 符合
      </button>
    </div>

    <!-- Floating inspector: pops near the clicked node (replaces the old
         right-side panel). It reads the node's screen rect from the canvas. -->
    <FloatingInspector :selected-node="selectedNode" />

    <!-- Copyright (bottom-center, non-interactive, low-key) -->
    <div
      class="pointer-events-none absolute bottom-4 left-1/2 z-40 -translate-x-1/2 text-[10px] tracking-wide text-slate-600"
      aria-label="版權宣告"
    >
      {{ copyright }}
    </div>
  </div>
</template>
