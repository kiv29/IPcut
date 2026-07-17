# DESIGN.md — Fyn 液態玻璃品牌規格（視覺正典）

> 這是 **signature（招牌金字幕）** 風格的視覺正典。kit 另內建 4 套風格（卡片收合／編輯黑紅／紙感襯線／暗夜霓虹），見根目錄 `STYLES.md`，各自 tokens 在 `templates/styles/<代號>/tokens.css`；剪片用 `script.json` 的 `"style"` 選。

> 這是本 kit 的預設品牌。客戶要換成自己的品牌：改這份文件＋`templates/design-tokens.css`，
> 其他一切不用動。

## 品牌色

| 用途 | 色碼 | 說明 |
|---|---|---|
| 主品牌金 | `#F4C430` | 字幕關鍵字、金色數字、發光框、sparkles |
| 金色立體陰影 | `#B8860B` | 金字下方 3px 硬陰影 |
| 亮黃貼片 | `#FFD23F` | chip 貼片字、印章、名牌膠囊（配黑字 `#0d0d0d`） |
| 輔助綠 | `#3ECF8E` | 正面/成功印章 |
| 警示紅 | `#E0554D` | 負面/刪除線/紅印章 |
| 深色膠囊 | `rgba(12,12,14,0.78)` | 印章下的副標 pill |

## 字幕版式（1080×1920）

- **繁中主行**：Noto Sans TC 500、42px、白、多層黑描邊＋深陰影；關鍵字 `<hl>` = 金色 900 粗體；超強調 `<chip>` = 黃底黑字圓角貼片（全片最多 2-3 個）
- **英文副行**：Montserrat 700、29px、白 94%
- **位置**：字幕帶 bottom:630px（下巴以下、胸口）；全螢幕 B-roll 時段用 `lift` 抬到畫面中上
- **一句一行**、不重疊；英文是理解後翻譯，不是機翻；用「你」不用「妳」

## 液態玻璃（liquid glass）配方

```
background: rgba(255,255,255,0.16)
backdrop-filter: blur(16px) saturate(1.25)
border: 1px solid rgba(255,255,255,0.55)
border-radius: 30px
box-shadow: 0 12px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.6)
```

## 版面安全區

- 臉在畫面上中——**任何東西都不能擋臉**
- 圖卡預設 top≈1330（字幕帶下方）；或頂部 y<520（帽緣以上）
- 一切置中 x=540

## 動態節奏（每張圖卡的生命週期）

pop 進場（scale 0.4→1、back.out 回彈、0.45s）→ 懸浮呼吸（±7px 正弦）→ 縮小淡出（0.25s）。
金句時刻臉部推近 1.10–1.12x（power2.inOut 進出）。

## 圖卡使用時機

| 台詞內容 | 圖卡 | 備註 |
|---|---|---|
| 數字成就（粉絲、營收、天數） | `statCounter` | 金色 count-up |
| 名人引用/背書 | `avatarBadge` | 白框圓頭像＋黃名牌 |
| 一句話強調 | `stamp` | 黃/綠/紅印章＋深色副標 |
| 指著字幕講 | `glowFrame` + `arrows` | 金色發光框＋箭頭 |
| 慶祝/亮點 | `sparkles` | ✦ 點綴，別超過 4 顆 |
| 倒數/步驟 | `countdown` | 頂部金色進度環 |
| 否定舊觀念 | `strikeText` | 紅線劃掉 |
| 結尾 | `cta` | 金色追蹤鈕＋心跳 |

**節制原則**：每 8–15 秒一張、只放圖跟數字、乾淨不雜。圖卡是配菜，臉和話才是主角。

> **預設風格已改為 `card-takeover`（卡片收合）**——本檔描述的是 signature 的視覺正典；卡片收合的版式規則（紙面、卡片幾何、on-light 字幕、面板元件）見 `templates/styles/card-takeover/README.md` 與 remote-editor skill 的「卡片收合 playbook」。
