import {
  accentFor,
  containerAccentFor,
  containerLabelFor,
  NODE_LABELS,
  type Architecture,
  type ArchitectureConnection,
  type ArchitectureContainer,
  type ArchitectureNode,
} from '@/types/architecture'

interface ExportRect {
  id: string
  x: number
  y: number
  width: number
  height: number
}

interface ExportNode extends ExportRect {
  name: string
  typeLabel: string
  technology?: string
  description?: string
  accent: string
}

interface ExportContainer extends ExportRect {
  name: string
  typeLabel: string
  description?: string
  accent: string
}

interface ExportConnection {
  id: string
  sourceId: string
  targetId: string
  type: ArchitectureConnection['type']
  label?: string
  direction?: ArchitectureConnection['direction']
  x1: number
  y1: number
  x2: number
  y2: number
  sourceAngle: number
  targetAngle: number
}

interface ExportLayout {
  width: number
  height: number
  nodes: ExportNode[]
  containers: ExportContainer[]
  connections: ExportConnection[]
}

const DEFAULT_WIDTH = 860
const DEFAULT_HEIGHT = 520
const PADDING = 80
const CDN_VUE_VERSION = '3.5.27'
const CDN_VUE_FLOW_VERSION = '1.48.2'
const CDN_VUE_URL = `https://cdn.jsdelivr.net/npm/vue@${CDN_VUE_VERSION}/+esm`
const CDN_VUE_FLOW_URL = `https://cdn.jsdelivr.net/npm/@vue-flow/core@${CDN_VUE_FLOW_VERSION}/+esm`
const CDN_VUE_FLOW_STYLE_URL = `https://cdn.jsdelivr.net/npm/@vue-flow/core@${CDN_VUE_FLOW_VERSION}/dist/style.css`
const CDN_VUE_FLOW_THEME_URL = `https://cdn.jsdelivr.net/npm/@vue-flow/core@${CDN_VUE_FLOW_VERSION}/dist/theme-default.css`

function finite(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function rectFor(
  id: string,
  position: { x: number; y: number },
  size: { width: number; height: number },
): ExportRect {
  return {
    id,
    x: finite(position.x),
    y: finite(position.y),
    width: Math.max(1, finite(size.width, 1)),
    height: Math.max(1, finite(size.height, 1)),
  }
}

function rectBounds(rect: ExportRect) {
  return {
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.width,
    maxY: rect.y + rect.height,
  }
}

function getAnchor(rect: ExportRect, other: ExportRect) {
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  const otherCenterX = other.x + other.width / 2
  const otherCenterY = other.y + other.height / 2
  const dx = otherCenterX - centerX
  const dy = otherCenterY - centerY

  if (Math.abs(dx) >= Math.abs(dy)) {
    const right = dx >= 0
    return {
      x: right ? rect.x + rect.width : rect.x,
      y: centerY,
      angle: right ? 0 : Math.PI,
    }
  }

  const down = dy >= 0
  return {
    x: centerX,
    y: down ? rect.y + rect.height : rect.y,
    angle: down ? Math.PI / 2 : -Math.PI / 2,
  }
}

function buildLayout(architecture: Architecture): ExportLayout {
  const rawContainers: ExportContainer[] = architecture.containers.map(
    (container: ArchitectureContainer) => {
      const rect = rectFor(container.id, container.position, container.size)
      return {
        ...rect,
        name: container.name || '未命名群組',
        typeLabel: containerLabelFor(container.type),
        description: container.description,
        accent: containerAccentFor(container.type),
      }
    },
  )

  const rawNodes: ExportNode[] = architecture.nodes.map((node: ArchitectureNode) => {
    const rect = rectFor(node.id, node.position, node.size)
    return {
      ...rect,
      name: node.name || '未命名節點',
      typeLabel: NODE_LABELS[node.type],
      technology: node.technology,
      description: node.description,
      accent: accentFor(node.type),
    }
  })

  const allRects: ExportRect[] = [...rawContainers, ...rawNodes]
  const emptyBounds = {
    minX: 0,
    minY: 0,
    maxX: DEFAULT_WIDTH - PADDING * 2,
    maxY: DEFAULT_HEIGHT - PADDING * 2,
  }
  const initialBounds = allRects.length > 0 ? rectBounds(allRects[0]!) : emptyBounds
  const rawBounds = allRects.slice(1).reduce(
    (bounds, rect) => {
      const current = rectBounds(rect)
      return {
        minX: Math.min(bounds.minX, current.minX),
        minY: Math.min(bounds.minY, current.minY),
        maxX: Math.max(bounds.maxX, current.maxX),
        maxY: Math.max(bounds.maxY, current.maxY),
      }
    },
    initialBounds,
  )

  const contentWidth = Math.max(1, rawBounds.maxX - rawBounds.minX)
  const contentHeight = Math.max(1, rawBounds.maxY - rawBounds.minY)
  const width = Math.max(DEFAULT_WIDTH, Math.ceil(contentWidth + PADDING * 2))
  const height = Math.max(DEFAULT_HEIGHT, Math.ceil(contentHeight + PADDING * 2))
  const offsetX = PADDING - rawBounds.minX
  const offsetY = PADDING - rawBounds.minY

  const containers = rawContainers.map((container) => ({
    ...container,
    x: container.x + offsetX,
    y: container.y + offsetY,
  }))
  const nodes = rawNodes.map((node) => ({
    ...node,
    x: node.x + offsetX,
    y: node.y + offsetY,
  }))
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))

  const connections = architecture.connections.flatMap((connection) => {
    const source = nodeMap.get(connection.sourceId)
    const target = nodeMap.get(connection.targetId)
    if (!source || !target) return []

    const sourceAnchor = getAnchor(source, target)
    const targetAnchor = getAnchor(target, source)
    return [
      {
        id: connection.id,
        sourceId: connection.sourceId,
        targetId: connection.targetId,
        type: connection.type,
        label: connection.label || connection.protocol,
        direction: connection.direction,
        x1: sourceAnchor.x,
        y1: sourceAnchor.y,
        x2: targetAnchor.x,
        y2: targetAnchor.y,
        sourceAngle: sourceAnchor.angle,
        targetAngle: targetAnchor.angle,
      },
    ]
  })

  return { width, height, nodes, containers, connections }
}

