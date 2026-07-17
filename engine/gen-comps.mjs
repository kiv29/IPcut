/*
 * gen-comps.mjs — 由 script.json 產生 Hyperframes 專案（Remote Editor Kit 預設渲染路徑）
 * Copyright (c) 2026 Fyn Chang. All rights reserved.
 *
 * 用法：node engine/gen-comps.mjs <專案資料夾>
 * 前置：work/base.mp4 已存在（build-base 產出：剪空白＋降噪＋B-roll；zoom 不在 base 做）
 * 產出：<專案>/hf/ 完整 Hyperframes 專案
 *   ├── hyperframes.json / meta.json / index.html（含臉部推近 GSAP 主時間軸）
 *   ├── compositions/captions.html（雙語字幕）
 *   ├── compositions/mg.html（液態玻璃動態圖卡）
 *   └── assets/（base.mp4 硬連結、字型、圖卡素材）
 * 之後：cd hf && npx hyperframes render --quality standard --output ../work/render.mp4
 */
import { readFileSync, writeFileSync, copyFileSync, linkSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, probeDuration } from "./util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(__dirname, "..");
const projDir = path.resolve(process.argv[2] || ".");
const script = JSON.parse(readFileSync(path.join(projDir, "script.json"), "utf8"));

const W = script.width || 1080, H = script.height || 1920, FPS = script.fps || 30;
// 版面：直式預設；橫式 16:9 自動適配（字幕 bottom、圖卡預設座標）
const LAND = W > H;
const CX = W / 2;
const CARD_TOP = LAND ? 640 : 1330;
const CAP_BOTTOM = LAND ? 96 : 630;
const base = path.join(projDir, "work/base.mp4");
if (!existsSync(base)) { console.error("缺 work/base.mp4 — 先跑 build-base"); process.exit(1); }
const DUR = +probeDuration(base).toFixed(2);

const hf = path.join(projDir, "hf");
ensureDir(path.join(hf, "compositions"));
ensureDir(path.join(hf, "assets/fonts"));

/* ---------- 素材 ---------- */
const dstBase = path.join(hf, "assets/base.mp4");
if (existsSync(dstBase)) rmSync(dstBase);
try { linkSync(base, dstBase); } catch { copyFileSync(base, dstBase); }
for (const f of ["NotoSansTC-500.woff2", "NotoSansTC-900.woff2", "NotoSerifTC-600.woff2", "NotoSerifTC-900.woff2", "Montserrat-700.woff2", "Montserrat-800.woff2"]) {
  copyFileSync(path.join(KIT, "templates/fonts", f), path.join(hf, "assets/fonts", f));
}
// 圖卡引用的專案素材（頭像等）
const assetRefs = new Set();
for (const m of script.mg || []) {
  for (const k of ["img", "icon"]) {
    const v = m[k];
    if (v && /\.(png|jpg|jpeg|webp|svg)$/i.test(v) && !v.startsWith("<svg")) assetRefs.add(v);
  }
}
for (const rel of assetRefs) {
  const src = path.resolve(projDir, rel);
  if (existsSync(src)) copyFileSync(src, path.join(hf, "assets", path.basename(src)));
  else console.warn(`⚠️ 圖卡素材不存在：${rel}`);
}
const assetPath = (rel) => "assets/" + path.basename(rel);

/* ---------- 卡片收合：去背素材＋逐幀追蹤（gen-cutouts 產出） ---------- */
const trackPath = path.join(projDir, "work/track.json");
const CARD = (script.windows || []).length && existsSync(trackPath)
  ? JSON.parse(readFileSync(trackPath, "utf8")) : null;
if ((script.windows || []).length && !CARD)
  console.warn("⚠️ script.json 有 windows 但缺 work/track.json — 先跑 `node engine/run.mjs <proj> cutouts`");
if (CARD) {
  for (const w of CARD.windows) {
    const f = "cut_" + w.key + ".webm";
    const src = path.join(projDir, "work", f), dst = path.join(hf, "assets", f);
    if (!existsSync(src)) { console.error(`缺 work/${f} — 重跑 cutouts`); process.exit(1); }
    if (existsSync(dst)) rmSync(dst);
    try { linkSync(src, dst); } catch { copyFileSync(src, dst); }
  }
}
const inWindow = (t) => !!CARD && CARD.windows.some((w) => t >= w.open && t <= (w.hold ? DUR : w.close));

