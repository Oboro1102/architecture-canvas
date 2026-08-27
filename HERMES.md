# HERMES.md — Architecture Canvas 開發指引

本檔案是 Hermes Agent 在此 repo 工作時的遵循規範。開始任何修改前先讀完。

> 專案目標已從 **AI Company OS**（AI Agent 模擬監控）全面轉向 **Architecture Canvas**（系統架構圖建構工具）。舊的 AI Company OS 程式碼（`src/engine/`、`src/canvas/`、`stores/ai` `agents` `company`…、`types/agent` `workflow`…）仍留在 repo，屬於待移除的歷史遺留，新功能一律只在 Architecture Canvas 的範疇內開發，不要擴充舊系統。

## 專案概要

**Architecture Canvas** — 給開發者的視覺化系統架構圖建構工具（spec `SPEC.md`，現行權威文件）。

- 產品用途：透過互動式 Canvas 建立、編輯、儲存、載入、匯出軟體系統架構圖。
- 核心價值：快速建立架構、視覺化 System/Application/Infrastructure/Data 架構、元件具明確語意、Node/Container/Connection 可編輯、Template 快速成型、匯出高品質 JPG、Architecture Model 與 Canvas Rendering 分離、未來可接 AI Architecture Generation。
- **定位**：Developer-oriented System Architecture Canvas。參考 C4 Model、System/Cloud/Microservice/Event-driven/Deployment 架構圖。**不要**定位成 AI Company、AI Agent Simulator、Workflow 動畫、3D Digital Twin、Cyberpunk 視覺化、或一般流程圖工具。
- 純前端、無後端；資料以 Pinia store + localStorage 持久化；部署目標 GitHub Pages（`vite.config.ts` `base: '/ai-company-os/'`）。

### 現行狀態（code-level）

- 已落地：主框架（`LandingView.vue` 實為 Architecture Canvas 主畫面）、`ArchitectureCanvas.vue`（基於 `@vue-flow/core`）、`types/architecture.ts`（領域模型）、`stores/architecture.ts`（含 undo/redo、save/load、add/update/remove/connect）。
- Canvas 渲染層使用 **`@vue-flow/core`**（Vue Flow 圖編輯核心）。**禁止引入 Three.js / React Flow（舊稱）/ 以 SVG 作為主要渲染層**（spec §3）。
- 視覺風格：深底（`#080c16` / `#0d1424` / `#0b1220`）、cyan 強調色（`cyan-400/300`）、subtle grid。

### 關鍵架構原則（spec §4）

- **Canvas 只負責 Rendering 與 Interaction，不負責保存 Business State**。完整畫面必須能從 Architecture Model render 出來。
- Architecture Model：`Architecture { nodes, containers, connections, viewport, settings, metadata }`。
- 編輯操作走 Pinia store action（含 `checkpoint()` 快照做 undo/redo），Component 不直接 mutate 核心狀態。

## 規格書結構（SPEC.md 重點章節）

| 章 | 主題 | 重點 |
|---|---|---|
| 1–2 | 產品定義 / 定位 | 系統架構圖建構器，非 AI 模擬 |
| 3 | 既有技術 | Vue/TS/Vite/Tailwind 保留；圖編輯核心 @vue-flow/core；禁 Three.js/SVG 主層 |
| 5–14 | Domain Model | Architecture / Node / NodeType(17) / NodeShape / Container / Connection / ConnectionType(6) |
| 15–20 | Canvas / Camera / Grid / Selection / Interaction / 鍵盤 | Pan/Zoom(0.25–3x)/Select/Multi-select/Drag/Resize/Connect/Delete/Grid+Snap；Del/Backspace、Cmd+Z、Cmd+Shift+Z、Cmd+S、Cmd+A/C/V、Esc、F(fit)、G(grid) |
| 21 | Undo/Redo | CommandHistory（勿整份 clone），至少涵蓋增刪改 Node/Connection/Container |
| 22–25 | 主版面 / 元件庫 / Inspector / 新增元素 | 左 Library、中 Canvas、右 Inspector；Inspector 依選取內容（Node/Connection/Container）變化 |
| 27 | Templates | Three-tier / Microservices / Event-driven / Serverless / Kubernetes / C4 Container / AI Application |
| 36 / 38–41 | JSON 匯出 / JPG 匯出 | 獨立 Export Renderer，canvas 尺寸不超上限 |
| 42–44 | File Persistence / Recent / Pages | localStorage/IndexedDB；Recent Architectures；建議 `/` 為 Dashboard |
| 63 | V1 Scope | Canvas/Components/Editing/Inspector/Templates/Persistence 清單（開發驗收依據） |

> 完整規格 2486 行，改 UI 或加功能前先定位對應章節。

## 技術棧

