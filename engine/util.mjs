/*
 * util.mjs — 共用工具（ffmpeg/whisper 路徑偵測、執行、時間換算）
 * Copyright (c) 2026 Fyn Chang. All rights reserved.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

/** 找有 libass 的 ffmpeg（燒字幕/濾鏡都靠它） */
export function ffmpegPath() {
  const candidates = [
    process.env.WN_FFMPEG,
    "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "ffmpeg",
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      execFileSync(c, ["-version"], { stdio: "pipe" });
      return c;
    } catch { /* 試下一個 */ }
  }
  throw new Error("找不到 ffmpeg，請先執行安裝（docs/00-快速安裝.md）");
}

export function ffprobePath() {
  const ff = ffmpegPath();
  const p = path.join(path.dirname(ff), "ffprobe");
  return existsSync(p) ? p : "ffprobe";
}

export function whisperPath() {
  const candidates = [process.env.WN_WHISPER, "/opt/homebrew/bin/whisper-cli", "whisper-cli"].filter(Boolean);
  for (const c of candidates) {
    try { execFileSync(c, ["--help"], { stdio: "pipe" }); return c; } catch { /* next */ }
  }
  throw new Error("找不到 whisper-cli，請先執行安裝（docs/00-快速安裝.md）");
}

export function chromePath() {
  const candidates = [
    process.env.WN_CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error("找不到 Chrome，請安裝 Google Chrome");
}

/** 執行外部指令（同步、直接輸出進度） */
export function run(cmd, args, opts = {}) {
  console.log(`  $ ${path.basename(cmd)} ${args.map(a => (/\s/.test(a) ? `'${a}'` : a)).join(" ").slice(0, 300)}`);
  return execFileSync(cmd, args, { stdio: opts.quiet ? "pipe" : "inherit", maxBuffer: 1024 * 1024 * 64, ...opts });
}

export function runCapture(cmd, args) {
  return execFileSync(cmd, args, { stdio: "pipe", maxBuffer: 1024 * 1024 * 64 }).toString();
}

/** 背景啟動（回傳 child process） */
export function runBg(cmd, args, opts = {}) {
  return spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], ...opts });
}

export function probeDuration(file) {
  const out = runCapture(ffprobePath(), [
    "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file,
  ]);
  return parseFloat(out.trim());
}

export function ensureDir(d) { mkdirSync(d, { recursive: true }); return d; }

/** keep 區段 → 來源秒數映射到成品秒數 */
export function makeRemapper(keep) {
  // keep: [[s0,e0],[s1,e1]...]（來源時間）
  let acc = 0;
  const seg = keep.map(([s, e]) => {
    const o = { s, e, out: acc };
    acc += e - s;
    return o;
  });
  return {
    totalOut: acc,
    toFinal(t) {
      for (const g of seg) {
        if (t < g.s) return g.out;          // 落在被剪掉的區間 → 貼齊下一段開頭
        if (t <= g.e) return g.out + (t - g.s);
      }
      return acc;
    },
  };
}

export function fmt(t) {
  return `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, "0")}`;
}
