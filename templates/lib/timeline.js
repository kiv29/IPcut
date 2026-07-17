/*
 * timeline.js — 「為你剪片」原創的極簡定格動畫引擎
 * Copyright (c) 2026 Fyn Chang. All rights reserved.
 *
 * 設計目標：完全由 seek(t) 驅動、100% 決定性（同一個 t 永遠畫出同一格），
 * 給無頭瀏覽器逐格截圖用。不依賴 requestAnimationFrame、不依賴任何外部函式庫。
 *
 * 規則：
 * - 每個 prop（x/y/scale/rotation/opacity）在同一元素上，由「最後一個已開始的 tween」決定值。
 * - t 在 tween 開始前 → 該 tween 完全不影響畫面（元素靠 CSS 預設隱藏）。
 * - t 在 tween 結束後 → 停在結束值（repeat/yoyo 另計）。
 */
(function (global) {
  "use strict";

  /* ---------- 緩動函式 ---------- */
  const Ease = {
    linear: (p) => p,
    inQuad: (p) => p * p,
    outQuad: (p) => 1 - (1 - p) * (1 - p),
    inOutQuad: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
    outCubic: (p) => 1 - Math.pow(1 - p, 3),
    inCubic: (p) => p * p * p,
    inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
    outSine: (p) => Math.sin((p * Math.PI) / 2),
    inQuint: (p) => p * p * p * p * p,
    // 帶回彈的 pop 進場
    outBack: (p) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    },
    outBackSoft: (p) => {
      const c1 = 1.2, c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    },
    outBounce: (p) => {
      const n1 = 7.5625, d1 = 2.75;
      if (p < 1 / d1) return n1 * p * p;
      if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + 0.75;
      if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + 0.9375;
      return n1 * (p -= 2.625 / d1) * p + 0.984375;
    },
  };

  const PROP_DEFAULTS = { x: 0, y: 0, scale: 1, rotation: 0, opacity: null };

  class Timeline {
    constructor() {
      this.tweens = [];  // {el, props:{k:[from,to]}, start, dur, ease, repeat, yoyo}
      this.calls = [];   // {start, dur, fn(progress, t), ease}
      this._end = 0;
    }

    /** 在 start 秒把 el 的 props 從 from 動到 to */
    fromTo(el, from, to, opts) {
      const o = opts || {};
      const props = {};
      for (const k of Object.keys(to)) {
        props[k] = [from[k] !== undefined ? from[k] : PROP_DEFAULTS[k], to[k]];
      }
      const tw = {
        el, props,
        start: o.start || 0,
        dur: Math.max(o.dur || 0.3, 0.0001),
        ease: Ease[o.ease || "outCubic"] || Ease.outCubic,
        repeat: o.repeat || 0, // 次數；配 yoyo 用
        yoyo: !!o.yoyo,
      };
      this.tweens.push(tw);
      this._end = Math.max(this._end, tw.start + tw.dur * (tw.repeat + 1));
      return this;
    }

    to(el, to, opts) { return this.fromTo(el, {}, to, opts); }

    /** 招牌 pop 進場：0.4→1 回彈縮放 + 快速淡入 */
    popIn(el, opts) {
      const o = opts || {};
      const s = o.start || 0, d = o.dur || 0.45;
      this.fromTo(el, { scale: o.fromScale !== undefined ? o.fromScale : 0.4 }, { scale: 1 },
        { start: s, dur: d, ease: o.ease || "outBack" });
      this.fromTo(el, { opacity: 0 }, { opacity: 1 }, { start: s, dur: Math.min(d, 0.25), ease: "outQuad" });
      return this;
    }

    /** 退場：縮小淡出 */
    popOut(el, opts) {
      const o = opts || {};
      const s = o.start || 0, d = o.dur || 0.25;
      this.fromTo(el, { scale: 1 }, { scale: 0.75 }, { start: s, dur: d, ease: "inQuad" });
      this.fromTo(el, { opacity: 1 }, { opacity: 0 }, { start: s, dur: d, ease: "inQuad" });
      return this;
    }

    /** 懸浮呼吸：y 在 ±amp 之間正弦來回，start→end */
    float(el, opts) {
      const o = opts || {};
      const amp = o.amp || 7, period = o.period || 1.6;
      const start = o.start || 0;
      const end = o.end || this._end || start + 6;
      const half = period / 2;
      const cycles = Math.max(2, Math.ceil((end - start) / half));
      this.fromTo(el, { y: -amp }, { y: amp },
        { start, dur: half, ease: "inOutSine", repeat: cycles - 1, yoyo: true });
      return this;
    }

    /** 淡入→停留→淡出 */
    show(el, tIn, tOut, opts) {
      const o = opts || {};
      const f = o.fade !== undefined ? o.fade : 0.12;
      this.fromTo(el, { opacity: 0 }, { opacity: 1 }, { start: tIn, dur: f, ease: "outQuad" });
      this.fromTo(el, { opacity: 1 }, { opacity: 0 }, { start: Math.max(tOut - f, tIn + f), dur: f, ease: "inQuad" });
      return this;
    }

    /** 自訂逐格更新（count-up、劃線、進度環…）：fn(progress 0..1, t) */
    onProgress(start, dur, fn, easeName) {
      this.calls.push({ start, dur: Math.max(dur, 0.0001), fn, ease: Ease[easeName || "outCubic"] });
      this._end = Math.max(this._end, start + dur);
      return this;
    }

    /** 把 timeline 至少延長到 t 秒（對齊影片長度） */
    pad(t) { this._end = Math.max(this._end, t); return this; }

    duration() { return this._end; }

    /** 核心：把整個畫面設定成 t 秒的樣子 */
    seek(t) {
      const states = new Map(); // el -> {x,y,scale,rotation,opacity,started}
      for (const tw of this.tweens) {
        if (t < tw.start) continue; // 還沒開始 → 不影響
        let st = states.get(tw.el);
        if (!st) { st = Object.assign({ started: true }, PROP_DEFAULTS); states.set(tw.el, st); }

        const total = tw.dur * (tw.repeat + 1);
        let local = Math.min(t - tw.start, total - 0.000001);
        let cycle = Math.floor(local / tw.dur);
        let cp = (local - cycle * tw.dur) / tw.dur;
        if (t - tw.start >= total && !tw.yoyo) cp = 1;
        if (tw.yoyo && cycle % 2 === 1) cp = 1 - cp;
        const p = tw.ease(Math.min(Math.max(cp, 0), 1));

        for (const k of Object.keys(tw.props)) {
          const [from, to] = tw.props[k];
          const f = from === null || from === undefined ? PROP_DEFAULTS[k] : from;
          st[k] = (f === null ? 0 : f) + (to - (f === null ? 0 : f)) * p; // 最後一個已開始的 tween 蓋過前面
        }
      }
      for (const [el, st] of states) {
        el.style.transform =
          (el.dataset.baseTransform || "") +
          ` translate(${st.x}px, ${st.y}px) scale(${st.scale}) rotate(${st.rotation}deg)`;
        if (st.opacity !== null) {
          el.style.opacity = st.opacity;
          el.style.visibility = st.opacity <= 0.001 ? "hidden" : "visible";
        } else {
          el.style.visibility = "visible";
        }
      }
      for (const c of this.calls) {
        const p = Math.min(Math.max((t - c.start) / c.dur, 0), 1);
        if (t >= c.start - 0.0001) c.fn(c.ease(p), t);
      }
    }
  }

  global.WNTimeline = Timeline;
  global.WNEase = Ease;
})(window);
