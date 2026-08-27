# Architecture Canvas — 系統架構圖建構工具

**給開發者的視覺化系統架構圖建構工具**。透過互動式 Canvas 建立、編輯、儲存、載入、匯出軟體系統架構圖。

- 拖放元件庫建立 System / Application / Infrastructure / Data 等節點
- 節點具明確語意（技術、說明、顏色），可編輯
- 節點之間拉線建立依賴關係（直角箭頭線）
- 用**群組（Container）**把相關節點組織在一起，拖動群組會整組移動
- 內建多種範本（電子商務平台、微服務、事件驅動、無伺服器…）
- **匯出 / 匯入 JSON** 作為存檔與交換格式
- 純前端、無後端；資料以 Pinia store 管理

## ✨ 功能特色

- 🎨 **互動式畫布** — 基於 `@vue-flow/core`，支援平移、縮放（0.3×–3×）、符合畫布（fit）
- 🧩 **元件庫** — 依分類（基礎 / 應用 / 基礎設施 / 資料 / 組織）拖放節點；群組也是其中一項
- 🔗 **連線** — hover 節點浮出連線點，從任意方向拉線；連線為直角箭頭線，hover 時有流光動畫
- 📦 **群組** — 把節點收進群組框；拖動群組整組跟隨；把節點拖出群組框會詢問是否解除關聯
- 🪟 **浮動屬性視窗** — 點擊節點 / 群組即出現，可拖到畫布任意位置，不擋編輯
- ⌨️ **快捷鍵** — `Delete`/`Backspace` 刪除、`Cmd/Ctrl+Z` 復原、`Cmd/Ctrl+Shift+Z` 重做、`F` 符合、`Esc` 取消選取
- 📐 **範本** — 一鍵套用已分群、已連線的完整架構
- 💾 **匯出 / 匯入** — 以 JSON 存檔與交換（見下方格式）

## 🚀 快速開始

```sh
npm install        # 安裝依賴
npm run dev        # 啟動開發伺服器
npm run build      # 型別檢查 + 生產建置
npm run preview    # 本機預覽建置結果
```

開啟後畫布預設載入「電子商務平台」範本。

### 常用操作

| 操作 | 方式 |
|---|---|
| 新增節點 | 從左下「元件庫」拖到畫布，或點擊元件庫項目在中央建立 |
| 新增群組 | 從元件庫「組織」分類拖「群組」到畫布 |
| 連線 | hover 節點 → 浮出連線點 → 拖到目標節點 |
| 移動群組 | 直接拖動群組框，內部節點跟著走 |
| 解除群組關聯 | 把節點拖出所屬群組框 → 確認對話框 |
| 編輯屬性 | 點擊節點 / 群組，浮動視窗可改名、改技術、加說明、加 / 移出群組 |
| 儲存 | 點「匯出」下載 JSON（匯出即視為儲存）|
| 載入 | 點「匯入」選擇 JSON 檔案 |

## 📦 JSON 格式（匯出 / 匯入）

「匯出」會下載目前架構的 JSON 檔；「匯入」會讀取該 JSON 並取代目前畫布。檔案為 `Architecture` 物件（pretty-print，`version: 1`、`type: 'architecture'`）。

### 頂層結構

```jsonc
{
  "version": 1,
  "type": "architecture",
  "id": "uuid",
  "name": "電子商務平台",
  "metadata": { "name": "電子商務平台", "description": "", "author": "", "tags": [], "createdAt": "…", "updatedAt": "…" },
  "nodes": [ /* ArchitectureNode[] */ ],
  "containers": [ /* ArchitectureContainer[] */ ],
  "connections": [ /* ArchitectureConnection[] */ ],
  "viewport": { "zoom": 1, "x": 0, "y": 0 },
  "settings": { "grid": true, "snap": true, "gridSize": 16 },
  "createdAt": "…",
  "updatedAt": "…"
}
```

### 節點 `ArchitectureNode`

所有座標皆為**絕對畫布座標**（非相對群組）。`containerId` 標記所屬群組（可省略）。

```jsonc
{
  "id": "uuid",
  "name": "前端",
  "type": "frontend",          // NodeType，見下方列舉
  "technology": "Next.js",      // 選填
  "description": "",            // 選填
  "position": { "x": 160, "y": 120 },   // 絕對座標
  "size": { "width": 150, "height": 82 },
  "shape": "rounded",           // 'rounded' | 'rectangle' | 'cylinder' | 'queue' | 'database'
  "containerId": "container-uuid"  // 選填；所屬群組 id
}
```

