# AI Company OS

**互動式 AI Agent 團隊監控系統** — 以 Canvas 2D 視覺化呈現一間由多個 AI Agent 組成的虛擬軟體公司的即時運作。

使用者提出產品需求（或播放離線模擬情境）後，系統會模擬一間 AI 公司：執行長啟動專案、產品經理分析需求、技術長拆解任務、各部門 Agent 協作實作、QA 測試除錯，並在關鍵決策點停下來等待人類核准。整個過程以一個**固定不捲動的 Mission Control 監看介面**呈現，中央是「AI 公司神經工作流」的即時視覺化。

系統支援兩種執行模式，共用同一套 UI、Workflow 編排與 Domain Model：

- **Simulation（預設）** — 離線 Mock Agent Engine，不呼叫任何 LLM、不需 API Key。
- **Real AI（BYOK）** — 填入自己的 API Key 後啟用，真實呼叫 LLM Provider（目前 OpenAI；Gemini / Claude 已預留介面），具備 JSON schema 校驗、Tool Calling、Cost Control 與 Observability Trace。

## ✨ 功能特色

- 🧠 **神經工作流視覺化（Canvas 2D 引擎）** — 深底＋漂移粒子、Agent 圓角模組卡片、細藍連線、琥珀色資料粒子沿曲線流動（glow + trail）。自寫 `CompanyEngine`：單一 rAF loop、`update/render` 分離、camera pan/zoom、spotlight 聚焦、pulse 光環、狀態色平滑插值、`prefers-reduced-motion`、依裝置核心數/寬度的效能分級。
- 🎯 **聚光燈（Spotlight）** — 執行中當事 Agent 高亮、其餘節點壓暗；步驟交接時放出脈衝光環。資料來源：`companyStore.currentStepId → activeScenario.steps[].agentId`。
- 🎮 **模擬控制列** — 開始／暫停／繼續／重設，速率 0.5×～8×；可切換「聚焦當事 Agent」跟隨視角或全景視角。
- 📋 **可摺疊控制台（右側）** — 模擬／組織／事件三個分頁，僅面板內部捲動。
- 👤 **Agent 工作區** — 點擊節點以鏡頭聚焦（不彈窗）；hover 時 tooltip 浮在節點旁顯示職責與狀態。
- 🔀 **任務依賴與 Bug 流程** — 任務自動解鎖、QA 發現 Bug → 前端修復重測的完整劇本。
- 🙋 **Human-in-the-loop** — 高風險轉場停下等待人工核准；否決回到修復階段。
- 🤖 **Real AI 路徑（BYOK）** — `RealWorkflowEngine` + `RealAgentRuntime`：Prompt 構建 → LLM 請求 → JSON schema 校驗 → 受限 Tool 執行 → 重試 → Observability Trace。細節見下章。
- 💾 **狀態持久化** — sessionStorage 自動保存，同分頁刷新後恢復進度（API Key 除外，見安全性）。
- 📊 **評估面板** — Agent 效能數據（Simulation 模式標示為模擬資料）。
- ♿ **無障礙支援** — 鍵盤操作（Esc 關閉工作區，不攔截 Tab）、focus 狀態、aria-label、reduced motion。

## 🚀 快速開始

```sh
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 生產建置（型別檢查 + vite build）
npm run build

# 本機預覽建置結果
npm run preview
```

### 使用方式

1. **Simulation**：左側「示範情境」選情境（預設「電商網站」），按「開始示範」，Agent 即在神經工作流圖上運作。
2. **Real AI**：點右上角齒輪開啟「AI Provider 設定」，輸入 OpenAI API Key → Test Connection → 啟用 Real AI；隨後用「啟動新專案」填入需求即可驅動真實 LLM。
3. 關鍵決策點會彈出核准對話框——「核准」完成，或「否決」回到修復階段。

> 開發者比對用：網址加 `?view=v2` 可切回 V2 dashboard 版面。

## 🔌 串接 Real AI 的處理流程

Real AI 與 Simulation **共用同一套 UI、Workflow 編排與 Domain Model**，差別只在「Agent 怎麼產出結果」。兩者都實作 `AgentRuntime` 介面，由 `createAgentRuntime(mode)` 工廠依模式選擇，因此切換模式**不需改寫任何 UI 或領域型別**。

### 1. 金鑰與模式（BYOK，僅存記憶體）

- API Key 由 `AISettingsDialog` 輸入，寫入 `useAIStore().apiKey` 這個 **plain ref，刻意不寫入 sessionStorage / localStorage**（spec §8），重新整理即清除；`clearKey()` 可立即移除。
- Provider / Model 在對話框選擇；Gemini、Claude 的選項已顯示但標記「敬請期待」（`ready: false`）。
- 切換到 Real 需先通過 `testConnection()`（發一個最小 probe 請求），且首次切換會彈出 BYOK 安全確認（§47）。`realReady` computed 決定 Real 是否可選。

