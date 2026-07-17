# 內建風格庫（5 套・安裝即用）

一次給你 5 套現成風格。剪片時挑一套：在專案 `script.json` 設 `"style": "<代號>"`，
或直接跟 AI 說「用暗夜霓虹風格剪這支」。字幕與動態圖卡會自動套上該風格的配色與字體。

| 代號 `style` | 名字 | 一句話 | 預覽 |
|---|---|---|---|
| `card-takeover` | 卡片收合 | 人物去背塞進襯線珊瑚白卡、頭衝出卡緣＋佐證截圖卡（**預設**，Fyn 主力風格） | [看](templates/styles/card-takeover/preview.mp4) |
| `signature` | 招牌金字幕 | 白字＋金關鍵字＋液態玻璃卡（全自動最快） | [看](templates/styles/signature/preview.mp4) |
| `editorial-red` | 編輯黑紅 | 黑底＋紅框重點＋圖表流程＋單字大字幕 | [看](templates/styles/editorial-red/preview.mp4) |
| `paper-serif` | 紙感襯線 | 米白紙紋＋大襯線＋珊瑚＋像素小獸 | [看](templates/styles/paper-serif/preview.mp4) |
| `midnight-neon` | 暗夜霓虹 | 壓暗發光 UI＋HUD 播放頭＋DM 對話重演 | [看](templates/styles/midnight-neon/preview.mp4) |

- `signature` 與 `card-takeover` 是 Fyn 本人正在用的兩套；後三套是全新模板，可直接用或當起點改。
- 每套資料夾 `templates/styles/<代號>/`：`tokens.css`（設計系統）＋`preview.mp4`＋`README.md`。
- 三個新風格的**招牌動態圖卡積木**（漏斗圖／HUD／DM 重演等）在 `templates/styles/_hero/hero-playbook.html`（一個檔、可直接 render 出 30 秒示範）。
- 不設 `style` = 用 `card-takeover`（預設）。換品牌配色：改對應 `tokens.css` 的 `:root` 變數即可。
- `card-takeover` 的卡片收合本體（人物去背、頭衝出卡片、逐幀追蹤）由引擎自動做：在
  `script.json` 寫 `"windows": [{"t":[開,關]}]` 即可，去背用本地 Apple Vision、免費不用連網。
