/* ============================================================
   NANATATA 个人网站 —— 交互
   §1 工具与全局   §2 滚动进度与揭示   §3 虚拟主播演示   §4 观片台演示

   两块演示都是网页模拟，不连真实模型，只为了让人直观看懂软件在做什么。
   系统关掉动效时，循环类动画不启动，但所有交互照常可用。
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

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

/* ───────── §3 虚拟主播演示 ───────── */

const stage = $('#stage');
const danmakuLayer = $('#danmaku');
const avatar = $('#avatar');
const bubble = $('#bubble');
const bubbleText = $('#bubbleText');
const quiz = $('#quiz');
const pipe = $('#pipe');

const AMBIENT = [
  '主播今天声音好听', '来一首', '这个 Live2D 是自己做的吗', '求讲讲技术栈',
  '弹幕能跟上吗', '跳个舞！', '刚关注，蹲个游戏', '模型好可爱',
  '延迟多少呀', '这是本地跑的还是云端', '上一句没听清', '开个答题吧',
];

const REPLIES = [
  '这条我看到了。程序把弹幕排了队，一条条过，人多的时候会合并成一个问题再回。',
  '好问题。语音走的是 Edge 在线合成，口型跟着音频的节拍走，所以说话时嘴是对得上的。',
  '模型是导入的 Cubism 3 文件夹，打包成 zip 丢进来就能换，人设会记住当前用的形象。',
  '答题是大模型现场出题，判分和排行榜由程序算，AI 只负责主持和串场。',
  '跳舞是跟着背景音乐的节拍触发的，礼物攒够了也会自动来一段。',
];

let dmSeq = 0;
const flyDanmaku = (text, mine = false) => {
  const el = document.createElement('div');
  el.className = 'dm' + (mine ? ' is-mine' : '');
  el.textContent = text;
  // 分到 5 条轨道上，避免互相压住
  el.style.top = `${18 + (dmSeq++ % 5) * 30}px`;
  const secs = mine ? 7 : 8 + Math.random() * 4;
  el.style.animationDuration = `${secs}s`;
  danmakuLayer.append(el);
  el.addEventListener('animationend', () => el.remove());
  // 关掉动效时不会有 animationend，兜底清理
  if (calm.matches) setTimeout(() => el.remove(), 2500);
};

// 流水线逐级点亮
const heat = (step) => $$('#pipe span').forEach((s) => s.classList.toggle('is-hot', s.dataset.step === step));
const cool = () => $$('#pipe span').forEach((s) => s.classList.remove('is-hot'));

let busy = false;
const reply = async (heard) => {
  if (busy) return;
  busy = true;

  heat('chat');
  await wait(420);
  heat('llm');
  await wait(760);
  heat('tts');

  const text = heard
    ? `「${heard}」—— ${REPLIES[Math.floor(Math.random() * REPLIES.length)]}`
    : REPLIES[Math.floor(Math.random() * REPLIES.length)];

  bubble.hidden = false;
  bubble.classList.add('is-speaking');
  avatar.classList.add('is-talking');
  bubbleText.textContent = '';

  // 一个字一个字打出来，模拟边合成边说
  for (let i = 0; i < text.length; i++) {
    bubbleText.textContent = text.slice(0, i + 1);
    await wait(calm.matches ? 0 : 38);
  }

  heat('obs');
  avatar.classList.remove('is-talking');
  bubble.classList.remove('is-speaking');
  await wait(1900);
  cool();
  bubble.hidden = true;
  busy = false;
};

// 观众自己发一条
$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#say');
  const text = input.value.trim();
  if (!text) return;
  flyDanmaku(text, true);
  input.value = '';
  reply(text);
});

$('#dance').addEventListener('click', () => {
  avatar.classList.add('is-dancing');
  flyDanmaku('舞风很顶', false);
  setTimeout(() => avatar.classList.remove('is-dancing'), 4200);
});