function escapeHtml(value: string | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function serializeForScript(value: unknown): string {
  return (JSON.stringify(value) ?? 'null')
    .replaceAll('&', '\\u0026')
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029')
}

function styleFor(rect: ExportRect, accent?: string): string {
  const accentStyle = accent ? `--accent:${escapeHtml(accent)};` : ''
  return `${accentStyle}left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;`
}

function renderContainer(container: ExportContainer): string {
  const description = container.description
    ? `<div class="export-group__description">${escapeHtml(container.description)}</div>`
    : ''

  return `<div class="export-group" data-architecture-container="${escapeHtml(container.id)}" data-description="${escapeHtml(container.description)}" style="${styleFor(container, container.accent)}">
  <div class="export-group__header">
    <span class="export-group__dot"></span>
    <span class="export-group__label">${escapeHtml(container.name)}</span>
    <span class="export-group__type">${escapeHtml(container.typeLabel)}</span>
  </div>
  ${description}
</div>`
}

function renderNode(node: ExportNode): string {
  return `<div class="export-node" data-architecture-node="${escapeHtml(node.id)}" data-description="${escapeHtml(node.description)}" style="${styleFor(node, node.accent)}">
  <div class="export-node__glow"></div>
  <div class="export-node__label">${escapeHtml(node.name)}</div>
  <div class="export-node__type">${escapeHtml(node.typeLabel)}</div>
  ${node.technology ? `<div class="export-node__tech">${escapeHtml(node.technology)}</div>` : ''}
</div>`
}

function connectionPath(connection: ExportConnection): string {
  const dx = connection.x2 - connection.x1
  const dy = connection.y2 - connection.y1

  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = connection.x1 + dx / 2
    return `M ${connection.x1} ${connection.y1} H ${midX} V ${connection.y2} H ${connection.x2}`
  }

  const midY = connection.y1 + dy / 2
  return `M ${connection.x1} ${connection.y1} V ${midY} H ${connection.x2} V ${connection.y2}`
}

function renderConnectionsSvg(layout: ExportLayout): string {
  const connections = layout.connections
    .map((connection) => {
      const markerStart =
        connection.direction === 'backward' || connection.direction === 'bidirectional'
          ? ' marker-start="url(#export-arrow)"'
          : ''
      const markerEnd = connection.direction !== 'backward' ? ' marker-end="url(#export-arrow)"' : ''
      const label = connection.label
        ? `<text class="export-edge-label" x="${(connection.x1 + connection.x2) / 2}" y="${(connection.y1 + connection.y2) / 2 - 6}">${escapeHtml(connection.label)}</text>`
        : ''

      return `<path class="export-edge" vector-effect="non-scaling-stroke" d="${connectionPath(connection)}"${markerStart}${markerEnd}></path>${label}`
    })
    .join('\n')

  return `<defs>
  <marker id="export-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
    <path d="M 0 0 L 10 5 L 0 10 Z" fill="#526889"></path>
  </marker>
</defs>
${connections}`
}

