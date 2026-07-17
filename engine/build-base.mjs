/*
 * build-base.mjs — 底片工廠：降噪 → 剪空白 → 臉部推近 → B-roll → work/base.mp4
 * Copyright (c) 2026 Fyn Chang. All rights reserved.
 *
 * 用法：node engine/build-base.mjs <專案資料夾>
 *
 * script.json 讀取欄位：
 *   source           來源影片
 *   keep             [[s,e],...] 來源時間軸要保留的區間（省略 = 全留）
 *   audio.denoise    true → afftdn 降噪（若 assets/denoise.rnnn 存在改用 arnndn）
 *   zooms            [{t:[a,b], amount:1.12, cx:540, cy:860}, ...]（成品時間軸）
 *   broll            [{src, t:[a,b], mode:"fullscreen|letterbox|top", in:秒, cropY, feather, audio:"keep|mix|replace"}]
 *                    （成品時間軸；in＝素材起點；mode:"top"＝上 1/3 副畫面、下 2/3 保留主影片，
 *                     cropY＝素材縮放到 1080 寬後帶狀裁切的起始 y（預設置中），
 *                     feather＝下緣羽化漸變高度 px（預設 90，無分割線、自然融接））
 *
 * 產出：work/base.mp4（1080×1920@30 高畫質底片）、work/transcript-final.json（時間已 remap）
 *
 * 實戰鐵律（都是踩過的雷）：
 *   - overlay/crop 不用 eval=frame（慢 30 倍）；zoom 用 zoompan、時間用 on/30
 *   - filter 運算式含逗號要整段用單引號包住
 *   - -loop 1 輸入必配 -shortest
 *   - 解碼加 -hwaccel videotoolbox
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ffmpegPath, run, ensureDir, makeRemapper, probeDuration } from "./util.mjs";

const projDir = process.argv[2];
if (!projDir) { console.error("用法：node engine/build-base.mjs <專案資料夾>"); process.exit(1); }

const script = JSON.parse(readFileSync(path.join(projDir, "script.json"), "utf8"));
const src = path.resolve(projDir, script.source);
const work = ensureDir(path.join(projDir, "work"));
const FF = ffmpegPath();
const FPS = script.fps || 30;
const W = script.width || 1080, H = script.height || 1920;

const srcDur = probeDuration(src);
const keep = (script.keep && script.keep.length ? script.keep : [[0, srcDur]])
  .map(([s, e]) => [Math.max(0, s), Math.min(e, srcDur)]);
const remap = makeRemapper(keep);
const outDur = remap.totalOut;

/* ---------- remap 逐字稿到成品時間軸（給寫字幕用） ---------- */
const trPath = path.join(work, "transcript.json");
if (existsSync(trPath)) {
  const tr = JSON.parse(readFileSync(trPath, "utf8"));
  const trF = tr
    .filter(sg => keep.some(([s, e]) => sg.e > s && sg.s < e))
    .map(sg => ({ s: +remap.toFinal(sg.s).toFixed(2), e: +remap.toFinal(sg.e).toFixed(2), text: sg.text }));
  writeFileSync(path.join(work, "transcript-final.json"), JSON.stringify(trF, null, 2));
}

/* ---------- filtergraph：trim 段落 + concat ---------- */
const parts = [];
const fc = [];
keep.forEach(([s, e], i) => {
  fc.push(`[0:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS,fps=${FPS}[v${i}]`);
  fc.push(`[0:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`);
  parts.push(`[v${i}][a${i}]`);
});
fc.push(`${parts.join("")}concat=n=${keep.length}:v=1:a=1[vcut][acut]`);

/* ---------- 音訊：降噪 ---------- */
let aLabel = "acut";
if (script.audio && script.audio.denoise) {
  const os = await import("node:os");
  const candidates = [
    path.resolve(projDir, "assets/denoise.rnnn"),
    path.join(os.homedir(), ".cache/weini/models/cb.rnnn"),
  ];
  const rnnn = candidates.find(existsSync);
  if (rnnn) {
    fc.push(`[${aLabel}]arnndn=m='${rnnn}':mix=0.85[aden]`);
  } else {
    fc.push(`[${aLabel}]highpass=f=80,afftdn=nr=12:nf=-28[aden]`);
  }
  aLabel = "aden";
}

/* ---------- 臉部推近（zoompan，成品時間軸）
 * Hyperframes 渲染路徑會在瀏覽器端用 GSAP 做推近（更順），
 * 此時設 WN_SKIP_ZOOM=1 跳過這裡。 ---------- */
