<script setup lang="ts">
import { computed, ref, watch, markRaw, onBeforeUnmount, onMounted, nextTick } from 'vue'
import { VueFlow, useVueFlow, MarkerType, ConnectionMode, type Node, type Edge, type Connection, type MouseTouchEvent } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import ArchNode from './ArchNode.vue'
import ArchGroupNode from './ArchGroupNode.vue'
import { useArchitectureStore } from '@/stores/architecture'
import { NODE_LABELS, accentFor, containerLabelFor, containerAccentFor, type NodeType, type ArchitectureContainer, type ArchitectureNode } from '@/types/architecture'
import { useNodeScreenRect } from '@/composables/useNodeScreenRect'
import { useConfirm } from '@/composables/useConfirm'

const { setRect } = useNodeScreenRect()

const store = useArchitectureStore()
const { confirm } = useConfirm()
const {
  setNodes,
  setEdges,
  screenToFlowCoordinate,
  zoomTo,
  fitView,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragStop,
  findNode,
  updateNode,
  onNodeClick,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onPaneClick,
  onConnect,
  onViewportChange,
  onNodesInitialized,
  getViewport,
} = useVueFlow()
// Vue Flow owns the live viewport (zoom/pan the user actually sees). We keep it
// in sync with the store (single source of truth) in both directions so the
// navbar's percentage + zoom buttons always agree with the canvas.

const nodeTypes = markRaw({ arch: ArchNode, group: ArchGroupNode })

// All positions are stored as ABSOLUTE canvas coordinates. Group membership is
// tracked via `containerId` only (no parentNode / coordinate conversion), so a
// group's children render at their absolute spots. When a group is dragged we
// manually translate its children by the same delta (see onNodeDrag below).
const NODE_W = 150
const NODE_H = 82
// `pulseEdges` holds the ids of connections that should currently play the
// "directional flow pulse" (archify-style source -> target signal).
const pulseEdges = ref<Set<string>>(new Set())
// `hoverId` is the node currently hovered; its one-hop connections get an
// Intent-Trace highlight (restrained, only on fine-pointer hover).
const hoverId = ref<string | null>(null)

// Build the node list. Regular architecture nodes become `arch` type; containers
// become `group` type (Vue Flow draggable groups). All positions are absolute.
const vfNodes = computed<Node[]>(() => {
  const groups: Node[] = store.current.containers.map((c) => ({
    id: c.id,
    type: 'group',
    position: { x: c.position.x, y: c.position.y },
    selected: c.id === store.selectedId,
    style: {
      width: `${c.size.width}px`,
      height: `${c.size.height}px`,
    },
    data: {
      label: c.name,
      typeLabel: containerLabelFor(c.type),
      description: c.description ?? '',
      accent: containerAccentFor(c.type),
    },
    }))
  const nodes: Node[] = store.current.nodes.map((n) => ({
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
  }))
  return [...groups, ...nodes]
})

