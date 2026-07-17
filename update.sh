#!/bin/bash
# ============================================================
# Remote Editor Kit — 一鍵更新器
# Copyright (c) 2026 Fyn Chang. All rights reserved.
#
# 用法：把 Skool 下載的新版 zip（remote-editor-kit-v*.zip）放到
#       本資料夾或 ~/Downloads，然後執行 bash update.sh
#
# 更新範圍：engine/ templates/ docs/ .claude/skills/ 根文件 setup.sh
# 絕不碰：projects/（你的所有影片專案）、node_modules
# ============================================================
set -u

KIT_DIR="$(cd "$(dirname "$0")" && pwd)"
CUR_VER="$(cat "$KIT_DIR/VERSION" 2>/dev/null || echo "1.0.0")"

echo "🔄 Remote Editor Kit 更新器（目前版本 v$CUR_VER）"

# ---------- 1. 找新版 zip ----------
ZIP=""
for d in "$KIT_DIR" "$HOME/Downloads"; do
  cand="$(ls -t "$d"/remote-editor-kit-v*.zip 2>/dev/null | head -1)"
  if [ -n "$cand" ]; then ZIP="$cand"; break; fi
done
if [ -z "$ZIP" ]; then
  echo "❌ 找不到新版安裝包。"
  echo "   請先到 Skool 社群下載最新的 remote-editor-kit-v*.zip，"
  echo "   放到這個資料夾或「下載項目」，再跑一次 bash update.sh"
  exit 1
fi
echo "📦 找到安裝包：$(basename "$ZIP")"

# ---------- 2. 解壓到暫存 ----------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unzip -q "$ZIP" -d "$TMP"
SRC="$(find "$TMP" -maxdepth 2 -name "VERSION" -exec dirname {} \; | head -1)"
if [ -z "$SRC" ] || [ ! -d "$SRC/engine" ]; then
  echo "❌ 這個 zip 不是有效的 Remote Editor Kit 安裝包"; exit 1
fi
NEW_VER="$(cat "$SRC/VERSION")"

# ---------- 3. 版本比對 ----------
if [ "$NEW_VER" = "$CUR_VER" ]; then
  echo "✅ 你已經是最新版 v$CUR_VER，不用更新。"
  exit 0
fi
echo "⬆️  v$CUR_VER → v$NEW_VER"

# ---------- 4. 備份被更新的部分（保險） ----------
BACKUP="$KIT_DIR/.backup-v$CUR_VER"
rm -rf "$BACKUP"; mkdir -p "$BACKUP"
for item in engine templates docs setup.sh CLAUDE.md DESIGN.md README.md STYLES.md LICENSE.md CREDITS.md; do
  [ -e "$KIT_DIR/$item" ] && cp -R "$KIT_DIR/$item" "$BACKUP/" 2>/dev/null
done
mkdir -p "$BACKUP/.claude"
cp -R "$KIT_DIR/.claude/skills" "$BACKUP/.claude/" 2>/dev/null
echo "🗄  舊版已備份到 .backup-v$CUR_VER/（確認新版沒問題後可刪）"

# ---------- 5. 套用更新（絕不碰 projects/；engine/templates/docs 用合併覆蓋，
#             不整包刪——你自己或其他工具加進去的自訂檔會保留） ----------
for item in engine templates docs; do
  if [ -d "$SRC/$item" ]; then
    mkdir -p "$KIT_DIR/$item"
    cp -R "$SRC/$item/." "$KIT_DIR/$item/"
  fi
done
for item in setup.sh update.sh CLAUDE.md DESIGN.md README.md STYLES.md LICENSE.md CREDITS.md VERSION package.json; do
  if [ -e "$SRC/$item" ]; then
    rm -f "$KIT_DIR/$item"
    cp -R "$SRC/$item" "$KIT_DIR/$item"
  fi
done
# skills：整包換新（成員自訂 skills 不放這裡）
if [ -d "$SRC/.claude/skills" ]; then
  rm -rf "$KIT_DIR/.claude/skills"
  mkdir -p "$KIT_DIR/.claude"
  cp -R "$SRC/.claude/skills" "$KIT_DIR/.claude/skills"
fi
# 範例專案：只新增、不覆蓋成員改過的
if [ -d "$SRC/projects" ]; then
  for p in "$SRC/projects"/*/; do
    name="$(basename "$p")"
    [ -d "$KIT_DIR/projects/$name" ] || cp -R "$p" "$KIT_DIR/projects/$name"
  done
fi

# ---------- 6. 依賴同步 ----------
cd "$KIT_DIR"
npm install --no-fund --no-audit >/dev/null 2>&1 && echo "✅ 依賴已同步" || echo "⚠️  npm install 失敗（跑一次 bash setup.sh 可修）"

echo ""
echo "════════════════════════════════════"
echo "🎉 更新完成：v$CUR_VER → v$NEW_VER"
echo "   你的 projects/ 影片專案完全沒被動。"
echo "   新功能說明看 Skool 的版本公告。"
echo "════════════════════════════════════"
