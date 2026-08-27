<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { X, ArrowUpRight, ArrowDownRight, GripHorizontal } from '@lucide/vue'
import { NODE_LABELS, type ArchitectureNode } from '@/types/architecture'
import { useArchitectureStore } from '@/stores/architecture'
import { useNodeScreenRect } from '@/composables/useNodeScreenRect'

const props = defineProps<{ selectedNode: ArchitectureNode | null }>()
const store = useArchitectureStore()
const { nodeScreenRect: rect } = useNodeScreenRect()

// Lightly follow the node while it is selected so the card stays glued during
// pan/zoom/drag. Stop the loop when nothing is selected.
let raf = 0
function follow() {
  raf = requestAnimationFrame(follow)
}
watch(
  () => props.selectedNode?.id,
  (id) => {
    cancelAnimationFrame(raf)
    if (id) {
      // The canvas publishes the rect via the shared composable; a short rAF
      // loop keeps the card aligned while the user pans or drags the node.
      raf = requestAnimationFrame(follow)
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => cancelAnimationFrame(raf))

// --- Position the floating card next to the node (archify Semantic Passport)-
const PLACEMENT = { w: 288, gap: 16, margin: 12 }
const pos = computed(() => {
  if (!rect.value) return null
  const r = rect.value
  const vw = window.innerWidth
  const vh = window.innerHeight
  const nodeCx = r.x + r.width / 2
  // Prefer the right side of the node; flip to the left if not enough room.
  let left = r.x + r.width + PLACEMENT.gap
  let origin = 'left'
  if (left + PLACEMENT.w > vw - PLACEMENT.margin) {
    left = r.x - PLACEMENT.w - PLACEMENT.gap
    origin = 'right'
    if (left < PLACEMENT.margin) {
      // Not enough room on either side: drop below the node, centered.
      left = Math.min(Math.max(nodeCx - PLACEMENT.w / 2, PLACEMENT.margin), vw - PLACEMENT.w - PLACEMENT.margin)
      origin = 'top'
    }
  }
  // Vertically: align with the node top, but keep within viewport.
  let top = r.y
  if (origin === 'top') top = r.y + r.height + PLACEMENT.gap
  top = Math.min(Math.max(top, 64 + PLACEMENT.margin), vh - 240)
  return { left, top, origin }
})
// Once the user grabs the grip, `pos2` overrides the auto-anchored position and
// the card stays where they drop it (no longer following the node).
const finalPos = computed(() =>
  pos2.value ?? (pos.value ? { left: pos.value.left, top: pos.value.top } : null),
)

// --- Neighbours (one-hop in/out) ------------------------------------------
const neighbors = computed(() => {
  if (!props.selectedNode) return { incoming: [], outgoing: [], incomingNodes: [], outgoingNodes: [] }
  return store.getNeighbors(props.selectedNode.id)
})

// Available groups (containers) the selected node can be dropped into.
const groups = computed(() => store.current.containers)
// When a container itself is selected, show its own group panel.
const selectedContainer = computed(
  () => store.current.containers.find((c) => c.id === store.selectedId) ?? null,
)
function patchContainerName(value: string) {
  if (selectedContainer.value) store.updateContainer(selectedContainer.value.id, { name: value })
}

function focusNode(id: string) {
  store.select(id)
}
function close() {
  store.select(null)
}
// Edit node fields through the store action (never mutate the prop directly).
function patchField(field: 'name' | 'technology' | 'description', value: string) {
  if (!props.selectedNode) return
  store.updateNode(props.selectedNode.id, { [field]: value })
}

// Esc closes the inspector.
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// --- Draggable card -------------------------------------------------------
// The card anchors to the node on open; the user can then grab the grip in the
// header and drag it anywhere so it never covers the node it describes.
const pos2 = ref<{ left: number; top: number } | null>(null)
const dragging = ref(false)
let offX = 0
let offY = 0
function onGripDown(e: PointerEvent) {
  if (!rect.value) return
  const card = e.currentTarget as HTMLElement
  const cardRect = card.getBoundingClientRect()
  offX = e.clientX - cardRect.left
  offY = e.clientY - cardRect.top
  dragging.value = true
  window.addEventListener('pointermove', onGripMove)
  window.addEventListener('pointerup', onGripUp)
  e.preventDefault()
}
function onGripMove(e: PointerEvent) {
  if (!dragging.value) return
  const left = e.clientX - offX
  const top = e.clientY - offY
  pos2.value = {
    left: Math.max(8, Math.min(left, window.innerWidth - PLACEMENT.w - 8)),
    top: Math.max(8, Math.min(top, window.innerHeight - 8)),
  }
}
function onGripUp() {
  dragging.value = false
  window.removeEventListener('pointermove', onGripMove)
  window.removeEventListener('pointerup', onGripUp)
}
// Switch back to auto-follow when the selection changes to a different node.
watch(
  () => props.selectedNode?.id,
  () => {
    pos2.value = null
  },
)
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onGripMove)
  window.removeEventListener('pointerup', onGripUp)
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0 scale-95"
    leave-active-class="transition duration-120 ease-in"
    leave-to-class="opacity-0 scale-95"
  >
    <section
      v-if="(selectedNode || selectedContainer) && finalPos"
      class="fixed z-50 w-72 rounded-xl border border-slate-700 bg-[#0b1220]/97 p-4 text-slate-100 shadow-2xl backdrop-blur"
      :class="dragging ? '' : 'transition-[left,top] duration-150 ease-out'"
      :style="{ left: finalPos.left + 'px', top: finalPos.top + 'px' }"
      role="dialog"
      aria-label="節點屬性"
    >
      <!-- Header (grip on the left lets you drag the panel anywhere) -->
      <div class="mb-3 flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <button
              class="cursor-grab touch-none rounded p-0.5 text-slate-500 transition-colors hover:bg-slate-700/50 hover:text-slate-200 active:cursor-grabbing"
              aria-label="拖動面板"
              title="拖動面板"
              @pointerdown="onGripDown"
            >
              <GripHorizontal class="size-3.5" />
            </button>
            <span class="text-[10px] uppercase tracking-widest text-cyan-300/80">
              {{ selectedContainer ? '群組' : NODE_LABELS[selectedNode!.type] }}
            </span>
          </div>
          <input
            :value="selectedContainer ? selectedContainer.name : selectedNode!.name"
            class="mt-0.5 w-full bg-transparent text-base font-semibold text-slate-100 outline-none"
            aria-label="名稱"
            @input="selectedContainer
              ? patchContainerName(($event.target as HTMLInputElement).value)
              : patchField('name', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <button
          class="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white"
          aria-label="關閉"
          @click="close"
        >
          <X class="size-4" />
        </button>
      </div>

      <!-- Container panel: rename + delete (keeps members) -->
      <template v-if="selectedContainer">
        <label class="mb-2 block text-xs text-slate-400">
          說明
          <textarea
            :value="selectedContainer.description"
            class="field mt-1"
            rows="3"
            placeholder="選填"
            @input="store.updateContainer(selectedContainer.id, { description: ($event.target as HTMLTextAreaElement).value })"
          />
        </label>
        <button
          class="mt-2 w-full rounded-md border border-slate-600/40 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-700/30"
          @click="store.removeContainer(selectedContainer.id)"
        >
          刪除群組（保留成員）
        </button>
      </template>

      <!-- Node panel: tech / description / neighbours / grouping -->
      <template v-else-if="selectedNode">
        <!-- Editable fields -->
        <label class="mb-2 block text-xs text-slate-400">
          技術
          <input
            :value="selectedNode.technology"
            class="field mt-1"
            placeholder="選填"
            @input="patchField('technology', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="block text-xs text-slate-400">
          說明
          <textarea
            :value="selectedNode.description"
            class="field mt-1"
            rows="3"
            @input="patchField('description', ($event.target as HTMLTextAreaElement).value)"
          />
        </label>

        <!-- Connected nodes (focus forward / backward) -->
        <div v-if="neighbors.incoming.length || neighbors.outgoing.length" class="mt-4 space-y-3">
          <div v-if="neighbors.outgoingNodes.length">
            <div class="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500">
              <ArrowDownRight class="size-3 text-cyan-400" /> 下游節點
            </div>
            <button
              v-for="n in neighbors.outgoingNodes"
              :key="n.id"
              class="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-300 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200"
              @click="focusNode(n.id)"
            >
              <span class="size-1.5 rounded-full bg-cyan-400" />
              {{ n.name }}
            </button>
          </div>
          <div v-if="neighbors.incomingNodes.length">
            <div class="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500">
              <ArrowUpRight class="size-3 text-emerald-400" /> 上游節點
            </div>
            <button
              v-for="n in neighbors.incomingNodes"
              :key="n.id"
              class="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-300 transition-colors hover:bg-emerald-400/10 hover:text-emerald-200"
              @click="focusNode(n.id)"
            >
              <span class="size-1.5 rounded-full bg-emerald-400" />
              {{ n.name }}
            </button>
          </div>
        </div>

        <!-- Grouping (only for regular nodes) -->
        <div v-if="!selectedNode.containerId && groups.length" class="mt-4">
          <label class="mb-1 block text-xs text-slate-400">加入群組</label>
          <select
            class="field"
            :value="''"
            @change="(e) => store.addNodeToContainer(selectedNode!.id, (e.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>選擇群組…</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </div>
        <button
          v-if="selectedNode.containerId"
          class="mt-4 w-full rounded-md border border-slate-600/40 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-700/30"
          @click="store.addNodeToContainer(selectedNode!.id, null)"
        >
          移出群組
        </button>

        <!-- Delete -->
        <button
          class="mt-4 w-full rounded-md border border-red-500/30 px-3 py-2 text-xs text-red-300 transition-colors hover:bg-red-500/10"
          @click="store.removeSelected"
        >
          刪除元件
        </button>
      </template>
    </section>
  </Transition>
</template>

<style scoped>
.field {
  border: 1px solid #263650;
  background: #111b2d;
  border-radius: 0.375rem;
  padding: 0.5rem 0.625rem;
  color: #e2e8f0;
  outline: none;
  width: 100%;
}
.field:focus {
  border-color: #38bdf8;
}
</style>
