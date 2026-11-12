/* ============================================================
   NANATATA 个人网站 —— 荣光层
   §1 玫瑰窗   §2 天光与金尘   §3 指针的光   §4 节拍

   开场那扇玫瑰窗按 128×128 的像素格算，再由 CSS 放大成硬边像素：
   每一格玻璃有自己的颜色和呼吸，一团“日光”在窗上慢慢移过。
   同一块画布还交给 scene.js，贴在 3D 城里大教堂的立面和直播塔背后。
   玫瑰窗的算法和 tools/sanctum.py 里那份是同一个，改一边记得改另一边。
   ============================================================ */

(() => {
  const root = document.documentElement;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const roseCv = document.getElementById('rose');
  const glory = document.getElementById('glory');
  if (!roseCv || !glory) return;

  /* ───────── §1 玫瑰窗 ───────── */

  const RES = roseCv.width;
  const COLORS = ['lead', 'gold', 'gold2', 'blue', 'blue2', 'sky', 'red', 'green', 'violet'];
  const PAL = {
    light: { lead: '#0b1d5c', gold: '#c9912e', gold2: '#f2cf73', blue: '#2a63e0', blue2: '#1b3fa8', sky: '#7cc4f5', red: '#c8423a', green: '#2e8f6c', violet: '#6f45b8' },
    dark:  { lead: '#020823', gold: '#e8b54e', gold2: '#ffe39a', blue: '#3a78f0', blue2: '#1d48c0', sky: '#6fd0ff', red: '#ff5e52', green: '#3fb487', violet: '#8a5cf0' },
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

  // 一格玻璃：返回 [颜色, 格子编号]；窗外返回 null
  function rose(x, y) {
    const r = Math.hypot(x, y);
    if (r > 1) return null;
    const a = Math.atan2(y, x) + Math.PI, T = 2 * Math.PI;
    if (r > 0.94) return [Math.floor((a / T) * 64) % 2 ? 'gold' : 'gold2', 0];
    if (r > 0.9) return ['lead', 0];
    if (r > 0.72) {
      const k = Math.floor((a / T) * 24), ca = ((k + 0.5) / 24) * T - Math.PI;
      const d = Math.hypot(x - 0.81 * Math.cos(ca), y - 0.81 * Math.sin(ca));
      if (d < 0.066) return [k % 2 ? 'red' : 'sky', 100 + k];
      if (d < 0.084 || r < 0.74 || r > 0.885) return ['lead', 0];
      return ['blue2', 200 + k];
    }
    if (r > 0.7) return ['lead', 0];
    if (r > 0.4) {
      const s = (a / T) * 12, k = Math.floor(s), u = Math.abs(s - k - 0.5);
      const top = 0.69 - 0.6 * u * u;
      if (u > 0.44) return ['lead', 0];
      if (r > top) return r < top + 0.025 ? ['lead', 0] : ['blue2', 300 + k];
      if (Math.abs(r - 0.55) < 0.012) return ['lead', 0];
      if (u > 0.38) return ['gold', 400 + k];
      if (r > 0.55) return [['gold', 'red', 'sky', 'violet', 'green', 'red'][k % 6], 500 + k];
      return [k % 2 ? 'blue' : 'red', 600 + k];
    }
    if (r > 0.38) return ['lead', 0];
    if (r > 0.16) {
      const k = Math.floor((a / T) * 8), ca = ((k + 0.5) / 8) * T - Math.PI;
      const d = Math.hypot(x - 0.27 * Math.cos(ca), y - 0.27 * Math.sin(ca));
      if (d < 0.05) return ['red', 700 + k];
      if (d < 0.095) return ['gold', 710 + k];
      if (d < 0.112) return ['lead', 0];
      return ['blue', 720 + k];
    }
    if (r > 0.14) return ['lead', 0];
    if (Math.abs(x) < 0.024 || Math.abs(y) < 0.024) return ['gold2', 800];
    return [x * y > 0 ? 'red' : 'blue', 801];
  }

  // 窗格是死的，先算一遍存起来；每帧只算光
  const N = RES * RES;
  const colorAt = new Int8Array(N).fill(-1);
  const phase = new Float32Array(N);
  for (let j = 0; j < RES; j++) {
    for (let i = 0; i < RES; i++) {
      const v = rose(((i + 0.5) / RES) * 2 - 1, ((j + 0.5) / RES) * 2 - 1);
      if (!v) continue;
      const n = j * RES + i;
      colorAt[n] = COLORS.indexOf(v[0]);
      phase[n] = (Math.sin(v[1] * 12.9898) * 43758.5453) % 6.283;
    }
  }

  const rctx = roseCv.getContext('2d');
  const img = rctx.createImageData(RES, RES);
  let rgb = [];

  function paintRose(t) {
    const px = img.data;
    // “日光”沿一条低低的弧线从左往右移过，再从头来
    const sx = Math.cos(t * 0.12) * 0.7, sy = -0.25 + Math.sin(t * 0.07) * 0.25;
    for (let n = 0; n < N; n++) {
      const c = colorAt[n], o = n * 4;
      if (c < 0) { px[o + 3] = 0; continue; }
      const base = rgb[c];
      let k = 1;
      if (c > 0) {
        const x = ((n % RES) + 0.5) / RES * 2 - 1, y = ((n / RES | 0) + 0.5) / RES * 2 - 1;
        const d2 = (x - sx) ** 2 + (y - sy) ** 2;
        k = 0.78 + (c > 2 ? 0.16 * Math.sin(t * 1.1 + phase[n]) : 0.06) + 0.6 * Math.exp(-d2 * 2.6);
      }
      px[o] = Math.min(255, base[0] * k);
      px[o + 1] = Math.min(255, base[1] * k);
      px[o + 2] = Math.min(255, base[2] * k);
      px[o + 3] = 255;
    }
    rctx.putImageData(img, 0, 0);
  }

  window.roseCanvas = roseCv; // scene.js 拿它当贴图

  /* ───────── §2 天光与金尘 ───────── */

  const g = glory.getContext('2d');
  let W = 0, H = 0, gold = '#e8b54e', light = '#fff';
  const motes = Array.from({ length: 80 }, () => ({
    x: Math.random(), y: Math.random(), v: 0.006 + Math.random() * 0.02,
    s: Math.random() < 0.25 ? 3 : 2, p: Math.random() * 6.28,
  }));

  function size() {
    W = glory.width = innerWidth;
    H = glory.height = innerHeight;
  }

  function paintGlory(t, dt) {
    g.clearRect(0, 0, W, H);
    const dark = root.dataset.theme === 'dark';
    const r = roseCv.getBoundingClientRect();
    const fade = Math.max(0, 1 - scrollY / (innerHeight * 0.9));

    // 天光：从玫瑰窗往下洒的几道楔形光
    if (fade > 0 && r.width) {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      g.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      for (let i = 0; i < 9; i++) {
        const a = Math.PI / 2 + (i - 4) * 0.16 + Math.sin(t * 0.2 + i) * 0.015;
        const w = 0.035 + (i % 3) * 0.012;
        const len = H * 1.4;
        const alpha = (0.05 + 0.04 * Math.sin(t * 0.5 + i * 1.7)) * fade * (dark ? 1.4 : 1);
        const grad = g.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        grad.addColorStop(0, dark ? gold : light);
        grad.addColorStop(1, 'transparent');
        g.globalAlpha = alpha;
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a - w) * len, cy + Math.sin(a - w) * len);
        g.lineTo(cx + Math.cos(a + w) * len, cy + Math.sin(a + w) * len);
        g.closePath();
        g.fill();
      }
    }

    // 金尘：方形的小光点慢慢往上飘，一闪一闪
    g.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    g.fillStyle = gold;
    for (const m of motes) {
      m.y -= m.v * dt;
      if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
      g.globalAlpha = (0.35 + 0.45 * Math.sin(t * 2 + m.p)) * (dark ? 1 : 0.8);
      g.fillRect(Math.round(m.x * W + Math.sin(t * 0.4 + m.p) * 12), Math.round(m.y * H), m.s, m.s);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  /* ───────── §3 指针的光 ───────── */

  addEventListener('pointermove', (e) => {
    root.style.setProperty('--mx', `${e.clientX}px`);
    root.style.setProperty('--my', `${e.clientY}px`);
  }, { passive: true });

  /* ───────── §4 节拍 ───────── */

  function repaint() {
    const p = PAL[root.dataset.theme === 'dark' ? 'dark' : 'light'];
    rgb = COLORS.map((k) => hex(p[k]));
    const cs = getComputedStyle(root);
    gold = cs.getPropertyValue('--gold').trim() || gold;
    light = '#ffffff';
  }

  let last = performance.now(), running = false, acc = 0;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    const t = now / 1000;
    if (acc > 1 / 30) { paintRose(t); acc = 0; } // 玫瑰窗 30 帧就够了
    paintGlory(t, dt);
    if (calm.matches) { running = false; return; }
    requestAnimationFrame(tick);
  }
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }
  function still() { paintRose(0); paintGlory(0, 0); }

  addEventListener('resize', () => { size(); if (calm.matches) still(); });
  addEventListener('themechange', () => { repaint(); if (calm.matches) still(); });
  calm.addEventListener('change', () => (calm.matches ? still() : start()));

  size();
  repaint();
  still();
  if (!calm.matches) start();
})();
