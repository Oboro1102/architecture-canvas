<script setup lang="ts">
import { computed, watch } from 'vue'
import { VueFlow, useVueFlow, MarkerType, type Node, type Edge } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import ArchNode from './ArchNode.vue'
import { useArchitectureStore } from '@/stores/architecture'
import { NODE_LABELS, type NodeType } from '@/types/architecture'

const store = useArchitectureStore()
const {
  setNodes,
  setEdges,
  screenToFlowCoordinate,
  zoomTo,
  onNodeDragStop,
  onNodeClick,
} = useVueFlow()

const nodeTypes = { arch: ArchNode }

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
    },
  })),
)

const vfEdges = computed<Edge[]>(() =>
  store.current.connections.map((c) => ({
    id: c.id,
    source: c.sourceId,
    target: c.targetId,
    style: { stroke: '#526889', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#526889', width: 18, height: 18 },
  })),
)

// store (single source of truth) -> Vue Flow
function syncFromStore() {
  setNodes(vfNodes.value)
  setEdges(vfEdges.value)
}
watch(
  () => [store.current.nodes, store.current.connections, store.selectedId] as const,
  syncFromStore,
  { deep: true },
)
syncFromStore()

// Vue Flow interactions -> store
onNodeDragStop(({ node }) => {
  const n = store.current.nodes.find((i) => i.id === node.id)
  if (n) n.position = { x: node.position.x, y: node.position.y }
})
onNodeClick(({ node }) => store.select(node.id))

// Zoom controlled by the navbar (single source = store.viewport.zoom)
watch(
  () => store.current.viewport.zoom,
  (z) => zoomTo(z, { duration: 150 }),
)

// Drag-and-drop from the sidebar component library
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
  <div class="h-full w-full" @drop="onDrop" @dragover="onDragOver">
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
  background: #0b1020;
}
</style>