/* 弹幕小游戏 */
const QUESTIONS = [
  { q: '下面哪种模型格式这个软件能导入？', a: ['Cubism 3 的 .model3.json', 'Cubism 2 的 .moc', '.fbx', '.blend'], right: 0 },
  { q: '主播的语音是在哪里合成的？', a: ['本地显卡', '微软 Edge 在线语音', '手机端', '不发声'], right: 1 },
  { q: '答题的分数由谁判定？', a: ['大模型自己判', '观众投票', '程序判题计分', '随机'], right: 2 },
];
let qi = 0;
let score = 0;
let answered = 0;

const drawQuiz = () => {
  const item = QUESTIONS[qi % QUESTIONS.length];
  $('#quizQ').textContent = item.q;
  const opts = $('#quizOpts');
  opts.innerHTML = '';
  item.a.forEach((text, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.addEventListener('click', () => {
      if (b.closest('.quiz-opts').dataset.done) return;
      opts.dataset.done = '1';
      const ok = i === item.right;
      b.classList.add(ok ? 'right' : 'wrong');
      if (!ok) opts.children[item.right].classList.add('right');
      answered++;
      if (ok) score += 10;
      drawBoard();
      flyDanmaku(ok ? '答对了！' : '啊这…', true);
      setTimeout(() => {
        qi++;
        delete opts.dataset.done;
        drawQuiz();
      }, 1500);
    });
    opts.append(b);
  });
  drawBoard();
};

const drawBoard = () => {
  $('#board').innerHTML =
    `<div><span>你</span><b>${score} 分</b></div>` +
    `<div><span>已答</span><b>${answered} 题</b></div>` +
    `<div><span>出题</span><b>大模型现场生成</b></div>`;
};

// 模式切换
$('#modes').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-mode]');
  if (!btn) return;
  $$('#modes button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
  const game = btn.dataset.mode === 'game';
  quiz.hidden = !game;
  bubble.hidden = true;
  if (game) drawQuiz();
});

// 只有这一屏在视野里才放环境弹幕，省得在别处空转
let ambientTimer = null;
new IntersectionObserver(
  (entries) => {
    const visible = entries[0].isIntersecting;
    if (visible && !ambientTimer && !calm.matches) {
      ambientTimer = setInterval(() => flyDanmaku(AMBIENT[Math.floor(Math.random() * AMBIENT.length)]), 1700);
    } else if (!visible && ambientTimer) {
      clearInterval(ambientTimer);
      ambientTimer = null;
    }
  },
  { threshold: 0.2 }
).observe(stage);

/* ───────── §4 观片台演示 ───────── */

const table = $('#lighttable');
const film = $('#film');
const filmMag = $('#filmMag');
const loupe = $('#loupe');
const loupeInner = $('#loupeInner');
const zoomTag = $('#zoomTag');

// 没有真实照片素材，用渐变画几张抽象的"底片"，意思到了就行
const SCENES = [
  'linear-gradient(170deg,#9fb6c4 0 42%,#c8cdb4 42% 64%,#7d8a69 64% 100%)',
  'linear-gradient(195deg,#f0d9b5 0 38%,#d79b6a 38% 70%,#6c4f3d 70% 100%)',
  'linear-gradient(160deg,#cfd9df 0 30%,#8fa5a9 30% 58%,#3f5358 58% 100%)',
  'linear-gradient(185deg,#e8dfc8 0 46%,#b3a278 46% 72%,#5d5842 72% 100%)',
  'linear-gradient(150deg,#b9c7a4 0 36%,#7d9262 36% 66%,#3f4a34 66% 100%)',
  'linear-gradient(200deg,#f2c9bd 0 40%,#c07f74 40% 68%,#5a3b3a 68% 100%)',
  'linear-gradient(175deg,#cbd6e2 0 34%,#93a4bd 34% 62%,#44506b 62% 100%)',
  'linear-gradient(165deg,#ded8c4 0 44%,#a9a186 44% 70%,#575444 70% 100%)',
];

const LUTS = {
  none: 'none',
  portra: 'saturate(.9) sepia(.18) contrast(.95) brightness(1.05) hue-rotate(-6deg)',
  velvia: 'saturate(1.6) contrast(1.14) brightness(.97)',
  trix: 'grayscale(1) contrast(1.3) brightness(1.03)',
  cine: 'contrast(1.2) saturate(.92) hue-rotate(-10deg) brightness(.96)',
};

