/*
 * run.mjs — Remote Editor Kit 總指揮
 * Copyright (c) 2026 Fyn Chang. All rights reserved.
 *
 * 用法：
 *   node engine/run.mjs <專案資料夾> transcribe          # 1. 逐字稿＋靜音偵測
 *   node engine/run.mjs <專案資料夾> render              # 2. 底片→字幕圖卡→配樂 全跑（預設 Hyperframes 渲染）
 *   node engine/run.mjs <專案資料夾> render --builtin    # 同上，改用內建自研渲染器（不依賴 Hyperframes）
 *   分步：base / comps / hfrender / overlay / compose
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const builtin = argv.includes("--builtin");
const [proj, step = "render"] = argv.filter((a) => !a.startsWith("--"));
if (!proj) {
  console.error("用法：node engine/run.mjs <專案資料夾> [transcribe|render|base|cutouts|comps|hfrender|overlay|compose] [--builtin]");
  process.exit(1);
}
const projAbs = path.resolve(proj);

function node(file, env = {}) {
  console.log(`\n━━━ ${file.replace(".mjs", "")} ━━━`);
  execFileSync(process.execPath, [path.join(__dirname, file), projAbs],
    { stdio: "inherit", env: { ...process.env, ...env } });
}

function hyperframesRender() {
  console.log(`\n━━━ hyperframes render ━━━`);
  const hf = path.join(projAbs, "hf");
  if (!existsSync(hf)) { console.error("缺 hf/ — 先跑 comps"); process.exit(1); }
  execFileSync("npx", ["hyperframes", "lint"], { stdio: "inherit", cwd: hf });
  execFileSync("npx", ["hyperframes", "render", "--quality", "standard",
    "--output", path.join(projAbs, "work/render.mp4")], { stdio: "inherit", cwd: hf });
}

// stills 可帶額外時間點參數：node run.mjs <proj> stills 2.5 8 14
function stills() {
  console.log(`\n━━━ gen-stills（靜態審核圖卡，不整支 render）━━━`);
  const times = argv.filter((a) => !a.startsWith("--") && !Number.isNaN(Number(a)) && a !== proj);
  execFileSync(process.execPath, [path.join(__dirname, "gen-stills.mjs"), projAbs, ...times],
    { stdio: "inherit", env: process.env });
}

const PIPE = {
  transcribe: () => node("transcribe.mjs"),
  base: () => node("build-base.mjs", builtin ? {} : { WN_SKIP_ZOOM: "1" }),
  cutouts: () => node("gen-cutouts.mjs"),
  comps: () => node("gen-comps.mjs"),
  stills,
  hfrender: hyperframesRender,
  overlay: () => node("render-overlay.mjs"),
  compose: () => node("compose.mjs"),
  render: () => {
    if (builtin) {
      // 自研路徑：zoompan 推近在 base 做；確保不誤用舊的 hyperframes 輸出
      // ⚠️ 備援路徑不支援卡片視窗（windows 會被忽略、退回全螢幕版型）
      const stale = path.join(projAbs, "work/render.mp4");
      if (existsSync(stale)) rmSync(stale);
      node("build-base.mjs");
      node("render-overlay.mjs");
      node("compose.mjs");
    } else {
      node("build-base.mjs", { WN_SKIP_ZOOM: "1" });
      node("gen-cutouts.mjs");   // script.json 沒 windows 會自動跳過
      node("gen-comps.mjs");
      hyperframesRender();
      node("compose.mjs");
    }
  },
  all: () => { PIPE.transcribe(); PIPE.render(); },
};

const fn = PIPE[step];
if (!fn) { console.error(`未知步驟：${step}`); process.exit(1); }
fn();
