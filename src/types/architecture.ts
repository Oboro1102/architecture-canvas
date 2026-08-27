export type NodeType = 'user' | 'client' | 'frontend' | 'backend' | 'service' | 'worker' | 'gateway' | 'load-balancer' | 'server' | 'container' | 'database' | 'cache' | 'storage' | 'queue' | 'message-broker' | 'external-api' | 'external-system'
export type ContainerType = 'system' | 'application' | 'environment' | 'network' | 'vpc' | 'subnet' | 'cluster' | 'namespace' | 'group' | 'data'
export type ConnectionType = 'dependency' | 'synchronous' | 'asynchronous' | 'event' | 'data-flow' | 'replication'
export type NodeShape = 'rectangle' | 'rounded' | 'circle' | 'database' | 'hexagon'
export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface ArchitectureNode { id: string; name: string; type: NodeType; technology?: string; description?: string; icon?: string; position: Point; size: Size; shape?: NodeShape; containerId?: string; metadata?: Record<string, unknown> }
export interface ArchitectureContainer { id: string; name: string; type: ContainerType; description?: string; position: Point; size: Size }
export interface ArchitectureConnection { id: string; sourceId: string; targetId: string; type: ConnectionType; protocol?: string; label?: string; direction?: 'forward' | 'backward' | 'bidirectional' }
export interface ViewportState { x: number; y: number; zoom: number }
export interface ArchitectureSettings { grid: boolean; snap: boolean; gridSize: number; background: 'dark' | 'light' }
export interface Architecture { id: string; name: string; description?: string; nodes: ArchitectureNode[]; containers: ArchitectureContainer[]; connections: ArchitectureConnection[]; viewport: ViewportState; settings: ArchitectureSettings; createdAt: string; updatedAt: string }

export const NODE_LABELS: Record<NodeType, string> = { user: '使用者', client: '用戶端', frontend: '前端', backend: '後端', service: '服務', worker: '工作處理程序', gateway: 'API 閘道', 'load-balancer': '負載平衡器', server: '伺服器', container: '容器', database: '資料庫', cache: '快取', storage: '物件儲存', queue: '佇列', 'message-broker': '訊息代理程式', 'external-api': '外部 API', 'external-system': '外部系統' }
export const NODE_GROUPS = [{ label: '應用程式', types: ['frontend','backend','service','worker'] as NodeType[] }, { label: '基礎設施', types: ['gateway','load-balancer','server','container'] as NodeType[] }, { label: '資料', types: ['database','cache','storage','queue','message-broker'] as NodeType[] }, { label: '外部系統', types: ['user','client','external-api','external-system'] as NodeType[] }]
const now = () => new Date().toISOString()
// Per node-type accent color, used for the node border/glow and the connection
// pulse so each node group reads with its own hue (mirrors archify's token vocab).
export const NODE_ACCENTS: Record<NodeType, string> = {
  user: '#a78bfa',
  client: '#a78bfa',
  frontend: '#38bdf8',
  backend: '#34d399',
  service: '#34d399',
  worker: '#fbbf24',
  gateway: '#f472b6',
  'load-balancer': '#f472b6',
  server: '#f59e0b',
  container: '#f59e0b',
  database: '#22d3ee',
  cache: '#22d3ee',
  storage: '#22d3ee',
  queue: '#fb923c',
  'message-broker': '#fb923c',
  'external-api': '#f87171',
  'external-system': '#f87171',
}
export function accentFor(type: NodeType): string {
  return NODE_ACCENTS[type] ?? '#38bdf8'
}
// Per container-type label + accent (group chrome). Kept here (not in the
// canvas component) so the domain vocabulary stays in one place and the maps
// are built once at module load instead of on every render.
export const CONTAINER_LABELS: Record<ContainerType, string> = {
  system: '系統', application: '應用程式', environment: '環境', network: '網路',
  vpc: 'VPC', subnet: '子網路', cluster: '叢集', namespace: '命名空間',
  group: '群組', data: '資料層',
}
export const CONTAINER_ACCENTS: Record<ContainerType, string> = {
  system: '#38bdf8', application: '#34d399', environment: '#a78bfa', network: '#f472b6',
  vpc: '#f472b6', subnet: '#f472b6', cluster: '#f59e0b', namespace: '#f59e0b',
  group: '#64748b', data: '#22d3ee',
}
export function containerLabelFor(t: ContainerType): string {
  return CONTAINER_LABELS[t] ?? '群組'
}
export function containerAccentFor(t: ContainerType): string {
  return CONTAINER_ACCENTS[t] ?? '#64748b'
}
export function blankArchitecture(name = '未命名架構'): Architecture { return { id: crypto.randomUUID(), name, nodes: [], containers: [], connections: [], viewport: { x: 0, y: 0, zoom: 1 }, settings: { grid: true, snap: true, gridSize: 16, background: 'dark' }, createdAt: now(), updatedAt: now() } }
export function demoArchitecture(): Architecture { const a = blankArchitecture('電子商務平台'); const add = (id: string, name: string, type: NodeType, x: number, y: number, technology?: string) => a.nodes.push({ id, name, type, technology, position: { x, y }, size: { width: 150, height: 82 }, shape: 'rounded' }); add('user','使用者','user',70,260); add('cdn','CDN','gateway',290,260,'CloudFront'); add('frontend','前端','frontend',510,260,'Next.js'); add('gateway','API 閘道','gateway',730,260,'Kong'); add('users','使用者服務','service',980,120,'NestJS'); add('orders','訂單服務','service',980,260,'NestJS'); add('payments','付款服務','service',980,400,'Node.js'); add('db','PostgreSQL','database',1240,220,'PostgreSQL'); add('redis','Redis','cache',1240,380,'Redis'); add('queue','佇列','queue',980,560,'Kafka'); add('worker','工作處理程序','worker',1240,560,'BullMQ'); const links: [string, string][] = [['user','cdn'],['cdn','frontend'],['frontend','gateway'],['gateway','users'],['gateway','orders'],['gateway','payments'],['users','db'],['orders','db'],['gateway','redis'],['payments','queue'],['queue','worker']]; a.connections = links.map(([sourceId,targetId], i) => ({ id: `edge-${i}`, sourceId, targetId, type: 'synchronous', protocol: 'HTTPS' })); return a }

