# B-roll 與 Higgsfield 生成

## 自備 B-roll

1. 把素材放進 `projects/<專案>/assets/`
2. 跟 Claude 說「25 到 28 秒放 assets/broll.mp4」
3. 兩種模式：
   - **fullscreen**（預設）：滿版蓋住畫面，口播聲音照常
   - **letterbox**：上下黑邊，適合橫式素材
4. B-roll 蓋住臉的期間，字幕會自動抬高到畫面中上（`lift`），不會被吃掉

## 用 Higgsfield 生成 B-roll（選配）

如果你有 Higgsfield 帳號：

1. 在 Claude 的設定把 **Higgsfield MCP** 連接起來（claude.ai → Settings → Connectors）
2. 跟 Claude 說：「幫我生成一段『在咖啡廳用筆電工作』的 B-roll」
3. Claude 會：
   - 從你的台詞挑出有畫面感的時刻
   - 列出要生成的 prompt 跟秒數**先給你確認**（生成會用你的 Higgsfield 額度）
   - 生成 → 下載到 assets/ → 排進影片
4. 有 Soul 角色的話跟 Claude 說你的角色名稱，生成的人物就會是「你」

沒有 Higgsfield 也完全沒關係——系統所有其他功能照常運作。