function renderStyles(showGrid: boolean): string {
  return `<style>
:root {
  color-scheme: dark;
  --export-bg: #080c16;
  --export-panel: #0d1424;
  --export-panel-strong: #0b1220;
  --export-border: #1c2a43;
  --export-text: #e2e8f0;
  --export-muted: #7c93b8;
  --export-cyan: #38bdf8;
}
* { box-sizing: border-box; }
html, body { width: 100%; height: 100%; margin: 0; }
body {
  overflow: hidden;
  background: var(--export-bg);
  color: var(--export-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
button { font: inherit; }
.export-page { display: flex; width: 100%; height: 100%; min-height: 100vh; flex-direction: column; background: var(--export-bg); }
.export-header {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 30px 18px;
  border-bottom: 1px solid rgba(28, 42, 67, 0.8);
  background: rgba(13, 20, 36, 0.92);
}
.export-header__eyebrow { margin-bottom: 7px; color: #647ea6; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
.export-header h1 { max-width: min(70vw, 960px); margin: 0; color: var(--export-text); font-size: clamp(20px, 3vw, 32px); line-height: 1.15; }
.export-header__description { max-width: min(70vw, 880px); margin: 9px 0 0; color: #94a3b8; font-size: 13px; line-height: 1.5; }
.export-readonly-badge { flex: 0 0 auto; padding: 7px 10px; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 999px; color: #7dd3fc; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.export-viewport {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background-color: var(--export-bg);
  ${showGrid ? 'background-image: radial-gradient(#1c2a43 1px, transparent 1px); background-size: 16px 16px;' : ''}
  cursor: grab;
  touch-action: none;
}
.export-viewport.is-dragging { cursor: grabbing; }
.export-toolbar {
  position: absolute;
  z-index: 5;
  top: 18px;
  right: 18px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px;
  border: 1px solid rgba(71, 90, 122, 0.7);
  border-radius: 10px;
  background: rgba(13, 20, 36, 0.92);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(10px);
}
.export-toolbar button {
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 12px;
}
.export-toolbar button:hover, .export-toolbar button:focus-visible { background: rgba(56, 189, 248, 0.12); color: #bae6fd; outline: none; }
.export-toolbar__zoom { min-width: 48px; text-align: center; color: #7c93b8; font-size: 11px; }
.export-world { position: absolute; transform-origin: 0 0; will-change: transform; }
.export-connections { position: absolute; z-index: 1; inset: 0; display: block; pointer-events: none; }
.export-elements { position: absolute; z-index: 2; inset: 0; }
.export-group { position: absolute; border: 1.5px dashed rgba(71, 90, 122, 0.62); border-radius: 16px; background: rgba(148, 163, 184, 0.04); pointer-events: none; }
.export-group__header { position: absolute; top: 10px; left: 14px; display: flex; align-items: center; gap: 6px; max-width: calc(100% - 28px); white-space: nowrap; }
.export-group__dot { width: 7px; height: 7px; flex: 0 0 auto; border-radius: 999px; background: var(--accent); }
.export-group__label { overflow: hidden; color: #e2e8f0; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-overflow: ellipsis; text-transform: uppercase; }
.export-group__type { color: #7c93b8; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; }
.export-group__description { position: absolute; right: 14px; bottom: 10px; left: 14px; overflow: hidden; color: #94a3b8; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.export-node { position: absolute; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 10px 14px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); border-radius: 12px; background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, #0e1830) 0%, #0e1830 60%); box-shadow: 0 9px 22px rgba(0, 0, 0, 0.16); }
.export-node__glow { position: absolute; inset: 0; border-radius: 12px; background: radial-gradient(120px 60px at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%); pointer-events: none; }
.export-node__label { position: relative; overflow: hidden; color: #e2e8f0; font-size: 14px; font-weight: 600; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.export-node__type { position: relative; overflow: hidden; color: color-mix(in srgb, var(--accent) 75%, #e2e8f0); font-size: 10px; letter-spacing: 0.08em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.export-node__tech { position: relative; overflow: hidden; color: var(--accent); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.export-empty { position: absolute; top: 50%; left: 50%; width: min(360px, calc(100% - 48px)); padding: 26px; transform: translate(-50%, -50%); border: 1px dashed rgba(71, 90, 122, 0.7); border-radius: 14px; color: #7c93b8; text-align: center; }
.export-empty strong { display: block; margin-bottom: 6px; color: #cbd5e1; font-size: 14px; }
.export-hint { position: absolute; z-index: 4; bottom: 18px; left: 20px; padding: 7px 10px; border: 1px solid rgba(71, 90, 122, 0.5); border-radius: 8px; background: rgba(13, 20, 36, 0.78); color: #647ea6; font-size: 10px; pointer-events: none; }
.export-footer { flex: 0 0 auto; padding: 10px 20px 12px; color: #526889; font-size: 10px; letter-spacing: 0.04em; text-align: center; }
@media (max-width: 640px) {
  .export-header { padding: 18px 18px 14px; }
  .export-header__description { font-size: 12px; }
  .export-readonly-badge { padding: 6px 8px; font-size: 9px; }
  .export-toolbar { top: 12px; right: 12px; }
  .export-hint { right: 12px; bottom: 12px; left: 12px; text-align: center; }
}
.export-page { position: relative; display: block; }
.export-header { position: absolute; z-index: 10; top: 0; right: 0; left: 0; align-items: center; height: 56px; padding: 0 20px; background: rgba(8, 12, 22, 0.74); backdrop-filter: blur(12px); }
.export-header__brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.export-header__logo { display: grid; width: 32px; height: 32px; flex: 0 0 auto; place-items: center; border: 1px solid rgba(56, 189, 248, 0.6); border-radius: 9px; background: rgba(14, 24, 48, 0.92); color: #67e8f9; font-size: 18px; font-weight: 700; }
.export-header__title { color: #e2e8f0; font-size: 14px; font-weight: 600; line-height: 1.1; }
.export-header__name { display: flex; align-items: center; gap: 5px; max-width: min(42vw, 260px); margin-top: 4px; overflow: hidden; color: #94a3b8; font-size: 11px; line-height: 1; text-overflow: ellipsis; white-space: nowrap; }
.export-header__name-mark { color: #647ea6; font-size: 10px; }
.export-readonly-badge { padding: 5px 8px; font-size: 10px; }
.export-viewport { position: absolute; inset: 0; display: block; min-height: 0; }
.export-toolbar { top: auto; right: 16px; bottom: 16px; }
.export-footer { position: absolute; z-index: 4; right: 0; bottom: 4px; left: 0; padding: 0; pointer-events: none; }
.export-edge { fill: none; stroke: #526889; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.export-edge-label { fill: #7dd3fc; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; text-anchor: middle; dominant-baseline: middle; paint-order: stroke; stroke: rgba(8, 12, 22, 0.92); stroke-width: 5px; stroke-linejoin: round; }
.export-toolbar__icon { color: #67e8f9; font-size: 13px; }
.export-toolbar__divider { width: 1px; height: 18px; margin: 0 2px; background: rgba(71, 90, 122, 0.66); }
.export-toolbar__label { display: inline; }
@media (max-width: 640px) {
  .export-header { padding: 0 12px; }
  .export-header__title { font-size: 12px; }
  .export-header__name { max-width: 42vw; font-size: 10px; }
  .export-toolbar { right: 10px; bottom: 10px; }
  .export-toolbar__label { display: none; }
}
</style>`
}