let vLabel = "vcut";
const zooms = process.env.WN_SKIP_ZOOM ? [] : (script.zooms || []);
if (zooms.length) {
  // 每個 zoom 做 raised-cosine 進出，z 表達式用輸出幀 on/FPS 當時間
  const T = `(on/${FPS})`;
  const zParts = zooms.map(z => {
    const [a, b] = z.t;
    const amt = (z.amount || 1.12) - 1;
    const ramp = Math.min(0.35, (b - a) / 4);
    // 進出線性斜坡，中段全額
    return `if(between(${T},${a},${b}), 1+${amt.toFixed(4)}*min(1,min((${T}-${a})/${ramp.toFixed(3)},(${b}-${T})/${ramp.toFixed(3)})), 0)`;
  });
  const zExpr = `1+${zParts.map(p => `max(0,(${p})-1)`).join("+")}`;
  const cx = zooms[0].cx !== undefined ? zooms[0].cx : W / 2;
  const cy = zooms[0].cy !== undefined ? zooms[0].cy : H * 0.45;
  fc.push(
    `[${vLabel}]scale=${W}:${H},zoompan=z='${zExpr}'` +
    `:x='${cx}-(${cx}/zoom)':y='${cy}-(${cy}/zoom)'` +
    `:d=1:fps=${FPS}:s=${W}x${H}[vzoom]`
  );
  vLabel = "vzoom";
} else {
  fc.push(`[${vLabel}]scale=${W}:${H}[vzoom]`);
  vLabel = "vzoom";
}

/* ---------- B-roll（成品時間軸疊上去；audio: keep=保留口播） ---------- */
const brolls = script.broll || [];
const inputs = ["-hwaccel", "videotoolbox", "-i", src];
brolls.forEach((b, i) => { inputs.push("-i", path.resolve(projDir, b.src)); });
// mode:"top" 的羽化 alpha 遮罩（lavfi 灰階漸層，一支 top 帶一個輸入）
const maskIdx = {};
brolls.forEach((b, i) => {
  if (b.mode !== "top") return;
  const bandH = b.height || Math.round(H / 3);
  const [a, e] = b.t;
  maskIdx[i] = 1 + brolls.length + Object.keys(maskIdx).length;
  inputs.push("-f", "lavfi", "-i", `color=white:s=${W}x${bandH}:r=${FPS}:d=${(e - a + 1).toFixed(2)}`);
});
brolls.forEach((b, i) => {
  const idx = i + 1;
  const [a, e] = b.t;
  const scaled = `b${i}s`;
  const inPt = b.in ? `trim=start=${b.in},` : "";
  if (b.mode === "letterbox") {
    fc.push(`[${idx}:v]${inPt}scale=${W}:-2,fps=${FPS},setpts=PTS-STARTPTS+${a}/TB,` +
      `pad=${W}:${H}:0:(oh-ih)/2:black[${scaled}]`);
  } else if (b.mode === "top") {
    // 上 1/3 副畫面：下緣羽化漸變融入主影片（無分割線）
    const bandH = b.height || Math.round(H / 3);
    const feather = b.feather != null ? b.feather : 90;
    fc.push(`[${idx}:v]${inPt}scale=${W}:-2,` +
      `crop=${W}:${bandH}:0:'${b.cropY != null ? b.cropY : `(ih-${bandH})/2`}',` +
      `fps=${FPS},setpts=PTS-STARTPTS+${a}/TB[${scaled}]`);
    fc.push(`[${maskIdx[i]}:v]format=gray,` +
      `geq=lum='if(lt(Y,${bandH - feather}),255,255*(${bandH}-Y)/${feather})'[b${i}m]`);
    fc.push(`[${scaled}][b${i}m]alphamerge[b${i}a]`);
    const out = `vb${i}`;
    fc.push(`[${vLabel}][b${i}a]overlay=0:0:enable='between(t,${a},${e})'[${out}]`);
    vLabel = out;
    if (b.audio === "mix") {
      fc.push(`[${idx}:a]adelay=${Math.round(a * 1000)}|${Math.round(a * 1000)},volume=0.5[ba${i}]`);
      fc.push(`[${aLabel}][ba${i}]amix=inputs=2:duration=first:normalize=0[am${i}]`);
      aLabel = `am${i}`;
    }
    return;
  } else {
    fc.push(`[${idx}:v]${inPt}scale=${W}:${H}:force_original_aspect_ratio=increase,` +
      `crop=${W}:${H},fps=${FPS},setpts=PTS-STARTPTS+${a}/TB[${scaled}]`);
  }
  const out = `vb${i}`;
  fc.push(`[${vLabel}][${scaled}]overlay=0:0:enable='between(t,${a},${e})'[${out}]`);
  vLabel = out;
  if (b.audio === "mix") {
    fc.push(`[${idx}:a]adelay=${Math.round(a * 1000)}|${Math.round(a * 1000)},volume=0.5[ba${i}]`);
    fc.push(`[${aLabel}][ba${i}]amix=inputs=2:duration=first:normalize=0[am${i}]`);
    aLabel = `am${i}`;
  }
});

const graph = fc.join(";\n");
writeFileSync(path.join(work, "base-filter.txt"), graph);

run(FF, [
  "-y", ...inputs,
  "-filter_complex", graph,
  "-map", `[${vLabel}]`, "-map", `[${aLabel}]`,
  "-c:v", "libx264", "-preset", "medium", "-crf", "18",
  "-c:a", "aac", "-b:a", "192k",
  "-movflags", "+faststart", "-shortest",
  path.join(work, "base.mp4"),
]);

console.log(`\n✅ 底片完成：work/base.mp4（${outDur.toFixed(1)}s, ${W}x${H}@${FPS}）`);
if (existsSync(path.join(work, "transcript-final.json")))
  console.log("✅ 已輸出 remap 後逐字稿：work/transcript-final.json（照這個寫 lines）");
