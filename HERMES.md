# HERMES.md — AI Company OS 開發指引

本檔案是 Hermes Agent 在此 repo 工作時的遵循規範。開始任何修改前先讀完。

## 專案概要

**AI Company OS** — 模擬「AI 公司」營運的前端應用：Agent 執行任務、產生 Execution Trace、需要 Human Approval，並在 Dashboard 上視覺化。

- **V2 架構核心原則**：Mock AI 與 Real AI（LLM Provider）必須共用同一套 Agent Runtime、Workflow、State 與 UI。UI 不知道也不需知道目前是 Mock 還是真實 LLM。禁止為 Real AI 建立獨立 UI 或平行資料模型。
- 完整規格見 `AI Company OS — V2 Specification.md`（權威文件）；V1 為歷史參考。
- 目前為純前端階段（無後端），資料以 Pinia store + persistence 模擬。

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
│   ├── common/      # 通用元件（StatusBadge、DemoControlBar…）
│   └── <domain>/    # 領域元件：agent/ dashboard/ execution/ office/ task/ settings/ layout/
├── stores/          # Pinia：agents, ai, company, evaluation, execution, persistence, tasks, trace
├── types/           # 領域型別：agent, agentRuntime, execution, llm, project, task, workflow
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