// --- Templates ------------------------------------------------------------
// Each template is authored as containers (groups) with nodes positioned
// relatively inside them, plus the connection list. `buildTemplate` expands
// this into a full Architecture so every preset ships with sensible groups
// AND sensible wiring out of the box.
interface TplNode { id: string; type: NodeType; name?: string; technology?: string; dx: number; dy: number }
interface TplContainer { id: string; name: string; type: ContainerType; x: number; y: number; w: number; h: number; nodes: TplNode[] }
interface Tpl { label: string; containers: TplContainer[]; links: Array<[string, string]> }
const TEMPLATES: Record<string, Tpl> = {
  電子商務平台: {
    label: '電子商務平台',
    containers: [
      { id: 'g-front', name: '前端層', type: 'application', x: 60, y: 200, w: 420, h: 180, nodes: [
        { id: 'user', type: 'user', dx: 30, dy: 60 },
        { id: 'cdn', type: 'gateway', name: 'CDN', technology: 'CloudFront', dx: 170, dy: 60 },
        { id: 'frontend', type: 'frontend', name: '前端', technology: 'Next.js', dx: 300, dy: 60 },
      ] },
      { id: 'g-back', name: '後端服務', type: 'application', x: 520, y: 200, w: 460, h: 320, nodes: [
        { id: 'gateway', type: 'gateway', name: 'API 閘道', technology: 'Kong', dx: 30, dy: 30 },
        { id: 'users', type: 'service', name: '使用者服務', technology: 'NestJS', dx: 200, dy: 20 },
        { id: 'orders', type: 'service', name: '訂單服務', technology: 'NestJS', dx: 200, dy: 110 },
        { id: 'payments', type: 'service', name: '付款服務', technology: 'Node.js', dx: 200, dy: 200 },
      ] },
      { id: 'g-data', name: '資料與非同步', type: 'data', x: 1020, y: 200, w: 340, h: 460, nodes: [
        { id: 'db', type: 'database', name: 'PostgreSQL', technology: 'PostgreSQL', dx: 30, dy: 30 },
        { id: 'redis', type: 'cache', name: 'Redis', technology: 'Redis', dx: 30, dy: 150 },
        { id: 'queue', type: 'queue', name: '佇列', technology: 'Kafka', dx: 180, dy: 250 },
        { id: 'worker', type: 'worker', name: '工作處理程序', technology: 'BullMQ', dx: 30, dy: 360 },
      ] },
    ],
    links: [['user','cdn'],['cdn','frontend'],['frontend','gateway'],['gateway','users'],['gateway','orders'],['gateway','payments'],['users','db'],['orders','db'],['gateway','redis'],['payments','queue'],['queue','worker']],
  },
  三層式: {
    label: '三層式',
    containers: [
      { id: 'g-pres', name: '展示層', type: 'application', x: 80, y: 200, w: 340, h: 160, nodes: [
        { id: 'user', type: 'user', dx: 30, dy: 50 },
        { id: 'frontend', type: 'frontend', name: '前端', technology: 'Vue', dx: 190, dy: 50 },
      ] },
      { id: 'g-app', name: '應用層', type: 'application', x: 480, y: 200, w: 300, h: 160, nodes: [
        { id: 'backend', type: 'backend', name: '後端', technology: 'Spring', dx: 80, dy: 50 },
      ] },
      { id: 'g-data', name: '資料層', type: 'data', x: 840, y: 200, w: 300, h: 160, nodes: [
        { id: 'database', type: 'database', name: '資料庫', technology: 'PostgreSQL', dx: 80, dy: 50 },
      ] },
    ],
    links: [['user','frontend'],['frontend','backend'],['backend','database']],
  },
  微服務: {
    label: '微服務',
    containers: [
      { id: 'g-edge', name: '入口', type: 'application', x: 80, y: 200, w: 340, h: 160, nodes: [
        { id: 'client', type: 'client', dx: 30, dy: 50 },
        { id: 'gateway', type: 'gateway', name: 'API 閘道', technology: 'Kong', dx: 190, dy: 50 },
      ] },
      { id: 'g-svc', name: '服務叢集', type: 'cluster', x: 480, y: 160, w: 320, h: 320, nodes: [
        { id: 's1', type: 'service', name: '服務 A', technology: 'Go', dx: 30, dy: 30 },
        { id: 's2', type: 'service', name: '服務 B', technology: 'Go', dx: 30, dy: 130 },
        { id: 's3', type: 'service', name: '服務 C', technology: 'Go', dx: 30, dy: 230 },
      ] },
      { id: 'g-data', name: '資料', type: 'data', x: 880, y: 200, w: 300, h: 160, nodes: [
        { id: 'database', type: 'database', name: '資料庫', technology: 'MongoDB', dx: 80, dy: 50 },
      ] },
    ],
    links: [['client','gateway'],['gateway','s1'],['gateway','s2'],['gateway','s3'],['s1','database'],['s2','database'],['s3','database']],
  },
  事件驅動: {
    label: '事件驅動',
    containers: [
      { id: 'g-prod', name: '生產者', type: 'application', x: 80, y: 200, w: 320, h: 160, nodes: [
        { id: 'client', type: 'client', dx: 110, dy: 50 },
      ] },
      { id: 'g-bus', name: '事件總線', type: 'network', x: 460, y: 200, w: 300, h: 160, nodes: [
        { id: 'broker', type: 'message-broker', name: '訊息代理', technology: 'Kafka', dx: 80, dy: 50 },
      ] },
      { id: 'g-cons', name: '消費者', type: 'application', x: 840, y: 140, w: 360, h: 340, nodes: [
        { id: 'w1', type: 'worker', name: '消費者 A', technology: 'Flink', dx: 30, dy: 30 },
        { id: 'w2', type: 'worker', name: '消費者 B', technology: 'Flink', dx: 30, dy: 140 },
        { id: 'database', type: 'database', name: '資料庫', technology: 'PostgreSQL', dx: 190, dy: 220 },
      ] },
    ],
    links: [['client','broker'],['broker','w1'],['broker','w2'],['w1','database'],['w2','database']],
  },
  無伺服器: {
    label: '無伺服器',
    containers: [
      { id: 'g-entry', name: '入口', type: 'application', x: 80, y: 200, w: 340, h: 160, nodes: [
        { id: 'client', type: 'client', dx: 30, dy: 50 },
        { id: 'gateway', type: 'gateway', name: 'API 閘道', technology: 'API Gateway', dx: 190, dy: 50 },
      ] },
      { id: 'g-fn', name: '函式', type: 'application', x: 480, y: 200, w: 300, h: 160, nodes: [
        { id: 'backend', type: 'backend', name: 'Lambda', technology: 'AWS Lambda', dx: 80, dy: 50 },
      ] },
      { id: 'g-store', name: '儲存', type: 'data', x: 840, y: 200, w: 320, h: 160, nodes: [
        { id: 'database', type: 'database', name: '資料庫', technology: 'DynamoDB', dx: 20, dy: 50 },
        { id: 'storage', type: 'storage', name: '物件儲存', technology: 'S3', dx: 170, dy: 50 },
      ] },
    ],
    links: [['client','gateway'],['gateway','backend'],['backend','database'],['backend','storage']],
  },
}
export const TEMPLATE_LABELS = Object.keys(TEMPLATES)
// Expand a template definition into a full Architecture (containers + nodes +
// connections). Node positions are absolute (container origin + node offset).
export function buildTemplate(label: string): Architecture | null {
  const t = TEMPLATES[label]
  if (!t) return null
  const a = blankArchitecture(t.label)
  for (const c of t.containers) {
    a.containers.push({ id: c.id, name: c.name, type: c.type, description: '', position: { x: c.x, y: c.y }, size: { width: c.w, height: c.h } })
    for (const n of c.nodes) {
      a.nodes.push({
        id: n.id,
        name: n.name ?? (n.type.charAt(0).toUpperCase() + n.type.slice(1)),
        type: n.type,
        technology: n.technology,
        position: { x: c.x + n.dx, y: c.y + n.dy },
        size: { width: 150, height: 82 },
        shape: 'rounded',
        containerId: c.id,
      })
    }
  }
  a.connections = t.links.map(([from, to], i) => ({ id: `edge-${i}`, sourceId: from, targetId: to, type: 'synchronous', protocol: 'HTTPS' }))
  return a
}
