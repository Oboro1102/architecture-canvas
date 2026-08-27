<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { X, ArrowUpRight, ArrowDownRight } from '@lucide/vue'
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

// --- Neighbours (one-hop in/out) ------------------------------------------
const neighbors = computed(() => {
  if (!props.selectedNode) return { incoming: [], outgoing: [], incomingNodes: [], outgoingNodes: [] }
  return store.getNeighbors(props.selectedNode.id)
})

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
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0 scale-95"
    leave-active-class="transition duration-120 ease-in"
    leave-to-class="opacity-0 scale-95"
  >
    <section
      v-if="selectedNode && pos"
      class="fixed z-50 w-72 rounded-xl border border-slate-700 bg-[#0b1220]/97 p-4 text-slate-100 shadow-2xl backdrop-blur"
      :style="{ left: pos.left + 'px', top: pos.top + 'px', transformOrigin: pos.origin }"
      role="dialog"
      aria-label="節點屬性"
    >
      <!-- Header -->
      <div class="mb-3 flex items-start justify-between gap-2">
        <div>
          <div class="text-[10px] uppercase tracking-widest text-cyan-300/80">
            {{ NODE_LABELS[selectedNode.type] }}
          </div>
          <input
            :value="selectedNode.name"
            class="mt-0.5 w-full bg-transparent text-base font-semibold text-slate-100 outline-none"
            aria-label="名稱"
            @input="patchField('name', ($event.target as HTMLInputElement).value)"
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

      <!-- Delete -->
      <button
        class="mt-4 w-full rounded-md border border-red-500/30 px-3 py-2 text-xs text-red-300 transition-colors hover:bg-red-500/10"
        @click="store.removeSelected"
      >
        刪除元件
      </button>
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
