/*
 * mg-extra.js — 「為你剪片」進階語義動畫元件（橫式/直式通用）
 * Copyright (c) 2026 Fyn Chang. All rights reserved.
 *
 * 方言中立：每個 builder 收 (env, spec, i)，env 由宿主提供——
 *   builtin 路徑（overlay.html / stills）：本檔尾端自動掛進 WNMG.BUILDERS
 *   Hyperframes 路徑（gen-comps.mjs）：mg.html 內嵌本檔後用 GSAP env 註冊
 *
 * env 介面：
 *   stage, L:{W,H,centerX,cardTop,landscape}, iconHTML(s), fmtNum(n),
 *   el(id, cls, style, html, x)   置中可覆寫 x 的絕對定位元素（wn-beat）
 *   full(id, html)                滿版 inset:0 圖層（wn-beat、無置中 transform）
 *   A.popIn(el,start) popOut(el,start) fadeIn(el,start,dur) fadeOut(el,start,dur)
 *   A.fadeTo(el,from,to,start,dur) float(el,start,end,amp)
 *   A.prog(start,dur,fn,ease)     逐格 fn(p)；ease ∈ out|in|inout|linear
 */
(function (global) {
  "use strict";

  const GOLD = "#F4C430", GOLD_DEEP = "#B8860B", RED = "#E0554D", GREEN = "#3ECF8E", INK = "#0d0d0d";
  const GLASS = "background:rgba(255,255,255,0.16);backdrop-filter:blur(16px) saturate(1.25);" +
    "-webkit-backdrop-filter:blur(16px) saturate(1.25);border:1px solid rgba(255,255,255,0.55);" +
    "border-radius:30px;box-shadow:0 12px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.6);";
  const MASCOT_PX = function (s) {
    // Claude 像素小獸（132×108 viewBox 內容，縮放 s）
    return '<g transform="scale(' + s + ')"><rect x="24" y="0" width="84.5" height="12.5" fill="#C57A5A"/><rect x="24" y="12" width="84.5" height="12.5" fill="#C57A5A"/><rect x="24" y="24" width="84.5" height="12.5" fill="#C57A5A"/><rect x="24" y="36" width="84.5" height="12.5" fill="#C57A5A"/><rect x="12" y="48" width="108.5" height="12.5" fill="#C57A5A"/><rect x="12" y="60" width="108.5" height="12.5" fill="#C57A5A"/><rect x="24" y="72" width="84.5" height="12.5" fill="#C57A5A"/><rect x="24" y="84" width="12.5" height="12.5" fill="#C57A5A"/><rect x="48" y="84" width="12.5" height="12.5" fill="#C57A5A"/><rect x="72" y="84" width="12.5" height="12.5" fill="#C57A5A"/><rect x="96" y="84" width="12.5" height="12.5" fill="#C57A5A"/><rect x="24" y="96" width="12.5" height="12.5" fill="#C57A5A"/><rect x="48" y="96" width="12.5" height="12.5" fill="#C57A5A"/><rect x="72" y="96" width="12.5" height="12.5" fill="#C57A5A"/><rect x="96" y="96" width="12.5" height="12.5" fill="#C57A5A"/><rect x="39" y="15" width="18" height="18" rx="2" fill="#141414"/><rect x="75" y="15" width="18" height="18" rx="2" fill="#141414"/></g>';
  };

  function clamp01(v) { return Math.min(1, Math.max(0, v)); }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); } // p 在 [a,b] 區段內的 0..1

  const DEFS = {

    /** 常駐品牌浮水印（頂部半透明兩行字）：
     *  {type:"watermark", t:[開,關], text:"高雄空調先生｜小吳", sub:"TLE:0916165113", top, size}
     *  預設 top:330、size:56；整支顯示就把 t 設 [封面結束, 片長]。 */
    watermark(env, spec, i) {
      const size = spec.size || 56;
      const el = env.el("mg-" + i, "",
        "top:" + (spec.top != null ? spec.top : 330) + "px; display:flex; flex-direction:column; align-items:center; gap:4px;" +
        "background:rgba(255,255,255,0.10); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);" +
        "border-radius:24px; padding:16px 46px 18px;",
        '<div style="font-family:\'Noto Sans TC\',sans-serif; font-weight:500; font-size:' + size + 'px;' +
        ' color:rgba(255,255,255,0.68); letter-spacing:0.08em; white-space:nowrap;' +
        ' text-shadow:0 2px 12px rgba(0,0,0,0.28);">' + (spec.text || "") + "</div>" +
        (spec.sub ? '<div style="font-family:Montserrat,\'Noto Sans TC\',sans-serif; font-weight:700; font-size:' + Math.round(size * 0.86) + 'px;' +
        ' color:rgba(255,255,255,0.62); letter-spacing:0.1em; white-space:nowrap;' +
        ' text-shadow:0 2px 12px rgba(0,0,0,0.28);">' + spec.sub + "</div>" : ""),
        spec.x);
      env.A.fadeIn(el, (spec.t && spec.t[0]) || 0, 0.15);
    },

    /** 封面卡（放在 0~0.15s 當 0.1s 關鍵幀縮圖）：
     *  {type:"cover", t:[0,0.15], img:"assets/cover-bg.jpg",
     *   topAccent:"新家裝潢", topWhite:"管線藏得漂亮", big:"藏管線", sub:"記住這 3 個時間點"}
     *  版式＝小吳統一封面：頂部橘字＋白字一行、下方超大橘色主標＋白色副標，全部粗黑描邊。 */
    cover(env, spec, i) {
      const ORANGE = spec.color || "#FFA028";
      const stroke = function (px) {
        return "-webkit-text-stroke:" + px + "px #000; paint-order:stroke fill;" +
          " text-shadow:0 6px 18px rgba(0,0,0,0.45);";
      };
      const el = env.full("mg-" + i,
        (spec.img ? '<img src="' + spec.img + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">' : "") +
        '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.32) 0%,rgba(0,0,0,0) 30%,rgba(0,0,0,0) 52%,rgba(0,0,0,0.30) 100%);"></div>' +
        '<div style="position:absolute; top:' + (spec.topY != null ? spec.topY : 380) + 'px; left:0; right:0;' +
        ' display:flex; justify-content:center; align-items:baseline; gap:26px;">' +
        (spec.topAccent ? '<span style="font-family:\'Noto Serif TC\',serif; font-weight:900; font-size:118px;' +
          ' color:' + ORANGE + ";" + stroke(12) + '">' + spec.topAccent + "</span>" : "") +
        (spec.topWhite ? '<span style="font-family:\'Noto Serif TC\',serif; font-weight:900; font-size:72px;' +
          " color:#fff;" + stroke(9) + '">' + spec.topWhite + "</span>" : "") +
        "</div>" +
        (spec.big ? '<div style="position:absolute; top:' + (spec.bigY != null ? spec.bigY : 1080) + 'px; left:0; right:0;' +
          " text-align:center; font-family:'Noto Serif TC',serif; font-weight:900; font-size:230px; line-height:1;" +
          " color:" + ORANGE + ";" + stroke(16) + '">' + spec.big + "</div>" : "") +
        (spec.sub ? '<div style="position:absolute; top:' + (spec.subY != null ? spec.subY : 1360) + 'px; left:0; right:0;' +
          " text-align:center; font-family:'Noto Serif TC',serif; font-weight:900; font-size:104px; line-height:1.15;" +
          " color:#fff;" + stroke(12) + '">' + spec.sub + "</div>" : ""));
      // 第 0 幀就要完整顯示（IG 縮圖抓第一幀）：inline 直接可見、不淡入；
      // 結束用硬切（0.03s ≈ 一幀），直接接正片
      el.style.opacity = "1"; el.style.visibility = "visible";
      env.A.fadeOut(el, spec.t[1], 0.03);
    },

    /** 壓接示範小動畫：{type:"crimpDemo", t:[開,關], top, label}
     *  銅線滑入壓接端子套筒 → 壓接鉗上下夾合 → 「咔!」閃光＋壓痕 → 標籤。
     *  讓觀眾 3 秒看懂「壓接」長什麼樣子。 */
    crimpDemo(env, spec, i) {
      const P = "mg-" + i;
      const el = env.el(P, "wn-glass",
        "top:" + (spec.top != null ? spec.top : env.L.cardTop) + "px; flex-direction:column; gap:10px; padding:24px 36px;",
        '<svg viewBox="0 0 560 240" width="520" xmlns="http://www.w3.org/2000/svg">' +
        // 壓接端子：左邊 Y 型叉 + 金屬套筒
        '<g id="' + P + '-term">' +
        '<path d="M120 120 L70 88 Q56 80 62 70 L70 58 Q76 50 88 58 L150 100 Z" fill="#D4AF37"/>' +
        '<path d="M120 120 L70 152 Q56 160 62 170 L70 182 Q76 190 88 182 L150 140 Z" fill="#D4AF37"/>' +
        '<g id="' + P + '-barrel"><rect x="150" y="94" width="150" height="52" rx="14" fill="#E8C15A" stroke="#B8860B" stroke-width="4"/>' +
        '<line id="' + P + '-d1" x1="185" y1="98" x2="185" y2="142" stroke="#8a6508" stroke-width="7" stroke-linecap="round" opacity="0"/>' +
        '<line id="' + P + '-d2" x1="255" y1="98" x2="255" y2="142" stroke="#8a6508" stroke-width="7" stroke-linecap="round" opacity="0"/></g></g>' +
        // 電線：外皮＋裸銅絲（從右滑入）
        '<g id="' + P + '-wire">' +
        '<line x1="305" y1="120" x2="360" y2="120" stroke="#C87533" stroke-width="16" stroke-linecap="round"/>' +
        '<line x1="308" y1="112" x2="352" y2="110" stroke="#E39A5B" stroke-width="4" stroke-linecap="round"/>' +
        '<line x1="308" y1="128" x2="352" y2="130" stroke="#9c5a26" stroke-width="4" stroke-linecap="round"/>' +
        '<rect x="355" y="98" width="190" height="44" rx="20" fill="#3a3f4a"/></g>' +
        // 壓接鉗上下鉗口
        '<g id="' + P + '-jawT"><polygon points="195,10 255,10 245,66 205,66" fill="#4a4f58"/>' +
        '<rect x="203" y="60" width="44" height="12" rx="4" fill="#2e323a"/></g>' +
        '<g id="' + P + '-jawB"><polygon points="195,230 255,230 245,174 205,174" fill="#4a4f58"/>' +
        '<rect x="203" y="168" width="44" height="12" rx="4" fill="#2e323a"/></g>' +
        // 閃光＋咔
        '<g id="' + P + '-flash" opacity="0">' +
        '<line x1="160" y1="70" x2="140" y2="46" stroke="#FFD700" stroke-width="7" stroke-linecap="round"/>' +
        '<line x1="290" y1="70" x2="310" y2="46" stroke="#FFD700" stroke-width="7" stroke-linecap="round"/>' +
        '<line x1="160" y1="170" x2="140" y2="194" stroke="#FFD700" stroke-width="7" stroke-linecap="round"/>' +
        '<line x1="290" y1="170" x2="310" y2="194" stroke="#FFD700" stroke-width="7" stroke-linecap="round"/>' +
        '<text x="345" y="66" font-family="Noto Sans TC" font-weight="900" font-size="52" fill="#FFD700" stroke="#000" stroke-width="2">咔!</text></g>' +
        "</svg>" +
        '<div class="wn-sub-pill">' + (spec.label || "壓接端子：把線咬得又緊又牢") + "</div>",
        spec.x);
      const a = spec.t[0], b = spec.t[1];
      const q = function (id) { return el.querySelector("#" + P + "-" + id); };
      const wire = q("wire"), jT = q("jawT"), jB = q("jawB"),
        barrel = q("barrel"), flash = q("flash"), d1 = q("d1"), d2 = q("d2");
      // 進場
      env.A.popIn(el, a);
      env.A.float(el, a + 0.5, b, 6);
      // 1) 銅線滑入套筒
      wire.setAttribute("transform", "translate(90 0)");
      env.A.prog(a + 0.35, 0.7, function (p) {
        wire.setAttribute("transform", "translate(" + (90 * (1 - p)) + " 0)");
      }, "out");
      // 2) 鉗口夾合＋套筒壓扁
      jT.setAttribute("transform", "translate(0 -90)");
      jB.setAttribute("transform", "translate(0 90)");
      env.A.prog(a + 1.25, 0.45, function (p) {
        jT.setAttribute("transform", "translate(0 " + (-90 * (1 - p)) + ")");
        jB.setAttribute("transform", "translate(0 " + (90 * (1 - p)) + ")");
        const sy = 1 - 0.18 * p;
        barrel.setAttribute("transform", "translate(0 " + (120 * (1 - sy)) + ") scale(1 " + sy + ")");
      }, "inout");
      // 3) 咔！閃光＋壓痕
      env.A.prog(a + 1.7, 0.25, function (p) {
        flash.setAttribute("opacity", String(p));
        d1.setAttribute("opacity", String(p)); d2.setAttribute("opacity", String(p));
      }, "out");
      env.A.prog(a + 2.6, 0.4, function (p) { flash.setAttribute("opacity", String(1 - p)); }, "inout");
      // 4) 鉗口鬆開（留下壓好的端子）
      env.A.prog(a + 2.7, 0.4, function (p) {
        jT.setAttribute("transform", "translate(0 " + (-90 * p) + ")");
        jB.setAttribute("transform", "translate(0 " + (90 * p) + ")");
      }, "inout");
      env.A.popOut(el, b - 0.25);
    },

    /** 小獸辛苦打電腦：{type:"mascotWork", t, x, top, scale} */
    mascotWork(env, spec, i) {
      const sc = spec.scale || 1;
      const el = env.el("mg-" + i, "", "top:" + (spec.top != null ? spec.top : env.L.cardTop) + "px;", "", spec.x);
      el.innerHTML =
        '<div id="mg-' + i + '-halo" style="position:absolute;left:50%;top:56%;width:' + 640 * sc + 'px;height:' + 470 * sc +
          'px;transform:translate(-50%,-50%);background:radial-gradient(closest-side, rgba(244,196,48,0.72), rgba(244,196,48,0.2) 58%, transparent 80%);filter:blur(10px);"></div>' +
        '<svg viewBox="0 0 300 210" width="' + 440 * sc + '" style="position:relative;filter:drop-shadow(0 0 22px rgba(244,196,48,0.9)) drop-shadow(0 0 46px rgba(244,196,48,0.5)) drop-shadow(0 10px 26px rgba(0,0,0,0.4));" xmlns="http://www.w3.org/2000/svg">' +
          '<text id="mg-' + i + '-e1" x="26" y="44" font-size="30">✂️</text>' +
          '<text id="mg-' + i + '-e2" x="132" y="30" font-size="30">✨</text>' +
          '<g id="mg-' + i + '-body" transform="translate(28,34)">' + MASCOT_PX(1.05) + '</g>' +
          '<g id="mg-' + i + '-laptop">' +
            '<path d="M170,166 L296,166 L288,182 L178,182 Z" fill="#3a3a40"/>' +
            '<rect x="176" y="104" width="112" height="62" rx="6" fill="#1f1f22" stroke="#111" stroke-width="2"/>' +
            '<rect id="mg-' + i + '-c0" x="186" y="114" width="40" height="10" rx="2" fill="' + GREEN + '"/>' +
            '<rect id="mg-' + i + '-c1" x="230" y="114" width="46" height="10" rx="2" fill="rgba(255,255,255,.35)"/>' +
            '<rect id="mg-' + i + '-c2" x="186" y="130" width="70" height="9" rx="2" fill="rgba(255,255,255,.28)"/>' +
            '<rect id="mg-' + i + '-c3" x="186" y="144" width="52" height="9" rx="2" fill="' + GREEN + '" opacity=".8"/>' +
          '</g></svg>';
      const a = spec.t[0], b = spec.t[1];
      env.A.popIn(el, a);
      env.A.float(el, a + 0.5, b, 5);
      env.A.popOut(el, b - 0.25);
      const body = el.querySelector("#mg-" + i + "-body");
      const halo = el.querySelector("#mg-" + i + "-halo");
      const e1 = el.querySelector("#mg-" + i + "-e1"), e2 = el.querySelector("#mg-" + i + "-e2");
      const rows = [0, 1, 2, 3].map(function (k) { return el.querySelector("#mg-" + i + "-c" + k); });
      const dur = Math.max(0.5, b - a - 0.5);
      env.A.prog(a + 0.4, dur, function (p) {
        const tt = p * dur;
        body.setAttribute("transform", "translate(28," + (34 + Math.abs(Math.sin(tt * Math.PI * 3.2)) * -4).toFixed(1) + ")");
        halo.style.opacity = (0.75 + 0.25 * Math.sin(tt * Math.PI * 1.4)).toFixed(2);
        rows.forEach(function (r, k) { r.style.opacity = ((Math.floor(tt * 2.4) + k) % 4) < 2 ? "0.95" : "0.28"; });
        e1.setAttribute("y", (44 + Math.sin(tt * 2.1) * 5).toFixed(1));
        e2.setAttribute("y", (30 + Math.cos(tt * 1.7) * 5).toFixed(1));
      }, "linear");
      return el;
    },

    /** 發光大英文字（可帶 icon）：{type:"glowText", t, text, icon, x, top, size} */
    glowText(env, spec, i) {
      const fs = spec.size || 88;
      let el;
      if (spec.behind) {
        // 滿版半透明大字，在人物「身後」（中心挖洞漸隱）
        const W = env.L.W, H = env.L.H;
        const hole = spec.hole || { x: W * 0.5, y: H * 0.6, r: 420 };
        const mask = "radial-gradient(circle at " + hole.x + "px " + hole.y + "px, transparent 0px, transparent " +
          Math.round(hole.r * 0.6) + "px, rgba(0,0,0,0.55) " + hole.r + "px, #000 " + Math.round(hole.r * 1.35) + "px)";
        el = env.full("mg-" + i, "");
        el.setAttribute("style", "position:absolute;inset:0;opacity:" + (spec.opacity != null ? spec.opacity : 0.8) +
          ";-webkit-mask-image:" + mask + ";mask-image:" + mask +
          ";display:flex;align-items:center;justify-content:center;padding-bottom:" + (spec.dy != null ? spec.dy : 240) + "px;");
      } else {
        el = env.el("mg-" + i, "", "top:" + (spec.top != null ? spec.top : env.L.cardTop) +
          "px;display:flex;flex-direction:column;align-items:center;gap:18px;", "", spec.x);
      }
      const textCss = "font-family:'Montserrat',sans-serif;font-weight:800;font-size:" + fs +
        "px;line-height:1.05;white-space:nowrap;letter-spacing:0.01em;";
      let ic = spec.icon ? env.iconHTML(spec.icon) : "";
      if (ic) ic = ic.replace(/width="[0-9.]+"/, 'width="' + (spec.iconSize || 96) + '"');
      el.innerHTML =
        (ic ? '<div style="filter:drop-shadow(0 0 22px rgba(244,196,48,0.55));line-height:0;">' + ic + "</div>" : "") +
        '<div style="position:relative;">' +
          '<div id="mg-' + i + '-glow" style="position:absolute;inset:0;' + textCss + 'color:' + GOLD + ';filter:blur(16px);opacity:0.7;">' + spec.text + "</div>" +
          '<div style="position:relative;' + textCss + 'color:#fff;text-shadow:0 0 14px rgba(244,196,48,0.75),0 0 44px rgba(244,196,48,0.45),0 3px 12px rgba(0,0,0,0.55);">' + spec.text + "</div>" +
        "</div>";
      const a = spec.t[0], b = spec.t[1];
      env.A.popIn(el, a);
      env.A.float(el, a + 0.5, b, 6);
      env.A.popOut(el, b - 0.25);
      const glow = el.querySelector("#mg-" + i + "-glow");
      const dur = Math.max(0.5, b - a - 0.5);
      env.A.prog(a + 0.3, dur, function (p) {
        glow.style.opacity = (0.55 + 0.35 * Math.sin(p * dur * Math.PI * 1.6)).toFixed(2);
      }, "linear");
      return el;
    },

    /** app logo 劃掉：{type:"iconStrike", t, icon, text, x, top} */
    iconStrike(env, spec, i) {
      const isImg = /\.(png|jpg|jpeg|svg|webp)$/i.test(spec.icon || "");
      const iconHtml = isImg
        ? '<img src="' + spec.icon + '" style="width:116px;height:116px;object-fit:contain;border-radius:26px;box-shadow:0 8px 24px rgba(0,0,0,0.4);">'
        : env.iconHTML(spec.icon);
      const el = env.el("mg-" + i, "", "top:" + (spec.top != null ? spec.top : env.L.cardTop) + "px;" + GLASS +
        "display:flex;flex-direction:column;align-items:center;gap:12px;padding:26px 40px;", "", spec.x);
      el.innerHTML =
        '<div id="mg-' + i + '-box" style="position:relative;display:flex;flex-direction:column;align-items:center;gap:12px;">' +
          iconHtml +
          (spec.text ? '<div style="font-family:\'Montserrat\',\'Noto Sans TC\',sans-serif;font-weight:700;font-size:26px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.5);">' + spec.text + "</div>" : "") +
          '<div id="mg-' + i + '-line" style="position:absolute;left:-8%;top:48%;height:9px;width:0;background:' + RED +
            ';border-radius:5px;transform:rotate(-14deg);transform-origin:left center;box-shadow:0 2px 10px rgba(0,0,0,0.45);"></div>' +
        "</div>";
      const a = spec.t[0], b = spec.t[1];
      env.A.popIn(el, a);
      env.A.popOut(el, b - 0.25);
      const line = el.querySelector("#mg-" + i + "-line");
      const box = el.querySelector("#mg-" + i + "-box");
      env.A.prog(a + 0.4, 0.35, function (p) { line.style.width = (p * 116) + "%"; }, "out");
      env.A.prog(a + 0.75, 0.3, function (p) { box.style.opacity = String(1 - 0.35 * p); }, "out");
      return el;
    },

    /** 剪空白＋降噪 波形語義動畫：{type:"waveTrim", t, x, top, mode:"both|trim|denoise"} */
    waveTrim(env, spec, i) {
      const mode = spec.mode || "both";
      const BAR = 12, GAP = 4, PITCH = BAR + GAP;
      const H0 = [34, 52, 66, 48, 70, 58, 40, 62, 74];          // 前段（含雜訊抖動）
      const HS = [6, 5, 7, 5, 6, 7];                             // 靜音段
      const H1 = [60, 72, 50, 64, 44, 68, 56, 73, 47, 58, 36];   // 後段
      const smooth = function (arr, k0) {
        return arr.map(function (h, k) { return 30 + 26 * Math.sin((k0 + k) * 0.55) + 8; });
      };
      const bars = function (hs, idPrefix) {
        return hs.map(function (h, k) {
          return '<div id="' + idPrefix + k + '" style="width:' + BAR + 'px;height:' + h + 'px;border-radius:4px;background:linear-gradient(180deg,#fff,rgba(255,255,255,0.55));"></div>';
        }).join("");
      };
      const gapW = HS.length * PITCH - GAP;
      const el = env.el("mg-" + i, "", "top:" + (spec.top != null ? spec.top : env.L.cardTop) + "px;" + GLASS +
        "display:flex;flex-direction:column;align-items:center;gap:16px;padding:26px 38px;", "", spec.x);
      el.innerHTML =
        '<div style="display:flex;gap:22px;align-items:center;">' +
          (mode !== "denoise" ? '<div id="mg-' + i + '-tag1" style="background:' + RED + ';color:#fff;font-family:\'Noto Sans TC\';font-weight:900;font-size:26px;border-radius:12px;padding:4px 16px;">剪空白</div>' : "") +
          (mode !== "trim" ? '<div id="mg-' + i + '-tag2" style="background:' + GREEN + ';color:' + INK + ';font-family:\'Noto Sans TC\';font-weight:900;font-size:26px;border-radius:12px;padding:4px 16px;' + (mode === "both" ? "opacity:0.25;" : "") + '">降噪</div>' : "") +
        "</div>" +
        '<div style="position:relative;display:flex;align-items:center;gap:' + GAP + 'px;height:84px;">' +
          bars(H0, "mg-" + i + "-a") +
          '<div id="mg-' + i + '-gap" style="display:flex;gap:' + GAP + 'px;align-items:center;width:' + gapW + 'px;overflow:hidden;flex:none;">' + bars(HS, "mg-" + i + "-s") + "</div>" +
          bars(H1, "mg-" + i + "-b") +
          '<div id="mg-' + i + '-frame" style="position:absolute;left:' + (H0.length * PITCH - GAP / 2 - 5) + 'px;width:' + (gapW + 10) +
            'px;top:26px;height:36px;border:3px dashed ' + RED + ';border-radius:8px;opacity:0;"></div>' +
          '<div id="mg-' + i + '-ok" style="position:absolute;right:-14px;top:-18px;width:44px;height:44px;border-radius:50%;background:' + GREEN +
            ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:28px;opacity:0;transform:scale(0.3);box-shadow:0 6px 18px rgba(0,0,0,0.35);">✓</div>' +
        "</div>";
      const a = spec.t[0], b = spec.t[1];
      env.A.popIn(el, a);
      env.A.popOut(el, b - 0.25);
      const gap = el.querySelector("#mg-" + i + "-gap");
      if (mode === "denoise") {
        gap.style.width = "0px";
        el.querySelector("#mg-" + i + "-frame").style.display = "none";
      }
      const frame = el.querySelector("#mg-" + i + "-frame");
      const ok = el.querySelector("#mg-" + i + "-ok");
      const tag1 = el.querySelector("#mg-" + i + "-tag1") || { style: {} };
      const tag2 = el.querySelector("#mg-" + i + "-tag2") || { style: {} };
      const aBars = H0.map(function (_, k) { return el.querySelector("#mg-" + i + "-a" + k); });
      const bBars = H1.map(function (_, k) { return el.querySelector("#mg-" + i + "-b" + k); });
      const smA = smooth(H0, 0), smB = smooth(H1, H0.length);
      const dur = Math.max(0.8, b - a - 0.6);
      env.A.prog(a + 0.35, dur, function (p) {
        if (mode !== "denoise") {
          // 剪空白：紅框標記 → 塌縮剪掉
          const fEnd = mode === "trim" ? 0.5 : 0.34;
          frame.style.opacity = p < fEnd ? String(0.4 + 0.6 * Math.abs(Math.sin(p * 22))) : String(clamp01(1 - seg(p, fEnd, fEnd + 0.1) * 2));
          const cut = mode === "trim" ? seg(p, 0.5, 0.75) : seg(p, 0.32, 0.5);
          gap.style.width = (gapW * (1 - cut)) + "px";
        }
        if (mode !== "trim") {
          // 降噪：毛邊 → 平滑
          const dn = mode === "denoise" ? seg(p, 0.2, 0.72) : seg(p, 0.55, 0.9);
          aBars.forEach(function (bar, k) { bar.style.height = (H0[k] + (smA[k] - H0[k]) * dn).toFixed(1) + "px"; });
          bBars.forEach(function (bar, k) { bar.style.height = (H1[k] + (smB[k] - H1[k]) * dn).toFixed(1) + "px"; });
          const okp = mode === "denoise" ? seg(p, 0.76, 0.9) : seg(p, 0.86, 0.97);
          ok.style.opacity = String(okp);
          ok.style.transform = "scale(" + (0.3 + 0.85 * okp) + ")";
        }
        if (mode === "both") {
          tag1.style.opacity = p < 0.5 ? "1" : String(1 - 0.7 * seg(p, 0.5, 0.62));
          tag2.style.opacity = String(0.25 + 0.75 * seg(p, 0.52, 0.64));
        }
      }, "linear");
      return el;
    },

    /** 折線圖 count-up：{type:"lineChart", t, value, prefix, suffix, label, x, top, w, h, small} */
    lineChart(env, spec, i) {
      const w = spec.w || 430, h = spec.h || 190;
      const data = [[0, 0.92], [0.1, 0.84], [0.2, 0.87], [0.32, 0.72], [0.44, 0.62], [0.55, 0.66], [0.67, 0.46], [0.78, 0.32], [0.9, 0.2], [1, 0.06]];
      const px = function (d) { return (8 + d[0] * (w - 16)).toFixed(1) + "," + (10 + d[1] * (h - 20)).toFixed(1); };
      const ptsAttr = data.map(px).join(" ");
      const CARD_BG = spec.solid
        ? "background:rgba(14,14,18,0.92);border:1px solid rgba(255,255,255,0.3);border-radius:30px;box-shadow:0 12px 40px rgba(0,0,0,0.45);"
        : GLASS;
      const el = env.el("mg-" + i, "", "top:" + (spec.top != null ? spec.top : env.L.cardTop) + "px;" + CARD_BG +
        "display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px 36px;", "", spec.x);
      el.innerHTML =
        '<div class="wn-gold-num ' + (spec.small ? "small" : "") + '" id="mg-' + i + '-num" style="font-family:\'Noto Sans TC\',\'Montserrat\',sans-serif;font-weight:900;font-size:' +
          (spec.small ? 54 : 72) + 'px;line-height:1;color:' + GOLD + ';text-shadow:0 3px 0 ' + GOLD_DEEP + ',0 8px 22px rgba(0,0,0,0.35);white-space:nowrap;">0</div>' +
        '<svg viewBox="0 0 ' + w + " " + h + '" width="' + w + '" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">' +
          '<line x1="8" y1="' + (h - 10) + '" x2="' + (w - 8) + '" y2="' + (h - 10) + '" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>' +
          '<polyline id="mg-' + i + '-pl" points="' + ptsAttr + '" fill="none" stroke="' + GOLD +
            '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 10px rgba(244,196,48,0.7));"/>' +
          '<circle id="mg-' + i + '-dot" r="9" fill="#fff" stroke="' + GOLD + '" stroke-width="5" style="filter:drop-shadow(0 0 12px rgba(244,196,48,0.95));"/>' +
        "</svg>" +
        (spec.label ? '<div style="font-family:\'Noto Sans TC\';font-weight:900;font-size:28px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.45);">' + spec.label + "</div>" : "");
      const a = spec.t[0], b = spec.t[1];
      env.A.popIn(el, a);
      env.A.float(el, a + 0.6, b, 5);
      env.A.popOut(el, b - 0.25);
      const pl = el.querySelector("#mg-" + i + "-pl");
      const dot = el.querySelector("#mg-" + i + "-dot");
      const num = el.querySelector("#mg-" + i + "-num");
      const L = pl.getTotalLength();
      pl.style.strokeDasharray = String(L);
      pl.style.strokeDashoffset = String(L);
      const target = spec.value || 0;
      env.A.prog(a + 0.25, Math.min(1.6, Math.max(0.8, b - a - 0.6)), function (p) {
        pl.style.strokeDashoffset = String(L * (1 - p));
        const pt = pl.getPointAtLength(L * p);
        dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y);
        num.textContent = (spec.prefix || "") + env.fmtNum(target * p) + (spec.suffix || "");
      }, "out");
      return el;
    },

    /** 卡拉OK跟字（小獸逐字跳）：{type:"karaokeLine", t, text, x, top, size, sub} */
    karaokeLine(env, spec, i) {
      const fs = spec.size || 46, pitch = fs + 10;
      const chars = Array.from(spec.text || "");
      const wTotal = chars.length * pitch - 10;
      const el = env.el("mg-" + i, "", "top:" + (spec.top != null ? spec.top : env.L.cardTop) +
        "px;display:flex;flex-direction:column;align-items:center;gap:20px;", "", spec.x);
      el.innerHTML =
        '<div style="position:relative;width:' + wTotal + 'px;height:' + (fs + 66) + 'px;">' +
          '<div id="mg-' + i + '-mascot" style="position:absolute;left:0;top:0;width:56px;height:46px;margin-left:' + ((fs - 56) / 2) + 'px;">' +
            '<svg viewBox="0 0 132 108" width="56" xmlns="http://www.w3.org/2000/svg">' + MASCOT_PX(1) + "</svg></div>" +
          '<div style="position:absolute;left:0;bottom:0;display:flex;">' +
            chars.map(function (c, k) {
              return '<span id="mg-' + i + "-ch" + k + '" style="display:inline-block;width:' + fs + "px;margin-right:10px;text-align:center;font-family:'Noto Sans TC';font-weight:500;font-size:" + fs +
                'px;color:#fff;text-shadow:-1px -1px 0 rgba(0,0,0,0.4),1px -1px 0 rgba(0,0,0,0.4),-1px 1px 0 rgba(0,0,0,0.4),1px 1px 0 rgba(0,0,0,0.4),0 2px 8px rgba(0,0,0,0.9);">' + c + "</span>";
            }).join("") +
          "</div>" +
        "</div>" +
        (spec.sub ? '<div style="' + GLASS + 'border-radius:100px;padding:10px 28px;font-family:\'Montserrat\',sans-serif;font-weight:700;font-size:26px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.4);">' + spec.sub + "</div>" : "");
      const a = spec.t[0], b = spec.t[1];
      env.A.popIn(el, a);
      env.A.popOut(el, b - 0.2);
      const mascot = el.querySelector("#mg-" + i + "-mascot");
      const spans = chars.map(function (_, k) { return el.querySelector("#mg-" + i + "-ch" + k); });
      const dur = Math.max(0.6, b - a - 0.55);
      env.A.prog(a + 0.35, dur, function (p) {
        const f = p * (chars.length - 0.001);
        const idx = Math.floor(f), frac = f - idx;
        mascot.style.transform = "translate(" + ((idx + frac) * pitch).toFixed(1) + "px," +
          (-Math.abs(Math.sin(frac * Math.PI)) * 26).toFixed(1) + "px)";
        spans.forEach(function (sp, k) {
          const on = k < idx || (k === idx && frac > 0.25);
          sp.style.color = on ? GOLD : "#fff";
          sp.style.fontWeight = on ? "900" : "500";
          sp.style.transform = (k === idx && frac > 0.25) ? "scale(1.16)" : "scale(1)";
        });
      }, "linear");
      return el;
    },

    /** 世界地圖旅行路線（半透明、人物中心挖洞）：
     *  {type:"worldRoute", t, pins:[{id,x,y,zh,en,at,dy}], legs:[{t:[a,b],from,to,mode:"plane|ship"}],
     *   hole:{x,y,r}, opacity} */
    worldRoute(env, spec, i) {
      const W = env.L.W, H = env.L.H;
      const op = spec.opacity != null ? spec.opacity : 0.85;
      const hole = spec.hole || { x: W * 0.5, y: H * 0.62, r: 430 };
      const mask = "radial-gradient(circle at " + hole.x + "px " + hole.y + "px, transparent 0px, transparent " +
        Math.round(hole.r * 0.72) + "px, rgba(0,0,0,0.55) " + hole.r + "px, #000 " + Math.round(hole.r * 1.35) + "px)";
      // 正版世界地圖（ICONS.worldmap，太平洋置中）→ 滿版拉伸＋半透明白重新上色
      let mapSvg = env.iconHTML(spec.mapIcon || "worldmap")
        .replace(/width="[0-9.]+" height="[0-9.]+"/, 'width="' + W + '" height="' + H + '" preserveAspectRatio="none"')
        .replace(/#CBD2D8/gi, "rgba(255,255,255,0.42)");
      const el = env.full("mg-" + i, "");
      el.innerHTML =
        '<div id="mg-' + i + '-map" style="position:absolute;inset:0;opacity:' + op + ';-webkit-mask-image:' + mask + ";mask-image:" + mask + ';filter:drop-shadow(0 4px 30px rgba(0,0,0,0.35));">' +
          mapSvg +
        "</div>" +
        '<svg id="mg-' + i + '-routes" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H +
          '" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0;overflow:visible;"></svg>' +
        '<div id="mg-' + i + '-pins" style="position:absolute;inset:0;"></div>';
      const a = spec.t[0], b = spec.t[1];
      env.A.fadeIn(el, a, 0.6);
      env.A.fadeOut(el, b - 0.5, 0.5);
      const pinsWrap = el.querySelector("#mg-" + i + "-pins");
      const routes = el.querySelector("#mg-" + i + "-routes");
      const byId = {};
      (spec.pins || []).forEach(function (p, k) {
        byId[p.id] = p;
        const dy = p.dy != null ? p.dy : -1;
        const d = document.createElement("div");
        d.id = "mg-" + i + "-pin" + k;
        d.className = "wn-beat";
        // 零尺寸錨點定位：子元素各自絕對置中，兩種動畫引擎的 transform 都不會打架
        d.setAttribute("style", "position:absolute;left:" + p.x + "px;top:" + p.y + "px;width:0;height:0;");
        d.innerHTML =
          '<div style="position:absolute;left:-23px;top:-23px;width:46px;height:46px;border-radius:50%;border:3px solid rgba(244,196,48,0.55);"></div>' +
          '<div style="position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;background:' + GOLD + ';box-shadow:0 0 16px rgba(244,196,48,0.9),0 2px 8px rgba(0,0,0,0.5);"></div>' +
          '<div style="position:absolute;left:0;' + (dy < 0 ? "bottom:26px;" : "top:26px;") + 'transform:translateX(-50%);' + GLASS +
            'border-radius:16px;padding:8px 18px;display:flex;flex-direction:column;align-items:center;white-space:nowrap;">' +
            '<div style="font-family:\'Noto Sans TC\';font-weight:900;font-size:30px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.5);">' + p.zh + "</div>" +
            (p.en ? '<div style="font-family:\'Montserrat\';font-weight:700;font-size:16px;letter-spacing:0.08em;color:rgba(255,255,255,0.85);">' + p.en + "</div>" : "") +
          "</div>";
        pinsWrap.appendChild(d);
        env.A.popIn(d, p.at != null ? p.at : a + 0.4);
        env.A.fadeOut(d, b - 0.5, 0.5);
      });
      (spec.legs || []).forEach(function (leg, k) {
        const P = byId[leg.from], Q = byId[leg.to];
        if (!P || !Q) return;
        const x1 = P.x, y1 = P.y, x2 = Q.x, y2 = Q.y;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const dx = x2 - x1, dyv = y2 - y1, len = Math.sqrt(dx * dx + dyv * dyv);
        const cxx = mx, cyy = my - len * 0.27; // 控制點上拋成弧線（拉高避開人物頭頂）
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M" + x1 + "," + y1 + " Q" + cxx + "," + cyy + " " + x2 + "," + y2);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", GOLD);
        path.setAttribute("stroke-width", "5");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-dasharray", "4 16");
        path.style.filter = "drop-shadow(0 0 8px rgba(244,196,48,0.8))";
        routes.appendChild(path);
        const Ln = path.getTotalLength();
        const veh = document.createElement("div");
        veh.id = "mg-" + i + "-veh" + k;
        veh.setAttribute("style", "position:absolute;left:0;top:0;font-size:40px;line-height:1;opacity:0;" +
          "filter:drop-shadow(0 4px 10px rgba(0,0,0,0.5));");
        veh.textContent = leg.mode === "ship" ? "🚢" : "✈️";
        pinsWrap.appendChild(veh);
        const la = leg.t[0], lb = leg.t[1];
        // 路徑逐步顯現 + 交通工具沿線移動
        path.style.strokeDashoffset = "0";
        const clipTotal = Ln;
        path.setAttribute("stroke-dasharray", clipTotal + " " + clipTotal);
        path.style.strokeDashoffset = String(clipTotal);
        env.A.prog(la, Math.max(0.4, lb - la), function (p) {
          path.style.strokeDashoffset = String(clipTotal * (1 - p));
          const pt = path.getPointAtLength(clipTotal * p);
          veh.style.opacity = p <= 0.02 ? String(p * 50) : (p >= 0.97 ? String((1 - p) * 33) : "1");
          const flip = x2 < x1 ? "scaleX(-1)" : "";
          veh.style.transform = "translate(" + (pt.x - 20) + "px," + (pt.y - 20) + "px) " + flip;
        }, "inout");
      });
      return el;
    },

    /** 三步圖解卡：{type:"flowDiagram", t, steps:[{icon,text,sub}], x, top, dir:"row|col"} */
    flowDiagram(env, spec, i) {
      const col = spec.dir === "col";
      const el = env.el("mg-" + i, "", "top:" + (spec.top != null ? spec.top : env.L.cardTop) +
        "px;display:flex;flex-direction:" + (col ? "column" : "row") + ";align-items:center;gap:6px;", "", spec.x);
      const steps = spec.steps || [];
      const parts = [];
      steps.forEach(function (st, k) {
        if (k > 0) parts.push('<div id="mg-' + i + "-ar" + k + '" style="position:relative;color:' + GOLD + ';font-size:44px;line-height:1;text-shadow:0 3px 10px rgba(0,0,0,0.5);' +
          (col ? "transform:rotate(90deg);margin:2px 0;" : "margin:0 6px;") + '">➜</div>');
        parts.push('<div id="mg-' + i + "-st" + k + '" style="position:relative;' + GLASS + 'display:flex;align-items:center;gap:14px;padding:16px 26px;border-radius:22px;">' +
          '<div style="font-size:42px;line-height:1;">' + (st.icon || "") + "</div>" +
          '<div style="display:flex;flex-direction:column;">' +
            '<div style="font-family:\'Noto Sans TC\';font-weight:900;font-size:30px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.5);white-space:nowrap;">' + st.text + "</div>" +
            (st.sub ? '<div style="font-family:\'Noto Sans TC\';font-weight:500;font-size:20px;color:rgba(255,255,255,0.85);white-space:nowrap;">' + st.sub + "</div>" : "") +
          "</div></div>");
      });
      el.innerHTML = parts.join("");
      const a = spec.t[0], b = spec.t[1];
      env.A.fadeIn(el, a, 0.15);
      env.A.float(el, a + steps.length * 0.55 + 0.3, b, 5);
      env.A.popOut(el, b - 0.25);
      steps.forEach(function (_, k) {
        const st = el.querySelector("#mg-" + i + "-st" + k);
        st.classList.add("wn-beat");
        env.A.popIn(st, a + 0.1 + k * 0.55);
        if (k > 0) {
          const ar = el.querySelector("#mg-" + i + "-ar" + k);
          ar.classList.add("wn-beat");
          env.A.fadeIn(ar, a + k * 0.55, 0.25);
        }
      });
      return el;
    },
  };

  /* ---------- builtin（WNTimeline）掛載 ---------- */
  function builtinEnv(stage, tl, global) {
    const L = (global.WNLAYOUT || { W: 1080, H: 1920, centerX: 540, cardTop: 1330, landscape: false });
    return {
      stage: stage, L: L,
      iconHTML: global.WNMG._iconHTML,
      fmtNum: global.WNMG._fmtNum,
      el: function (id, cls, style, html, x) {
        const d = document.createElement("div");
        d.id = id; d.className = "wn-beat " + (cls || "");
        d.setAttribute("style", "left:" + (x != null ? x : L.centerX) + "px;" + (style || ""));
        d.dataset.baseTransform = "translateX(-50%)";
        d.innerHTML = html || "";
        stage.appendChild(d);
        return d;
      },
      full: function (id, html) {
        const d = document.createElement("div");
        d.id = id; d.className = "wn-beat";
        d.setAttribute("style", "position:absolute;inset:0;");
        d.dataset.baseTransform = "";
        d.innerHTML = html || "";
        stage.appendChild(d);
        return d;
      },
      A: {
        popIn: function (el, start) { tl.popIn(el, { start: start }); },
        popOut: function (el, start) { tl.popOut(el, { start: start }); },
        fadeIn: function (el, start, dur) { tl.fromTo(el, { opacity: 0 }, { opacity: 1 }, { start: start, dur: dur || 0.3, ease: "outQuad" }); },
        fadeOut: function (el, start, dur) { tl.fromTo(el, { opacity: 1 }, { opacity: 0 }, { start: start, dur: dur || 0.3, ease: "inQuad" }); },
        fadeTo: function (el, from, to, start, dur) { tl.fromTo(el, { opacity: from }, { opacity: to }, { start: start, dur: dur || 0.3, ease: "inOutSine" }); },
        float: function (el, start, end, amp) { tl.float(el, { start: start, end: end, amp: amp || 6 }); },
        prog: function (start, dur, fn, ease) {
          const map = { out: "outCubic", "in": "inQuad", inout: "inOutSine", linear: "linear" };
          tl.onProgress(start, dur, fn, map[ease] || "outCubic");
        },
      },
    };
  }

  global.WNMGX = {
    DEFS: DEFS,
    installBuiltin: function (WNMG) {
      Object.keys(DEFS).forEach(function (k) {
        WNMG.BUILDERS[k] = function (stage, spec, tl, i) {
          return DEFS[k](builtinEnv(stage, tl, global), spec, i);
        };
      });
    },
  };
  if (global.WNMG) global.WNMGX.installBuiltin(global.WNMG);
})(window);
