# 招牌配方（Fyn 風格・一行一效果）

安裝就內建這些**現成資產與動畫元件**。剪片時 Claude 直接在 `script.json` 的 `mg`
陣列丟這些片段就能重現 Fyn 的成品——**不用重畫、不用找參考圖、不用多花 token**。
`t` = [進場秒, 退場秒]（成品時間軸）。座標自動置中；`top` 預設 1330（字幕帶下方，不擋臉）。

## 內建圖示 ICONS（`"icon":"名稱"`）
`instagram` · `tiktok` · `youtube` · `facebook` · `linkedin` · `skool` ·
`claude-mascot`（Claude 像素小獸）· `worldmap`（世界地圖）· `money`（金幣）·
`globe` · `home` · `check` · `cross` · `play` · `bolt` · `heart`
（也可 `"icon":"assets/xxx.png"` 用專案自備圖，或 `"icon":"<svg…>"` 直接給 SVG。）

## 動畫元件 BUILDERS（`"type":"名稱"`）

**① IG 破十萬 ＋ 拉炮**（招牌）
```json
{ "type":"statCounter", "t":[3.2,6.5], "icon":"instagram", "value":100000, "suffix":" 粉", "label":"180 天" },
{ "type":"confetti", "t":[3.4,6.3] }
```

**② 金錢 count-up（液態玻璃金數字）**
```json
{ "type":"statCounter", "t":[5,8], "icon":"money", "value":93000, "prefix":"$", "label":"月營收" }
```

**③ Claude 小獸卡 / 平台 logo 卡**
```json
{ "type":"glassCard", "t":[0.5,3], "icon":"claude-mascot", "text":"Claude 剪的" }
{ "type":"glassCard", "t":[6,8], "icon":"tiktok", "text":"TikTok" }
```

**④ 印章貼片**（黃/綠/紅）
```json
{ "type":"stamp", "t":[2,5], "text":"100% 自動", "color":"green", "sub":"從素材到成品" }
```

**⑤ 名人頭像牌**（自備頭像放 `assets/`）
```json
{ "type":"avatarBadge", "t":[4,7], "img":"assets/hormozi.png", "name":"ALEX HORMOZI" }
```

**⑥ CTA 追蹤鈕 / 倒數環 / 金色關注框 / sparkles**
```json
{ "type":"cta", "t":[88,92], "text":"留言 EDIT", "icon":"heart" }
{ "type":"countdown", "t":[10,15], "from":5 }
{ "type":"glowFrame", "t":[20,24], "top":1080, "height":210 }
{ "type":"sparkles", "t":[3,6] }
```

**⑦ 世界地圖旅行路線**（進階・全螢幕背景）
`worldmap` 是全幅地圖，當背景層用（非 72px 小圖示）。要做「台北→加拿大→阿拉斯加」那種
飛行路線動畫時，跟 Claude 說「用 worldmap 做旅行路線」，它會鋪地圖＋加紅色定位針＋虛線飛行路徑。
標準素材：`templates/assets/world-map.svg`。

## 音效
金幣「叮」音效已內建：`templates/assets/coin.m4a`。要在某個錢幣/數字彈出時加音效，
跟 Claude 說「這拍加金幣音效」即可（它會把 coin.m4a 疊進該時間點）。

## 字型（已內建、自動載入）
Noto Sans TC 500/900（中文字幕）· Noto Serif TC 600/900（襯線標題）· Montserrat 700/800（英文/數字）。

## 卡片收合三連發（card-takeover 預設風格・fyn-cashflow-09 正典）

原始影片＋佐證截圖 → 揭曉爆點開卡片、秀證據、CTA 收尾停在卡片。複製改時間與文字即可：

```jsonc
{
  "style": "card-takeover",
  "windows": [
    { "t": [7.0, 10.8] },                  // 爆點：金額揭曉＋佐證截圖
    { "t": [14.1, 24.7] },                 // 證據連發＋工作流故事（一窗到底，面板換拍）
    { "t": [28.4, 33.2], "hold": true }    // CTA：停在卡片模式到片尾
  ],
  "mg": [
    // 佐證截圖卡：白框截圖＋黃日期膠囊＋珊瑚金額印章（stampAt 對準說出數字那一刻）
    { "type": "proofShot", "t": [7.05, 10.8], "img": "assets/proof1.png",
      "kicker": "7/12 星期日 ・ 後台數據", "stamp": "+$1,593", "stampAt": 9.0 },
    // 兩張並排：x 指定中心（305 / 775），width 440
    { "type": "proofShot", "t": [14.3, 19.1], "img": "assets/proof2.png", "width": 440, "x": 305,
      "top": 230, "pill": "7/13 ・ $892" },
    { "type": "proofShot", "t": [15.4, 19.1], "img": "assets/proof3.png", "width": 440, "x": 775,
      "top": 230, "pill": "7/14 ・ $896" },
    // 工作流故事列：每步 at 對台詞，最後一張自動珊瑚 result 卡
    { "type": "flowRow", "t": [19.45, 24.68], "kicker": "這支影片的工作流", "steps": [
      { "icon": "🎬", "top": "隨手拍", "big": "3 分鐘", "at": 19.6 },
      { "icon": "🤖", "top": "AI", "big": "自動剪輯", "at": 21.65 },
      { "icon": "💰", "top": "現金流", "big": "NT$100,000", "at": 22.95 } ] },
    // CTA 卡：ctaAt 對準說出關鍵字那一刻；hold 停到片尾
    { "type": "ctaCard", "t": [28.6, 33.2], "hold": true, "kicker": "想要同款工作流？",
      "question": "怎麼<accent>用 AI</accent> 剪片", "questionAt": 29.65,
      "keyword": "EDIT", "ctaAt": 32.2, "badge": "📩 早鳥邀請直接發給你" }
  ]
}
```

要點：
- 字幕不用管深淺——句子落在視窗內自動變 on-light（紙上深字、抬到卡頂上方）。
- 視窗外的全螢幕段照用 `stamp`／`glassCard`／`statCounter`（top≈1330）＋ `zooms` 推近。
- 金額印章固定釘截圖右上角（不會撞字幕帶）；日期膠囊固定卡底置中。
- 口誤剪不掉時，字幕直接寫正確版——字幕是修正層。
