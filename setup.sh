#!/bin/bash
# ============================================================
# Remote Editor Kit — 一鍵環境安裝器
# Copyright (c) 2026 Fyn Chang. All rights reserved.
#
# 用法：bash setup.sh
# 特性：可重複執行（已裝的自動跳過）、下載可斷點續傳、每步驗證
# ============================================================
set -u

KIT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODEL_DIR="$HOME/.cache/weini/models"
MODEL_FILE="$MODEL_DIR/ggml-medium.bin"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin"
MODEL_SIZE_MIN=1400000000   # 1.5GB 模型，小於此數字視為下載不完整

OK="✅"; SKIP="⏭️ "; FAIL="❌"
PASS=0; FAILED=0
step() { echo ""; echo "━━━ $1 ━━━"; }
ok()   { echo "$OK $1"; PASS=$((PASS+1)); }
skip() { echo "$SKIP$1（已安裝，跳過）"; PASS=$((PASS+1)); }
die()  { echo "$FAIL $1"; FAILED=$((FAILED+1)); }

echo "🎬 Remote Editor Kit 環境安裝開始"
echo "   （已安裝的項目會自動跳過，整個過程約 5–20 分鐘，模型下載佔大部分）"

# ---------- 0. 系統檢查 ----------
step "0/7 系統檢查"
if [ "$(uname)" != "Darwin" ]; then die "目前只支援 macOS"; exit 1; fi
ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then BREW_PREFIX="/opt/homebrew"; else BREW_PREFIX="/usr/local"; fi
ok "macOS ($ARCH)"

# ---------- 1. Homebrew ----------
step "1/7 Homebrew（套件管理）"
if command -v brew >/dev/null 2>&1; then
  skip "Homebrew $(brew --version | head -1 | awk '{print $2}')"
else
  echo "安裝 Homebrew（過程中系統會要求輸入你的 Mac 密碼，這是正常的）…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$($BREW_PREFIX/bin/brew shellenv)" 2>/dev/null
  if command -v brew >/dev/null 2>&1; then ok "Homebrew 安裝完成"; else die "Homebrew 安裝失敗（請確認網路與密碼）"; fi
fi
# 確保這個 shell 找得到 brew
command -v brew >/dev/null 2>&1 || eval "$($BREW_PREFIX/bin/brew shellenv)" 2>/dev/null

# ---------- 2. Node.js ----------
step "2/7 Node.js（引擎執行）"
if command -v node >/dev/null 2>&1 && [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -ge 20 ]; then
  skip "Node $(node --version)"
else
  brew install node && ok "Node $(node --version) 安裝完成" || die "Node 安裝失敗"
fi

# ---------- 3. FFmpeg（需含 libass 字幕引擎）----------
step "3/7 FFmpeg（影音處理）"
FF_OK=""
for c in "$BREW_PREFIX/opt/ffmpeg-full/bin/ffmpeg" "$BREW_PREFIX/bin/ffmpeg" "$(command -v ffmpeg 2>/dev/null)"; do
  if [ -n "$c" ] && [ -x "$c" ] && "$c" -filters 2>/dev/null | grep -q subtitles; then FF_OK="$c"; break; fi
done
if [ -n "$FF_OK" ]; then
  skip "FFmpeg（$FF_OK，含字幕引擎）"
else
  brew install ffmpeg
  if "$BREW_PREFIX/bin/ffmpeg" -filters 2>/dev/null | grep -q subtitles; then
    ok "FFmpeg 安裝完成（含字幕引擎）"
  else
    die "FFmpeg 安裝後仍缺字幕引擎——請把這個訊息貼給 Claude 處理"
  fi
fi

# ---------- 4. whisper.cpp + 中文模型 ----------
step "4/7 語音辨識（whisper + 中文模型 1.5GB）"
if command -v whisper-cli >/dev/null 2>&1; then
  skip "whisper-cli"
else
  brew install whisper-cpp && ok "whisper-cpp 安裝完成" || die "whisper-cpp 安裝失敗"
fi
mkdir -p "$MODEL_DIR"
NEED_MODEL=1
if [ -f "$MODEL_FILE" ]; then
  SIZE=$(stat -f%z "$MODEL_FILE" 2>/dev/null || echo 0)
  if [ "$SIZE" -ge "$MODEL_SIZE_MIN" ]; then skip "中文模型（$((SIZE/1048576)) MB）"; NEED_MODEL=0; fi
