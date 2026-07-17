/*
 * captions.js — 「為你剪片」雙語字幕引擎
 * Copyright (c) 2026 Fyn Chang. All rights reserved.
 *
 * lines 格式（時間 = 最終成品時間軸秒數）：
 *   { s, e, zh: "可含 <hl>金色關鍵字</hl> 與 <chip>黃貼片字</chip>", en: "english line",
 *     lift: 1320  // 選填：這句期間整個字幕帶抬高（如全螢幕 B-roll 遮住下半部時） }
 */
(function (global) {
  "use strict";

  function renderZH(s) {
    return (s || "")
      .replace(/<hl>/g, '<span class="hl">').replace(/<\/hl>/g, "</span>")
      .replace(/<chip>/g, '<span class="chip">').replace(/<\/chip>/g, "</span>");
  }

  global.WNCaptions = {
    build(stage, lines, tl) {
      const CAPB = (global.WNLAYOUT && global.WNLAYOUT.capBottom != null) ? global.WNLAYOUT.capBottom : 630;
      const capStage = document.createElement("div");
      capStage.className = "wn-cap-stage";
      capStage.id = "wn-cap-stage";
      stage.appendChild(capStage);

      // 正規化：字幕可用 {s,e} 或 {t:[a,b]}（跟 mg 一致），兩者皆可
      (lines || []).forEach((ln) => { if (ln.t) { if (ln.s == null) ln.s = ln.t[0]; if (ln.e == null) ln.e = ln.t[1]; } });
      (lines || []).forEach((ln, i) => {
        const wrap = document.createElement("div");
        wrap.className = "wn-cap-line";
        wrap.id = "wn-cap-" + i;
        const zh = document.createElement("div");
        zh.className = "wn-cap-zh";
        zh.innerHTML = renderZH(ln.zh);
        wrap.appendChild(zh);
        if (ln.en) {
          const en = document.createElement("div");
          en.className = "wn-cap-en";
          en.textContent = ln.en;
          wrap.appendChild(en);
        }
        capStage.appendChild(wrap);

        const next = lines[i + 1];
        // 句尾停留最多 0.5s，或到下一句開始
        const hideAt = next ? Math.min(next.s, ln.e + 0.5) : ln.e;
        tl.show(wrap, ln.s, hideAt, { fade: 0.12 });
      });

      // 字幕帶抬高（B-roll 全螢幕時段）
      let liftStart = null, liftTo = null;
      (lines || []).forEach((ln) => {
        if (ln.lift && liftStart === null) { liftStart = ln.s; liftTo = ln.lift; }
        if (!ln.lift && liftStart !== null) {
          tl.onProgress(liftStart, 0.0001, () => { capStage.style.bottom = liftTo + "px"; });
          tl.onProgress(ln.s, 0.0001, () => { capStage.style.bottom = CAPB + "px"; });
          liftStart = null;
        }
      });
      if (liftStart !== null) {
        tl.onProgress(liftStart, 0.0001, () => { capStage.style.bottom = liftTo + "px"; });
      }
      return capStage;
    },
  };
})(window);
