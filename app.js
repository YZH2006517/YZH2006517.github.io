/* ============================================================
   NANATATA 个人网站 —— 交互
   §1 工具   §2 深浅色   §3 中英切换   §4 窗口展开   §5 暗房   §6 观片台

   背后的 3D 城市在 scene.js 里，这里只管页面本身。
   两边靠一个 themechange 事件对齐颜色。
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const root = document.documentElement;

// 隐私模式下 localStorage 可能读写都抛错，记不住就算了，页面照常
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const keep = (k, v) => {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 同上 */ }
};
const zh = () => root.lang !== 'en';

$('#year').textContent = new Date().getFullYear();

/* ───────── §2 深浅色 ─────────
   跟系统走，直到读者自己选；选了和系统一样的，就当没选过 ——
   这样以后系统切换了，页面还会跟着走。首帧的 data-theme 由 <head> 里那段脚本定。 */

const THEME_KEY = 'nanatata-theme';
const sysDark = matchMedia('(prefers-color-scheme: dark)');
const themeBtn = $('#theme');
const systemTheme = () => (sysDark.matches ? 'dark' : 'light');

function labelTheme() {
  const dark = root.dataset.theme === 'dark';
  themeBtn.setAttribute('aria-label', dark
    ? (zh() ? '切换到浅色' : 'Switch to light')
    : (zh() ? '切换到深色' : 'Switch to dark'));
}

function applyTheme() {
  const saved = read(THEME_KEY);
  root.dataset.theme = saved === 'dark' || saved === 'light' ? saved : systemTheme();
  labelTheme();
  dispatchEvent(new CustomEvent('themechange'));
}

themeBtn.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  keep(THEME_KEY, next === systemTheme() ? null : next);
  applyTheme();
});
sysDark.addEventListener('change', applyTheme);
labelTheme();

/* ───────── §3 中英切换 ─────────
   页面上的中文就是原文，英文挂在同一个节点的 data-en 上，SVG 里的 <text> 也一样。
   切换时两边来回换内容，不复制一份 DOM，所以版面、动效、编号全都只有一套。 */

const LANG_KEY = 'nanatata-lang';
const textNodes = $$('[data-en]');          // 换 textContent
const attrNodes = $$('[data-en-label]');    // 换 aria-label / meta content
const langBtn = $('#lang');
const attrOf = (el) => (el.tagName === 'META' ? 'content' : 'aria-label');

function setLang(lang) {
  const en = lang === 'en';

  for (const el of textNodes) {
    if (el.dataset.zh === undefined) el.dataset.zh = el.textContent.replace(/\s+/g, ' ').trim();
    el.textContent = en ? el.dataset.en : el.dataset.zh;
  }
  for (const el of attrNodes) {
    const attr = attrOf(el);
    if (el.dataset.zhLabel === undefined) el.dataset.zhLabel = el.getAttribute(attr) || '';
    el.setAttribute(attr, en ? el.dataset.enLabel : el.dataset.zhLabel);
  }

  root.lang = en ? 'en' : 'zh-CN';
  langBtn.textContent = en ? '中' : 'EN';
  langBtn.setAttribute('aria-label', en ? '切换到中文' : 'Switch to English');
  labelTheme();
  keep(LANG_KEY, lang);
}

// 没存过就看浏览器：不是中文环境的访客直接拿到英文
const savedLang = read(LANG_KEY);
const zhFirst = (navigator.language || 'zh').toLowerCase().startsWith('zh');
setLang(savedLang === 'en' || savedLang === 'zh' ? savedLang : zhFirst ? 'zh' : 'en');

langBtn.addEventListener('click', () => setLang(zh() ? 'en' : 'zh'));

/* ───────── §4 窗口展开 ─────────
   窗口滚进视口才“打开”，打开一次就不再管。 */

const wins = $$('.win');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        obs.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' }
  );
  wins.forEach((w) => io.observe(w));
} else {
  wins.forEach((w) => w.classList.add('is-in'));
}