function renderRuntimeScript(layout: ExportLayout): string {
  const connections = serializeForScript(layout.connections)
  return `<script>
(function () {
  var viewport = document.querySelector('.export-viewport');
  var world = document.getElementById('export-world');
  var canvas = null;
  var zoomLabel = document.querySelector('[data-export-zoom]');
  var gridButton = document.querySelector('[data-export-action="grid"]');
  var connections = ${connections};
  var worldWidth = ${layout.width};
  var worldHeight = ${layout.height};
  var ctx = null;
  var scale = 1;
  var offsetX = 0;
  var offsetY = 0;
  var dragging = null;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    var dpr = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.ceil(worldWidth * dpr);
    canvas.height = Math.ceil(worldHeight * dpr);
    canvas.style.width = worldWidth + 'px';
    canvas.style.height = worldHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawArrow(x, y, angle, color) {
    if (!ctx) return;
    var length = 8;
    var spread = Math.PI / 6;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-length * Math.cos(spread), length * Math.sin(spread));
    ctx.lineTo(-length * Math.cos(spread), -length * Math.sin(spread));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function drawConnection(connection) {
    if (!ctx) return;
    var color = '#526889';
    var dx = connection.x2 - connection.x1;
    var dy = connection.y2 - connection.y1;
    var mid;
    ctx.beginPath();
    ctx.moveTo(connection.x1, connection.y1);
    if (Math.abs(dx) >= Math.abs(dy)) {
      mid = connection.x1 + dx / 2;
      ctx.lineTo(mid, connection.y1);
      ctx.lineTo(mid, connection.y2);
    } else {
      mid = connection.y1 + dy / 2;
      ctx.lineTo(connection.x1, mid);
      ctx.lineTo(connection.x2, mid);
    }
    ctx.lineTo(connection.x2, connection.y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    if (connection.direction !== 'backward') drawArrow(connection.x2, connection.y2, connection.targetAngle + Math.PI, color);
    if (connection.direction === 'backward' || connection.direction === 'bidirectional') drawArrow(connection.x1, connection.y1, connection.sourceAngle + Math.PI, color);

    if (connection.label) {
      var labelX = (connection.x1 + connection.x2) / 2;
      var labelY = (connection.y1 + connection.y2) / 2 - 6;
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      var labelWidth = ctx.measureText(connection.label).width + 10;
      ctx.fillStyle = 'rgba(8, 12, 22, 0.9)';
      ctx.fillRect(labelX - labelWidth / 2, labelY - 11, labelWidth, 17);
      ctx.fillStyle = '#7dd3fc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(connection.label, labelX, labelY - 2);
    }
  }

  function drawConnections() {
    if (!ctx) return;
    resizeCanvas();
    ctx.clearRect(0, 0, worldWidth, worldHeight);
    connections.forEach(drawConnection);
  }

  function applyTransform() {
    if (world) world.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px) scale(' + scale + ')';
    if (zoomLabel) zoomLabel.textContent = Math.round(scale * 100) + '%';
  }

  function fitView() {
    if (!viewport) return;
    var rect = viewport.getBoundingClientRect();
    var margin = 72;
    var nextScale = Math.min((rect.width - margin) / worldWidth, (rect.height - margin) / worldHeight);
    scale = clamp(nextScale, 0.25, 1.5);
    offsetX = (rect.width - worldWidth * scale) / 2;
    offsetY = (rect.height - worldHeight * scale) / 2;
    applyTransform();
  }

  function zoomAt(nextScale, clientX, clientY) {
    if (!viewport) return;
    var rect = viewport.getBoundingClientRect();
    var pointX = clientX - rect.left;
    var pointY = clientY - rect.top;
    var worldX = (pointX - offsetX) / scale;
    var worldY = (pointY - offsetY) / scale;
    scale = clamp(nextScale, 0.25, 3);
    offsetX = pointX - worldX * scale;
    offsetY = pointY - worldY * scale;
    applyTransform();
  }

  function endDrag(event) {
    if (!dragging || dragging.pointerId !== event.pointerId) return;
    dragging = null;
    viewport.classList.remove('is-dragging');
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  }

  if (viewport) {
    viewport.addEventListener('wheel', function (event) {
      event.preventDefault();
      zoomAt(scale * (event.deltaY < 0 ? 1.1 : 0.9), event.clientX, event.clientY);
    }, { passive: false });
    viewport.addEventListener('pointerdown', function (event) {
      if (event.target.closest('button')) return;
      dragging = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: offsetX, offsetY: offsetY };
      viewport.classList.add('is-dragging');
      viewport.setPointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointermove', function (event) {
      if (!dragging || dragging.pointerId !== event.pointerId) return;
      offsetX = dragging.offsetX + event.clientX - dragging.x;
      offsetY = dragging.offsetY + event.clientY - dragging.y;
      applyTransform();
    });
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
  }

  document.querySelectorAll('[data-export-action]').forEach(function (button) {
    button.addEventListener('click', function () {
      var action = button.getAttribute('data-export-action');
      if (action === 'fit') fitView();
      if (action === 'zoom-in') zoomAt(scale * 1.2, window.innerWidth / 2, window.innerHeight / 2);
      if (action === 'zoom-out') zoomAt(scale / 1.2, window.innerWidth / 2, window.innerHeight / 2);
      if (action === 'grid' && viewport) {
        viewport.classList.toggle('has-grid');
        button.setAttribute('aria-pressed', viewport.classList.contains('has-grid') ? 'true' : 'false');
      }
    });
  });

  if (gridButton && viewport) gridButton.setAttribute('aria-pressed', viewport.classList.contains('has-grid') ? 'true' : 'false');
  window.addEventListener('resize', fitView);
  drawConnections();
  window.requestAnimationFrame(fitView);
}());
</script>`
}