`NodeType` 列舉：`person`、`frontend`、`backend`、`api`/`gateway`、`service`、`database`、`cache`、`queue`、`storage`、`cdn`、`loadbalancer`、`server`、`function`、`container`、`messagebroker`、`external`、`mobile`。

### 群組 `ArchitectureContainer`

```jsonc
{
  "id": "container-uuid",
  "name": "後端服務",
  "type": "group",             // ContainerType
  "description": "",
  "position": { "x": 400, "y": 80 },    // 絕對座標（群組框左上角）
  "size": { "width": 360, "height": 280 }
}
```

成員關係由節點的 `containerId` 指向此 `id` 決定（無 parentNode 巢疊）。

### 連線 `ArchitectureConnection`

```jsonc
{
  "id": "uuid",
  "sourceId": "node-uuid",     // 來源節點 id
  "targetId": "node-uuid",     // 目標節點 id
  "type": "dependency",        // ConnectionType
  "protocol": "",              // 選填，如 HTTPS / gRPC / AMQP
  "label": "",                 // 選填
  "direction": "forward"
}
```

`ConnectionType` 列舉：`dependency`、`data`、`async`、`sync`、`network`、`deployment`。

### 匯入規則

- 檔案需為合法 JSON，且含 `nodes`、`containers`、`connections` 三個陣列，否則匯入失敗（跳出提示）。
- 匯入會**整份取代**目前畫布，並可經由復原（Cmd/Ctrl+Z）回退。
- 匯出時自動帶上 `version` 與 `type` 欄位，供未來格式相容使用。

## 🏗️ 技術棧

| 類別 | 技術 |
|---|---|
| 框架 | Vue 3.5（Composition API + `<script setup>`）|
| 語言 | TypeScript（strict mode）|
| 建置 | Vite 8（含 vue-tsc 型別檢查）|
| 狀態 | Pinia 4 |
| UI | Tailwind CSS v4（CSS-first）+ reka-ui（shadcn-vue）+ lucide 圖示 |
| 畫布 | `@vue-flow/core`（圖編輯核心）|
| 測試 | Vitest（jsdom, globals）|
| Lint | oxlint（第一層）→ ESLint（第二層），Prettier 格式化 |

## 📁 專案架構

```
src/
├── components/
│   ├── architecture/      # ArchitectureCanvas（Vue Flow 橋接）、ArchNode、ArchGroupNode、FloatingInspector
│   ├── layout/            # LandingView（主畫面：工具列 + 元件庫 + 畫布 + 屬性窗）
│   └── common/            # Tooltip 等通用元件
├── stores/                # Pinia：architecture（真理源，含 undo/redo、匯入/匯出）
├── types/                 # 領域型別：architecture（含 buildTemplate 範本、NODE_LABELS、accentFor）
├── composables/           # useNodeScreenRect（浮動視窗定位）
└── __tests__/             # 單元測試
```

### 核心設計原則

- **Canvas 只負責渲染與互動，不儲存業務狀態** — 完整畫面由 Architecture Model 渲染；編輯操作皆走 Pinia store action。
- **絕對座標模型** — 節點與群組都存絕對畫布座標，群組跟隨在拖動時手動平移子節點，避免 parentNode 巢疊的不可控行為。
- **undo/redo** — store 以快照（`checkpoint()`）實作，至少涵蓋增刪改節點 / 連線 / 群組。

## 🧪 測試

```sh
npx vitest run
```

涵蓋：store 的 add/update/connect/undo/redo、群組（新增 / 收納 / 解除 / 刪除保留成員）、連線、以及各範本皆含群組與連線。

## 📐 部署

純前端應用，無後端需求。`base` 已設為 `/ai-company-os/`（GitHub Pages 專案頁路徑）。

```sh
npm run build   # 產出 dist/
# 部署 dist/ 至 GitHub Pages / Vercel / 任何靜態主機
```

## 🛠️ 開發指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發伺服器（hot reload）|
| `npm run build` | 型別檢查 + 生產建置 |
| `npm run preview` | 本機預覽建置結果 |
| `npm run lint` | oxlint → eslint |
| `npm run format` | Prettier 格式化 `src/` |