/* ───────── §5 暗房 ─────────
   渲染器是下载站的 PhotoGL（gl.js，WebGL2 + 真实 3D LUT），这里只接按钮、滑杆和对比线。
   浏览器不支持 WebGL2 时整扇窗退成一句说明。 */

// gl.js 排在本文件后面加载，等页尾脚本都跑完再接
addEventListener('DOMContentLoaded', async () => {
  const wrap = $('#labWrap');
  if (!wrap || !window.PhotoGL) return;
  let gl;
  try { gl = new PhotoGL($('#labCanvas')); } catch { $('#lab').classList.add('no-gl'); return; }

  const looks = await fetch('assets/lut/catalog.json').then((r) => r.json());
  const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  let current = looks[0].id;
  let strength = 0.9;

  const list = $('#looks');
  const mark = () => $$('.look', list).forEach((b) => b.classList.toggle('is-on', b.dataset.id === current));
  async function apply() {
    await gl.setLut(0, current, strength);
    gl.render();
    $('#labTag').textContent = looks.find((l) => l.id === current).label;
  }
  for (const look of looks) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'look';
    b.dataset.id = look.id;
    b.innerHTML = '<b></b><small></small>';
    b.children[0].textContent = look.label;
    b.children[1].textContent = look.group;
    b.addEventListener('click', () => { current = look.id; mark(); apply(); });
    list.append(b);
  }

  $('#labStrength').addEventListener('input', (e) => {
    strength = e.target.value / 100;
    gl.strength[0] = strength;
    $('#labStrengthOut').textContent = e.target.value;
    gl.render();
  });

  // 对比线：线左边是原片，右边是套了胶片的
  const wipe = (v) => {
    v = Math.min(1, Math.max(0, v));
    gl.state.wipe = v;
    $('#wipe').style.left = `${v * 100}%`;
    gl.render();
  };
  const at = (e) => { const r = wrap.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  wrap.addEventListener('pointerdown', (e) => { wrap.setPointerCapture(e.pointerId); wrap.dataset.drag = '1'; wipe(at(e)); });
  wrap.addEventListener('pointermove', (e) => { if (wrap.dataset.drag) wipe(at(e)); });
  for (const n of ['pointerup', 'pointercancel']) wrap.addEventListener(n, () => delete wrap.dataset.drag);

  $$('#labPhotos button').forEach((b) => b.addEventListener('click', async () => {
    $$('#labPhotos button').forEach((o) => o.classList.toggle('is-on', o === b));
    gl.setImage(await load(b.dataset.src));
    gl.render();
  }));

  gl.setImage(await load('assets/img/lake.webp'));
  mark();
  await apply();
  wipe(0.5);
  addEventListener('resize', () => gl.render());
});

/* ───────── §6 观片台 ─────────
   照下载站那张观片台做的精简版：九格胶片（三张照片换不同裁切），
   G 平铺 / E 单张 / C 连续胶卷 / V 放大镜 / L 背光 / I 沉浸，照片可以拖。
   放大镜是一块小画布，按每格胶片在台面上的真实位置把原图放大重画，所以镜外的台面照旧。 */