fi
if [ "$NEED_MODEL" = "1" ]; then
  echo "下載中文辨識模型（1.5GB，依網速約 3–15 分鐘，可中斷後重跑續傳）…"
  curl -L -C - --progress-bar -o "$MODEL_FILE" "$MODEL_URL"
  SIZE=$(stat -f%z "$MODEL_FILE" 2>/dev/null || echo 0)
  if [ "$SIZE" -ge "$MODEL_SIZE_MIN" ]; then ok "中文模型下載完成"; else die "模型下載不完整，請重跑 bash setup.sh 續傳"; fi
fi
# 降噪模型（RNN，人聲更乾淨；300KB）
RNNN_FILE="$MODEL_DIR/cb.rnnn"
if [ -f "$RNNN_FILE" ] && [ "$(stat -f%z "$RNNN_FILE" 2>/dev/null || echo 0)" -ge 100000 ]; then
  skip "降噪模型"
else
  curl -fsSL -o "$RNNN_FILE" "https://raw.githubusercontent.com/GregorR/rnnoise-models/master/conjoined-burgers-2018-08-28/cb.rnnn" \
    && ok "降噪模型下載完成" || echo "⚠️  降噪模型下載失敗（不影響使用，會改用內建降噪）"
fi

# ---------- 5. Google Chrome ----------
step "5/7 Google Chrome（渲染引擎的瀏覽器）"
if [ -d "/Applications/Google Chrome.app" ]; then
  skip "Google Chrome"
else
  echo "安裝 Google Chrome（可能會要求輸入 Mac 密碼）…"
  brew install --cask google-chrome && ok "Chrome 安裝完成" || die "Chrome 安裝失敗——也可以手動到 google.com/chrome 下載"
fi

# ---------- 5.5 personcut（人物去背，卡片收合預設風格的核心） ----------
step "5.5/7 人物去背引擎（Apple Vision，本地免費）"
PC_BIN="$HOME/.cache/weini/bin/personcut"
if [ -x "$PC_BIN" ]; then
  skip "personcut"
else
  if xcode-select -p >/dev/null 2>&1; then :; else
    echo "安裝 Xcode Command Line Tools（跳出視窗請按「安裝」）…"
    xcode-select --install 2>/dev/null || true
    until xcode-select -p >/dev/null 2>&1; do sleep 10; done
  fi
  mkdir -p "$(dirname "$PC_BIN")"
  if xcrun swiftc -O "$KIT_DIR/engine/personcut.swift" -o "$PC_BIN" 2>/dev/null; then
    ok "personcut 編譯完成（人物去背就緒）"
  else
    die "personcut 編譯失敗——請把這個訊息貼給 Claude 處理（剪片時第一次用到會再自動重試）"
  fi
fi

# ---------- 6. Kit 依賴 + Hyperframes ----------
step "6/7 Kit 依賴 + Hyperframes 渲染引擎"
cd "$KIT_DIR"
if [ -d node_modules/puppeteer-core ]; then
  skip "kit 依賴"
else
  npm install --no-fund --no-audit && ok "kit 依賴安裝完成" || die "npm install 失敗"
fi
HF_VER="$(npx --yes hyperframes --version 2>/dev/null | head -1)"
if [ -n "$HF_VER" ]; then ok "Hyperframes $HF_VER 就緒"; else die "Hyperframes 下載失敗（之後仍可用備援渲染器 --builtin 出片）"; fi
# 官方 Hyperframes 創作 skills（Studio 預覽/進階合成用；失敗不影響剪片）
if [ -f skills-lock.json ] && grep -q hyperframes skills-lock.json 2>/dev/null; then
  skip "Hyperframes 創作 skills"
else
  npx --yes skills add heygen-com/hyperframes --yes >/dev/null 2>&1 \
    && ok "Hyperframes 創作 skills 安裝完成" || echo "⚠️  創作 skills 安裝失敗（不影響剪片功能）"
fi

# ---------- 7. 總驗收 ----------
step "7/7 總驗收"
cd "$KIT_DIR"
node -e "
import('./engine/util.mjs').then(u => {
  console.log('$OK ffmpeg  →', u.ffmpegPath());
  console.log('$OK whisper →', u.whisperPath());
  console.log('$OK chrome  →', u.chromePath());
}).catch(e => { console.log('$FAIL 驗收失敗：' + e.message); process.exit(1); })
" || FAILED=$((FAILED+1))

echo ""
echo "════════════════════════════════════"
if [ "$FAILED" = "0" ]; then
  echo "🎉 全部安裝完成！環境就緒。"
  echo ""
  echo "下一步：把你的影片檔丟進來，對 Claude 說："
  echo "「幫我剪這支影片」"
else
  echo "⚠️  有 $FAILED 個項目沒過——把上面的訊息貼給 Claude，它會幫你處理。"
  echo "   （setup.sh 可以放心重跑，已完成的會自動跳過）"
fi
echo "════════════════════════════════════"
exit $FAILED
