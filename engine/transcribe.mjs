/*
 * transcribe.mjs — 逐字稿：whisper.cpp 轉錄 + 靜音偵測
 * Copyright (c) 2026 Fyn Chang. All rights reserved.
 *
 * 用法：node engine/transcribe.mjs <專案資料夾> [--lang zh] [--model <path>]
 * 產出：
 *   work/transcript.json  — 段落級逐字稿（來源時間軸）
 *   work/silences.json    — ≥0.6s 的靜音區間（來源時間軸）
 *
 * 注意（實測經驗）：whisper.cpp 的逐 token 時間戳會量化成 2 秒塊，
 * 不能直接當字幕時間用。精準對時要靠「SRT 段落錨點 + silences.json 靜音邊界」。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { ffmpegPath, whisperPath, run, runCapture, ensureDir, probeDuration } from "./util.mjs";

const projDir = process.argv[2];
if (!projDir) { console.error("用法：node engine/transcribe.mjs <專案資料夾>"); process.exit(1); }

const args = process.argv.slice(3);
const getArg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const lang = getArg("--lang", "zh");
const model = getArg("--model",
  process.env.WN_WHISPER_MODEL ||
  path.join(os.homedir(), ".cache/weini/models/ggml-medium.bin"));

const script = JSON.parse(readFileSync(path.join(projDir, "script.json"), "utf8"));
const src = path.resolve(projDir, script.source);
const work = ensureDir(path.join(projDir, "work"));
const FF = ffmpegPath();

/* ---------- 1. 抽 16k 單聲道 wav ---------- */
const wav = path.join(work, "audio16k.wav");
run(FF, ["-y", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", "16000", wav]);

/* ---------- 2. whisper 轉錄（SRT 段落） ---------- */
if (!existsSync(model)) {
  console.error(`找不到 whisper 模型：${model}\n請執行安裝步驟或設 WN_WHISPER_MODEL`);
  process.exit(1);
}
const srtBase = path.join(work, "whisper");
run(whisperPath(), ["-m", model, "-l", lang, "-f", wav, "-osrt", "-of", srtBase]);

/* ---------- 3. SRT → transcript.json ---------- */
const srt = readFileSync(srtBase + ".srt", "utf8");
const segs = [];
const re = /(\d+)\s+(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*\n([\s\S]*?)(?=\n\s*\n|\s*$)/g;
let m;
while ((m = re.exec(srt))) {
  const s = +m[2] * 3600 + +m[3] * 60 + +m[4] + +m[5] / 1000;
  const e = +m[6] * 3600 + +m[7] * 60 + +m[8] + +m[9] / 1000;
  const text = m[10].trim().replace(/\n/g, " ");
  if (text) segs.push({ s: +s.toFixed(2), e: +e.toFixed(2), text });
}
writeFileSync(path.join(work, "transcript.json"), JSON.stringify(segs, null, 2));

/* ---------- 4. 靜音偵測（剪空白的依據）
 * silencedetect 的結果印在 stderr，用 spawnSync 抓。 ---------- */
const { spawnSync } = await import("node:child_process");
const det = spawnSync(FF, ["-i", src, "-af", "silencedetect=noise=-30dB:d=0.6", "-f", "null", "-"],
  { maxBuffer: 1024 * 1024 * 64 });
const silLog = det.stderr ? det.stderr.toString() : "";
const silences = [];
const sRe = /silence_start:\s*([\d.]+)[\s\S]*?silence_end:\s*([\d.]+)/g;
let sm;
while ((sm = sRe.exec(silLog))) silences.push({ s: +(+sm[1]).toFixed(2), e: +(+sm[2]).toFixed(2) });
writeFileSync(path.join(work, "silences.json"), JSON.stringify(silences, null, 2));

const dur = probeDuration(src);
console.log(`\n✅ 逐字稿完成：${segs.length} 段（素材 ${dur.toFixed(1)}s）`);
console.log(`✅ 靜音區間：${silences.length} 段 → work/silences.json`);
console.log("下一步：閱讀 work/transcript.json，決定 keep 剪輯區間與字幕文案。");
