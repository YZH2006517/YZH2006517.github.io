/* ============================================================
   NANATATA 个人网站 —— 背景里的那座城
   一座直播塔（AI 虚拟主播：顶上的球往外发电波，弹幕条往塔上飞），
   一条横过天空的胶卷和一枚放大镜（Photo All Studio），
   周围是同一种蓝的低多边形城市。滚动页面，镜头就沿一条路线在城里走。

   §1 渲染器与色板   §2 三阶着色   §3 搭场景   §4 镜头路线   §5 每一帧

   WebGL 起不来、或者 three.js 没加载到，这个模块就安静地失败，
   页面退回到 CSS 画的那层天空，窗口照常可读。
   ============================================================ */

import * as THREE from 'three';

const root = document.documentElement;
const canvas = document.getElementById('gl');
const calm = matchMedia('(prefers-reduced-motion: reduce)');

/* ───────── §1 渲染器与色板 ───────── */

THREE.ColorManagement.enabled = false; // 色值按写的原样上屏，不做线性空间换算
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(1); // 高分屏也按 1 倍画，CSS 再放大成硬像素 —— 要的就是这个颗粒，还省电
renderer.setClearColor(0x000000, 0);

// 每种材质都是“亮 / 中 / 暗”三阶；ink 比 paper 整体深一档，用来区分体块
const PAL = {
  light: {
    hi: '#fbfeff', mid: '#a3dbf8', lo: '#4a82e4',
    inkHi: '#bde8fd', inkMid: '#58adf0', inkLo: '#2152cc',
    fog: '#f2fbff', line: '#58b2f0', red: '#e04a3f', win: '#2a5fd6', chat: '#3f9df0',
    glass: '#ffffff', film: '#13286a', hole: '#eefaff', f1: '#a9dcf8', f2: '#7cc1f3', f3: '#c6e9fc',
    star: '#ffffff', near: 90, far: 360, stars: 0.5,
  },
  dark: {
    hi: '#4f86ee', mid: '#2149b8', lo: '#0d1f6a',
    inkHi: '#3a6ad8', inkMid: '#173894', inkLo: '#08154c',
    fog: '#12297e', line: '#62c4ff', red: '#ff6052', win: '#a8ecff', chat: '#8fe2ff',
    glass: '#9fe6ff', film: '#050d2e', hole: '#a8e4ff', f1: '#2f63d8', f2: '#2453c4', f3: '#3d78e8',
    star: '#d8f4ff', near: 70, far: 300, stars: 0.95,
  },
};

// 所有材质共用这些 uniform 对象：换主题时改一处，整座城一起变色
const U = {};
for (const [k, v] of Object.entries(PAL.light)) if (typeof v === 'string') U[k] = { value: new THREE.Color(v) };
const uL = { value: new THREE.Vector3(-0.45, 0.8, 0.4).normalize() }; // 光从左上前方来
const uNear = { value: PAL.light.near };
const uFar = { value: PAL.light.far };
const uTime = { value: 0 };

/* ───────── §2 三阶着色 ─────────
   不用灯光，直接拿法线和光线方向的夹角分三档上色：顶面亮、迎光面中、背光面暗。
   硬边色块 + 雾，就是那种印刷品似的蓝色城市。 */