(() => {
  const stage = $('#ltStage');
  if (!stage) return;
  const wrap = $('#lt');
  const dock = $('#ltDock');
  const loupe = $('#ltLoupe');
  const lens = loupe.querySelector('canvas');
  const lctx = lens.getContext('2d');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');

  const SHOTS = [
    ['lake', '50% 40%'], ['valley', '30% 50%'], ['mountain', '50% 30%'],
    ['lake', '15% 60%'], ['valley', '80% 40%'], ['mountain', '50% 75%'],
    ['valley', '55% 70%'], ['lake', '85% 35%'], ['mountain', '40% 50%'],
  ];
  const frames = SHOTS.map(([name, pos], i) => {
    const el = document.createElement('div');
    el.className = 'lt-frame';
    const img = new Image();
    img.src = `assets/img/${name}.webp`;
    img.alt = '';
    img.draggable = false;
    img.style.objectPosition = pos;
    el.append(img);
    stage.append(el);
    return { el, img, pos: pos.split(' ').map(parseFloat), x: 0, y: 0, w: 0, h: 0, z: i };
  });

  let mode = 'g', current = 0, zoom = 2.5, lensOn = false, lights = true, roll = 0, top = 20;

  function place(f, x, y, w, h, opacity = 1) {
    Object.assign(f, { x, y, w, h });
    f.el.style.transform = `translate(${x}px, ${y}px)`;
    f.el.style.width = `${w}px`;
    f.el.style.height = `${h}px`;
    f.el.style.opacity = opacity;
  }

  function layout() {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (mode === 'g') {
      const cols = W > 700 ? 5 : 3, gap = W > 700 ? 18 : 10;
      const w = (W - gap * (cols + 1)) / cols, h = w * 0.74;
      const rows = Math.ceil(frames.length / cols);
      const y0 = Math.max(gap, (H - rows * h - (rows - 1) * gap) / 2);
      frames.forEach((f, i) => place(f, gap + (i % cols) * (w + gap), y0 + Math.floor(i / cols) * (h + gap), w, h));
    } else if (mode === 'e') {
      const h = Math.min(H * 0.84, (W * 0.86) / 1.5), w = h * 1.5;
      frames.forEach((f, i) => {
        const d = i - current;
        place(f, (W - w) / 2 + d * 40, (H - h) / 2 + Math.abs(d) * 6, w, h, d === 0 ? 1 : 0);
        f.el.style.zIndex = d === 0 ? 50 : 1;
      });
    } else {
      rollTo(roll);
    }
  }

  // 连续胶卷：九格首尾相接，第 i 格的位置按偏移量取模，走出左边就接到最右边
  function rollTo(offset) {
    const W = stage.clientWidth, H = stage.clientHeight;
    const h = Math.min(H * 0.62, 260), w = h * 1.5, span = w * frames.length;
    frames.forEach((f, i) => {
      const x = ((((i * w - offset) % span) + span) % span) - w;
      place(f, x, (H - h) / 2, w, h, x < W + w ? 1 : 0);
    });
  }

  function setMode(next) {
    mode = next;
    stage.dataset.mode = next;
    frames.forEach((f) => (f.el.style.zIndex = f.z));
    layout();
    $$('button', dock).forEach((b) => {
      const k = b.dataset.key;
      b.classList.toggle('is-on', k === mode || (k === 'v' && lensOn) || (k === 'l' && !lights) || (k === 'i' && wrap.classList.contains('is-immersive')));
    });
  }

  // ── 拖动：台面模式下照片可以随手摆，再按 G 一键平铺回去 ──
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.lt-frame');
    if (mode === 'e') { current = (current + 1) % frames.length; layout(); return; }
    if (!el || mode !== 'g') return;
    const f = frames.find((x) => x.el === el);
    f.z = ++top;
    el.style.zIndex = f.z;
    el.classList.add('is-held');
    stage.setPointerCapture(e.pointerId);
    drag = { f, dx: e.clientX - f.x, dy: e.clientY - f.y };
  });
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    if (lensOn) moveLens(e.clientX - r.left, e.clientY - r.top);
    if (!drag) return;
    const { f } = drag;
    place(f, e.clientX - drag.dx, e.clientY - drag.dy, f.w, f.h);
  });
  const drop = () => { if (drag) drag.f.el.classList.remove('is-held'); drag = null; };
  stage.addEventListener('pointerup', drop);
  stage.addEventListener('pointercancel', drop);

  // ── 放大镜 ──
  let lensAt = { x: 0, y: 0 };
  function moveLens(x, y) {
    lensAt = { x, y };
    loupe.style.transform = `translate(${x - lens.width / 2}px, ${y - lens.height / 2}px)`;
    drawLens();
  }
  function drawLens() {
    const S = lens.width, c = S / 2;
    lctx.fillStyle = lights ? '#f3efe2' : '#1b1c21';
    lctx.fillRect(0, 0, S, S);
    const sr = stage.getBoundingClientRect();
    for (const f of [...frames].sort((a, b) => (+a.el.style.zIndex || 0) - (+b.el.style.zIndex || 0))) {
      if (+f.el.style.opacity === 0) continue;
      const r = f.el.getBoundingClientRect();
      const X = (r.left - sr.left - lensAt.x) * zoom + c, Y = (r.top - sr.top - lensAt.y) * zoom + c;
      const Wf = r.width * zoom, Hf = r.height * zoom;
      if (X > S || Y > S || X + Wf < 0 || Y + Hf < 0) continue;
      lctx.fillStyle = '#121212';
      lctx.fillRect(X, Y, Wf, Hf);
      lctx.fillStyle = '#efe9d6';                     // 齿孔
      const band = Hf * 0.12, hole = 9 * zoom;
      for (let hx = X + hole * 0.3; hx < X + Wf - hole * 0.5; hx += hole * 1.6) {
        lctx.fillRect(hx, Y + band * 0.3, hole * 0.6, band * 0.4);
        lctx.fillRect(hx, Y + Hf - band * 0.7, hole * 0.6, band * 0.4);
      }
      const ix = X + Wf * 0.03, iy = Y + band, iw = Wf * 0.94, ih = Hf - band * 2;
      const im = f.img;
      if (!im.naturalWidth) continue;
      const k = Math.max(iw / im.naturalWidth, ih / im.naturalHeight);
      const sw = iw / k, sh = ih / k;
      const sx = (im.naturalWidth - sw) * f.pos[0] / 100, sy = (im.naturalHeight - sh) * f.pos[1] / 100;
      if (!lights) lctx.filter = 'brightness(.42)';
      lctx.drawImage(im, sx, sy, sw, sh, ix, iy, iw, ih);
      lctx.filter = 'none';
    }
  }
  stage.addEventListener('wheel', (e) => {
    if (!lensOn) return;
    e.preventDefault();
    zoom = Math.min(5, Math.max(1.5, zoom - Math.sign(e.deltaY) * 0.25));
    $('#ltZoom').textContent = `${zoom.toFixed(1)}×`;
    drawLens();
  }, { passive: false });

  // ── 键位：和软件一致；只在观片台露在屏幕上时生效 ──
  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.3 }).observe(stage);

  function press(key) {
    if (key === 'g' || key === 'e' || key === 'c') return setMode(key);
    if (key === 'v') {
      lensOn = !lensOn;
      loupe.hidden = !lensOn;
      if (lensOn) moveLens(stage.clientWidth / 2, stage.clientHeight / 2);
    }
    if (key === 'l') { lights = !lights; stage.classList.toggle('lights-off', !lights); if (lensOn) drawLens(); }
    if (key === 'i') { wrap.classList.toggle('is-immersive'); requestAnimationFrame(layout); }
    setMode(mode);
  }
  $$('button', dock).forEach((b) => b.addEventListener('click', () => press(b.dataset.key)));
  addEventListener('keydown', (e) => {
    const t = e.target;
    if (!visible || e.metaKey || e.ctrlKey || e.altKey) return;
    if (t instanceof Element && t.closest('input, textarea, select, [contenteditable]')) return;
    const k = e.key.toLowerCase();
    if ('gecvli'.includes(k) && k.length === 1) { e.preventDefault(); press(k); }
    else if (mode === 'e' && (k === 'arrowright' || k === 'arrowleft')) {
      current = (current + (k === 'arrowright' ? 1 : frames.length - 1)) % frames.length;
      layout();
    } else if (k === 'escape' && wrap.classList.contains('is-immersive')) press('i');
  });

  // ── 胶卷自己走；手一碰（指针进台面）就停 ──
  let hover = false, last = performance.now();
  stage.addEventListener('pointerenter', () => (hover = true));
  stage.addEventListener('pointerleave', () => (hover = false));
  (function spin(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode === 'c' && !hover && !calm.matches) { roll += dt * 60; rollTo(roll); if (lensOn) drawLens(); }
    requestAnimationFrame(spin);
  })(last);

  addEventListener('resize', layout);
  frames[0].img.addEventListener('load', () => lensOn && drawLens());
  setMode('g');
})();