### 2. Provider 抽象層（`engine/providers`）

- `LLMProvider` 介面（`generate` / `testConnection`）讓 Workflow Engine 與任何具體廠商解耦（spec §12）。
- `createLLMProvider(config)` 工廠：目前 `openai` → `OpenAIProvider`（繼承 `HttpLLMProvider`，用瀏覽器 `fetch` 直送 `api.openai.com/v1/chat/completions`）；`gemini`/`claude` 拋 `not implemented`；`mock` → `MockProvider`。
- `HttpLLMProvider` 統一處理：30s 超時（`AbortController`）、`classifyHttpError` 把 401/403→`authentication`、429→`rate_limit`、404→`invalid_response`、網路錯誤→`network`、逾時→`timeout`。**錯誤訊息永不包含 API Key 或 Authorization header（§49）。**

### 3. 編排順序（`RealWorkflowEngine`，spec §58）

`ProjectLauncher` 呼叫 `getRealEngine().start(project)`，依固定順序輪流執行 8 個角色：`ceo → product → cto → designer → frontend → backend → qa → ceo（最終審查）`。每個角色：

1. 設定階段與該 Agent 狀態（`working` / 最終審查 `reviewing`）。
2. `effectiveModeFor(agentId)` 決定本步用 mock 或 real（§37 支援 Per-Agent override，否則跟全域）。
3. `createAgentRuntime(mode)` 取得對應 runtime。
4. 呼叫 runtime，並經 `onTrace` 回調記錄 Observability（Real 才記）。
5. 依結果決定下一步：`needs_approval` / 最終審查 → 暫停等人工；`failed` → 標 `blocked`；否則標 `completed`，並 `refreshUnlocks()` 解鎖任務。
6. 達 `maxSteps`（預設 20）即停止並推送「Execution limit reached」事件（§38）。

### 4. Real Agent Runtime 執行（`RealAgentRuntime.run`，spec §18/§25）

對單一 Agent 一次執行：

1. **建 Prompt** — `buildSystemPrompt()`（中央構建，絕不寫在元件裡，§59）組合：公司規則 + 角色職責 + 專案/任務上下文 + 可用工具名 + 輸出 JSON Schema；`buildUserMessage()` 為使用者需求。
2. **呼叫 LLM** — `provider.generate({ model, systemPrompt, messages, temperature: 0.4 })`。`buildProvider()` 在無 Key 時自動回退 `MockProvider`（§34 永不靜默失敗）。
3. **解析 JSON** — `parseLLMJson()` 先剝 markdown fence、再取第一個 `{` 到最後 `}`，失敗拋 `invalid_response`。**LLM 輸出絕不直接信任。**
4. **Schema 校驗** — `validateAgentOutput()` 檢查 `status` ∈ {success|failed|blocked|needs_approval}、`message` 非空、`tasks[]` 結構合法（優先級/角色不合法時降為預設值）。
5. **執行 Tool** — 對校驗通過的每個 task，經 `runToolCall()` 走安全 Tool 層（§28），依 `maxToolCalls`（預設 10）上限建立任務；Tool 只透過 Pinia store 讀寫領域狀態，不直接碰 LLM 或元件（§54）。
6. **記錄 Trace 並回傳** — 組 `RealRunTrace`（provider / model / duration / attempt / usage / finishReason / promptVersion / toolCalls / status），`onTrace` 寫入 `useTraceStore()`，UI 事件可顯示 token 用量等觀測資訊。

### 5. 重試與錯誤（spec §40）

`MAX_RETRIES = 2`。`authentication` / `rate_limit` 錯誤**不重試**（立刻失敗，避免燒額度）；validation / transient 錯誤才有限重試。最終失敗時推送 `error` 事件並回傳 `failed`。

### 6. Human Approval（spec §41）

結果為 `needs_approval` 或最終審查時，`RealWorkflowEngine` 設 `runState = 'awaiting_approval'` 並推送 `approval_required` 事件，await `resolveRealApproval()`（由 `ApprovalDialog` 的核准/否決按鈕觸發）。核准才 `finish()`，否決則標 `blocked` 繼續下一角色。

### 7. 安全性（§61/§62）

- API Key 僅存在瀏覽器分頁的記憶體，本應用程式不儲存、不記錄、不進 sessionStorage。
- 請求由**使用者瀏覽器直接用其 Key 發送**——瀏覽器非可信執行環境，故 UI 與對話框明確提醒：勿使用權限/額度高於願意暴露程度的金鑰。
- Test Connection 與每次 generate 都經錯誤分類，回傳給 UI 的訊息不含敏感資訊。

## 🏗️ 技術棧

