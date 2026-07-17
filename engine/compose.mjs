/*
 * compose.mjs — 成品合成：底片 + 疊加層 + 配樂 → out/final.mp4 + out/reel_web.mp4
 * Copyright (c) 2026 Fyn Chang. All rights reserved.
 *
 * 用法：node engine/compose.mjs <專案資料夾>
 *
 * script.json 讀取欄位：
 *   audio.music     配樂檔（選填）
 *   audio.musicDb   配樂音量 dB（預設 -22，人聲永遠是主角）
 *   audio.duck      true（預設）→ sidechain 自動閃避：有人聲時配樂再壓低
 *   audio.sfx       特效音 [{src, at, db}]（選填）：src 先找專案內、再找 kit 的
 *                   templates/assets/；at＝成品秒數；db 預設 0
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ffmpegPath, run, ensureDir, probeDuration } from "./util.mjs";

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const projDir = process.argv[2];
if (!projDir) { console.error("用法：node engine/compose.mjs <專案資料夾>"); process.exit(1); }

const script = JSON.parse(readFileSync(path.join(projDir, "script.json"), "utf8"));
const work = path.join(projDir, "work");
const out = ensureDir(path.join(projDir, "out"));
const FF = ffmpegPath();

/* 兩種來源：
 * 1) Hyperframes 路徑：work/render.mp4（畫面已含字幕圖卡與人聲，只差配樂）
 * 2) 自研引擎路徑：work/base.mp4 + work/overlay.mov（這裡疊） */
const hfRender = path.join(work, "render.mp4");
const base = path.join(work, "base.mp4");
const overlay = path.join(work, "overlay.mov");
const useHF = existsSync(hfRender) &&
  (!existsSync(overlay) || statSync(hfRender).mtimeMs > statSync(overlay).mtimeMs);
if (!useHF) {
  if (!existsSync(base)) { console.error("缺 work/base.mp4 — 先跑 build-base"); process.exit(1); }
  if (!existsSync(overlay)) { console.error("缺 work/overlay.mov — 先跑 render-overlay"); process.exit(1); }
}

const music = script.audio && script.audio.music ? path.resolve(projDir, script.audio.music) : null;
const musicDb = (script.audio && script.audio.musicDb) ?? -22;
const duck = (script.audio && script.audio.duck) !== false;
// 特效音：src 先找專案內、再退回 kit 的 templates/assets/（內建音效庫）
const sfx = (script.audio && script.audio.sfx || []).map((s) => {
  const local = path.resolve(projDir, s.src);
  const kitAsset = path.join(KIT, "templates/assets", path.basename(s.src));
  const file = existsSync(local) ? local : kitAsset;
  if (!existsSync(file)) { console.warn(`⚠️ 特效音不存在，略過：${s.src}`); return null; }
  return { file, at: +s.at || 0, db: s.db ?? 0 };
}).filter(Boolean);

const inputs = useHF
  ? ["-hwaccel", "videotoolbox", "-i", hfRender]
  : ["-hwaccel", "videotoolbox", "-i", base, "-i", overlay];
const fc = useHF
  ? [`[0:v]copy[vout]`]
  : [`[0:v][1:v]overlay=0:0:format=auto[vout]`];
let aMap = "0:a";
let nextIdx = useHF ? 1 : 2;

// 每顆特效音：延遲到 at 秒＋音量
const sfxLabels = [];
for (const s of sfx) {
  inputs.push("-i", s.file);
  const ms = Math.round(s.at * 1000);
  const lb = `sfx${sfxLabels.length}`;
  fc.push(`[${nextIdx}:a]aresample=48000,adelay=${ms}|${ms},volume=${s.db}dB[${lb}]`);
  sfxLabels.push(`[${lb}]`);
  nextIdx++;
}

if (music) {
  const musicIdx = nextIdx;
  inputs.push("-stream_loop", "-1", "-i", music);
  if (duck) {
    fc.push(
      `[${musicIdx}:a]volume=${musicDb}dB[bgm]`,
      `[0:a]asplit=2[voice][sc]`,
      `[bgm][sc]sidechaincompress=threshold=0.03:ratio=8:attack=80:release=400[bgmd]`,
      `[voice][bgmd]${sfxLabels.join("")}amix=inputs=${2 + sfxLabels.length}:duration=first:normalize=0,alimiter=limit=0.95[aout]`
    );
  } else {
    fc.push(
      `[${musicIdx}:a]volume=${musicDb}dB[bgm]`,
      `[0:a][bgm]${sfxLabels.join("")}amix=inputs=${2 + sfxLabels.length}:duration=first:normalize=0,alimiter=limit=0.95[aout]`
    );
  }
  aMap = "[aout]";
} else if (sfxLabels.length) {
  fc.push(`[0:a]${sfxLabels.join("")}amix=inputs=${1 + sfxLabels.length}:duration=first:normalize=0,alimiter=limit=0.95[aout]`);
  aMap = "[aout]";
}

const finalPath = path.join(out, "final.mp4");
run(FF, [
  "-y", ...inputs,
  "-filter_complex", fc.join(";\n"),
  "-map", "[vout]", "-map", aMap,
  "-c:v", "libx264", "-preset", "medium", "-crf", "18",
  "-c:a", "aac", "-b:a", "192k",
  "-movflags", "+faststart", "-shortest",
  finalPath,
]);

/* 上傳版（IG/TikTok 檔案小） */
const webPath = path.join(out, "reel_web.mp4");
run(FF, [
  "-y", "-hwaccel", "videotoolbox", "-i", finalPath,
  "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-maxrate", "10M", "-bufsize", "16M",
  "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
  webPath,
]);

console.log(`\n✅ 成品：out/final.mp4（${probeDuration(finalPath).toFixed(1)}s）`);
console.log(`✅ 上傳版：out/reel_web.mp4`);