// Build the edge list. Edges connected to the hovered node get an Intent-Trace
// highlight AND the directional flow pulse; edges in `pulseEdges` (clicked) get
// the pulse too. Edges use orthogonal (smoothstep) routing so they read as
// technical architecture lines rather than curvy beziers.
const vfEdges = computed<Edge[]>(() => {
  return store.current.connections.map((c) => {
    const isHover = hoverId.value === c.sourceId || hoverId.value === c.targetId
    const isPulse = pulseEdges.value.has(c.id) || isHover
    const dim = hoverId.value !== null && !isHover && !pulseEdges.value.has(c.id)
    const color = isPulse ? '#38bdf8' : '#526889'
    return {
      id: c.id,
      source: c.sourceId,
      target: c.targetId,
      type: 'smoothstep',
      animated: isPulse,
      style: {
        stroke: color,
        strokeWidth: isPulse ? 2.2 : 1.5,
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

// On first mount we request a fit so the canvas isn't stuck at the default
// 1:1 zoom. The actual fitView waits until Vue Flow has MEASURED the nodes
// (onNodesInitialized) — fitting before measurement frames a 0-size canvas and
// does nothing useful. This also pulls the live zoom back into the store via
// the onViewportChange sync below, keeping the navbar % honest.
//
// Two distinct triggers feed one `wantFit` flag:
//   1. store.fit()  (navbar "符合" button, keyboard 'f'): the CURRENT view is
//      already measured, so we fit immediately.
//   2. a whole node-set replacement (template switch / import / new): we watch
//      the nodes ARRAY REFERENCE (not deep content) and, once Vue Flow
//      re-measures the new nodes, fit again. This is exactly "fit once after
//      switching templates". Adding a single node (push, same reference) must
//      NOT trigger an auto-fit.
let isInitialized = false
let wantFit = false
function tryFit() {
  if (wantFit && isInitialized) {
    wantFit = false
    // One more tick so the just-measured dimensions are committed before we
    // compute the bounding box.
    nextTick(() => fitView({ padding: 0.2, duration: 200 }))
  }
}
function doFit() {
  // Manual request on an already-measured view: fit right away.
  wantFit = true
  tryFit()
}
// Fires whenever ALL nodes have been measured — initial mount, and again after
// the node set is replaced (template switch / import) and re-measured.
onNodesInitialized(() => {
  isInitialized = true
  tryFit()
})
// Auto-fit when the entire node set is swapped (template switch / import / new
// architecture). A reference change (not a deep content change) means the
// structure was replaced, so wait for re-measurement rather than fitting the
// outgoing nodes.
watch(
  () => store.current.nodes,
  () => {
    wantFit = true
  },
)
onMounted(() => {
  store.registerFit(doFit)
  // First-load: request a fit once the initial nodes are measured.
  doFit()
})

// --- Group-drag follow + node drag persistence --------------------------
// Because positions are absolute (no Vue Flow parentNode), dragging a group does
// NOT auto-move its children. We capture the group + children's starting spots on
// drag-start, then translate every child by the same delta on each drag frame.
const dragState = ref<{ groupId: string; groupStart: { x: number; y: number }; childStart: Map<string, { x: number; y: number }> } | null>(null)

onNodeDragStart(({ node }) => {
  const c = store.current.containers.find((i) => i.id === node.id)
  if (!c) return
  const childStart = new Map<string, { x: number; y: number }>()
  for (const n of store.current.nodes) {
    if (n.containerId === c.id) childStart.set(n.id, { x: n.position.x, y: n.position.y })
  }
  dragState.value = { groupId: c.id, groupStart: { x: c.position.x, y: c.position.y }, childStart }
})

onNodeDrag(({ node }) => {
  const s = dragState.value
  if (!s || s.groupId !== node.id) return
  const dx = node.position.x - s.groupStart.x
  const dy = node.position.y - s.groupStart.y
  for (const [cid, start] of s.childStart) {
    // Command-level update of the Vue Flow internal node — does NOT touch the
    // store, so it won't trigger our re-sync watch mid-drag.
    updateNode(cid, { position: { x: start.x + dx, y: start.y + dy } })
  }
})

// Vue Flow interactions -> store
onNodeDragStop(async ({ node }) => {
  // Dragging a group container: persist its new absolute position + children.
  const s = dragState.value
  if (s && s.groupId === node.id) {
    const c = store.current.containers.find((i) => i.id === s.groupId)
    if (c) c.position = { x: node.position.x, y: node.position.y }
    for (const [cid] of s.childStart) {
      const child = store.current.nodes.find((n) => n.id === cid)
      const vf = findNode(cid)
      if (child && vf) child.position = { x: vf.position.x, y: vf.position.y }
    }
    dragState.value = null
    if (store.selectedId) updateNodeScreenRect(c?.id ?? store.selectedId)
    return
  }
  dragState.value = null

  const n = store.current.nodes.find((i) => i.id === node.id)
  if (!n) return
  n.position = { x: node.position.x, y: node.position.y }

  // Work out which group (if any) the node's CENTER was dropped onto.
  const target = containerAt(node.position.x, node.position.y)
  if (target && target.id !== n.containerId) {
    // Dropped onto a DIFFERENT group -> ask to join it.
    const ok = await confirm({
      title: '加入群組？',
      description: `將「${n.name}」加入群組「${target.name}」？`,
      confirmText: '加入',
      cancelText: '取消',
    })
    if (ok) {
      store.addNodeToContainer(n.id, target.id)
    } else if (n.containerId) {
      // Cancelled: keep original membership, snap back inside the original group.
      snapBackToGroup(n, node)
    }
  } else if (!target && n.containerId) {
    // Dropped OUTSIDE any group while it belonged to one -> ask to leave it.
    const c = store.current.containers.find((i) => i.id === n.containerId)
    if (c) {
      const ok = await confirm({
        title: '移出群組？',
        description: `「${n.name}」已移出群組「${c.name}」，是否解除群組關聯？`,
        confirmText: '移出',
        cancelText: '保留',
      })
      if (ok) {
        store.addNodeToContainer(n.id, null)
      } else {
        snapBackToGroup(n, node)
      }
    }
  }
  // Re-measure the selected node so the floating inspector stays glued.
  if (store.selectedId) updateNodeScreenRect(store.selectedId)
})

// Find the topmost group whose box contains the node's center (NODE_W/H offset).
function containerAt(x: number, y: number): ArchitectureContainer | null {
  const cx = x + NODE_W / 2
  const cy = y + NODE_H / 2
  let found: ArchitectureContainer | null = null
  for (const c of store.current.containers) {
    if (cx >= c.position.x && cx <= c.position.x + c.size.width && cy >= c.position.y && cy <= c.position.y + c.size.height) {
      found = c
    }
  }
  return found
}
// Snap a node back just inside the bounds of the group it already belongs to.
function snapBackToGroup(n: ArchitectureNode, node: { position: { x: number; y: number } }) {
  const c = n.containerId ? store.current.containers.find((i) => i.id === n.containerId) : undefined
  if (!c) return
  const snapX = Math.min(Math.max(node.position.x, c.position.x + NODE_W / 2), c.position.x + c.size.width - NODE_W / 2)
  const snapY = Math.min(Math.max(node.position.y, c.position.y + NODE_H / 2), c.position.y + c.size.height - NODE_H / 2)
  n.position = { x: snapX, y: snapY }
  updateNode(n.id, { position: { x: snapX, y: snapY } })
}

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

onConnect((conn: Connection) => {
  if (!conn.source || !conn.target || conn.source === conn.target) return
  store.addConnection(conn.source, conn.target)
})

onPaneClick(() => {
  store.select(null)
  pulseEdges.value = new Set()
  setRect(null)
})

// --- Keyboard shortcuts (common node-editing habits) ----------------------
// Only act when the user isn't typing in a field, so Delete/Backspace never
// wipes a node while editing its name in the inspector.
function isEditing() {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}
function onKey(e: KeyboardEvent) {
  if (isEditing()) return
  const mod = e.metaKey || e.ctrlKey
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) store.redo()
    else store.undo()
    return
  }
  if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault()
    store.save()
    return
  }
  if (mod && e.key.toLowerCase() === 'a') {
    // Let Vue Flow's selection box handle multi-select; don't hijack.
    return
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (store.selectedId) {
      e.preventDefault()
      store.removeSelected()
    }
    return
  }
  if (e.key === 'f' || e.key === 'F') {
    store.fit()
    return
  }
  if (e.key === 'Escape') {
    store.select(null)
    pulseEdges.value = new Set()
    setRect(null)
  }
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// Zoom is the single source of truth in the store, but Vue Flow owns the live
// viewport. We sync in BOTH directions:
//   store -> canvas : when the navbar zoom buttons change the store, animate.
//   canvas -> store : when the user pans/zooms (or fitView runs), push the live
//                     zoom back into the store so the navbar % stays in sync.
watch(
  () => store.current.viewport.zoom,
  (z) => {
    if (Math.abs(z - getViewport().zoom) < 1e-3) return // avoid echo loop
    zoomTo(z, { duration: 150 })
    // Re-measure the selected node's screen position so the floating card
    // stays glued to it while zooming.
    if (store.selectedId) updateNodeScreenRect(store.selectedId)
  },
)

onViewportChange((vp) => {
  // Keep the store's zoom as the single source of truth in sync with the
  // canvas. Guarded so we don't fight the store->canvas watch above.
  if (Math.abs(vp.zoom - store.current.viewport.zoom) >= 1e-3) {
    store.current.viewport.zoom = vp.zoom
  }
})

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
const GROUP_MIME = 'application/vueflow-group'
function onDrop(e: DragEvent) {
  const groupType = e.dataTransfer?.getData(GROUP_MIME)
  if (groupType === 'group') {
    const pos = screenToFlowCoordinate({ x: e.clientX, y: e.clientY })
    store.addContainer(pos.x, pos.y)
    return
  }
  const type = e.dataTransfer?.getData(DRAG_MIME) as NodeType | ''
  if (!type) return
  const pos = screenToFlowCoordinate({ x: e.clientX, y: e.clientY })
  store.addNode(type, pos.x, pos.y)
}
function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes(DRAG_MIME) || e.dataTransfer?.types.includes(GROUP_MIME)) {
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
      :connection-mode="ConnectionMode.Loose"
      :nodes-connectable="true"
      :zoom-on-scroll="true"
      :default-viewport="{ zoom: 1, x: 0, y: 0 }"
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
