# Remote Editor Kit ✨ 「為你剪片」AI 剪輯系統

> for Claude Code ‧ by Fyn / 奇蹟研究所 Miracle Academy

> 把原始口播影片丟給 Claude，它就幫你剪好：去空白廢話、繁中＋英文雙語字幕、
> 液態玻璃動態圖卡、臉部推近、B-roll、降噪、配樂、匯出。
> 不會剪片、不會寫程式，也能產出和 Fyn 一樣的成品。

## 你會得到什麼

- 🎬 **自動粗剪**：靜音偵測剪掉空白、廢話、NG；自動挑最強的 hook 開場
- 📝 **雙語字幕**：繁中白字＋<b style="color:#F4C430">金色關鍵字</b>＋黃色貼片字，英文是「理解後翻譯」不是機翻，永遠不擋臉
- 💎 **液態玻璃動態圖卡**：玻璃卡、金色跳動數字、印章貼片、名人頭像牌、發光框、sparkles，全部 pop 進場＋懸浮呼吸
- 🔍 **臉部推近**：金句時刻自動 punch-in
- 🎞️ **B-roll**：自備素材直接疊；有 Higgsfield 帳號可以讓 Claude 幫你生成
- 🎙️ **降噪**：一鍵去背景噪音
- 🎵 **配樂**：自動 ducking，人聲永遠是主角
- 📤 **一鍵匯出**：高畫質版＋上傳壓縮版

## 快速開始（新手看這裡）

1. 裝好 **Claude Code** 和 **Google Chrome**
2. 用 Claude Code 打開這個資料夾
3. 對 Claude 說：**「請幫我安裝這個影片剪輯系統需要的所有環境」**
   （Claude 會執行內建安裝器 `setup.sh`，自動下載安裝所有需要的工具並逐項驗證）
4. 把你的影片丟進來，說：**「幫我剪這支影片」**

就這樣。Claude 會一步一步帶你走完，每個階段都會給你看畫面確認。

## 這套系統怎麼運作（給好奇的人）

```
你的原始影片
   │
   ├─ 1. transcribe   whisper 逐字稿 + 靜音偵測
   ├─ 2. Claude 決策   剪哪裡、字幕怎麼寫、圖卡放哪（寫進 script.json）
   ├─ 3. base          剪空白 + 降噪 + B-roll → 底片
   ├─ 4. comps         由 script.json 產生 Hyperframes 合成（字幕＋圖卡＋臉部推近）
   ├─ 5. hf render     Hyperframes 渲染（HeyGen 開源引擎）
   └─ 6. compose       配樂 ducking → out/final.mp4 + out/reel_web.mp4
```

- `script.json` 是唯一的剪輯決策檔——改它就能重剪，全部可重現
- 渲染引擎預設用 **Hyperframes**（HeyGen 的免費開源引擎，安裝時自動裝好）；
  另內建一套**自研備援渲染器**（`render --builtin`），Hyperframes 壞了照樣能出片
- 品牌設計系統在 `templates/design-tokens.css`——改一個檔案就能換成你自己的品牌

## 資料夾結構

```
remote-editor-kit/
├── README.md                ← 你在這
├── .claude/skills/          ← 系統大腦（Claude 自動讀）
│   ├── weini-editor/        ← 剪輯工作流程
│   └── weini-setup/         ← 一句話安裝器
├── engine/                  ← 渲染引擎（Node）
├── templates/               ← 設計系統 + 疊加層模板 + 字型
├── projects/                ← 你的每支影片一個資料夾
│   └── _example/            ← 完整註解範例
└── docs/                    ← 教學文件
```

## 授權

本系統（引擎、模板、設計系統、文件）© 2026 Fyn Chang，授權給奇蹟研究所（Miracle Academy）、
奇蹟 CEO（Miracle CEO）、遊牧一家（RemoteFAM）成員及直接購買者使用，
詳見 `LICENSE.md`；第三方開源元件見 `CREDITS.md`。
配樂請使用你自己有授權的音樂。
