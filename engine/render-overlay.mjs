/*
 * render-overlay.mjs — 疊加層渲染器（字幕＋動態圖卡 → 透明影片）
 * Copyright (c) 2026 Fyn Chang. All rights reserved.
 *
 * 原理：無頭 Chrome 開 templates/overlay.html，逐格 __seek(t) 後截透明 PNG，
 * 串流進 ffmpeg 壓成 qtrle .mov（帶 alpha），之後 compose 疊到底片上。
 *
 * 用法：node engine/render-overlay.mjs <專案資料夾>
 * 產出：work/overlay.mov
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import puppeteer from "puppeteer-core";
import { ffmpegPath, chromePath, ensureDir, probeDuration, runBg } from "./util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(__dirname, "..");
const projDir = path.resolve(process.argv[2] || ".");
const work = ensureDir(path.join(projDir, "work"));

const script = JSON.parse(readFileSync(path.join(projDir, "script.json"), "utf8"));
const FPS = script.fps || 30;
const W = script.width || 1080, H = script.height || 1920;

// 疊加層長度 = 底片長度（保證完全對齊）
const baseDur = probeDuration(path.join(work, "base.mp4"));
const scriptForBrowser = { ...script, duration: baseDur };

/* ---------- 小型靜態伺服器（服務 templates/ 與專案 assets/） ---------- */
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".woff2": "font/woff2", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };

const server = http.createServer((req, res) => {
  try {
    const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = null;
    if (u === "/__script.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(scriptForBrowser));
      return;
    }
    if (u.startsWith("/assets/")) file = path.join(projDir, u);       // 專案素材（頭像等）
    else file = path.join(KIT, "templates", u);                        // 模板本體
    const data = readFileSync(file);
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

/* ---------- Chrome ---------- */
const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: true,
  args: [
    "--no-sandbox", "--disable-gpu", "--force-color-profile=srgb",
    "--disable-lcd-text", "--hide-scrollbars", `--window-size=${W},${H}`,
    "--font-render-hinting=none",
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/overlay.html?script=/__script.json`, { waitUntil: "networkidle0" });
await page.waitForFunction("window.__ready === true", { timeout: 30000 });
const err = await page.evaluate("window.__error || null");
if (err) { console.error("overlay.html 執行錯誤：\n" + err); process.exit(1); }

/* ---------- ffmpeg 收 PNG 串流 → qtrle mov ---------- */
const FF = ffmpegPath();
const outMov = path.join(work, "overlay.mov");
const ff = runBg(FF, [
  "-y", "-v", "error",
  "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
  "-c:v", "qtrle", "-pix_fmt", "argb", outMov,
]);
ff.stderr.on("data", (d) => process.stderr.write(d));

const frames = Math.ceil(baseDur * FPS);
console.log(`渲染疊加層：${frames} 格 @ ${FPS}fps（${baseDur.toFixed(1)}s）`);
const t0 = Date.now();

const cdp = await page.createCDPSession();
// 透明背景（qtrle 需要真 alpha）
await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
for (let i = 0; i < frames; i++) {
  const t = i / FPS;
  await page.evaluate((tt) => window.__seek(tt), t);
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png", fromSurface: true, captureBeyondViewport: false,
  });
  const buf = Buffer.from(shot.data, "base64");
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 150 === 0 && i > 0) {
    const fps = i / ((Date.now() - t0) / 1000);
    console.log(`  ${i}/${frames}（${fps.toFixed(1)} fps，預估剩 ${((frames - i) / fps).toFixed(0)}s）`);
  }
}
ff.stdin.end();
await new Promise((r, j) => { ff.on("exit", (c) => (c === 0 ? r() : j(new Error("ffmpeg exit " + c)))); });
await browser.close();
server.close();

console.log(`\n✅ 疊加層完成：work/overlay.mov（${((Date.now() - t0) / 1000).toFixed(0)}s）`);