const buildFilm = (host) => {
  host.innerHTML = '';
  SCENES.forEach((bg) => {
    const f = document.createElement('div');
    f.className = 'frame';
    f.style.background = bg;
    host.append(f);
  });
};
buildFilm(film);
buildFilm(filmMag);

let filmX = 20;
let zoom = Number($('#zoom').value);
let lx = 0;
let ly = 0;
let placed = false; // 放大镜有没有摆过初始位置

const layout = () => {
  const w = table.clientWidth;
  const h = table.clientHeight;
  // 容器还没有尺寸时（首帧、被隐藏、字体未加载完）先不摆，
  // 否则下面的 clamp 会拿负数算出镜片跑到台面外面去
  if (w < 2 || h < 2) return;
  if (!placed) {
    lx = w * 0.62;
    ly = h / 2;
    placed = true;
  }
  // 胶卷不能被拖到完全离开台面
  const span = film.scrollWidth;
  filmX = clamp(filmX, Math.min(0, w - span - 20), 20);
  film.style.transform = `translateX(${filmX}px)`;
  filmMag.style.transform = `translateX(${filmX}px)`;

  const r = loupe.offsetWidth / 2;
  lx = clamp(lx, r * 0.3, w - r * 0.3);
  ly = clamp(ly, r * 0.3, h - r * 0.3);
  loupe.style.left = `${lx - r}px`;
  loupe.style.top = `${ly - r}px`;

  // 镜内那层铺满整个台面，再以镜心为原点放大 —— 镜心那一点保持不动，
  // 所以看到的就是底下真实内容的放大，而不是另画一张
  Object.assign(loupeInner.style, {
    left: `${-(lx - r)}px`,
    top: `${-(ly - r)}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${w}px`,
    height: `${h}px`,
    transformOrigin: `${lx}px ${ly}px`,
    transform: `scale(${zoom})`,
  });
  zoomTag.textContent = `${zoom.toFixed(1)}×`;
};

// 拖动：拖镜片就移动放大镜，拖台面就卷动胶卷
let drag = null;
const startDrag = (e) => {
  const onLoupe = e.target.closest('.loupe');
  drag = { onLoupe, x: e.clientX, y: e.clientY, fx: filmX, lx, ly };
  (onLoupe ? loupe : table).classList.add('is-grabbing');
  table.setPointerCapture(e.pointerId);
};
table.addEventListener('pointerdown', startDrag);
table.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (drag.onLoupe) {
    lx = drag.lx + dx;
    ly = drag.ly + dy;
  } else {
    filmX = drag.fx + dx;
  }
  layout();
});
const endDrag = () => {
  if (!drag) return;
  loupe.classList.remove('is-grabbing');
  table.classList.remove('is-grabbing');
  drag = null;
};
table.addEventListener('pointerup', endDrag);
table.addEventListener('pointercancel', endDrag);

$('#zoom').addEventListener('input', (e) => {
  zoom = Number(e.target.value);
  layout();
});

// 背光开关
const lampBtn = $('#lampBtn');
const toggleLamp = () => {
  const off = table.classList.toggle('lamp-off');
  lampBtn.classList.toggle('is-on', !off);
  lampBtn.setAttribute('aria-pressed', String(!off));
};
lampBtn.addEventListener('click', toggleLamp);

// 胶片风格
$('#luts').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-lut]');
  if (!btn) return;
  $$('#luts button').forEach((b) => b.classList.toggle('is-on', b === btn));
  const f = LUTS[btn.dataset.lut];
  film.style.setProperty('--lut', f);
  filmMag.style.setProperty('--lut', f);
});

// 软件里的快捷键，这里把 L 接上，其余只做提示。
// target 不一定是元素（事件可能派发在 window 上），所以先判类型再调 closest
addEventListener('keydown', (e) => {
  const t = e.target;
  if (t instanceof Element && t.closest('input, textarea, select, [contenteditable]')) return;
  if (e.key === 'l' || e.key === 'L') {
    toggleLamp();
    e.preventDefault();
  }
});

// 容器一拿到尺寸就摆好（比 load 事件更早也更可靠），之后跟着尺寸变化重排
new ResizeObserver(layout).observe(table);
addEventListener('resize', layout);
layout();
