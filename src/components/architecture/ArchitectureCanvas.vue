<script setup lang="ts">
import { computed, ref, watch, markRaw } from 'vue'
import { VueFlow, useVueFlow, MarkerType, type Node, type Edge, type MouseTouchEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import ArchNode from './ArchNode.vue'
import { useArchitectureStore } from '@/stores/architecture'
import { NODE_LABELS, accentFor, type NodeType } from '@/types/architecture'
import { useNodeScreenRect } from '@/composables/useNodeScreenRect'

const { setRect } = useNodeScreenRect()

const store = useArchitectureStore()
const {
  setNodes,
  setEdges,
  screenToFlowCoordinate,
  zoomTo,
  onNodeDragStop,
  onNodeClick,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onPaneClick,
} = useVueFlow()

const nodeTypes = markRaw({ arch: ArchNode })

// --- Interaction state ---------------------------------------------------
// `pulseEdges` holds the ids of connections that should currently play the
// "directional flow pulse" (archify-style source -> target signal).
const pulseEdges = ref<Set<string>>(new Set())
// `hoverId` is the node currently hovered; its one-hop connections get an
// Intent-Trace highlight (restrained, only on fine-pointer hover).
const hoverId = ref<string | null>(null)

const vfNodes = computed<Node[]>(() =>
  store.current.nodes.map((n) => ({
    id: n.id,
    type: 'arch',
    position: { x: n.position.x, y: n.position.y },
    selected: n.id === store.selectedId,
    data: {
      label: n.name,
      typeLabel: NODE_LABELS[n.type],
      technology: n.technology,
      width: n.size.width,
      height: n.size.height,
      accent: accentFor(n.type),
    },
  })),
)

// Build the edge list. Edges connected to the hovered node get an Intent-Trace
// highlight; edges in `pulseEdges` get the animated directional flow pulse.
const vfEdges = computed<Edge[]>(() => {
  return store.current.connections.map((c) => {
    const isHover = hoverId.value === c.sourceId || hoverId.value === c.targetId
    const isPulse = pulseEdges.value.has(c.id)
    const dim = hoverId.value !== null && !isHover
    const color = isPulse || isHover ? '#38bdf8' : '#526889'
    return {
      id: c.id,
      source: c.sourceId,
      target: c.targetId,
      animated: isPulse,
      style: {
        stroke: color,
        strokeWidth: isPulse || isHover ? 2.2 : 1.5,
        opacity: dim ? 0.25 : 1,
        transition: 'stroke 0.2s ease, stroke-width 0.2s ease, opacity 0.2s ease',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
        width: 18,
        height: 18,
      },
    }
  })
})

// store (single source of truth) -> Vue Flow
function syncFromStore() {
  setNodes(vfNodes.value)
  setEdges(vfEdges.value)
}
watch(
  () => [store.current.nodes, store.current.connections, store.selectedId, hoverId.value, pulseEdges.value] as const,
  syncFromStore,
  { deep: true },
)
syncFromStore()

// Vue Flow interactions -> store
onNodeDragStop(({ node }) => {
  const n = store.current.nodes.find((i) => i.id === node.id)
  if (n) n.position = { x: node.position.x, y: node.position.y }
})

onNodeClick(({ node, event }) => {
  store.select(node.id)
  // Play the directional flow pulse on every connection touching this node,
  // then clear after the animation finishes (archify: finite, one-shot only).
  const touched = store.current.connections
    .filter((c) => c.sourceId === node.id || c.targetId === node.id)
    .map((c) => c.id)
  if (touched.length) {
    pulseEdges.value = new Set(touched)
    window.setTimeout(() => {
      // Only clear if a newer click hasn't already replaced the set.
      if (pulseEdges.value.size && [...pulseEdges.value].every((id) => touched.includes(id))) {
        pulseEdges.value = new Set()
      }
    }, 1200)
  }
  // Capture the node's on-screen rectangle so the floating inspector can
  // anchor itself next to the node (archify's Semantic Passport).
  updateNodeScreenRect(node.id, event)
})

onNodeMouseEnter(({ node }) => {
  hoverId.value = node.id
})
onNodeMouseLeave(() => {
  hoverId.value = null
})

onPaneClick(() => {
  store.select(null)
  pulseEdges.value = new Set()
  setRect(null)
})

// Zoom controlled by the navbar (single source = store.viewport.zoom)
watch(
  () => store.current.viewport.zoom,
  (z) => {
    zoomTo(z, { duration: 150 })
    // Re-measure the selected node's screen position so the floating card
    // stays glued to it while zooming.
    if (store.selectedId) updateNodeScreenRect(store.selectedId)
  },
)

// --- Screen-rect bridge for the floating inspector -----------------------
// The floating inspector lives in LandingView (outside VueFlow) but must
// position itself next to the clicked node (archify's Semantic Passport).
// We measure the node's DOM rect inside the flow pane and publish it through
// the shared composable ref.
function updateNodeScreenRect(id: string, event?: MouseTouchEvent) {
  const el = document.querySelector<HTMLElement>(`.vue-flow__node[data-id="${id}"]`)
  if (el) {
    const r = el.getBoundingClientRect()
    setRect({ x: r.left, y: r.top, width: r.width, height: r.height })
    return
  }
  // Fallback: if the node element isn't found yet, anchor near the cursor.
  if (event && 'clientX' in event) {
    setRect({ x: event.clientX, y: event.clientY, width: 0, height: 0 })
  }
}

// Drag-and-drop from the floating component library
const DRAG_MIME = 'application/vueflow'
function onDrop(e: DragEvent) {
  const type = e.dataTransfer?.getData(DRAG_MIME) as NodeType | ''
  if (!type) return
  const pos = screenToFlowCoordinate({ x: e.clientX, y: e.clientY })
  store.addNode(type, pos.x, pos.y)
}
function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes(DRAG_MIME)) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
}
</script>

<template>
  <div class="absolute inset-0 h-full w-full" @drop="onDrop" @dragover="onDragOver">
    <VueFlow
      :nodes="vfNodes"
      :edges="vfEdges"
      :node-types="nodeTypes"
      :zoom-on-scroll="false"
      :default-viewport="{ zoom: store.current.viewport.zoom, x: 0, y: 0 }"
      class="arch-flow"
    >
      <Background
        v-if="store.current.settings.grid"
        variant="dots"
        :gap="16"
        :size="1"
        color="#1c2a43"
      />
    </VueFlow>
  </div>
</template>

<style scoped>
.arch-flow {
  background: transparent;
}
</style>