/* ---------- 共用樣式（品牌設計系統，路徑改到 assets/fonts） ---------- */
// 風格選擇：script.json 的 "style" 欄位（signature / card-takeover / editorial-red /
// paper-serif / midnight-neon）→ 載 templates/styles/<style>/tokens.css；找不到就退回正典。
const styleSlug = (script.style || "card-takeover").toLowerCase();
const styleTokens = path.join(KIT, "templates/styles", styleSlug, "tokens.css");
const tokensPath = existsSync(styleTokens) ? styleTokens : path.join(KIT, "templates/design-tokens.css");
console.log("風格：" + styleSlug + (existsSync(styleTokens) ? "" : "（找不到，用 signature 正典）") + " ← " + path.relative(KIT, tokensPath));
const tokensCSS = readFileSync(tokensPath, "utf8")
  .replace(/url\("fonts\//g, 'url("assets/fonts/')
  .replace(/html, body \{[^}]*\}/, "") // 交給 index.html 管 root
  .replace(/#wn-stage[^}]*\}/, "")
  + (LAND ? "\n:root { --wn-cap-bottom: " + CAP_BOTTOM + "px; --wn-cap-maxw: 1400px; }\n" : "");

/* ---------- hyperframes.json / meta.json ---------- */
writeFileSync(path.join(hf, "hyperframes.json"), JSON.stringify({
  $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
}, null, 2));
writeFileSync(path.join(hf, "meta.json"), JSON.stringify({
  id: path.basename(projDir), name: path.basename(projDir),
  createdAt: "2026-01-01T00:00:00.000Z", width: W, height: H, fps: FPS,
}, null, 2));

/* ---------- index.html（root：底片 + 推近 + 子合成） ---------- */
const zoomLines = (script.zooms || []).map((z) => {
  const [a, b] = z.t;
  const S = z.amount || 1.12;
  const cy = z.cy !== undefined ? z.cy : H * 0.45;
  const maxShift = (H / 2) * (S - 1);
  const y = Math.max(-maxShift, Math.min(maxShift, (cy - H / 2) * (1 - S)));
  const ramp = Math.min(0.45, (b - a) / 4).toFixed(2);
  return `      mainTl.to("#face-video", { scale: ${S}, y: ${y.toFixed(0)}, duration: ${ramp}, ease: "power2.inOut" }, ${a.toFixed(2)});
      mainTl.to("#face-video", { scale: 1.0, y: 0, duration: ${ramp}, ease: "power2.inOut" }, ${(b - +ramp).toFixed(2)});`;
}).join("\n");

const subComps = `      <div id="mg" class="mg-layer" data-composition-id="mg"
        data-composition-src="compositions/mg.html"
        data-start="0" data-duration="${DUR}" data-track-index="1"
        data-width="${W}" data-height="${H}"></div>
      <div id="captions" class="cap-layer" data-composition-id="captions"
        data-composition-src="compositions/captions.html"
        data-start="0" data-duration="${DUR}" data-track-index="2"
        data-width="${W}" data-height="${H}"></div>`;

if (!CARD) {
  /* ---- 全螢幕版型（無卡片視窗） ---- */
  writeFileSync(path.join(hf, "index.html"), `<!doctype html>
<!-- Remote Editor Kit 自動產生 — 不要手改，改 script.json 後重跑 gen-comps -->
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>${path.basename(projDir)}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #000; }
      #face-wrapper { position: absolute; inset: 0; z-index: 0; }
      #face-video { display: block; width: 100%; height: 100%; object-fit: cover; transform-origin: 50% 50%; }
      .mg-layer { position: absolute; inset: 0; z-index: 1; }
      .cap-layer { position: absolute; inset: 0; z-index: 2; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="${W}" data-height="${H}">
      <div id="face-wrapper">
        <video id="face-video" data-start="0" data-duration="${DUR}" data-track-index="0"
          src="assets/base.mp4" muted playsinline></video>
      </div>
      <audio id="face-audio" data-start="0" data-duration="${DUR}" data-track-index="4"
        data-volume="1" src="assets/base.mp4"></audio>
${subComps}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const mainTl = gsap.timeline({ paused: true });
${zoomLines || "      // 無推近"}
      mainTl.set({}, {}, ${DUR});
      window.__timelines["main"] = mainTl;
    </script>
  </body>
</html>
`);
} else {
  /* ---- 卡片收合版型（fyn-weekend-08 / fyn-cashflow-09 正典）：
     紙感畫布 + 底片收進圓角卡片 + 去背人物頭衝出卡緣 + 逐幀追蹤 ---- */
  const cutoutTags = CARD.windows.map((w, i) =>
    `        <video id="cut${i + 1}" class="cutout" data-start="${w.start}" data-duration="${w.dur}" data-track-index="${6 + i}" src="assets/cut_${w.key}.webm" muted playsinline></video>`).join("\n");
  const windowsJS = CARD.windows.map((w, i) =>
    `        [${w.open}, ${w.hold ? DUR : w.close}, "#cut${i + 1}", "${w.key}", ${w.start}, ${w.x}, ${w.hold ? "true" : "false"}],`).join("\n");
  writeFileSync(path.join(hf, "index.html"), `<!doctype html>
<!-- Remote Editor Kit 自動產生 — 不要手改，改 script.json 後重跑 gen-comps -->
<html lang="zh-Hant">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>${path.basename(projDir)}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: var(--wn-paper, #F5F1E8); }
      #paper { position: absolute; inset: 0; z-index: 0; background:
        radial-gradient(1200px 900px at 82% -8%, rgba(190,178,150,.28), rgba(190,178,150,0) 60%),
        radial-gradient(1000px 800px at -10% 108%, rgba(190,178,150,.22), rgba(190,178,150,0) 55%),
        #F5F1E8; }
      #face-wrapper { position: absolute; inset: 0; z-index: 1; }
      #face-video { display: block; width: 100%; height: 100%; object-fit: cover; transform-origin: 50% 50%;
        filter: contrast(1.02) saturate(1.05); }
      #card-group { position: absolute; inset: 0; z-index: 1; opacity: 0; }
      #card-frame { position: absolute; left: 20px; top: 1230px; width: 1040px; height: 710px; border-radius: 64px;
        overflow: hidden; background: #E9E3D5; box-shadow: 0 30px 80px rgba(40,32,16,.28); }
      #card-bg-wrap { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
      #card-bg { display: block; width: ${W}px; height: ${H}px; }
      .cutout { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; }
      .mg-layer { position: absolute; inset: 0; z-index: 2; }
      .cap-layer { position: absolute; inset: 0; z-index: 3; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="${W}" data-height="${H}">
      <div id="paper"></div>
      <div id="face-wrapper">
        <video id="face-video" data-start="0" data-duration="${DUR}" data-track-index="0"
          src="assets/base.mp4" muted playsinline></video>
      </div>
      <div id="card-group">
        <div id="card-frame">
          <div id="card-bg-wrap">
            <video id="card-bg" data-start="0" data-duration="${DUR}" data-track-index="5"
              src="assets/base.mp4" muted playsinline></video>
          </div>
        </div>
${cutoutTags}
      </div>
      <audio id="face-audio" data-start="0" data-duration="${DUR}" data-track-index="4"
        data-volume="1" src="assets/base.mp4"></audio>
${subComps}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const TRACK = ${JSON.stringify(CARD.track)};
      const mainTl = gsap.timeline({ paused: true });
      // 卡片視窗：[開, 關, cutout, track key, 素材起點, x, holdEnd]
      // 逐幀 y keyframes 把頭頂釘在 y≈1020（on-light 字幕帶正下方）；
      // 卡內背景同軌跡鏡射（偏移 -20,-1230）→ 兩層像素相同、零疊影。
      const WINDOWS = [
${windowsJS}
      ];
      function applyTrack(el, kfs, A, dx, dy) {
        mainTl.set(el, { x: dx, y: kfs[0][1] + dy, scale: ${CARD.scale} }, Math.max(0, A));
        for (let i = 1; i < kfs.length; i++) {
          mainTl.to(el, { y: kfs[i][1] + dy, duration: kfs[i][0] - kfs[i - 1][0], ease: "none" }, A + kfs[i - 1][0]);
        }
      }
      mainTl.set("#face-wrapper", { opacity: 1 }, 0);
      WINDOWS.forEach(function (w) {
        const a = w[0], b = w[1], kfs = TRACK[w[3]], A = w[4], dx = w[5], hold = w[6];
        applyTrack(w[2], kfs, A, dx, 0);
        applyTrack("#card-bg-wrap", kfs, A, dx - 20, -1230);
        mainTl.to("#face-wrapper", { opacity: 0, duration: 0.18, ease: "power2.in" }, a);
        mainTl.fromTo("#card-group", { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.28, ease: "power3.out" }, a);
        if (hold) return; // 停在卡片模式到片尾
        mainTl.to("#card-group", { opacity: 0, duration: 0.18, ease: "power2.in" }, b - 0.18);
        mainTl.to("#face-wrapper", { opacity: 1, duration: 0.2, ease: "power2.out" }, b - 0.12);
      });
${zoomLines || "      // 無推近"}
      mainTl.set({}, {}, ${DUR});
      window.__timelines["main"] = mainTl;
    </script>
  </body>
</html>
`);
}

/* ---------- compositions/captions.html ---------- */
const linesJSON = JSON.stringify((script.lines || []).map((l) => {
  const s = l.s ?? (l.t ? l.t[0] : 0);   // 字幕可用 {s,e} 或 {t:[a,b]}，統一正規化
  const e = l.e ?? (l.t ? l.t[1] : 0);
  return {
    ...l, s, e,
    // 卡片模式自動判定：句子中點落在卡片視窗內 → on-light（紙上深字、抬到卡頂上方）
    light: l.light ?? (inWindow((s + e) / 2) ? 1 : 0),
    zh: (l.zh || "")
      .replace(/<hl>/g, '<span class="hl">').replace(/<\/hl>/g, "</span>")
      .replace(/<chip>/g, '<span class="chip">').replace(/<\/chip>/g, "</span>"),
  };
}), null, 0);

/* 卡片收合的結構化樣式（on-light 字幕＋紙上面板元件），疊在風格 tokens 之後 */
const CARD_CSS = `
      /* ---- 卡片模式字幕：抬到卡頂上方、紙上深字 ---- */
      .wn-cap-line.on-light { bottom: 280px; }
      .wn-cap-line.on-light .wn-cap-zh { color: #1c1710; text-shadow: none; }
      .wn-cap-line.on-light .wn-cap-zh .hl { color: var(--wn-card-accent, #C9694A); }
      .wn-cap-line.on-light .wn-cap-en { color: rgba(28,23,16,.72); text-shadow: none; }
      /* ---- 紙上面板元件（卡片視窗期間的上方內容） ---- */
      .wn-kicker { font-family: "Noto Serif TC", serif; font-style: italic; font-weight: 600;
        font-size: 34px; color: var(--wn-card-accent, #C9694A); letter-spacing: .02em; text-align: center; }
      .wn-panel { display: flex; flex-direction: column; align-items: center; gap: 30px; }
      .wn-shot-wrap { position: relative; }
      .wn-shot { display: block; border: 10px solid #FFFDF8; border-radius: 22px;
        box-shadow: 0 20px 44px rgba(60,45,20,.28); }
      .wn-day-pill { position: absolute; left: 50%; bottom: -22px; transform: translateX(-50%); white-space: nowrap;
        font-family: "Montserrat", "Noto Sans TC", sans-serif; font-weight: 800; font-size: 28px; color: #151310;
        background: var(--wn-day-pill-bg, #F4C430); padding: 10px 22px 13px; border-radius: 14px;
        box-shadow: 0 10px 26px rgba(60,45,20,.3); }
      .wn-money-stamp { position: absolute; right: -30px; top: -34px; transform: rotate(-4deg);
        font-family: "Montserrat", "Noto Sans TC", sans-serif; font-weight: 800; font-size: 62px; color: #fff;
        background: var(--wn-card-accent, #C9694A); padding: 10px 32px 16px; border-radius: 20px;
        box-shadow: 0 18px 40px rgba(60,45,20,.35); opacity: 0; }
      .wn-flow-row { display: flex; gap: 22px; align-items: center; justify-content: center; }
      .wn-mcard { background: #FFFDF8; border-radius: 22px; box-shadow: 0 20px 44px rgba(60,45,20,.28);
        padding: 26px 30px 24px; display: flex; flex-direction: column; align-items: center; gap: 8px; opacity: 0; }
      .wn-mcard .ic { font-size: 64px; line-height: 1; }
      .wn-mcard .tp { font-family: "Noto Sans TC", sans-serif; font-weight: 900; font-size: 26px; color: rgba(21,19,16,.55); }
      .wn-mcard .bg { font-family: "Montserrat", "Noto Sans TC", sans-serif; font-weight: 800; font-size: 40px;
        color: #151310; white-space: nowrap; }
      .wn-mcard.result { background: var(--wn-card-accent, #C9694A); }
      .wn-mcard.result .tp { color: rgba(255,255,255,.8); }
      .wn-mcard.result .bg { color: #fff; font-size: 44px; }
      .wn-m-op { font-family: "Montserrat", sans-serif; font-weight: 800; font-size: 64px;
        color: var(--wn-card-accent, #C9694A); line-height: 1; opacity: 0; }
      .wn-cta-line { font-family: "Noto Serif TC", serif; font-weight: 900; font-size: 96px; color: #151310;
        display: flex; align-items: center; gap: 26px; opacity: 0; }
      .wn-cta-box { display: inline-block; font-family: "Montserrat", sans-serif; font-weight: 800; font-size: 84px;
        color: #fff; background: var(--wn-card-accent, #C9694A); padding: 10px 38px 16px; border-radius: 20px;
        box-shadow: 0 18px 40px rgba(60,45,20,.3); transform: rotate(-2deg); }
      .wn-cta-q { font-family: "Noto Serif TC", serif; font-weight: 900; font-size: 48px; color: #151310; opacity: 0; }
      .wn-cta-q .accent { color: var(--wn-card-accent, #C9694A); }
      .wn-pc-badge { font-family: "Noto Sans TC", sans-serif; font-weight: 900; font-size: 28px; color: #fff;
        background: #151310; padding: 12px 26px 15px; border-radius: 14px; transform: rotate(-2deg);
        box-shadow: 0 10px 26px rgba(60,45,20,.3); opacity: 0; }`;

writeFileSync(path.join(hf, "compositions/captions.html"), `<template id="captions-template">
  <div data-composition-id="captions" data-start="0" data-width="${W}" data-height="${H}" data-duration="${DUR}">
    <div class="wn-cap-stage" id="wn-cap-stage"></div>
    <style>
${tokensCSS}
${CARD_CSS}
      [data-composition-id="captions"] { position: absolute; inset: 0; pointer-events: none; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      (function () {
        const LINES = ${linesJSON};
        const DUR = ${DUR};
        const stage = document.querySelector('[data-composition-id="captions"] #wn-cap-stage');
        if (!stage) return;
        LINES.forEach(function (ln, i) {
          const wrap = document.createElement("div");
          wrap.className = "wn-cap-line" + (ln.light ? " on-light" : ""); wrap.id = "wn-cap-" + i;
          const zh = document.createElement("div");
          zh.className = "wn-cap-zh"; zh.innerHTML = ln.zh;
          wrap.appendChild(zh);
          if (ln.en) {
            const en = document.createElement("div");
            en.className = "wn-cap-en"; en.textContent = ln.en;
            wrap.appendChild(en);
          }
          stage.appendChild(wrap);
        });
        const tl = gsap.timeline({ paused: true });
        const FADE = 0.12;
        const SEL = '[data-composition-id="captions"] ';
        LINES.forEach(function (ln, i) {
          const sel = SEL + "#wn-cap-" + i;
          const next = LINES[i + 1];
          const hideAt = next ? Math.min(next.s, ln.e + 0.5) : ln.e;
          const outStart = Math.max(hideAt - FADE, ln.s + FADE + 0.02);
          // 彈跳進場（動畫感）：縮放回彈＋微上移，淡出維持快速
          tl.fromTo(sel, { autoAlpha: 0, scale: 0.86, y: 14 },
            { autoAlpha: 1, scale: 1, y: 0, duration: 0.28, ease: "back.out(1.8)" }, ln.s);
          tl.to(sel, { autoAlpha: 0, duration: FADE, ease: "power2.in" }, outStart);
        });
        // 字幕帶抬高（全螢幕 B-roll 時段）
        let lifted = false;
        LINES.forEach(function (ln) {
          if (ln.lift && !lifted) { tl.set(SEL + "#wn-cap-stage", { bottom: ln.lift }, ln.s); lifted = true; }
          else if (!ln.lift && lifted) { tl.set(SEL + "#wn-cap-stage", { bottom: ${CAP_BOTTOM} }, ln.s); lifted = false; }
        });
        tl.set({}, {}, DUR);
        window.__timelines = window.__timelines || {};
        window.__timelines["captions"] = tl;
      })();
    </script>
  </div>
</template>
`);

/* ---------- compositions/mg.html ---------- */
const mgExtraSrc = readFileSync(path.join(KIT, "templates/lib/mg-extra.js"), "utf8");
const mgJSON = JSON.stringify((script.mg || []).map((m) => {
  const out = { ...m };
  if (out.img) out.img = assetPath(out.img);
  if (out.icon && /\.(png|jpg|jpeg|webp|svg)$/i.test(out.icon) && !out.icon.startsWith("<svg"))
    out.icon = assetPath(out.icon);
  return out;
}), null, 0);

writeFileSync(path.join(hf, "compositions/mg.html"), `<template id="mg-template">
  <div data-composition-id="mg" data-start="0" data-width="${W}" data-height="${H}" data-duration="${DUR}">
    <div id="wn-mg-stage" style="position:absolute;inset:0;"></div>
    <style>
${tokensCSS}
${CARD_CSS}
      [data-composition-id="mg"] { position: absolute; inset: 0; pointer-events: none; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      (function () {
        const SPECS = ${mgJSON};
        const DUR = ${DUR};
        const stage = document.querySelector('[data-composition-id="mg"] #wn-mg-stage');
        if (!stage) return;
        const tl = gsap.timeline({ paused: true });

        const ICONS = ${readFileSync(path.join(KIT, "templates/lib/mg-library.js"), "utf8").match(/const ICONS = (\{[\s\S]*?\n  \});/)[1]};

        function iconHTML(spec) {
          if (!spec) return "";
          if (spec.indexOf("<svg") === 0) return spec;
          if (/\\.(png|jpg|jpeg|svg|webp)$/i.test(spec))
            return '<img src="' + spec + '" style="width:72px;height:72px;object-fit:contain">';
          return ICONS[spec] || "";
        }
        function fmtNum(n) { return Math.round(n).toLocaleString("en-US"); }
        function makeBeat(id, cls, style, html, cx) {
          const d = document.createElement("div");
          d.id = id; d.className = "wn-beat " + (cls || "");
          d.setAttribute("style", "left:" + (cx != null ? cx : ${CX}) + "px;" + (style || ""));
          d.innerHTML = html || "";
          stage.appendChild(d);
          gsap.set(d, { xPercent: -50 });
          return d;
        }
        function popCycle(el, a, b) {
          tl.fromTo(el, { autoAlpha: 0, scale: 0.4 },
            { autoAlpha: 1, scale: 1, duration: 0.45, ease: "back.out(1.7)" }, a);
          tl.to(el, { y: "-=7", duration: 0.8, yoyo: true,
            repeat: Math.max(1, Math.floor((b - a - 1) / 0.8)), ease: "sine.inOut" }, a + 0.5);
          tl.to(el, { autoAlpha: 0, scale: 0.75, duration: 0.25, ease: "power2.in" }, b - 0.25);
        }

        const BUILDERS = {
          statCounter: function (m, i) {
            const el = makeBeat("mg-" + i, "wn-glass", "top:" + (m.top != null ? m.top : ${CARD_TOP}) + "px;",
              iconHTML(m.icon) +
              '<div class="wn-gold-num ' + (m.small ? "small" : "") + '" id="mg-' + i + '-num">0</div>' +
              (m.label ? '<div class="wn-tag-zh">' + m.label + "</div>" : ""), m.x);
            popCycle(el, m.t[0], m.t[1]);
            const num = el.querySelector("#mg-" + i + "-num");
            const obj = { v: 0 };
            tl.to(obj, { v: m.value || 0, duration: Math.min(1.2, m.t[1] - m.t[0] - 0.4), ease: "power3.out",
              onUpdate: function () { num.textContent = (m.prefix || "") + fmtNum(obj.v) + (m.suffix || ""); } },
              m.t[0] + 0.15);
          },
          glassCard: function (m, i) {
            const inner = m.html || (iconHTML(m.icon) + (m.text
              ? '<div class="wn-tag-zh" style="align-self:center;padding:0;font-size:' + (m.fontSize || 38) + 'px">' + m.text + "</div>" : ""));
            const el = makeBeat("mg-" + i, "wn-glass", "top:" + (m.top != null ? m.top : ${CARD_TOP}) + "px;", inner, m.x);
            popCycle(el, m.t[0], m.t[1]);
          },
          stamp: function (m, i) {
            const rot = m.rotate !== undefined ? m.rotate : -2;
            const el = makeBeat("mg-" + i, "",
              "top:" + (m.top != null ? m.top : ${CARD_TOP}) + "px; display:flex; flex-direction:column; align-items:center; gap:14px;",
              '<div class="wn-stamp ' + (m.color === "green" ? "green" : m.color === "red" ? "red" : "") +
              '" style="transform:rotate(' + rot + 'deg)">' + m.text + "</div>" +
              (m.sub ? '<div class="wn-sub-pill">' + m.sub + "</div>" : ""), m.x);
            popCycle(el, m.t[0], m.t[1]);
          },
          avatarBadge: function (m, i) {
            const el = makeBeat("mg-" + i, "wn-avatar-wrap", "top:" + (m.top != null ? m.top : (${LAND} ? ${CARD_TOP} : 1290)) + "px;",
              '<img class="wn-avatar" src="' + m.img + '"><div class="wn-name-pill">' + m.name + "</div>", m.x);
            popCycle(el, m.t[0], m.t[1]);
          },
          glowFrame: function (m, i) {
            const el = document.createElement("div");
            el.className = "wn-beat wn-glow-frame";
            el.setAttribute("style",
              "left:60px; right:60px; top:" + (m.top !== undefined ? m.top : 1080) + "px; height:" + (m.height || 210) + "px;");
            stage.appendChild(el);
            const a = m.t[0], b = m.t[1];
            tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: "power2.out" }, a);
            tl.to(el, { opacity: 0.45, duration: 0.55, yoyo: true,
              repeat: Math.max(1, Math.floor((b - a - 1) / 0.55)), ease: "sine.inOut" }, a + 0.5);
            tl.to(el, { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, b - 0.3);
          },
          arrows: function (m, i) {
            const el = makeBeat("mg-" + i, "",
              "top:" + (m.top !== undefined ? m.top : 1020) + "px; display:flex; gap:660px;",
              '<div class="wn-arrow">↓</div><div class="wn-arrow">↓</div>', m.x);
            const a = m.t[0], b = m.t[1];
            tl.fromTo(el, { autoAlpha: 0, scale: 0.4 },
              { autoAlpha: 1, scale: 1, duration: 0.45, ease: "back.out(1.7)" }, a);
            tl.to(el, { y: "+=12", duration: 0.5, yoyo: true,
              repeat: Math.max(1, Math.floor((b - a - 0.7) / 0.5)), ease: "sine.inOut" }, a + 0.3);
            tl.to(el, { autoAlpha: 0, duration: 0.25, ease: "power2.in" }, b - 0.25);
          },
          sparkles: function (m, i) {
            const pts = m.points || [[330, 260], [540, 200], [760, 250]];
            pts.forEach(function (pt, j) {
              const s = document.createElement("div");
              s.className = "wn-sparkle"; s.textContent = "✦";
              s.style.left = pt[0] + "px"; s.style.top = pt[1] + "px";
              stage.appendChild(s);
              const d = m.t[0] + j * 0.14;
              tl.fromTo(s, { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, d);
              tl.to(s, { opacity: 0.35, duration: 0.4, yoyo: true,
                repeat: Math.max(2, Math.floor((m.t[1] - d - 0.6) / 0.4)), ease: "sine.inOut" }, d + 0.35);
              tl.to(s, { autoAlpha: 0, scale: 0.3, duration: 0.25, ease: "power2.in" }, m.t[1] - 0.25);
            });
          },
          confetti: function (m, i) {
            const a = m.t[0], b = m.t[1];
            const colors = ["#F4C430", "#FFD23F", "#3ECF8E", "#E0554D", "#5AA9FF", "#ffffff"];
            let s = ((m.seed || 7) * 2654435761) & 0x7fffffff;
            const R = function () { return (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; };
            const N = m.count || 34;
            for (let j = 0; j < N; j++) {
              const p = document.createElement("div");
              const sz = 8 + Math.floor(R() * 10),
                x0 = (m.x0 != null ? m.x0 : 200) + R() * (m.xw != null ? m.xw : 680);
              p.style.cssText = "position:absolute;top:-40px;left:" + x0 + "px;width:" + sz +
                "px;height:" + Math.round(sz * 0.6) + "px;border-radius:2px;background:" +
                colors[Math.floor(R() * colors.length)] + ";opacity:0;";
              stage.appendChild(p);
              const d = a + R() * 0.25, drift = (R() - 0.5) * 260, rot = R() * 720 - 360;
              tl.fromTo(p, { opacity: 0 }, { opacity: 1, duration: 0.15 }, d);
              tl.to(p, { y: 900 + R() * 300, x: drift, rotation: rot, duration: (b - d) - 0.1, ease: "none" }, d);
              tl.to(p, { opacity: 0, duration: 0.4 }, b - 0.4);
            }
          },
          cta: function (m, i) {
            const el = makeBeat("mg-" + i, "", "top:" + (m.top != null ? m.top : ${CARD_TOP}) + "px;",
              '<div class="wn-cta">' + iconHTML(m.icon || "") + "<span>" + (m.text || "追蹤看更多") + "</span></div>", m.x);
            const a = m.t[0], b = m.t[1];
            tl.fromTo(el, { autoAlpha: 0, scale: 0.4 },
              { autoAlpha: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)" }, a);
            tl.to(el, { scale: 1.06, duration: 0.4, yoyo: true,
              repeat: Math.max(1, Math.floor((b - a - 1) / 0.4)), ease: "sine.inOut" }, a + 0.7);
            tl.to(el, { autoAlpha: 0, scale: 0.75, duration: 0.25, ease: "power2.in" }, b - 0.25);
          },
          countdown: function (m, i) {
            const R = 120, C = 2 * Math.PI * R;
            const size = m.size || 300, from = m.from || 5;
            const el = makeBeat("mg-" + i, "", "top:" + (m.top !== undefined ? m.top : 96) + "px;",
              '<svg viewBox="0 0 300 300" width="' + size + '" xmlns="http://www.w3.org/2000/svg">' +
              '<circle cx="150" cy="150" r="' + R + '" fill="rgba(12,12,14,0.55)"/>' +
              '<circle cx="150" cy="150" r="' + R + '" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="14"/>' +
              '<circle id="mg-' + i + '-ring" cx="150" cy="150" r="' + R + '" fill="none" stroke="#F4C430" stroke-width="14"' +
              ' stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="0" transform="rotate(-90 150 150)"/>' +
              '<text id="mg-' + i + '-n" x="150" y="150" text-anchor="middle" dominant-baseline="central"' +
              ' font-family="Noto Sans TC" font-weight="900" font-size="120" fill="#fff">' + from + "</text></svg>", m.x);
            const ring = el.querySelector("#mg-" + i + "-ring");
            const num = el.querySelector("#mg-" + i + "-n");
            const a = m.t[0], b = m.t[1];
            tl.fromTo(el, { autoAlpha: 0, scale: 0.4 },
              { autoAlpha: 1, scale: 1, duration: 0.45, ease: "back.out(1.7)" }, a);
            const obj = { p: 0 };
            tl.to(obj, { p: 1, duration: b - a - 0.3, ease: "none",
              onUpdate: function () {
                ring.setAttribute("stroke-dashoffset", String(C * obj.p));
                num.textContent = String(Math.max(1, Math.ceil(from * (1 - obj.p))));
              } }, a);
            tl.to(el, { autoAlpha: 0, scale: 0.75, duration: 0.25, ease: "power2.in" }, b - 0.25);
          },
          strikeText: function (m, i) {
            const el = makeBeat("mg-" + i, "", "top:" + (m.top != null ? m.top : ${CARD_TOP}) + "px;",
              '<div style="position:relative; display:inline-block; font-family:\\'Noto Sans TC\\'; font-weight:900;' +
              ' font-size:52px; color:#fff; text-shadow:0 2px 10px rgba(0,0,0,0.6); padding:4px 10px;">' + m.text +
              '<div id="mg-' + i + '-line" style="position:absolute; left:0; top:52%; height:7px; width:0;' +
              ' background:#E0554D; border-radius:4px;"></div></div>', m.x);
            popCycle(el, m.t[0], m.t[1]);
            tl.to("#mg-" + i + "-line", { width: "100%", duration: 0.35, ease: "power3.out" }, m.t[0] + 0.45);
          },
        };

        /* ---- 卡片收合面板元件（在卡片視窗期間、紙上呈現） ---- */
        // 佐證截圖卡：白框截圖＋斜體 kicker＋黃色日期膠囊＋珊瑚金額印章（釘右上角，不撞字幕）
        BUILDERS.proofShot = function (m, i) {
          const el = makeBeat("mg-" + i, "wn-panel", "top:" + (m.top || 260) + "px;",
            (m.kicker ? '<div class="wn-kicker">' + m.kicker + "</div>" : "") +
            '<div class="wn-shot-wrap">' +
            '<img class="wn-shot" src="' + m.img + '" width="' + (m.width || 640) + '">' +
            (m.stamp ? '<div class="wn-money-stamp" id="mg-' + i + '-st">' + m.stamp + "</div>" : "") +
            (m.pill ? '<div class="wn-day-pill">' + m.pill + "</div>" : "") +
            "</div>", m.x);
          const a = m.t[0], b = m.t[1];
          tl.fromTo(el, { autoAlpha: 0, y: 44, scale: 0.94 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: "power3.out" }, a);
          if (m.stamp) {
            const st = a + Math.min(Math.max(m.stampAt !== undefined ? m.stampAt - a : 1.6, 0.3), b - a - 0.6);
            tl.fromTo("#mg-" + i + "-st", { opacity: 0, scale: 0.3, rotation: -12, y: 20 },
              { opacity: 1, scale: 1, rotation: -4, y: 0, duration: 0.4, ease: "back.out(2)" }, st);
            tl.to("#mg-" + i + "-st", { scale: 1.06, repeat: 2, yoyo: true, duration: 0.35, ease: "sine.inOut" }, st + 0.5);
          }
          tl.to(el, { autoAlpha: 0, y: -26, duration: 0.3, ease: "power2.in" }, b - 0.3);
        };
        // 工作流故事列：icon 卡＋箭頭逐拍點亮，最後一張珊瑚 result 卡
        BUILDERS.flowRow = function (m, i) {
          const steps = m.steps || [];
          let inner = "";
          steps.forEach(function (s2, j) {
            if (j) inner += '<div class="wn-m-op" id="mg-' + i + "-a" + j + '">→</div>';
            inner += '<div class="wn-mcard' + (j === steps.length - 1 && m.result !== false ? " result" : "") +
              '" id="mg-' + i + "-c" + j + '">' +
              (s2.icon ? '<div class="ic">' + s2.icon + "</div>" : "") +
              (s2.top ? '<div class="tp">' + s2.top + "</div>" : "") +
              (s2.big ? '<div class="bg">' + s2.big + "</div>" : "") + "</div>";
          });
          const el = makeBeat("mg-" + i, "wn-panel", "top:" + (m.top || 280) + "px;",
            (m.kicker ? '<div class="wn-kicker">' + m.kicker + "</div>" : "") +
            '<div class="wn-flow-row">' + inner + "</div>", m.x);
          const a = m.t[0], b = m.t[1];
          tl.fromTo(el, { autoAlpha: 0, y: 44 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" }, a);
          steps.forEach(function (s2, j) {
            const at = s2.at !== undefined ? +s2.at : a + 0.2 + j * ((b - a - 1) / steps.length);
            if (j) tl.fromTo("#mg-" + i + "-a" + j, { opacity: 0, scale: 0.3 },
              { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, Math.max(a + 0.1, at - 0.25));
            tl.fromTo("#mg-" + i + "-c" + j, { opacity: 0, scale: 0.3, y: 20 },
              { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, at);
            if (j === steps.length - 1) tl.to("#mg-" + i + "-c" + j,
              { scale: 1.06, repeat: 2, yoyo: true, duration: 0.4, ease: "sine.inOut" }, at + 0.5);
          });
          tl.to(el, { autoAlpha: 0, y: -26, duration: 0.3, ease: "power2.in" }, b - 0.3);
        };
        // CTA 卡：kicker＋襯線問題行＋「留言 <BOX>」大字＋黑色小徽章；hold=true 停到片尾
        BUILDERS.ctaCard = function (m, i) {
          const el = makeBeat("mg-" + i, "wn-panel", "top:" + (m.top || 300) + "px;",
            (m.kicker ? '<div class="wn-kicker">' + m.kicker + "</div>" : "") +
            (m.question ? '<div class="wn-cta-q" id="mg-' + i + '-q">' +
              m.question.split("<accent>").join('<span class="accent">').split("</accent>").join("</span>") + "</div>" : "") +
            '<div class="wn-cta-line" id="mg-' + i + '-cta">' + (m.lead || "留言") +
            ' <span class="wn-cta-box">' + (m.keyword || "EDIT") + "</span></div>" +
            (m.badge ? '<div class="wn-pc-badge" id="mg-' + i + '-bd">' + m.badge + "</div>" : ""), m.x);
          const a = m.t[0], b = m.t[1];
          tl.fromTo(el, { autoAlpha: 0, y: 44 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" }, a);
          if (m.question) tl.fromTo("#mg-" + i + "-q", { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }, a + (m.questionAt !== undefined ? m.questionAt - a : 0.8));
          const ctaAt = m.ctaAt !== undefined ? +m.ctaAt : b - 1.1;
          tl.fromTo("#mg-" + i + "-cta", { opacity: 0, scale: 0.3, rotation: -8, y: 20 },
            { opacity: 1, scale: 1, rotation: 0, y: 0, duration: 0.4, ease: "back.out(2)" }, ctaAt);
          tl.to("#mg-" + i + "-cta", { scale: 1.04, repeat: 2, yoyo: true, duration: 0.4, ease: "sine.inOut" }, ctaAt + 0.5);
          if (m.badge) tl.fromTo("#mg-" + i + "-bd", { opacity: 0, scale: 0.3, y: 20 },
            { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, ctaAt + 0.35);
          if (!m.hold) tl.to(el, { autoAlpha: 0, y: -26, duration: 0.3, ease: "power2.in" }, b - 0.3);
        };

        /* ---------- 進階語義動畫（mg-extra.js 內嵌，GSAP env 掛載） ---------- */
        ${mgExtraSrc}
        (function () {
          const L = { W: ${W}, H: ${H}, centerX: ${CX}, cardTop: ${CARD_TOP}, landscape: ${LAND} };
          const A = {
            popIn: function (el, start) { tl.fromTo(el, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "back.out(1.7)" }, start); },
            popOut: function (el, start) { tl.to(el, { autoAlpha: 0, scale: 0.75, duration: 0.25, ease: "power2.in" }, start); },
            fadeIn: function (el, start, dur) { tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: dur || 0.3, ease: "power2.out" }, start); },
            fadeOut: function (el, start, dur) { tl.to(el, { autoAlpha: 0, duration: dur || 0.3, ease: "power2.in" }, start); },
            fadeTo: function (el, from, to, start, dur) { tl.fromTo(el, { autoAlpha: from }, { autoAlpha: to, duration: dur || 0.3, ease: "sine.inOut" }, start); },
            float: function (el, start, end, amp) {
              amp = amp || 6;
              tl.fromTo(el, { y: -amp }, { y: amp, duration: 0.8, yoyo: true,
                repeat: Math.max(1, Math.floor((end - start - 0.9) / 0.8)), ease: "sine.inOut" }, start);
            },
            prog: function (start, dur, fn, ease) {
              const map = { out: "power3.out", "in": "power2.in", inout: "sine.inOut", linear: "none" };
              const o = { p: 0 };
              tl.to(o, { p: 1, duration: Math.max(dur, 0.0001), ease: map[ease] || "power3.out",
                onUpdate: function () { fn(o.p); } }, start);
            },
          };
          const env = {
            stage: stage, L: L, iconHTML: iconHTML, fmtNum: fmtNum, A: A,
            el: function (id, cls, style, html, x) {
              const d = document.createElement("div");
              d.id = id; d.className = "wn-beat " + (cls || "");
              d.setAttribute("style", "left:" + (x != null ? x : L.centerX) + "px;" + (style || ""));
              d.innerHTML = html || "";
              stage.appendChild(d);
              gsap.set(d, { xPercent: -50 });
              return d;
            },
            full: function (id, html) {
              const d = document.createElement("div");
              d.id = id; d.className = "wn-beat";
              d.setAttribute("style", "position:absolute;inset:0;");
              d.innerHTML = html || "";
              stage.appendChild(d);
              return d;
            },
          };
          Object.keys(WNMGX.DEFS).forEach(function (k) {
            BUILDERS[k] = function (m, i) { WNMGX.DEFS[k](env, m, i); };
          });
        })();

        SPECS.forEach(function (m, i) {
          const fn = BUILDERS[m.type];
          if (fn) fn(m, i); else console.warn("未知圖卡類型: " + m.type);
        });
        tl.set({}, {}, DUR);
        window.__timelines = window.__timelines || {};
        window.__timelines["mg"] = tl;
      })();
    </script>
  </div>
</template>
`);

console.log(`\n✅ Hyperframes 專案已產生：${path.relative(process.cwd(), hf)}/`);
console.log(`   ${(script.lines || []).length} 句字幕、${(script.mg || []).length} 張圖卡、${(script.zooms || []).length} 個推近、${DUR}s`);
console.log(`下一步：cd ${path.relative(process.cwd(), hf)} && npx hyperframes lint && npx hyperframes render --quality standard --output ../work/render.mp4`);
