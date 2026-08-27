import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { blankArchitecture, demoArchitecture, buildTemplate, type Architecture, type ArchitectureNode, type ArchitectureContainer, type NodeType } from '@/types/architecture'

// Deep clone that works both in the browser and in Node/jsdom test runs
// (structuredClone chokes on Vue reactive proxies under Node 24).
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const STORAGE = 'architecture-canvas.architectures'
export const useArchitectureStore = defineStore('architecture', () => {
  const architectures = ref<Architecture[]>([])
  // The default canvas is the 電子商務平台 (E-commerce) template, so a fresh
  // session always opens with a meaningful, grouped, fully-wired architecture.
  const current = ref<Architecture>(buildTemplate('電子商務平台') ?? demoArchitecture())
  const selectedId = ref<string | null>(null)
  // The canvas owns the live Vue Flow viewport and its `fitView`. It registers
  // its real fitView callback here so any caller (navbar button, keyboard 'f',
  // template switch, import) can request a fit without the store importing
  // Vue Flow directly. Registering the callback (rather than toggling a boolean
  // flag) is exactly what fixes the "fit only works once" bug: a boolean flag
  // flips false->true on the first call and then never changes again, so the
  // canvas watch that keyed off it stopped firing on every later click.
  let fitHandler: (() => void) | null = null
  let fitPending = false
  function registerFit(fn: () => void) {
    fitHandler = fn
    // If a fit was requested before the canvas mounted/registered, honor it now.
    if (fitPending) {
      fitPending = false
      fn()
    }
  }
  function fit() {
    if (fitHandler) fitHandler()
    else fitPending = true
  }
  const past = ref<Architecture[]>([])
  const future = ref<Architecture[]>([])
  const selected = computed(() => current.value.nodes.find(n => n.id === selectedId.value) ?? current.value.containers.find(c => c.id === selectedId.value) ?? current.value.connections.find(c => c.id === selectedId.value) ?? null)
  function checkpoint() { past.value.push(clone(current.value)); if (past.value.length > 50) past.value.shift(); future.value = [] }
  function touch() { current.value.updatedAt = new Date().toISOString() }
  function load() { try { const raw = sessionStorage.getItem(STORAGE); if (raw) architectures.value = JSON.parse(raw); const saved = architectures.value[0]; if (saved) current.value = saved } catch { /* recover with demo */ } }
  function save() { touch(); architectures.value = [current.value, ...architectures.value.filter(a => a.id !== current.value.id)].slice(0, 12); sessionStorage.setItem(STORAGE, JSON.stringify(architectures.value)) }
  function newArchitecture(name = 'Untitled Architecture') { checkpoint(); current.value = blankArchitecture(name); selectedId.value = null }
  function replace(a: Architecture) { checkpoint(); current.value = clone(a); selectedId.value = null }
  function addNode(type: NodeType, x = 180, y = 160, containerId?: string) { checkpoint(); const n: ArchitectureNode = { id: crypto.randomUUID(), name: type === 'gateway' ? 'API Gateway' : type.charAt(0).toUpperCase() + type.slice(1), type, position: { x, y }, size: { width: 150, height: 82 }, shape: 'rounded', containerId }; current.value.nodes.push(n); selectedId.value = n.id; touch() }
  function updateNode(id: string, patch: Partial<ArchitectureNode>) { checkpoint(); const n = current.value.nodes.find(n => n.id === id); if (n) Object.assign(n, patch); touch() }
  function removeSelected() { if (!selectedId.value) return; checkpoint(); current.value.nodes = current.value.nodes.filter(n => n.id !== selectedId.value); current.value.containers = current.value.containers.filter(n => n.id !== selectedId.value); current.value.connections = current.value.connections.filter(c => c.sourceId !== selectedId.value && c.targetId !== selectedId.value); selectedId.value = null; touch() }
  // --- Containers / grouping ----------------------------------------------
  function addContainer(x: number, y: number, w = 320, h = 260) { checkpoint(); const c: ArchitectureContainer = { id: crypto.randomUUID(), name: '群組', type: 'group', description: '', position: { x, y }, size: { width: w, height: h } }; current.value.containers.push(c); selectedId.value = c.id; touch(); return c.id }
  function updateContainer(id: string, patch: Partial<ArchitectureContainer>) { checkpoint(); const c = current.value.containers.find(c => c.id === id); if (c) Object.assign(c, patch); touch() }
  // Reparent a node into a container (or null to ungroup). Positions are stored
  // as ABSOLUTE canvas coordinates throughout, so grouping only sets the
  // `containerId` membership — no coordinate conversion needed.
  function addNodeToContainer(nodeId: string, containerId: string | null) {
    checkpoint()
    const n = current.value.nodes.find(n => n.id === nodeId)
    if (!n) return
    n.containerId = containerId ?? undefined
    touch()
  }
  function removeContainer(id: string) {
    checkpoint()
    // Ungroup its members (clear membership) instead of deleting them. Since
    // positions are absolute, members keep their exact spot on the canvas.
    current.value.nodes.forEach(n => { if (n.containerId === id) n.containerId = undefined })
    current.value.containers = current.value.containers.filter(c => c.id !== id)
    if (selectedId.value === id) selectedId.value = null
    touch()
  }
  function addConnection(sourceId: string, targetId: string) { checkpoint(); current.value.connections.push({ id: crypto.randomUUID(), sourceId, targetId, type: 'dependency', direction: 'forward' }); touch() }
  function select(id: string | null) { selectedId.value = id }
  // Returns the one-hop neighborhood of a node (incoming / outgoing connections
  // and the nodes on the other end). Used by the floating inspector to offer a
  // "focus connected nodes" action, mirroring archify's relationship lens.
  function getNeighbors(id: string) {
    const incoming = current.value.connections.filter((c) => c.targetId === id)
    const outgoing = current.value.connections.filter((c) => c.sourceId === id)
    const byId = (nid: string) => current.value.nodes.find((n) => n.id === nid)
    return {
      incoming,
      outgoing,
      incomingNodes: incoming.map((c) => byId(c.sourceId)).filter(Boolean) as ArchitectureNode[],
      outgoingNodes: outgoing.map((c) => byId(c.targetId)).filter(Boolean) as ArchitectureNode[],
    }
  }
  function zoomIn() { const z = current.value.viewport.zoom || 1; current.value.viewport.zoom = Math.min(z * 1.2, 3) }
  function zoomOut() { const z = current.value.viewport.zoom || 1; current.value.viewport.zoom = Math.max(z / 1.2, 0.3) }
  // --- Persistence via JSON (import / export) ------------------------------
  // Export the current architecture as a pretty-printed JSON string. This is
  // the canonical "save" action (see README: JSON Format).
  function exportJson(): string {
    touch()
    return JSON.stringify(current.value, null, 2)
  }
  // Parse + load an architecture from a JSON string (import). Returns false if
  // the payload is not a valid architecture document.
  function importJson(text: string): boolean {
    try {
      const data = JSON.parse(text)
      if (!data || typeof data !== 'object') return false
      if (!Array.isArray(data.nodes) || !Array.isArray(data.containers) || !Array.isArray(data.connections)) return false
      const a: Architecture = {
        ...blankArchitecture(data.metadata?.name ?? 'Imported Architecture'),
        ...data,
      }
      replace(a)
      return true
    } catch {
      return false
    }
  }
  function undo() { const p = past.value.pop(); if (p) { future.value.push(clone(current.value)); current.value = p } }
  function redo() { const f = future.value.pop(); if (f) { past.value.push(clone(current.value)); current.value = f } }
  load()
  return { architectures, current, selectedId, registerFit, selected, canUndo: computed(() => past.value.length > 0), canRedo: computed(() => future.value.length > 0), load, save, newArchitecture, replace, addNode, updateNode, removeSelected, addConnection, select, getNeighbors, zoomIn, zoomOut, fit, addContainer, updateContainer, addNodeToContainer, removeContainer, undo, redo, exportJson, importJson }
})
