# 出處與致謝 Credits

Remote Editor Kit 是 Fyn Chang 的原創作品（工作流程、引擎腳本、設計系統、
模板、skills、文件皆為原創），並站在以下優秀開源專案的肩膀上：

## 渲染引擎（使用者安裝時自動裝好，本包未內附其原始碼）

- **Hyperframes** — HTML 原生影片合成引擎
  © HeyGen ‧ 開源（Apache License 2.0）
  https://hyperframes.heygen.com ‧ https://github.com/heygen-com/hyperframes
  本產品透過 `npx hyperframes` 由使用者自行安裝使用，未修改、未內附其原始碼。

## 其他依賴（使用者自行安裝）

- **whisper.cpp**（語音轉文字）— MIT License
- **FFmpeg**（影音處理）— LGPL/GPL
- **GSAP**（合成內動畫，經 CDN 載入）— 依 GSAP 標準授權免費使用（含商用）
- **Node.js / Google Chrome** — 各依其原始授權

## 內附字型

- **Noto Sans TC / Noto Serif TC**（思源黑體/宋體）、**Montserrat**
  SIL Open Font License 1.1 — 詳見 `templates/fonts/字型授權-OFL.txt`

## 本產品的原創部分（© 2026 Fyn Chang）

- `engine/` 全部（含自研備援渲染器 render-overlay.mjs 與定格動畫引擎 templates/lib/timeline.js）
- `templates/` 設計系統與元件庫、`.claude/skills/`、`docs/`、範例專案