/**
 * Render the current Architecture model as a read-only HTML document.
 *
 * The generated file has no runtime dependency on the editor, Vue Flow, or
 * external assets, so opening it directly from the local filesystem remains
 * reliable. The embedded script only provides pan/zoom/grid controls.
 */
export function renderLegacyArchitectureHtml(architecture: Architecture): string {
  const layout = buildLayout(architecture)
  const hasElements = layout.nodes.length > 0 || layout.containers.length > 0
  const title = architecture.name || '未命名架構'
  const description = architecture.description || '以唯讀模式檢視這份系統架構。'
  const showGrid = architecture.settings.background === 'dark' && architecture.settings.grid
  const data = serializeForScript(architecture)

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)}</title>
  ${renderStyles(showGrid)}
</head>
<body>
  <main class="export-page" data-node-count="${layout.nodes.length}" data-container-count="${layout.containers.length}" data-connection-count="${layout.connections.length}">
    <header class="export-header">
      <div class="export-header__brand">
        <div class="export-header__logo">⌘</div>
        <div>
          <div class="export-header__title">系統架構圖建構工具</div>
          <div class="export-header__name"><span class="export-header__name-mark">✎</span><span>${escapeHtml(title)}</span></div>
        </div>
      </div>
      <span class="export-readonly-badge">唯讀</span>
    </header>

    <section class="export-viewport${showGrid ? ' has-grid' : ''}" aria-label="唯讀系統架構圖">
      <div class="export-toolbar" aria-label="畫布控制">
        <button type="button" data-export-action="grid" aria-label="切換格線" aria-pressed="${showGrid ? 'true' : 'false'}"><span class="export-toolbar__icon">▦</span><span class="export-toolbar__label">格線</span></button>
        <span class="export-toolbar__divider" aria-hidden="true"></span>
        <button type="button" data-export-action="zoom-out" aria-label="縮小">−</button>
        <span class="export-toolbar__zoom" data-export-zoom>100%</span>
        <button type="button" data-export-action="zoom-in" aria-label="放大">＋</button>
        <span class="export-toolbar__divider" aria-hidden="true"></span>
        <button type="button" data-export-action="fit" aria-label="符合畫布">⌗</button>
      </div>

      <div id="export-world" class="export-world" style="width:${layout.width}px;height:${layout.height}px;">
        <svg id="export-connections" class="export-connections" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">${renderConnectionsSvg(layout)}</svg>
        <div class="export-elements">
          ${hasElements ? `${layout.containers.map(renderContainer).join('\n')}\n${layout.nodes.map(renderNode).join('\n')}` : '<div class="export-empty"><strong>沒有架構元件</strong><span>這份架構目前沒有可顯示的節點或群組。</span></div>'}
        </div>
      </div>
    </section>

    <footer class="export-footer">© 2026 Design &amp; Coding by ツキノリュウ with Hermes Agent.</footer>
  </main>
  <script id="architecture-data" type="application/json">${data}</script>
  ${renderRuntimeScript(layout)}
</body>
</html>`
}

interface CdnFlowModel {
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
}

function createCdnFlowModel(architecture: Architecture): CdnFlowModel {
  const containers = architecture.containers.map((container) => ({
    id: container.id,
    type: 'group',
    position: { x: container.position.x, y: container.position.y },
    style: {
      width: `${container.size.width}px`,
      height: `${container.size.height}px`,
    },
    data: {
      label: container.name || '未命名群組',
      typeLabel: containerLabelFor(container.type),
      description: container.description ?? '',
      accent: containerAccentFor(container.type),
    },
  }))

  const nodes = architecture.nodes.map((node) => ({
    id: node.id,
    type: 'arch',
    position: { x: node.position.x, y: node.position.y },
    data: {
      label: node.name || '未命名節點',
      typeLabel: NODE_LABELS[node.type],
      technology: node.technology,
      width: node.size.width,
      height: node.size.height,
      accent: accentFor(node.type),
    },
  }))

  const edges = architecture.connections.map((connection) => {
    const edge: Record<string, unknown> = {
      id: connection.id,
      source: connection.sourceId,
      target: connection.targetId,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#526889', strokeWidth: 1.5 },
      markerEnd: { type: 'arrowclosed', color: '#526889', width: 18, height: 18 },
    }
    if (connection.label) edge.label = connection.label
    return edge
  })

  return { nodes: [...containers, ...nodes], edges }
}

function renderCdnStyles(): string {
  return `<style>