| 類別 | 技術 |
|---|---|
| 框架 | Vue 3.5（Composition API + `<script setup>`）|
| 語言 | TypeScript（strict mode）|
| 建置 | Vite 8（含 vue-tsc 型別檢查）|
| 狀態 | Pinia 4 |
| UI | Tailwind CSS v4（CSS-first）+ reka-ui（shadcn-vue）+ lucide 圖示 |
| 視覺 | 自寫 Canvas 2D 引擎（無 Three.js 依賴）|
| 測試 | Vitest + @vue/test-utils（jsdom）|
| Lint | oxlint（第一層）→ ESLint（第二層），Prettier 格式化 |

## 📁 專案架構

```
src/
├── canvas/                 # Canvas 2D 神經工作流引擎（不含 Pinia / 業務邏輯）
│   ├── CanvasEngine.ts     # 主引擎：圖布局、rAF loop、update/render、input
│   ├── Camera.ts           # 2D camera（world↔screen、zoom clamp）
│   ├── effects/glow.ts     # glow 繪圖 helper
│   └── types/workflow.ts   # WorkflowEvent 介面（Mock/Real 共用入口）
├── components/
│   ├── three/              # 視覺層 bridge：CompanyCanvas（引擎 wrapper）、AgentWorkspace
│   ├── landing/            # V3 控制台分頁：SimulationTab、OrgTab、事件 tab
│   ├── layout/             # LandingView（Mission Control 主畫面）、AppShell（V2 比對）
│   ├── common/             # StatusBadge、ProgressBar、ScenarioSelector、DemoControlBar、ProjectLauncher…
│   ├── execution/          # ExecutionTimeline、ApprovalDialog、EventDetailDialog
│   ├── agent/ settings/ task/ office/   # 領域元件
│   └── ui/                 # shadcn-vue 生成元件（由 CLI 管理，不手改）
├── engine/                 # 與 UI 完全分離的領域引擎
│   ├── scenarioEngine.ts   # Mock Agent Engine（離線模擬核心，單一 interval tick）
│   ├── realWorkflowEngine.ts # Real AI 編排（WHO runs WHEN）
│   ├── runtime/            # AgentRuntime：mockAgentRuntime / realAgentRuntime / schemaValidation / index（工廠）
│   ├── providers/          # LLM Provider 抽象：index（工廠+Mock）、openai、httpProvider
│   ├── tools/              # Agent Tool registry（createTask / updateTask / getProjectState / getTask / searchKnowledge / requestApproval）
│   ├── prompts/            # system / user prompt 構建（§59 中央構建）
│   └── avatarProvider.ts   # DiceBear 頭像抽象
├── stores/                 # Pinia：agents, ai, company, evaluation, execution, landing, persistence, tasks, trace
├── types/                  # 領域型別：agent, agentRuntime, execution, landing, llm, project, task, workflow
├── data/                   # 初始資料：agents.ts、scenarios.ts（僅 Mock 引擎使用）
├── lib/ utils/             # cn() 等工具
└── __tests__/              # 單元測試（與原始碼分離放置）
```

### 核心設計原則

- **引擎與 UI 完全分離** — Workflow 只存在於 `engine/`，Component 不直接修改核心狀態，一切透過 Store Action。
- **Mock / Real 共用 Runtime 介面** — 兩者皆實作 `AgentRuntime`，由 `createAgentRuntime(mode)` 工廠選擇；切換模式不重寫 UI 與 Domain Model。
- **確定性推進模型** — Mock 引擎以單一 interval tick 依「消耗時間 × 速度」推進步驟，不使用 promise chain，避免未處理 rejection 造成流程靜默中斷。
- **Provider abstraction** — `LLMProvider` 抽象層支援 OpenAI / Gemini / Claude（後兩者預留）；`AgentTool` 經安全層執行並受 `maxToolCalls` cost limit 約束。
- **不信任 LLM 輸出** — Real 路徑一律 `validateAgentOutput(parseLLMJson(...))`，且僅 `authentication`/`rate_limit` 之外的 transient error 才重試（§40）。
- **狀態表達「符號 + 文字 + 顏色」三者並用** — 全場狀態燈統一語義（working/等待/錯誤…），不只用顏色區分（§11/§37）。

## 🧪 測試

```sh
npx vitest run
```

涵蓋（11 個檔、66 個測試）：任務依賴解鎖、Agent 狀態轉移、完整流程（到達核准點 → 核准 → 完成）、否決回到修復階段、暫停／繼續、重設、**Mock/Real Runtime**、**Provider 工廠與錯誤分類**、**Cost Control**、**Trace 記錄**、**RealWorkflow 八步編排與 Human Approval**、Evaluation。

## 📦 部署

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

## 📐 規格

設計依據 `AI Company OS — V3 Specification.md`（權威文件）。V1/V2 為歷史參考。

---

*本專案的 Simulation 模式 Agent 行為與評估數據皆為模擬結果，不代表真實 AI 評估。Real AI 模式會直接呼叫使用者自行設定的 LLM Provider，並消耗該 Provider 的額度。*
