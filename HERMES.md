# HERMES.md — AI Company OS 開發指引

本檔案是 Hermes Agent 在此 repo 工作時的遵循規範。開始任何修改前先讀完。

## 專案概要

**AI Company OS** — 模擬「AI 公司」營運的前端應用：Agent 執行任務、產生 Execution Trace、需要 Human Approval，並以 **Three.js 3D 公司場景**為核心視覺化。

- **V3 架構（現行）— Mission Control 監看式介面**：整頁是固定不捲動的監看應用。中央為 3D 公司場景（`src/three/companyScene.ts`，公司 Core + 7 個 Agent 節點 + 連線 + 粒子流），右側為可摺疊控制台（模擬／組織／事件三個分頁，僅面板內部捲動）。**禁止回到 landing page 滾動式版面**——滾動與 3D 互動會互相干擾。
- **V2 架構原則仍有效**：Mock AI 與 Real AI（LLM Provider）共用同一套 Agent Runtime、Workflow、State。UI 不分支於 Mock/Real。（V3 階段 Real AI 入口暫時從 UI 移除，但 engine/providers 程式碼完整保留，勿刪。）
- 規格見 `AI Company OS — V3 Specification.md`（權威文件）；V1/V2 為歷史參考。
- 目前為純前端階段（無後端），資料以 Pinia store + sessionStorage 模擬；部署目標 GitHub Pages（vite `base: '/ai-company-os/'`）。

### V3 UI 要點（改 UI 前必讀）

- **主畫面**：`LandingView.vue`（名稱沿用，實為 Mission Control 主畫面）；V2 dashboard 以 `?view=v2` 保留供開發比對。
- **聚光燈**：模擬執行中，當事 Agent 高亮、其餘節點壓暗（`companyScene.setSpotlight()`），步驟交接時放出脈衝光環（`pulseAt()`）。資料來源是 `companyStore.currentStepId → activeScenario.steps[].agentId`。
- **狀態表達不得只靠顏色**：一律「符號 + 文字 + 顏色」三者並用（規格 §11、§37）。事件 tab 的狀態燈：執行中閃爍綠燈、暫停／等待核准黃燈、錯誤紅燈（最後一筆事件 type === 'error'）、完成或待機時不顯示。
- **鍵盤**：Esc = 關閉 Agent 工作區。**不可攔截 Tab 鍵**——它屬於瀏覽器焦點導航（曾因此破壞 a11y 與自動化測試）。
- 摺疊按鈕位於 navbar 右側，不可放在面板分頁列（會遮住 Agent 工作區的關閉按鈕）。

## 技術棧

| 類別 | 技術 |
|---|---|
| 框架 | Vue 3.5+ `<script setup>` + TypeScript |
| 建置 | Vite 8, `vue-tsc` 型別檢查 |
| 狀態 | Pinia |
| UI | Tailwind CSS v4（CSS-first，無 tailwind.config）+ shadcn-vue (reka-ui, style: reka-vega) + lucide icons |
| 測試 | Vitest（jsdom, globals: true） |
| Lint | oxlint（第一層）→ ESLint（第二層），Prettier 格式化 |

## 指令

```bash
npm run dev         # 開發伺服器
npm run build       # type-check + vite build（交付前必跑）
npm run lint        # oxlint --fix → eslint --fix
npm run format      # prettier (src/)
npx vitest run      # 全部測試；npx vitest run src/__tests__/xxx.test.ts 跑單一檔
```

**驗證流程：改完程式碼 → `npx vitest run` → `npm run lint` → `npm run build`。三者皆過才算完成。**

## 目錄結構

```
src/
├── components/
│   ├── ui/          # shadcn-vue 生成元件 —— 不手改，由 CLI 管理
│   ├── common/      # 通用元件（StatusBadge、ProgressBar…）
│   ├── landing/     # V3 控制台分頁：SimulationTab、OrgTab
│   ├── three/       # 3D 橋接：CompanyCanvas（場景 wrapper）、AgentWorkspace
│   └── <domain>/    # 領域元件：agent/ dashboard/ execution/ office/ task/ settings/ layout/（LandingView 主畫面）
├── three/           # Three.js 場景本體：companyScene.ts（不含任何 Pinia / 業務邏輯）
├── stores/          # Pinia：agents, ai, company, evaluation, execution, landing, persistence, tasks, trace
├── types/           # 領域型別：agent, agentRuntime, execution, landing(3D 狀態模型), llm, project, task, workflow
├── composables/     # useXxx() composables
├── lib/             # utils.ts（cn() 等）
├── utils/           # 一般工具函式
└── __tests__/       # Vitest 測試（與原始碼分離放置於此）
```

## 開發慣例

- **路徑別名**：一律用 `@/`（= `src/`），不用相對路徑多層跳轉。
- **Vue SFC**：`<script setup lang="ts">`，Props/Emits 用 `defineProps<T>()` / `defineEmits<T>()` 型別語法。
- **新 UI 元件**：優先用 `npx shadcn-vue@latest add <component>` 生成，不要手寫 `components/ui/` 底下內容。業務元件組合 ui 元件，不重造按鈕/dialog。
- **樣式**：Tailwind utility classes + `main.css` 的 CSS variables 主題 token；用 `cn()` 合併 class。不寫行內 style、不新增全域 CSS（除非主題 token）。
- **狀態**：跨元件共享的狀態進 Pinia store；元件區域狀態留在元件內。Mock/Real 切換邏輯集中在 `stores/ai.ts` 與 agent runtime 相關模組，不得散落在 UI 元件。
- **型別**：所有領域資料結構定義在 `src/types/`，UI 與 store 都從那裡 import，不要在元件裡重新宣告介面。
- **測試**：新功能（尤其 stores、runtime、provider 判斷、cost control）附帶對應測試於 `src/__tests__/`，命名 `*.test.ts`。

## 注意事項

- Node 版本需求：`^22.18.0 || >=24.12.0`。
- Windows 環境：shell 為 git-bash；原生工具傳 `C:/...` 正斜線路徑。
- 不要 commit `dist/`、`.eslintcache`。
- Prettier 只處理 `src/`（見 format script），其他目錄維持原樣。
- 規格書為中文＋英文混合；回覆與註解跟隨使用者語言（繁體中文）。
