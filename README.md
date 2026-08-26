# AI Company OS

**互動式 AI Agent 團隊管理與觀測系統** — 純前端的 AI 虛擬公司模擬器（V1.0 Frontend Prototype）。

使用者提出產品需求後，系統模擬一間由多個 AI Agent 組成的虛擬軟體公司：執行長啟動專案、產品經理分析需求、技術長拆解任務、各部門 Agent 協作實作、QA 測試除錯，最後由人類核准完成。

> V1 使用 **Mock Agent Engine** 模擬所有 AI 行為，不使用真實 LLM。
> V2 計畫將 Mock Provider 替換為真實 LLM Provider（OpenAI / Gemini / Claude / BYOK）。

## ✨ 功能特色

- 🏢 **辦公室視圖** — 2D 平面圖即時顯示每位 Agent 的狀態（工作中／等待中／已阻塞／已完成）
- 📋 **Kanban 任務板** — 六欄看板（待辦清單 → 已完成），含進度條與依賴提示
- 🔀 **任務依賴關係圖** — 分層視覺化，依賴完成的任務自動解鎖
- ⏱️ **執行時間軸** — 所有 Agent 行為以事件呈現，點擊查看詳細內容
- 👤 **Agent 詳細面板** — 狀態、目前任務、職責、最近活動
- 🧪 **完整示範情境** — 「電商網站」：需求分析 → 任務規劃 → 實作 → QA 發現 Bug → 修復重測 → 執行長審查
- ⚠️ **錯誤情境模擬** — QA 測試失敗建立 Bug、前端 Agent 因等待 API 規格而阻塞
- 🙋 **Human-in-the-loop** — 專案完成前需人工核准；否決會回到上一階段繼續執行
- 🎮 **示範控制列** — 開始／暫停／繼續／重設，速度可調 0.5x～4x
- 💾 **狀態持久化** — sessionStorage 自動保存，同一分頁內重新整理後恢復目前進度
- 📊 **評估面板** — Agent 效能數據（標示為模擬資料）
- ♿ **無障礙支援** — 鍵盤操作、focus 狀態、aria-label、reduced motion

## 🚀 快速開始

```sh
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 生產建置
npm run build

# 本機預覽建置結果
npm run preview
```

### 使用方式

1. 在左側「示範情境」選擇情境（V1 提供「電商網站」）
2. 按「開始示範」，Agent 們就會開始工作
3. 用速度按鈕（0.5x～4x）加快或放慢流程
4. 流程結束時會彈出核准對話框——按「核准專案」完成，或按「否決」回到修復階段

## 🏗️ 技術棧

| 類別 | 技術 |
|---|---|
| 框架 | Vue 3（Composition API + `<script setup>`）|
| 語言 | TypeScript（strict mode）|
| 建置 | Vite |
| 樣式 | Tailwind CSS v4 |
| 狀態管理 | Pinia |
| 圖示 | Lucide |
| 測試 | Vitest + @vue/test-utils |

## 📁 專案架構

採 Feature-oriented 架構：

```text
src/
├── components/
│   ├── agent/        # Agent 詳細資訊面板
│   ├── common/       # 共用元件（控制列、進度條、狀態徽章等）
│   ├── dashboard/    # 總覽儀表板
│   ├── execution/    # 執行時間軸、核准對話框
│   ├── layout/       # AppShell 版面配置
│   ├── office/       # 辦公室平面圖
│   └── task/         # Kanban 任務板、依賴關係圖
├── engine/
│   ├── scenarioEngine.ts   # Mock Agent Engine（核心模擬引擎）
│   ├── workflowEngine.ts   # 狀態轉移與任務依賴規則
│   ├── llmProvider.ts      # LLM Provider 抽象（V2 預留）
│   └── agentTools.ts       # Agent Tool registry（V2 預留）
├── data/
│   ├── agents.ts     # Agent 初始資料
│   └── scenarios.ts  # 示範情境劇本
├── stores/           # Pinia stores（company/agents/tasks/execution/persistence）
├── types/            # 領域模型型別
└── __tests__/        # 單元測試
```

### 核心設計原則

- **引擎與 UI 完全分離** — Workflow 只存在於 `engine/`，Component 不直接修改核心狀態，一切透過 Store Action
- **Mock 資料與 UI 分離** — 所有 Agent 劇本集中在 `data/scenarios.ts`，不在 Component 裡 hardcode
- **確定性推進模型** — 引擎以單一 interval tick 依「消耗時間 × 速度」推進步驟，不使用 promise chain，避免未處理 rejection 造成流程靜默中斷
- **Provider abstraction** — `LLMProvider` 與 `AgentTool` 介面已預留，V2 替換成真實 LLM 時不需改寫 UI 與 Domain Model

## 🧪 測試

```sh
npx vitest run
```

涵蓋：任務依賴解鎖、Agent 狀態轉移規則、完整流程（到達核准點 → 核准 → 完成）、否決後回到修復階段再重新抵達核准點、暫停／繼續、重設。

## 📦 部署

純前端應用，無後端需求。建置後將 `dist/` 部署至 Vercel、GitHub Pages 或任何靜態主機即可。

```sh
npm run build   # 產出 dist/
```

## 🛠️ 開發指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發伺服器（hot reload）|
| `npm run build` | 型別檢查 + 生產建置 |
| `npm run preview` | 本機預覽建置結果 |
| `npm run lint` | ESLint + oxlint |
| `npm run format` | Prettier 格式化 |

> 安裝依賴時若遇到 peer dependency 衝突，可加上 `--legacy-peer-deps`。

## 🗺️ Roadmap

- **V2**：BYOK、真實 LLM Provider、Tool Calling、Streaming、Token/Cost 追蹤
- **V3**：GitHub 整合、真實程式碼生成、Browser Agent、MCP、Multi-project

---

*本專案的 Agent 行為與評估數據皆為模擬結果，不代表真實 AI 評估。*
