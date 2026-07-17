# 暗夜霓虹 Midnight Neon  `midnight-neon`

![preview](preview.mp4)

**長相**：把畫面壓暗當底＋發光 UI＋頂部五軌 HUD 播放頭＋IG DM 對話重演（藍泡泡逐字打、黃底 highlight）＋霓虹粉紫漸層字。夜拍暗調素材最搭。

**什麼時候用**：銷售/成交教學、演算法技巧、DM 話術重演；素材需室內暗調＋暖光。

**設計 tokens**：主色 霓虹藍 #2F7DF6／粉 #FF5EDB／黃 highlight #F6C445；深底 #0a0c11；hl＝黃底黑字。

**Hero 動態圖卡**：hero MG（五軌 HUD＋播放頭＋👁 count、DM 藍泡泡逐字＋highlight、霓虹漸層字）在 _hero/hero-playbook.html 的 #s3 段。

## 怎麼用
在專案的 `script.json` 加一行：
```json
{ "style": "midnight-neon", ... }
```
或直接跟 AI 說「用暗夜霓虹風格剪這支」。引擎會自動把 `tokens.css` 套到字幕與動態圖卡。