const TOON_VS = /* glsl */ `
  varying vec3 vN;
  varying float vD;
  void main() {
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = m * instanceMatrix;
    #endif
    vec4 w = m * vec4(position, 1.0);
    vN = normalize(mat3(m) * normal);
    vec4 mv = viewMatrix * w;
    vD = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const TOON_FS = /* glsl */ `
  uniform vec3 uHi, uMid, uLo, uFog, uL;
  uniform float uNear, uFar;
  varying vec3 vN;
  varying float vD;
  void main() {
    float d = dot(normalize(vN), uL);
    vec3 c = d > 0.45 ? uHi : (d > -0.1 ? uMid : uLo);
    gl_FragColor = vec4(mix(c, uFog, smoothstep(uNear, uFar, vD)), 1.0);
  }`;

function toon(hi, mid, lo) {
  return new THREE.ShaderMaterial({
    uniforms: { uHi: U[hi], uMid: U[mid], uLo: U[lo], uFog: U.fog, uL, uNear, uFar },
    vertexShader: TOON_VS,
    fragmentShader: TOON_FS,
  });
}
const paper = toon('hi', 'mid', 'lo');
const ink = toon('inkHi', 'inkMid', 'inkLo');

// 内置材质的 color 也直接指向共享的 Color，跟着主题一起变
function flat(key, opts = {}) {
  const m = new THREE.MeshBasicMaterial({ fog: true, ...opts });
  m.color = U[key].value;
  return m;
}
function lines(key, opacity = 1) {
  const m = new THREE.LineBasicMaterial({ fog: true, transparent: opacity < 1, opacity });
  m.color = U[key].value;
  return m;
}

/* ───────── §3 搭场景 ───────── */

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffffff, uNear.value, uFar.value);
scene.fog.color = U.fog.value;

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // 底面在 y=0，摆放时只管地面高度
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();

function block(x, z, w, h, d, { mat = paper, y = 0, ry = 0 } = {}) {
  const m = new THREE.Mesh(BOX, mat);
  m.position.set(x, y, z);
  m.scale.set(w, h, d);
  m.rotation.y = ry;
  scene.add(m);
  return m;
}
function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  scene.add(m);
  return m;
}
const pyramid = (r, h) => new THREE.ConeGeometry(r, h, 4).rotateY(Math.PI / 4).translate(0, h / 2, 0);
function line(points, mat) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat);
  scene.add(l);
  return l;
}

// —— 地面与台地 ——
mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), paper, 0, 0, 0);
block(-36, -10, 56, 3, 44);                  // 左边城区
block(26, -8, 46, 2, 42, { mat: ink });      // 塔下广场，深一档
block(-6, -60, 96, 7, 26);                   // 后面一道高台
block(64, -40, 44, 4, 30);                   // 右后方的柱廊台

// —— 左边城区 ——
const Y0 = 3;
block(-58, -14, 6, 30, 6, { y: Y0 });
mesh(pyramid(4.4, 12), paper, -58, Y0 + 30, -14);
block(-49, -1, 5, 18, 5, { y: Y0 });
mesh(pyramid(3.6, 8), paper, -49, Y0 + 18, -1);

// 竖条纹的楼群：立面上贴几根深色细条
for (const [x, z, h] of [[-42, -25, 34], [-35, -27, 44], [-28, -24, 30], [-21, -28, 40]]) {
  block(x, z, 5, h, 5, { y: Y0 });
  for (const dx of [-1.6, 0, 1.6]) block(x + dx, z + 2.55, 0.5, h - 3, 0.2, { y: Y0 + 1.5, mat: ink });
}

// 鼓形楼和它一圈窗
mesh(new THREE.CylinderGeometry(7, 7, 11, 24).translate(0, 5.5, 0), paper, -24, Y0, 4);
mesh(new THREE.CylinderGeometry(7.6, 7.6, 0.8, 24), ink, -24, Y0 + 11.4, 4);
{
  const n = 24;
  const wins = new THREE.InstancedMesh(BOX, flat('win'), n);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    q.setFromAxisAngle(V(0, 1, 0), a);
    m4.compose(V(-24 + Math.sin(a) * 7.05, Y0 + 5, 4 + Math.cos(a) * 7.05), q, V(0.9, 2.2, 0.2));
    wins.setMatrixAt(i, m4);
  }
  scene.add(wins);
}

// 阶梯金字塔
[14, 11, 8, 5].forEach((s, i) => block(-42, 12, s, 1.6, s, { y: Y0 + i * 1.6 }));

// —— 后面高台上挤成一座小山的房子 ——
{
  const houses = [];
  for (let lv = 0; lv < 4; lv++) {
    const count = 7 - lv;
    for (let i = 0; i < count; i++) {
      houses.push(V(-6 + (i - (count - 1) / 2) * 5.2 + (lv % 2) * 1.3, 7 + lv * 3.6, -56 - lv * 2.2 + (i % 2) * 1.5));
    }
  }
  const bodies = new THREE.InstancedMesh(BOX, paper, houses.length);
  const roofs = new THREE.InstancedMesh(pyramid(2.5, 2.4), paper, houses.length);
  houses.forEach((p, i) => {
    q.setFromAxisAngle(V(0, 1, 0), (i % 3) * 0.12);
    m4.compose(p, q, V(3.4, 3.2, 3.4));
    bodies.setMatrixAt(i, m4);
    m4.compose(V(p.x, p.y + 3.2, p.z), q, V(1, 1, 1));
    roofs.setMatrixAt(i, m4);
  });
  scene.add(bodies, roofs);
}

// —— 右后方的柱廊 ——
block(64, -30, 36, 1.2, 8, { y: 4 });
for (let i = 0; i < 9; i++) block(48.5 + i * 3.9, -27.5, 1.2, 8, 1.2, { y: 5.2 });
block(64, -30, 37, 1.6, 9, { y: 13.2, mat: ink });

// —— 直播塔：AI 虚拟主播 ——
const TX = 26, TZ = -10, TY = 2;
block(TX, TZ, 16, 3, 16, { y: TY, mat: ink });
mesh(new THREE.CylinderGeometry(2.4, 4, 50, 10).translate(0, 25, 0), paper, TX, TY + 3, TZ); // 塔身 y 5 → 55
mesh(new THREE.CylinderGeometry(11, 11, 1.4, 32), ink, TX, 35.3, TZ);                        // 观景台，顶面在 36
mesh(new THREE.CylinderGeometry(7, 8, 3, 16).translate(0, 1.5, 0), paper, TX, 36, TZ);       // 台上的小屋
mesh(new THREE.IcosahedronGeometry(4.6, 1), paper, TX, 59, TZ);                               // 顶上的球
{
  const ring = mesh(new THREE.TorusGeometry(7.6, 0.32, 4, 48), ink, TX, 59, TZ);
  ring.rotation.set(1.2, 0, 0.35);
}
mesh(new THREE.CylinderGeometry(0.22, 0.22, 10, 5).translate(0, 5, 0), ink, TX, 63.4, TZ);
const liveDot = mesh(new THREE.SphereGeometry(0.9, 8, 6), flat('red'), TX, 73.6, TZ); // 天线顶上那颗“直播中”

// 观景台外面一圈线框环和辐条
{
  const lm = lines('line', 0.9);
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    pts.push(V(TX + Math.cos(a) * 16, 37.5, TZ + Math.sin(a) * 16));
  }
  line(pts, lm);
  const spokes = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    spokes.push(V(TX + Math.cos(a) * 8, 39, TZ + Math.sin(a) * 8), V(TX + Math.cos(a) * 16, 37.5, TZ + Math.sin(a) * 16));
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spokes), lm));
}

// 从观景台拉到地面的红缆绳
{
  const red = lines('red');
  for (const a of [0.35, 1.9, 3.5, 5.0]) {
    line([V(TX + Math.cos(a) * 11, 35, TZ + Math.sin(a) * 11), V(TX + Math.cos(a) * 36, TY, TZ + Math.sin(a) * 36)], red);
  }
}

// 电波：三圈环从球心往外扩，扩到最大时淡掉
const waves = [0, 1, 2].map(() => {
  const w = mesh(new THREE.TorusGeometry(1, 0.08, 3, 72), flat('line', { transparent: true, depthWrite: false }), TX, 59, TZ);
  w.rotation.x = Math.PI / 2;
  return w;
});

// 弹幕：一条条小横块从城区那边飞向塔
const CHAT = 42;
const chat = new THREE.InstancedMesh(BOX, flat('chat'), CHAT);
const chatData = Array.from({ length: CHAT }, (_, i) => ({
  x: -80 + Math.random() * 150,
  y: 12 + Math.random() * 36,
  z: TZ - 18 + Math.random() * 34,
  v: 5 + Math.random() * 7,
  len: 2 + Math.random() * 5,
  i,
}));
scene.add(chat);

// —— 一路通上观景台的长台阶，一侧红扶手 ——
// 斜着横过画面（不是正对镜头），这样看到的是台阶的侧影，而不是一面白墙
{
  const S0 = V(-30, 0, 22), S1 = V(15, 36, -2);
  const STEPS = 44;
  const dir = V(S1.x - S0.x, 0, S1.z - S0.z);
  const run = dir.length() / STEPS;
  dir.normalize();
  q.setFromAxisAngle(V(0, 1, 0), Math.atan2(dir.x, dir.z));
  const steps = new THREE.InstancedMesh(BOX, paper, STEPS);
  for (let i = 0; i < STEPS; i++) {
    const t = (i + 0.5) / STEPS;
    const top = ((i + 1) / STEPS) * S1.y;
    m4.compose(V(S0.x + (S1.x - S0.x) * t, top - 3, S0.z + (S1.z - S0.z) * t), q, V(4.4, 3, run * 1.04));
    steps.setMatrixAt(i, m4);
  }
  scene.add(steps);
  const side = V(dir.z, 0, -dir.x).multiplyScalar(2.4);
  line([S0.clone().add(side).setY(1.6), S1.clone().add(side).setY(S1.y + 1.6)], lines('red'));
  line([S0.clone().sub(side).setY(1.6), S1.clone().sub(side).setY(S1.y + 1.6)], lines('line'));
}

// —— 棒棒糖树：细树干顶一块圆片 ——
{
  const trunk = new THREE.CylinderGeometry(0.22, 0.3, 5, 5).translate(0, 2.5, 0);
  const crown = new THREE.CylinderGeometry(2.3, 2.3, 0.6, 14).rotateX(Math.PI / 2);
  const spots = [
    [-36, 30, 0], [-44, 24, 0], [6, 24, 0], [20, 22, 2], [40, 14, 2], [44, 2, 2], [36, -26, 2],
    [-14, 6, 3], [-54, 8, 3], [-62, 0, 3], [-12, -20, 3], [74, -10, 0], [58, 16, 0],
  ];
  spots.forEach(([x, z, y], i) => {
    mesh(trunk, ink, x, y, z);
    const c = mesh(crown, paper, x, y + 5.6, z);
    c.rotation.set((i % 3) * 0.18 - 0.18, i * 0.7, 0);
  });
}

// —— 横过天空的胶卷：Photo All Studio ——
// 一条沿曲线铺开的长带子，齿孔和画幅都在着色器里按 uv 现画，片子沿着带子慢慢走
const FILM_W = 10;
const filmCurve = new THREE.CatmullRomCurve3([V(-120, 24, -96), V(-62, 44, -70), V(-14, 54, -62), V(36, 52, -74), V(96, 38, -100)]);
{
  const SEG = 220;
  const pos = [], uv = [], idx = [];
  const zAxis = V(0, 0, 1);
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const p = filmCurve.getPointAt(t);
    const side = new THREE.Vector3().crossVectors(filmCurve.getTangentAt(t), zAxis).normalize().multiplyScalar(FILM_W / 2);
    pos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z);
    uv.push(t, 1, t, 0);
    if (i < SEG) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);

  const film = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uBase: U.film, uHole: U.hole, uF1: U.f1, uF2: U.f2, uF3: U.f3, uFog: U.fog,
      uNear, uFar, uTime, uFrames: { value: filmCurve.getLength() / (FILM_W * 1.45) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vD;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vD = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase, uHole, uF1, uF2, uF3, uFog;
      uniform float uNear, uFar, uTime, uFrames;
      varying vec2 vUv;
      varying float vD;
      float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
      void main() {
        float x = vUv.x * uFrames - uTime * 0.12;
        float y = vUv.y;
        vec3 c = uBase;
        // 上下两条齿孔带
        float hx = fract(x * 4.0);
        float hy = min(abs(y - 0.08), abs(y - 0.92));
        if (hx > 0.3 && hx < 0.7 && hy < 0.035) c = uHole;
        // 画幅：每格挑一种天色，下半截压一道山或楼的剪影，按像素格取样
        float fx = fract(x), id = floor(x);
        if (y > 0.2 && y < 0.8 && fx > 0.05 && fx < 0.95) {
          float h = hash(id);
          vec3 sky = h < 0.34 ? uF3 : (h < 0.67 ? uF1 : uF2);
          float px = floor(fx * 24.0) / 24.0;
          float fy = floor((y - 0.2) / 0.6 * 12.0) / 12.0;
          float ridge = 0.3 + 0.22 * abs(sin(px * 3.1416 * (1.0 + floor(h * 3.0)) + h * 6.0));
          c = fy < ridge ? mix(uBase, sky, 0.4) : sky;
        }
        gl_FragColor = vec4(mix(c, uFog, smoothstep(uNear, uFar, vD)), 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(geo, film));
}

// 悬在胶卷前面的放大镜：镜框、半透明镜片、斜出去的镜柄
const loupe = new THREE.Group();
{
  loupe.add(new THREE.Mesh(new THREE.TorusGeometry(7, 0.8, 6, 40), ink));
  loupe.add(new THREE.Mesh(new THREE.CircleGeometry(6.4, 40), flat('glass', { transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide })));
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 10, 8), ink);
  handle.position.set(8.6, -8.6, 0);
  handle.rotation.z = Math.PI / 4;
  loupe.add(handle);
  loupe.position.set(-16, 53, -50);
  scene.add(loupe);
}

// —— 天上漂的线框多面体 ——
const polyMat = lines('line', 0.95);
const polys = [
  [new THREE.IcosahedronGeometry(6, 0), V(58, 64, -32)],
  [new THREE.OctahedronGeometry(5, 0), V(-80, 64, -28)],
  [new THREE.DodecahedronGeometry(4.5, 0), V(72, 34, 4)],
  [new THREE.IcosahedronGeometry(3.4, 1), V(44, 84, -12)],
  [new THREE.TetrahedronGeometry(4.2, 0), V(-42, 84, -34)],
  [new THREE.OctahedronGeometry(2.6, 0), V(-6, 70, 6)],
].map(([g, p]) => {
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(g), polyMat);
  l.position.copy(p);
  scene.add(l);
  return l;
});

// —— 浮尘，深色时是星星 ——
const stars = (() => {
  const N = 640;
  const arr = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    arr[i * 3] = (Math.random() - 0.5) * 360;
    arr[i * 3 + 1] = 8 + Math.random() * 150;
    arr[i * 3 + 2] = -190 + Math.random() * 250;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, transparent: true, opacity: 0.5, fog: false });
  mat.color = U.star.value;
  const p = new THREE.Points(geo, mat);
  scene.add(p);
  return p;
})();

/* ───────── §4 镜头路线 ─────────
   页面滚动比例 0 → 1 对应这条路线从头到尾。几个停靠点大致对着页面上的窗口：
   开场全景 → 城区（关于我、作品）→ 台阶和直播塔（虚拟主播）→ 塔顶电波
   → 胶卷和放大镜（Photo All 三扇窗）→ 退到高处看全城（方向、联系）。 */

const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 1000);
const PATH = new THREE.CatmullRomCurve3([
  V(2, 12, 80), V(-34, 18, 50), V(-4, 30, 34), V(6, 50, 22),
  V(-12, 54, -14), V(-50, 48, -22), V(-30, 40, 40), V(0, 80, 112),
]);
const LOOK = new THREE.CatmullRomCurve3([
  V(10, 26, 0), V(-36, 14, -14), V(26, 40, -10), V(26, 60, -10),
  V(-16, 52, -64), V(0, 50, -68), V(10, 20, -20), V(0, 14, -20),
]);

const scrollT = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
};
let tNow = scrollT();
let tGoal = tNow;
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
const eye = new THREE.Vector3();
const look = new THREE.Vector3();

function place(t) {
  PATH.getPoint(t, eye);
  LOOK.getPoint(t, look);
  camera.position.set(eye.x + pointer.sx * 2.2, eye.y - pointer.sy * 1.4, eye.z);
  camera.lookAt(look);
}

/* ───────── §5 每一帧 ───────── */

function paint() {
  const p = PAL[root.dataset.theme === 'dark' ? 'dark' : 'light'];
  for (const k in U) U[k].value.set(p[k]);
  uNear.value = scene.fog.near = p.near;
  uFar.value = scene.fog.far = p.far;
  stars.material.opacity = p.stars;
  if (calm.matches) draw();
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < 700 ? 64 : 50; // 竖屏视野窄，拉宽一点才装得下塔
  camera.updateProjectionMatrix();
  if (calm.matches) draw();
}

function animate(time, dt) {
  uTime.value = time;

  for (const [i, l] of polys.entries()) {
    l.rotation.x = time * (0.08 + i * 0.015);
    l.rotation.y = time * (0.12 + i * 0.01);
    l.position.y += Math.sin(time * 0.6 + i) * 0.004;
  }

  waves.forEach((w, i) => {
    const k = (time * 0.35 + i / waves.length) % 1;
    const s = 6 + k * 26;
    w.scale.set(s, s, s);
    w.material.opacity = (1 - k) * 0.85;
  });
  liveDot.visible = Math.floor(time * 1.6) % 2 === 0;

  for (const c of chatData) {
    c.x += c.v * dt;
    if (c.x > TX + 34) { c.x = -90 - Math.random() * 20; c.y = 12 + Math.random() * 36; }
    m4.compose(V(c.x, c.y, c.z), q.identity(), V(c.len, 0.8, 0.25));
    chat.setMatrixAt(c.i, m4);
  }
  chat.instanceMatrix.needsUpdate = true;

  loupe.position.x = -16 + Math.sin(time * 0.22) * 12;
  loupe.position.y = 53 + Math.sin(time * 0.7) * 0.8;
  loupe.rotation.z = Math.sin(time * 0.3) * 0.08;
}

function draw() {
  // 动效关掉时镜头停在开场那个角度，城市也不动，只在尺寸或主题变了时重画
  if (calm.matches) place(0);
  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
let running = false;
function tick() {
  if (calm.matches) { running = false; draw(); return; }
  const dt = Math.min(clock.getDelta(), 0.05);
  tNow += (tGoal - tNow) * (1 - Math.exp(-dt * 3.5));
  pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 2));
  pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 2));
  animate(clock.elapsedTime, dt);
  place(tNow);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
function start() {
  if (running || calm.matches) return;
  running = true;
  clock.getDelta();
  requestAnimationFrame(tick);
}

addEventListener('scroll', () => { tGoal = scrollT(); }, { passive: true });
addEventListener('resize', () => { tGoal = scrollT(); resize(); });
addEventListener('pointermove', (e) => {
  pointer.x = e.clientX / innerWidth - 0.5;
  pointer.y = e.clientY / innerHeight - 0.5;
}, { passive: true });
addEventListener('themechange', paint);
calm.addEventListener('change', () => (calm.matches ? draw() : start()));

paint();
resize();
place(tNow);
animate(0, 0);
draw();
root.classList.add('gl-on');
start();