:root { color-scheme: dark; --export-bg: #080c16; --export-text: #e2e8f0; }
* { box-sizing: border-box; }
html, body, #export-app { width: 100%; height: 100%; margin: 0; }
body { overflow: hidden; background: var(--export-bg); color: var(--export-text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button { font: inherit; }
.export-page { position: relative; width: 100%; height: 100%; min-height: 100vh; overflow: hidden; background: var(--export-bg); }
.export-header { position: absolute; z-index: 20; top: 0; right: 0; left: 0; display: flex; align-items: center; justify-content: space-between; height: 56px; padding: 0 20px; border-bottom: 1px solid rgba(28, 42, 67, 0.78); background: rgba(8, 12, 22, 0.74); backdrop-filter: blur(12px); }
.export-header__brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.export-header__logo { display: grid; width: 32px; height: 32px; flex: 0 0 auto; place-items: center; border: 1px solid rgba(56, 189, 248, 0.6); border-radius: 9px; background: rgba(14, 24, 48, 0.92); color: #67e8f9; font-size: 18px; font-weight: 700; }
.export-header__title { color: #e2e8f0; font-size: 14px; font-weight: 600; line-height: 1.1; }
.export-header__name { display: flex; align-items: center; gap: 5px; max-width: min(42vw, 260px); margin-top: 4px; overflow: hidden; color: #94a3b8; font-size: 11px; line-height: 1; text-overflow: ellipsis; white-space: nowrap; }
.export-header__name-mark { color: #647ea6; font-size: 10px; }
.export-readonly-badge { padding: 5px 8px; border: 1px solid rgba(56, 189, 248, 0.38); border-radius: 999px; color: #7dd3fc; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.export-flow-shell { position: absolute; inset: 0; overflow: hidden; background: var(--export-bg); }
.export-flow-shell.has-grid { background: transparent; }
.export-flow { position: absolute; inset: 0; background: transparent; }
.export-toolbar { position: absolute; z-index: 25; right: 16px; bottom: 16px; display: flex; align-items: center; gap: 4px; padding: 6px; border: 1px solid rgba(71, 90, 122, 0.7); border-radius: 10px; background: rgba(13, 20, 36, 0.92); box-shadow: 0 14px 30px rgba(0, 0, 0, 0.22); backdrop-filter: blur(10px); }
.export-toolbar button { min-width: 30px; height: 30px; padding: 0 7px; border: 0; border-radius: 6px; background: transparent; color: #94a3b8; cursor: pointer; font-size: 12px; }
.export-toolbar button:hover, .export-toolbar button:focus-visible { background: rgba(56, 189, 248, 0.12); color: #bae6fd; outline: none; }
.export-toolbar__icon { color: #67e8f9; font-size: 13px; }
.export-toolbar__divider { width: 1px; height: 18px; margin: 0 2px; background: rgba(71, 90, 122, 0.66); }
.export-toolbar__zoom { min-width: 42px; color: #7c93b8; font-size: 11px; text-align: center; }
.export-toolbar__label { display: inline; }
.export-footer { position: absolute; z-index: 25; right: 0; bottom: 4px; left: 0; color: #526889; font-size: 10px; letter-spacing: 0.04em; pointer-events: none; text-align: center; }
.arch-node { position: relative; display: flex; flex-direction: column; justify-content: center; gap: 2px; height: 100%; padding: 10px 14px; border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent); border-radius: 12px; background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 12%, #0e1830) 0%, #0e1830 60%); color: #e2e8f0; cursor: default; }
.arch-node__glow { position: absolute; inset: 0; border-radius: 12px; background: radial-gradient(120px 60px at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%); opacity: 0.8; pointer-events: none; }
.arch-node__label, .arch-node__type, .arch-node__tech { position: relative; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arch-node__label { color: #e2e8f0; font-size: 14px; font-weight: 600; line-height: 1.2; }
.arch-node__type { color: color-mix(in srgb, var(--accent) 75%, #e2e8f0); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
.arch-node__tech { color: var(--accent); font-size: 11px; }
.arch-handle { width: 9px; height: 9px; border: 2px solid #0b1220; border-radius: 9999px; background: var(--accent); opacity: 0; }
.arch-group { position: relative; width: 100%; height: 100%; border: 1.5px dashed rgba(71, 90, 122, 0.55); border-radius: 16px; background: rgba(148, 163, 184, 0.04); pointer-events: all; }
.arch-group__header { position: absolute; top: 10px; left: 14px; display: flex; align-items: center; gap: 6px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; user-select: none; }
.arch-group__dot { width: 7px; height: 7px; border-radius: 9999px; }
.arch-group__label { color: #e2e8f0; font-weight: 700; }
.arch-group__type { color: #7c93b8; font-size: 10px; }
.arch-group__desc { position: absolute; bottom: 10px; left: 14px; max-width: calc(100% - 28px); overflow: hidden; color: #94a3b8; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.vue-flow__edge-path { stroke: #526889; stroke-width: 1.5; }
.vue-flow__edge-text { fill: #7dd3fc; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.vue-flow__edge-textbg { fill: rgba(8, 12, 22, 0.9); }
@media (max-width: 640px) {
  .export-header { padding: 0 12px; }
  .export-header__title { font-size: 12px; }
  .export-header__name { max-width: 42vw; font-size: 10px; }
  .export-toolbar { right: 10px; bottom: 10px; }
  .export-toolbar__label { display: none; }
}
</style>`
}

function renderCdnRuntime(model: CdnFlowModel, title: string, showGrid: boolean): string {
  const serializedModel = serializeForScript(model)
  const serializedTitle = serializeForScript(title)

  return `<script type="module">
import * as Vue from '${CDN_VUE_URL}'
import * as VueFlowCore from '${CDN_VUE_FLOW_URL}'

const { computed, h, defineComponent, markRaw, onMounted, ref } = Vue
const { ConnectionMode, Handle, MarkerType, Position, VueFlow, useVueFlow } = VueFlowCore
const flowModel = ${serializedModel}
const architectureTitle = ${serializedTitle}

const ArchNode = defineComponent({
  name: 'ExportArchNode',
  props: {
    data: { type: Object, default: () => ({}) },
    selected: { type: Boolean, default: false },
  },
  setup(props) {
    return () => {
      const data = props.data || {}
      const children = [
        h('div', { class: 'arch-node__glow' }),
        h('div', { class: 'arch-node__label' }, String(data.label || '未命名節點')),
        h('div', { class: 'arch-node__type' }, String(data.typeLabel || '')),
      ]
      if (data.technology) children.push(h('div', { class: 'arch-node__tech' }, String(data.technology)))
      children.push(
        h(Handle, { type: 'target', position: Position.Left, connectionMode: ConnectionMode.Loose, class: 'arch-handle' }),
        h(Handle, { type: 'source', position: Position.Right, connectionMode: ConnectionMode.Loose, class: 'arch-handle' }),
        h(Handle, { type: 'target', position: Position.Top, connectionMode: ConnectionMode.Loose, class: 'arch-handle' }),
        h(Handle, { type: 'source', position: Position.Bottom, connectionMode: ConnectionMode.Loose, class: 'arch-handle' }),
      )
      return h('div', { class: ['arch-node', props.selected ? 'is-selected' : ''], style: { '--accent': data.accent || '#38bdf8' } }, children)
    }
  },
})

const ArchGroupNode = defineComponent({
  name: 'ExportArchGroupNode',
  props: {
    data: { type: Object, default: () => ({}) },
    selected: { type: Boolean, default: false },
  },
  setup(props) {
    return () => {
      const data = props.data || {}
      const accent = data.accent || '#64748b'
      const children = [
        h('div', { class: 'arch-group__header', style: { color: accent } }, [
          h('span', { class: 'arch-group__dot', style: { background: accent } }),
          h('span', { class: 'arch-group__label' }, String(data.label || '群組')),
          h('span', { class: 'arch-group__type' }, String(data.typeLabel || '')),
        ]),
      ]
      if (data.description) children.push(h('div', { class: 'arch-group__desc' }, String(data.description)))
      return h('div', { class: ['arch-group', props.selected ? 'is-selected' : ''] }, children)
    }
  },
})

const ExportBackground = defineComponent({
  name: 'ExportBackground',
  props: {
    variant: { type: String, default: 'dots' },
    gap: { type: Number, default: 20 },
    size: { type: Number, default: 1 },
    color: { type: String, default: '#81818a' },
  },
  setup(props) {
    const { viewport } = useVueFlow()
    const patternId = 'export-background-pattern'

    return () => {
      const zoom = viewport.value.zoom
      const scaledGap = Math.max(1, props.gap * zoom)
      const scaledSize = props.size * zoom
      const offset = 1 + scaledGap / 2
      const patternX = viewport.value.x % scaledGap
      const patternY = viewport.value.y % scaledGap
      const pattern = props.variant === 'dots'
        ? h('circle', { cx: scaledSize / 2, cy: scaledSize / 2, r: scaledSize / 2, fill: props.color })
        : h('path', { stroke: props.color, 'stroke-width': props.size, d: 'M' + scaledGap / 2 + ' 0 V' + scaledGap + ' M0 ' + scaledGap / 2 + ' H' + scaledGap })

      return h('svg', { class: 'vue-flow__background vue-flow__container', style: { height: '100%', width: '100%' } }, [
        h('defs', {}, [
          h('pattern', {
            id: patternId,
            x: patternX,
            y: patternY,
            width: scaledGap,
            height: scaledGap,
            patternTransform: 'translate(-' + offset + ',-' + offset + ')',
            patternUnits: 'userSpaceOnUse',
          }, [pattern]),
        ]),
        h('rect', { x: 0, y: 0, width: '100%', height: '100%', fill: 'url(#' + patternId + ')' }),
      ])
    }
  },
})

const nodeTypes = markRaw({ arch: ArchNode, group: ArchGroupNode })
const hoverId = ref(null)
const flowEdges = computed(() => flowModel.edges.map((edge) => {
  const isHighlighted = hoverId.value !== null && (edge.source === hoverId.value || edge.target === hoverId.value)
  const isDimmed = hoverId.value !== null && !isHighlighted
  const color = isHighlighted ? '#38bdf8' : '#526889'
  return {
    ...edge,
    animated: isHighlighted,
    style: {
      ...(edge.style || {}),
      stroke: color,
      strokeWidth: isHighlighted ? 2.2 : 1.5,
      opacity: isDimmed ? 0.25 : 1,
      transition: 'stroke 0.2s ease, stroke-width 0.2s ease, opacity 0.2s ease',
    },
    markerEnd: edge.markerEnd
      ? { ...edge.markerEnd, type: MarkerType.ArrowClosed, color }
      : undefined,
  }
}))

const Root = defineComponent({
  name: 'ReadonlyArchitectureRoot',
  setup() {
    const showGrid = ref(${showGrid ? 'true' : 'false'})
    const zoom = ref(1)
    const { fitView, onNodeMouseEnter, onNodeMouseLeave, onViewportChange, zoomIn, zoomOut } = useVueFlow()
    const fit = () => fitView({ padding: 0.2, duration: 0 })
    onNodeMouseEnter(({ node }) => { hoverId.value = node.id })
    onNodeMouseLeave(() => { hoverId.value = null })
    onViewportChange((viewport) => { zoom.value = viewport.zoom })
    onMounted(() => requestAnimationFrame(fit))

    const controlButton = (action, label, content, handler) => h('button', { type: 'button', 'aria-label': label, 'data-export-action': action, onClick: handler }, content)

    return () => h('main', { class: 'export-page', 'aria-label': '唯讀系統架構圖' }, [
      h('header', { class: 'export-header' }, [
        h('div', { class: 'export-header__brand' }, [
          h('div', { class: 'export-header__logo' }, '⌘'),
          h('div', {}, [
            h('div', { class: 'export-header__title' }, '系統架構圖建構工具'),
            h('div', { class: 'export-header__name' }, [h('span', { class: 'export-header__name-mark' }, '✎'), h('span', {}, architectureTitle)]),
          ]),
        ]),
        h('span', { class: 'export-readonly-badge' }, '唯讀'),
      ]),
      h('section', { class: ['export-flow-shell', showGrid.value ? 'has-grid' : ''], 'aria-label': '架構畫布' }, [
        h(VueFlow, {
          nodes: flowModel.nodes,
          edges: flowEdges.value,
          nodeTypes,
          connectionMode: ConnectionMode.Loose,
          nodesConnectable: false,
          nodesDraggable: false,
          elementsSelectable: false,
          zoomOnScroll: true,
          zoomOnPinch: true,
          panOnDrag: true,
          fitViewOnInit: true,
          fitViewOnInitOptions: { padding: 0.2 },
          class: 'export-flow',
        }, {
          default: () => showGrid.value
            ? h(ExportBackground, { variant: 'dots', gap: 16, size: 1, color: '#1c2a43' })
            : null,
        }),
        h('div', { class: 'export-toolbar', 'aria-label': '畫布控制' }, [
          controlButton('grid', '切換格線', [h('span', { class: 'export-toolbar__icon' }, '▦'), h('span', { class: 'export-toolbar__label' }, '格線')], () => { showGrid.value = !showGrid.value }),
          h('span', { class: 'export-toolbar__divider', 'aria-hidden': 'true' }),
          controlButton('zoom-out', '縮小', '−', () => zoomOut({ duration: 150 })),
          h('span', { class: 'export-toolbar__zoom', 'data-export-zoom': 'true' }, String(Math.round(zoom.value * 100)) + '%'),
          controlButton('zoom-in', '放大', '＋', () => zoomIn({ duration: 150 })),
          h('span', { class: 'export-toolbar__divider', 'aria-hidden': 'true' }),
          controlButton('fit', '符合畫布', '⌗', fit),
        ]),
      ]),
      h('footer', { class: 'export-footer' }, '© 2026 Design & Coding by ツキノリュウ with Hermes Agent.'),
    ])
  },
})

Vue.createApp(Root).mount('#export-app')
</script>`
}

/**
 * Render a read-only HTML document with the same Vue Flow runtime used by the
 * editor. The file remains standalone in terms of markup/data, while Vue Flow
 * and its CSS are fetched from fixed jsDelivr versions when opened.
 */
export function renderArchitectureHtml(architecture: Architecture): string {
  const model = createCdnFlowModel(architecture)
  const title = architecture.name || '未命名架構'
  const description = architecture.description || '以唯讀模式檢視這份系統架構。'
  const showGrid = architecture.settings.background === 'dark' && architecture.settings.grid
  const data = serializeForScript(architecture)

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${CDN_VUE_FLOW_STYLE_URL}">
  <link rel="stylesheet" href="${CDN_VUE_FLOW_THEME_URL}">
  ${renderCdnStyles()}
</head>
<body>
  <div id="export-app" data-node-count="${architecture.nodes.length}" data-container-count="${architecture.containers.length}" data-connection-count="${architecture.connections.length}"></div>
  <script id="architecture-data" type="application/json">${data}</script>
  ${renderCdnRuntime(model, title, showGrid)}
</body>
</html>`
}
