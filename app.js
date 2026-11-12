/* ============================================================
   NANATATA 个人网站 —— 交互
   §1 工具   §2 深浅色   §3 中英切换   §4 窗口展开   §5 暗房

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
