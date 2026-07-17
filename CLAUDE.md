# Remote Editor Kit — 工作區指南（Claude 必讀）

「為你剪片」AI 剪輯系統：把口播原始影片變成 Fyn 風格的 Reel——去空白＋降噪＋雙語字幕＋
動態圖卡＋**卡片收合**（人物去背、頭衝出卡片、佐證截圖卡；預設風格 `card-takeover`）。
使用者多半**不會剪片、不會寫程式**——全程繁體中文、每階段給畫面確認、**問題越少越好**：
丟一支原始影片說「幫我剪」，就要用預設風格＋最少往返剪出 Fyn 同級成品。

## 兩個核心 skill（觸發就用，不要自己發明流程）

| Skill | 什麼時候 |
|---|---|
| `remote-setup` | 「幫我安裝環境」→ 執行 `bash setup.sh`（冪等、可續傳） |
| `remote-editor` | 「幫我剪這支影片」→ 完整剪輯工作流程 |

使用者說「**幫我更新剪片系統**」→ 執行 `bash update.sh`（自動找 Skool 下載的新版 zip、
只更新系統檔、絕不碰 projects/；找不到 zip 時引導使用者去 Skool 下載）。

## 品牌設計 = DESIGN.md（改樣式前必讀）

視覺規格的**唯一正典**在 `DESIGN.md`（字幕版式、液態玻璃配方、安全區、圖卡使用時機）。
機器版 token 在 `templates/design-tokens.css`（＝signature 風格的 tokens）。客戶要換品牌配色 → 改對應風格 tokens。

## 5 套內建風格 = STYLES.md（剪片先選一套）

內建 5 套風格：`card-takeover`（卡片收合，**預設**——Fyn 本人主力風格：襯線珊瑚白卡＋人物去背頭衝出卡片＋佐證截圖卡）、`signature`（招牌金字幕）、`editorial-red`（編輯黑紅）、`paper-serif`（紙感襯線）、`midnight-neon`（暗夜霓虹）。清單＋預覽在根目錄 `STYLES.md`，每套在 `templates/styles/<代號>/`。剪片時 `script.json` 設 `"style": "<代號>"`，或使用者說「用暗夜霓虹風格剪」，引擎自動套。不設 = card-takeover。卡片視窗規劃規則見 remote-editor skill 的「卡片收合 playbook」。

## 內建資產與招牌配方（剪片先用這些，別重畫）

Fyn 做過的可重用資產都已內建，剪片時直接套、不要重新產生或找參考圖：
- **圖示 ICONS**（`mg` 用 `"icon":"名稱"`）：`claude-mascot`（Claude 像素小獸）、`instagram`/`tiktok`/`youtube`/`facebook`/`linkedin`/`skool`、`worldmap`、`money`… 定義在 `templates/lib/mg-library.js`。
- **動畫元件 BUILDERS**（`mg` 用 `"type":"名稱"`）：`statCounter`（金色跳數）、`confetti`（拉炮）、`glassCard`、`stamp`、`avatarBadge`、`glowFrame`、`sparkles`、`cta`、`countdown`…；卡片視窗面板：`proofShot`（佐證截圖卡）、`flowRow`（流程故事）、`ctaCard`（留言 CTA）。
- **標準素材** `templates/assets/`：`world-map.svg`、`claude-mascot.svg`、`coin.m4a`（金幣音效）。
- **招牌配方（複製即用的 `script.json` 片段）在 `templates/RECIPES.md`**——IG 破十萬＋拉炮、金錢 count-up、小獸卡、平台 logo、CTA、世界地圖路線都在。

## 工作區結構

```
remote-editor-kit/
├── CLAUDE.md / DESIGN.md / README.md / LICENSE.md / CREDITS.md
├── setup.sh                 ← 一鍵安裝器（remote-setup skill 執行它）
├── engine/                  ← 渲染引擎（run.mjs 是總指揮）
├── templates/               ← 設計 token、疊加層模板、字型
├── .claude/skills/          ← remote-editor / remote-setup
└── projects/<slug>/         ← 一支影片一個資料夾
    ├── raw/                 ← 原始素材
    ├── assets/              ← B-roll、頭像、配樂
    ├── script.json          ← 唯一剪輯決策檔（改這裡重剪）
    ├── work/                ← 中間產物（transcript、base.mp4）
    ├── hf/                  ← 自動產生的 Hyperframes 專案（不要手改）
    └── out/                 ← final.mp4 + reel_web.mp4
```

## 指令速查

```bash
bash setup.sh                                        # 環境安裝/驗證
bash update.sh                                       # 更新系統（新版 zip 放本資料夾或下載項目）
node engine/run.mjs projects/<slug> transcribe       # 逐字稿＋靜音偵測
node engine/run.mjs projects/<slug> base             # 底片（會輸出 remap 後逐字稿）
node engine/run.mjs projects/<slug> cutouts          # 人物去背＋頭部追蹤（有 windows 才需要）
node engine/run.mjs projects/<slug> render           # 全渲染（Hyperframes 路徑；含自動去背）
node engine/run.mjs projects/<slug> render --builtin # 備援渲染器（不支援卡片視窗）
cd projects/<slug>/hf && npx hyperframes preview     # Studio 即時預覽（改 script.json 後重跑 comps）
```

## 鐵律（違反 = 壞片）

1. **時間軸**：`keep` 用來源秒數；`lines/mg/zooms/broll` 用成品秒數（對時看 `work/transcript-final.json`）
2. **不手改 `hf/`**——那是 gen-comps 的產物，重跑會被覆蓋；一切改 `script.json`
3. **交付前必逐格驗收**：抽每張圖卡/字幕/zoom 時刻的 frame，用 Read 真的看過（字幕不擋臉、圖卡沒跑版）。lint 過 ≠ 畫面對
4. 字幕在 bottom:630（下巴以下）、圖卡在字幕下方或頂部——**永遠不擋臉**
5. 用「你」不用「妳」；中英文之間加半形空格
6. 配樂只用使用者自己有授權的音樂

## 範例專案

- `projects/example-morning-hike/` — 完整成品範例（含 script.json 決策＋out/final.mp4），新客戶先看這個
- `projects/_example/script.json` — 全欄位註解版
