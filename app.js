/* ============================================================
   NANATATA 个人网站 —— 交互
   §1 工具与全局   §2 滚动进度与揭示   §3 中英切换

   两个项目用说明图讲清机制，动效全部在 CSS 里（含 prefers-reduced-motion 兜底），
   所以这里只剩页面级的那点事：阅读进度、滚动揭示、顶栏高亮、语言切换。
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

$('#year').textContent = new Date().getFullYear();

/* ───────── §2 滚动进度与揭示 ───────── */

const progress = $('#progress');
const onScroll = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
};
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();

// 进入视口才揭示，露出一次就不再管
const revealObserver = new IntersectionObserver(
  (entries, obs) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      obs.unobserve(e.target);
    }
  },
  { rootMargin: '0px 0px -12% 0px' }
);
$$('.reveal').forEach((el) => revealObserver.observe(el));

// 顶栏高亮当前章节
const navLinks = $$('.bar-nav a');
const spyObserver = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      navLinks.forEach((a) => a.classList.toggle('is-here', a.getAttribute('href') === `#${e.target.id}`));
    }
  },
  { rootMargin: '-45% 0px -50% 0px' }
);
['streamer', 'photo', 'focus', 'contact'].forEach((id) => {
  const el = document.getElementById(id);
  if (el) spyObserver.observe(el);
});

/* ───────── §3 中英切换 ─────────
   页面上的中文就是原文，英文挂在同一个节点的 data-en 上，SVG 里的 <text> 也一样。
   切换时两边来回换内容，不复制一份 DOM，所以版面、动效、编号全都只有一套。 */

const LANG_KEY = 'nanatata-lang';
const textNodes = $$('[data-en]');          // 换 textContent
const attrNodes = $$('[data-en-label]');    // 换 aria-label / meta content
const langBtn = $('#lang');

// 属性翻译只用在这两个地方：SVG 的无障碍描述，和 <meta name=description>
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

  document.documentElement.lang = en ? 'en' : 'zh-CN';
  langBtn.textContent = en ? '中文' : 'EN';
  langBtn.setAttribute('aria-label', en ? '切换到中文' : 'Switch to English');
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* 隐私模式下写不了，无所谓 */ }
}

let saved = null;
try { saved = localStorage.getItem(LANG_KEY); } catch { /* 同上 */ }
// 没存过就看浏览器：不是中文环境的访客直接拿到英文
const zhFirst = (navigator.language || 'zh').toLowerCase().startsWith('zh');
setLang(saved === 'en' || saved === 'zh' ? saved : zhFirst ? 'zh' : 'en');

langBtn.addEventListener('click', () => {
  setLang(document.documentElement.lang === 'en' ? 'zh' : 'en');
});

