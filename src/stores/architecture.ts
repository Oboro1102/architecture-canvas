import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { blankArchitecture, demoArchitecture, type Architecture, type ArchitectureNode, type NodeType } from '@/types/architecture'

// Deep clone that works both in the browser and in Node/jsdom test runs
// (structuredClone chokes on Vue reactive proxies under Node 24).
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const STORAGE = 'architecture-canvas.architectures'
export const useArchitectureStore = defineStore('architecture', () => {
  const architectures = ref<Architecture[]>([])
  const current = ref<Architecture>(demoArchitecture())
  const selectedId = ref<string | null>(null)
  const past = ref<Architecture[]>([])
  const future = ref<Architecture[]>([])
  const selected = computed(() => current.value.nodes.find(n => n.id === selectedId.value) ?? current.value.containers.find(c => c.id === selectedId.value) ?? current.value.connections.find(c => c.id === selectedId.value) ?? null)
  function checkpoint() { past.value.push(clone(current.value)); if (past.value.length > 50) past.value.shift(); future.value = [] }
  function touch() { current.value.updatedAt = new Date().toISOString() }
  function load() { try { const raw = sessionStorage.getItem(STORAGE); if (raw) architectures.value = JSON.parse(raw); const saved = architectures.value[0]; if (saved) current.value = saved } catch { /* recover with demo */ } }
  function save() { touch(); architectures.value = [current.value, ...architectures.value.filter(a => a.id !== current.value.id)].slice(0, 12); sessionStorage.setItem(STORAGE, JSON.stringify(architectures.value)) }
  function newArchitecture(name = 'Untitled Architecture') { checkpoint(); current.value = blankArchitecture(name); selectedId.value = null }
  function replace(a: Architecture) { checkpoint(); current.value = clone(a); selectedId.value = null }
  function addNode(type: NodeType, x = 180, y = 160) { checkpoint(); const n: ArchitectureNode = { id: crypto.randomUUID(), name: type === 'gateway' ? 'API Gateway' : type.charAt(0).toUpperCase() + type.slice(1), type, position: { x, y }, size: { width: 150, height: 82 }, shape: 'rounded' }; current.value.nodes.push(n); selectedId.value = n.id; touch() }
  function updateNode(id: string, patch: Partial<ArchitectureNode>) { checkpoint(); const n = current.value.nodes.find(n => n.id === id); if (n) Object.assign(n, patch); touch() }
  function removeSelected() { if (!selectedId.value) return; checkpoint(); current.value.nodes = current.value.nodes.filter(n => n.id !== selectedId.value); current.value.containers = current.value.containers.filter(n => n.id !== selectedId.value); current.value.connections = current.value.connections.filter(c => c.sourceId !== selectedId.value && c.targetId !== selectedId.value); selectedId.value = null; touch() }
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
  function undo() { const p = past.value.pop(); if (p) { future.value.push(clone(current.value)); current.value = p } }
  function redo() { const f = future.value.pop(); if (f) { past.value.push(clone(current.value)); current.value = f } }
  load()
  return { architectures, current, selectedId, selected, canUndo: computed(() => past.value.length > 0), canRedo: computed(() => future.value.length > 0), load, save, newArchitecture, replace, addNode, updateNode, removeSelected, addConnection, select, getNeighbors, zoomIn, zoomOut, undo, redo }
})
