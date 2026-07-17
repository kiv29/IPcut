# 編輯黑紅 Editorial Red  `editorial-red`

![preview](preview.mp4)

**長相**：純黑細紋理實色底＋紅色 #E5484D 重點框＋白色圖表流程（倒三角、行事曆、平台藥丸）＋單字大字幕＋動態模糊 whip 轉場。資訊密度高、很「乾貨教學」。

**什麼時候用**：框架/清單/系統教學（把知識拆成圖解），想要專業、鋒利、高資訊感。

**設計 tokens**：主色 紅 #E5484D／白；黑底 #101114；hl＝白字紅框；英文小字大寫加寬。

**Hero 動態圖卡**：hero MG（倒三角漏斗圖、行事曆、平台藥丸、速度 stamp、whip 轉場）在 _hero/hero-playbook.html 的 #s1 段。

## 怎麼用
在專案的 `script.json` 加一行：
```json
{ "style": "editorial-red", ... }
```
或直接跟 AI 說「用編輯黑紅風格剪這支」。引擎會自動把 `tokens.css` 套到字幕與動態圖卡。
