/*
 * gen-cutouts.mjs — 卡片收合的人物去背＋逐幀頭部追蹤（card-takeover 風格核心）
 * Copyright (c) 2026 Fyn Chang. All rights reserved.
 *
 * 用法：node engine/gen-cutouts.mjs <專案資料夾>
 * 前置：work/base.mp4 已存在（build-base 產出）
 *
 * script.json 讀取欄位：
 *   windows   [{ "t":[開,關], "hold":true? }, ...]（成品時間軸；hold=停在卡片模式到片尾）
 *
 * 產出（都在 work/）：
 *   cut_w1.webm ...   人物去背 alpha 影片（VP9 yuva420p，含 0.2s 前導）
 *   track.json        { windows:[{key,open,close,start,dur,x,hold}], track:{w1:[[t,y],...]} }
 *
 * 原理（fyn-weekend-08 / fyn-cashflow-09 正典）：
 *   抽幀 → Apple Vision 人物分割（personcut，本地免費）→ alpha webm；
 *   同時掃 alpha 每 3 幀的頭頂列＋頭部質心 → 平滑 y 軌跡把頭頂釘在 y≈1020
 *   （on-light 字幕帶正下方）、質心對齊 x=540。她晃動引擎自動反向補償。
 */
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ffmpegPath, run, ensureDir, probeDuration } from "./util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projDir = path.resolve(process.argv[2] || ".");
const script = JSON.parse(readFileSync(path.join(projDir, "script.json"), "utf8"));
const windows = script.windows || [];
if (!windows.length) { console.log("script.json 沒有 windows — 跳過去背（純全螢幕版型）"); process.exit(0); }

const base = path.join(projDir, "work/base.mp4");
if (!existsSync(base)) { console.error("缺 work/base.mp4 — 先跑 base"); process.exit(1); }
const FF = ffmpegPath();
const DUR = +probeDuration(base).toFixed(2);
const work = path.join(projDir, "work");

/* ---------- personcut：Apple Vision 人物分割（第一次用時自動編譯） ---------- */
function personcutBin() {
  const cache = path.join(os.homedir(), ".cache/weini/bin");
  const bin = path.join(cache, "personcut");
  const srcSwift = path.join(__dirname, "personcut.swift");
  if (existsSync(bin)) return bin;
  console.log("第一次使用：編譯 personcut（Apple Vision 人物去背，約 10 秒）…");
  mkdirSync(cache, { recursive: true });
  try {
    execFileSync("xcrun", ["swiftc", "-O", srcSwift, "-o", bin], { stdio: "inherit" });
  } catch {
    console.error("編譯失敗 — 需要 Xcode Command Line Tools：xcode-select --install 後重試");
    process.exit(1);
  }
  return bin;
}

/* ---------- 逐窗：抽幀 → 去背 → webm ＋ 頭部掃描 ---------- */
const PRE = 0.2;                 // 前導，卡片開啟瞬間就有人
const SW = 270, SH = 480, SCALE = 4;   // 掃描解析度（1080/270）
const TARGET_HEAD_Y = 1020, TARGET_CX = 540, S = 1.06, STEP = 0.1;

const bin = personcutBin();
const outWindows = [];
const outTrack = {};

windows.forEach((w, idx) => {
  const key = "w" + (idx + 1);
  const open = +w.t[0], close = w.hold ? DUR : Math.min(+w.t[1], DUR);
  const start = Math.max(0, +(open - PRE).toFixed(2));
  const dur = +(Math.min(close + PRE, DUR) - start).toFixed(2);
  console.log(`\n━━━ ${key}：${open}s → ${close}s（去背 ${start}s +${dur}s）━━━`);

  const frDir = path.join(work, "fr_" + key), cutDir = path.join(work, "cut_" + key);
  rmSync(frDir, { recursive: true, force: true }); rmSync(cutDir, { recursive: true, force: true });
  mkdirSync(frDir, { recursive: true }); mkdirSync(cutDir, { recursive: true });

  run(FF, ["-y", "-ss", String(start), "-t", String(dur), "-i", base,
    "-vf", "fps=30", path.join(frDir, "%05d.png")], { quiet: true });
  run(bin, [frDir, cutDir]);
  run(FF, ["-y", "-framerate", "30", "-i", path.join(cutDir, "%05d.png"),
    "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-crf", "33", "-b:v", "0",
    "-cpu-used", "4", "-row-mt", "1", "-threads", "8", "-auto-alt-ref", "0",
    "-metadata:s:v:0", "alpha_mode=1", path.join(work, "cut_" + key + ".webm")], { quiet: true });

  /* 掃 alpha：每 3 幀頭頂列 + 頭部質心（頭頂下 40 列） */
  const r = spawnSync(FF, ["-framerate", "30", "-i", path.join(cutDir, "%05d.png"),
    "-vf", `framestep=3,alphaextract,scale=${SW}:${SH}`, "-f", "rawvideo", "-pix_fmt", "gray", "-"],
    { maxBuffer: 1 << 30 });
  const buf = r.stdout;
  const nf = Math.floor(buf.length / (SW * SH));
  const tops = [], cxs = [];
  let last = 460;
  for (let f = 0; f < nf; f++) {
    const o = f * SW * SH;
    let top = -1;
    for (let y = 0; y < SH && top < 0; y++) {
      const ro = o + y * SW;
      for (let x = 0; x < SW; x++) if (buf[ro + x] > 140) { top = y; break; }
    }
    if (top < 0) top = last / SCALE;
    last = top * SCALE;
    let sx = 0, sn = 0;
    for (let y = top; y < Math.min(SH, top + 40); y++) {
      const ro = o + y * SW;
      for (let x = 0; x < SW; x++) if (buf[ro + x] > 140) { sx += x; sn++; }
    }
    tops.push(top * SCALE); cxs.push(sn ? (sx / sn) * SCALE : SW * SCALE / 2);
  }
  /* x：頭質心中位數對齊 540；y：±3 樣本移動平均，頭頂釘 y1020 */
  const cxSorted = [...cxs].sort((a, b) => a - b);
  const cx = cxSorted[Math.floor(cxSorted.length / 2)] || 540;
  const dx = Math.round(TARGET_CX - S * cx);
  const sm = tops.map((_, i) => {
    let s2 = 0, c = 0;
    for (let j = Math.max(0, i - 3); j <= Math.min(tops.length - 1, i + 3); j++) { s2 += tops[j]; c++; }
    return s2 / c;
  });
  outTrack[key] = sm.map((h, i) => [+(i * STEP).toFixed(1), Math.round(TARGET_HEAD_Y - S * h)]);
  outWindows.push({ key, open, close, start, dur, x: dx, hold: !!w.hold });
  console.log(`${key}: ${nf} 樣本, x=${dx}, y ${Math.min(...outTrack[key].map(k => k[1]))}→${Math.max(...outTrack[key].map(k => k[1]))}`);

  rmSync(frDir, { recursive: true, force: true });
  rmSync(cutDir, { recursive: true, force: true });
});

writeFileSync(path.join(work, "track.json"), JSON.stringify({ scale: S, windows: outWindows, track: outTrack }));
console.log(`\n✅ 去背＋追蹤完成：work/cut_w*.webm + work/track.json（${windows.length} 個卡片視窗）`);
