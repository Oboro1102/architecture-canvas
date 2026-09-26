import { describe, expect, it } from 'vitest'
import { renderArchitectureHtml } from '@/utils/exportHtml'
import type { Architecture } from '@/types/architecture'

function createArchitecture(): Architecture {
  return {
    id: 'arch-1',
    name: '訂單 <平台>',
    description: '唯讀展示',
    nodes: [
      {
        id: 'api',
        name: 'API <Gateway>',
        type: 'gateway',
        technology: 'Kong',
        position: { x: -120, y: 80 },
        size: { width: 150, height: 82 },
        shape: 'rounded',
      },
      {
        id: 'db',
        name: '資料庫',
        type: 'database',
        position: { x: 260, y: 80 },
        size: { width: 150, height: 82 },
        shape: 'rounded',
      },
    ],
    containers: [
      {
        id: 'system',
        name: '訂單系統',
        type: 'system',
        description: '核心服務 <readonly>',
        position: { x: -180, y: 20 },
        size: { width: 620, height: 220 },
      },
    ],
    connections: [
      {
        id: 'api-db',
        sourceId: 'api',
        targetId: 'db',
        type: 'synchronous',
        label: 'HTTPS',
        direction: 'forward',
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    settings: { grid: true, snap: true, gridSize: 16, background: 'dark' },
    createdAt: '2026-09-26T00:00:00.000Z',
    updatedAt: '2026-09-26T00:00:00.000Z',
  }
}

describe('renderArchitectureHtml', () => {
  it('renders a complete single-file read-only HTML document', () => {
    const html = renderArchitectureHtml(createArchitecture())

    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<title>訂單 &lt;平台&gt;</title>')
    expect(html).toContain('id="export-app"')
    expect(html).toContain('https://cdn.jsdelivr.net/npm/vue@3.5.27/+esm')
    expect(html).toContain('https://cdn.jsdelivr.net/npm/@vue-flow/core@1.48.2/+esm')
    expect(html).toContain('系統架構圖建構工具')
    expect(html).toContain('"id":"api"')
    expect(html).toContain('API \\u003cGateway\\u003e')
    expect(html).toContain('"source":"api"')
    expect(html).toContain('"target":"db"')
    expect(html).toContain('唯讀')
    expect(html).toContain('type="module"')
  })

  it('uses the pinned Vue Flow CDN runtime and editor geometry instead of a custom raster renderer', () => {
    const html = renderArchitectureHtml(createArchitecture())

    expect(html).toContain('.export-flow-shell { position: absolute; inset: 0;')
    expect(html).toContain('fitViewOnInit: true')
    expect(html).toContain('nodesDraggable: false')
    expect(html).toContain('nodesConnectable: false')
    expect(html).toContain('"type":"smoothstep"')
    expect(html).toContain('VueFlowCore')
    expect(html).toContain('const ExportBackground = defineComponent')
    expect(html).toContain("variant: 'dots'")
    expect(html).toContain("gap: 16")
    expect(html).toContain("size: 1")
    expect(html).toContain("color: '#1c2a43'")
    expect(html).not.toContain('@vue-flow/background')
  })

  it('preserves the editor hover animation for connected edges', () => {
    const html = renderArchitectureHtml(createArchitecture())

    expect(html).toContain('const hoverId = ref(null)')
    expect(html).toContain('animated: isHighlighted')
    expect(html).toContain('onNodeMouseEnter')
    expect(html).toContain('onNodeMouseLeave')
    expect(html).toContain("const color = isHighlighted ? '#38bdf8' : '#526889'")
  })

  it('does not turn protocol metadata into visible edge labels', () => {
    const architecture = createArchitecture()
    architecture.connections[0].label = undefined
    architecture.connections[0].protocol = 'HTTPS'

    const html = renderArchitectureHtml(architecture)

    expect(html).toContain('"protocol":"HTTPS"')
    expect(html).not.toContain('"label":"HTTPS"')
  })

  it('escapes markup and inline-script delimiters in architecture content', () => {
    const architecture = createArchitecture()
    architecture.name = '</title><script>window.__injected = true</script>'
    architecture.nodes[0].name = '</div><img src=x onerror=alert(1)>'
    architecture.nodes[0].description = '</script><script>window.__injected = true</script>'

    const html = renderArchitectureHtml(architecture)

    expect(html).not.toContain('</title><script>')
    expect(html).not.toContain('</div><img')
    expect(html).not.toContain('</script><script>')
    expect(html).toContain('\\u003c/script\\u003e')
  })

  it('renders an empty architecture while still booting from the pinned CDN runtime', () => {
    const architecture = createArchitecture()
    architecture.nodes = []
    architecture.containers = []
    architecture.connections = []

    const html = renderArchitectureHtml(architecture)

    expect(html).toContain('data-node-count="0"')
    expect(html).toContain('data-container-count="0"')
    expect(html).toContain('data-connection-count="0"')
    expect(html).toContain('https://cdn.jsdelivr.net/npm/@vue-flow/core@1.48.2/+esm')
    expect(html).not.toMatch(/(?:data-[^=]+|src|href|content)="undefined"/)
  })
})
