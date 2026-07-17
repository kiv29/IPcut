# 紙感襯線 Paper Serif  `paper-serif`

![preview](preview.mp4)

**長相**：米白紙紋底 #F5F1E8＋大襯線標題＋珊瑚 #C9694A＋漂浮白卡＋像素小獸＋文件/終端機卡。溫暖、高質感、像出版品。

**什麼時候用**：品牌故事、產品/工具介紹、想要溫暖高級感（尤其 AI/科技題材配像素小獸）。

**設計 tokens**：主色 珊瑚 #C9694A／米白卡 #FFFDF8／襯線 Noto Serif TC；hl 珊瑚。

**Hero 動態圖卡**：hero MG（NOW SHOWING 牌、襯線大標、文件掃描卡、模型切換卡、像素小獸）在 _hero/hero-playbook.html 的 #s2 段。

## 怎麼用
在專案的 `script.json` 加一行：
```json
{ "style": "paper-serif", ... }
```
或直接跟 AI 說「用紙感襯線風格剪這支」。引擎會自動把 `tokens.css` 套到字幕與動態圖卡。
