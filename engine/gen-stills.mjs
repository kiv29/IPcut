/*
 * gen-stills.mjs — 靜態審核圖卡（不整支 render，超省時間/token）
 * Copyright (c) 2026 Fyn Chang. All rights reserved.
 *
 * 原理：重用 render-overlay 的無頭 Chrome harness，但只 __seek 到「每張圖卡/字幕的
 * hero 時刻」截一張透明疊加層，再用 ffmpeg 合成到底片同一格上 → out/stills/。
 * 讓使用者先審核位置/顏色/發光/陰影/有沒有擋臉，全部核可後才 render 成動畫。
 *
 * 用法：
 *   node engine/gen-stills.mjs <專案>            # 自動抓每個 mg 中點＋字幕中點
 *   node engine/gen-stills.mjs <專案> 2.5 8 14   # 指定時間點（秒）
 * 前置：work/base.mp4 已存在（First Cut 產出）。
 * 產出：out/stills/NN-t<秒>.png（合成圖）＋ out/stills/_contact.jpg（總覽）＋ manifest.json
 */
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import { ffmpegPath, chromePath, ensureDir, probeDuration } from "./util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(__dirname, "..");
const projDir = path.resolve(process.argv[2] || ".");
const extraTimes = process.argv.slice(3).map(Number).filter((n) => !Number.isNaN(n));
const work = path.join(projDir, "work");
const base = path.join(work, "base.mp4");
if (!existsSync(base)) { console.error("缺 work/base.mp4 — 先做 First Cut（base）"); process.exit(1); }

const script = JSON.parse(readFileSync(path.join(projDir, "script.json"), "utf8"));
const W = script.width || 1080, H = script.height || 1920;
const baseDur = probeDuration(base);
const scriptForBrowser = { ...script, duration: baseDur };
const FF = ffmpegPath();

/* ---------- 風格 tokens（攔 /design-tokens.css 改服務所選風格） ---------- */
const styleSlug = (script.style || "signature").toLowerCase();
const styleTokens = path.join(KIT, "templates/styles", styleSlug, "tokens.css");
const tokensFile = existsSync(styleTokens) ? styleTokens : path.join(KIT, "templates/design-tokens.css");

/* ---------- 決定要截哪些時刻 ---------- */
function lineSpan(l) { return l.t ? l.t : [l.s ?? 0, l.e ?? 0]; }
const shots = [];
if (extraTimes.length) {
  extraTimes.forEach((t) => shots.push({ t, label: "manual" }));
} else {
  (script.mg || []).forEach((m, i) => {
    const [a, b] = m.t || [0, 0];
    shots.push({ t: +((a + b) / 2).toFixed(2), label: `mg${i}-${m.type}${m.icon ? ":" + m.icon : ""}` });
  });
  (script.lines || []).forEach((l, i) => {
    const [a, b] = lineSpan(l);
    shots.push({ t: +((a + b) / 2).toFixed(2), label: `cap${i}` });
  });
}
// 去重（0.4s 內視為同一格，保留先出現的標籤）＋排序＋夾在片長內
shots.sort((x, y) => x.t - y.t);
const picked = [];
for (const s of shots) {
  s.t = Math.max(0.05, Math.min(baseDur - 0.05, s.t));
  if (!picked.length || s.t - picked[picked.length - 1].t > 0.4) picked.push(s);
  else picked[picked.length - 1].label += "+" + s.label;
}
if (!picked.length) { console.error("script.json 沒有 mg / lines，無可截"); process.exit(1); }
console.log(`風格：${styleSlug}　靜態圖卡：${picked.length} 張（${picked.map((p) => p.t + "s").join(", ")}）`);

/* ---------- 靜態伺服器（服務 templates/，攔 design-tokens.css 換風格） ---------- */
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  try {
    const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (u === "/__script.json") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(scriptForBrowser)); return; }
    let file;
    if (u === "/design-tokens.css") file = tokensFile;               // ← 換成所選風格
    else if (u.startsWith("/assets/")) file = path.join(projDir, u); // 專案素材
    else file = path.join(KIT, "templates", u);                       // 模板本體
    const data = readFileSync(file);
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch { res.writeHead(404); res.end("not found"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

/* ---------- Chrome ---------- */
const browser = await puppeteer.launch({
  executablePath: chromePath(), headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--force-color-profile=srgb", "--disable-lcd-text",
    "--hide-scrollbars", `--window-size=${W},${H}`, "--font-render-hinting=none"],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/overlay.html?script=/__script.json`, { waitUntil: "networkidle0" });
await page.waitForFunction("window.__ready === true", { timeout: 30000 });
const err = await page.evaluate("window.__error || null");
if (err) { console.error("overlay.html 執行錯誤：\n" + err); process.exit(1); }
const cdp = await page.createCDPSession();
await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });

/* ---------- 逐張：seek → 截疊加層 → 合成到底片那一格 ---------- */
const outDir = path.join(projDir, "out/stills");
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const tmp = path.join(work, "_still_overlay.png");
const manifest = [];
for (let i = 0; i < picked.length; i++) {
  const { t, label } = picked[i];
  await page.evaluate((tt) => window.__seek(tt), t);
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  writeFileSync(tmp, Buffer.from(shot.data, "base64"));
  const nn = String(i + 1).padStart(2, "0");
  const safe = label.replace(/[^\w:+.-]/g, "").slice(0, 40);
  const out = path.join(outDir, `${nn}-t${t}-${safe}.png`);
  execFileSync(FF, ["-y", "-v", "error", "-ss", String(t), "-i", base, "-i", tmp,
    "-filter_complex", `[0:v]scale=${W}:${H}[b];[b][1:v]overlay=0:0`, "-frames:v", "1", "-q:v", "2", out]);
  manifest.push({ n: i + 1, t, label, file: path.basename(out) });
  console.log(`  ✓ ${path.basename(out)}`);
}
await browser.close(); server.close();

/* ---------- HTML 索引頁（一頁看全部，方便 Fyn 審核） ---------- */
const cards = manifest.map((m) =>
  `<figure><img src="${m.file}" alt="${m.label}"><figcaption><b>#${m.n} · ${m.t}s</b><br>${m.label}</figcaption></figure>`).join("\n");
writeFileSync(path.join(outDir, "index.html"),
`<!doctype html><meta charset="utf-8"><title>靜態圖卡審核 · ${styleSlug}</title>
<style>body{margin:0;background:#14140f;color:#eee;font:15px -apple-system,"PingFang TC",sans-serif;padding:28px}
h1{font-weight:700}h1 small{color:#999;font-weight:400}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:22px;margin-top:20px}
figure{margin:0;background:#1e1e18;border-radius:14px;overflow:hidden}
img{width:100%;display:block;background:#000}
figcaption{padding:10px 14px;font-size:13px;color:#cfcabb;line-height:1.5}
figcaption b{color:#F4C430}</style>
<h1>靜態圖卡審核 <small>· 風格 ${styleSlug} · ${manifest.length} 張 · 審核完再 render 動畫</small></h1>
<div class="grid">
${cards}
</div>`);
writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
const files = readdirSync(outDir).filter((f) => f.endsWith(".png"));
console.log(`\n✅ 靜態審核圖：out/stills/（${files.length} 張）。開 out/stills/index.html 一頁看全部。審核完再 render 動畫。`);