| 類別 | 技術 |
|---|---|
| 框架 | Vue 3.5 `<script setup>` + TypeScript |
| 建置 | Vite 8, `vue-tsc` 型別檢查 |
| 狀態 | Pinia |
| UI | Tailwind CSS v4（CSS-first，無 tailwind.config）+ shadcn-vue (reka-ui, style: reka-vega) + lucide icons |
| 畫布 | `@vue-flow/core`（圖編輯核心） |
| 測試 | Vitest（jsdom, globals: true） |
| Lint | oxlint（第一層）→ ESLint（第二層），Prettier 格式化 |

## 指令

```bash
npm run dev         # 開發伺服器
npm run build       # type-check (vue-tsc --build) + vite build（交付前必跑）
npm run preview     # 本機預覽建置結果
npm run lint        # oxlint --fix → eslint --fix --cache
npm run format      # prettier --write src/
npx vitest run      # 全部測試；npx vitest run src/__tests__/xxx.test.ts 跑單一檔
```

**驗證流程：改完程式碼 → `npx vitest run` → `npm run lint` → `npm run build`。三者皆過才算完成。**

## 目錄結構（現行）

```
src/
├── components/
│   ├── ui/                # shadcn-vue 生成元件 —— 不手改，由 CLI 管理
│   ├── architecture/      # ArchitectureCanvas.vue（@vue-flow/core 橋接 wrapper）
│   ├── layout/            # LandingView.vue（實為 Architecture Canvas 主畫面）
│   └── common/            # 通用元件（按需求新增）
├── stores/                # Pinia：architecture（主）、及舊 AI Company OS 遺留（ai/agents/company/...）
├── types/                 # 領域型別：architecture（主）；舊 agent/agentRuntime/execution/landing/llm/... 為遺留
├── lib/                   # utils.ts（cn() 等）
├── utils/                 # 一般工具函式（persistence、useEscapeToClose...）
└── __tests__/            # Vitest 測試（與原始碼分離放置於此）
```

> 舊 AI Company OS 的 `engine/`、`canvas/`、`data/`、多數 `stores/*`、`types/*` 仍保留在 repo 但屬遺留，不要在新功能中引用或擴充。優先使用 `stores/architecture.ts` 與 `types/architecture.ts`。

## 開發慣例

- **路徑別名**：一律用 `@/`（= `src/`），不用相對路徑多層跳轉。
- **Vue SFC**：`<script setup lang="ts">`，Props/Emits 用 `defineProps<T>()` / `defineEmits<T>()` 型別語法。
- **新 UI 元件**：優先用 `npx shadcn-vue@latest add <component>` 生成，不要手寫 `components/ui/` 底下內容。
- **樣式**：Tailwind utility classes + `main.css` 的 CSS variables 主題 token；用 `cn()` 合併 class。不寫行內 style、不新增全域 CSS（除非主題 token）。
- **狀態**：跨元件共享的架構狀態進 `stores/architecture.ts`；元件區域狀態留在元件內。所有編輯操作（add/update/remove/connect/undo/redo/save/load）集中在 store，Component 不直改 `store.current` 內部陣列，一律呼叫 action。
- **型別**：領域資料結構定義在 `src/types/architecture.ts`，UI 與 store 都從那裡 import，不要在元件裡重新宣告介面。
- **畫布**：所有圖編輯邏輯走 `@vue-flow/core` 的 `useVueFlow()` API（含 `setNodes`/`setEdges`/`onNodeClick`/`screenToFlowCoordinate` 等）；不要在 Canvas 上手寫拖拽/連線狀態機去繞過 Vue Flow。
- **儲存**：前端持久化一律用 `sessionStorage`，**禁止用 `localStorage`**。現有實作在 `stores/architecture.ts` 的 `load()`/`save()`（key = `architecture-canvas.architectures`）。理由：架構草稿屬於當前編輯 session，關閉分頁即清除、不同分頁各自獨立，避免跨 session 殘留舊資料造成混淆。新增任何需要持久化的資料時，同樣走 `sessionStorage`，不要引入 `localStorage`。
- **元件勿入響應式**：Vue 元件定義（SFC import 進來的元件物件）傳給 Vue Flow 的 `:node-types` / `:edge-types` 時，必須用 `markRaw()` 包住（例：`const nodeTypes = markRaw({ arch: ArchNode })`）。直接把元件放進普通物件/ref 會觸發 `Vue received a Component that was made a reactive object` 黃色效能警告。
- **測試**：新功能（尤其 store 的 add/update/connect/undo/redo/save/load、匯出邏輯）附帶對應測試於 `src/__tests__/`，命名 `*.test.ts`。

## 注意事項

- Node 版本需求：`^22.18.0 || >=24.12.0`。
- Windows 環境：shell 為 git-bash；原生工具傳 `C:/...` 正斜線路徑。
- 不要 commit `dist/`、`.eslintcache`。
- Prettier 只處理 `src/`（見 format script），其他目錄維持原樣。
- 規格書以中文為主；回覆與註解跟隨使用者語言（繁體中文）。
- 移除舊 AI Company OS 程式碼前，先確認 `App.vue` 與 `LandingView.vue` 已無引用，並保留測試通過。
