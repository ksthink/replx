// Chrome 웹 스토어에 등록되면 주소를 넣으세요. 비어 있으면 GitHub 릴리스의 최신 zip(replx.zip)을 받게 합니다.
const STORE_URL = '';

const $ = (s) => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = (x) => x * x * (3 - 2 * x);
const lerp = (a, b, k) => a + (b - a) * k;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (STORE_URL) {
  $('#getBtn').href = STORE_URL;
  $('#getBtn').textContent = 'Chrome에 추가';
  $('#getNote').hidden = true;
}

// ---------- 상단 바 ----------
const topBar = $('#top');

// ---------- 1. 첫 화면: 흩어지는 말풍선(패럴렉스) ----------
const BUBBLES = [
  ['ㅋㅋㅋㅋ 이게 맞냐', 8, 18, 0.55], ['<b>베스트</b> 추천 1.2만', 70, 14, 0.8, 'hot'], ['ㄹㅇ 공감', 84, 34, 0.35],
  ['댓글 3,204', 4, 46, 0.7, 'hot'], ['근데 그거 아님', 76, 58, 0.6], ['1등', 18, 72, 0.9],
  ['요약 좀', 62, 80, 0.45], ['이건 좀 아니지 않나', 30, 10, 0.3], ['↳ 답글 128개', 88, 78, 0.75, 'hot'],
  ['출처는?', 10, 88, 0.5], ['역시 믿고 거른다', 44, 90, 0.65], ['ㅇㅈ', 92, 8, 0.4],
];
const bubbleWrap = $('#bubbles');
const bubbles = BUBBLES.map(([html, x, y, speed, cls], i) => {
  const el = document.createElement('div');
  el.className = `bubble${cls ? ` ${cls}` : ''}`;
  el.innerHTML = html;
  el.style.left = `${x}%`;
  el.style.top = `${y}%`;
  if (!reduceMotion) el.animate([{ opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }], { duration: 600, delay: 120 + i * 70, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' });
  bubbleWrap.append(el);
  return { el, speed, x };
});
const heroCore = $('#heroCore');

function updateHero(y, vh) {
  const k = y / vh;
  for (const b of bubbles) {
    const drift = (b.x < 50 ? -1 : 1) * k * 120 * b.speed;
    b.el.style.transform = `translate(${drift}px, ${-y * b.speed}px)`;
    b.el.style.opacity = String(clamp(1 - k * 1.6));
    b.el.style.setProperty('--strike', String(clamp(k * 4 - b.speed)));
  }
  heroCore.style.transform = `translateY(${y * 0.35}px)`;
  heroCore.style.opacity = String(clamp(1 - k * 1.3));
}

// ---------- 2. 기능 장면 ----------
const show = $('#show');
const device = $('#device');
const deviceWrap = $('#deviceWrap');
const captions = [...document.querySelectorAll('#captions li')];
const bars = [...document.querySelectorAll('#progress i')];
const badge = $('#badge');
const cursor = $('#cursor');
const pickBox = $('#pickBox');
const toast = $('#toast');
const rules = $('#rules');
const rows = [...rules.querySelectorAll('.r-row')];
const exportBtn = $('#exportBtn');
const foldBtn = $('#foldBtn');
const B = { rel: $('#bRelated'), react: $('#bReact'), com: $('#bComments'), fold: $('#bFold') };
const PROPS = ['height', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'];
const natural = new Map();
let scale = 1;

function measure() {
  for (const el of Object.values(B)) {
    for (const p of PROPS) el.style[p] = '';
    el.style.opacity = '';
    const cs = getComputedStyle(el);
    natural.set(el, Object.fromEntries(PROPS.map((p) => [p, p === 'height' ? el.offsetHeight : parseFloat(cs[p]) || 0])));
  }
  // 화면 폭·높이에 맞춰 기기 모형 크기 조절
  const stage = deviceWrap.parentElement;
  const capH = innerWidth <= 900 ? $('#captions').offsetHeight + 30 : 0;
  const availW = deviceWrap.clientWidth;
  const availH = stage.clientHeight - capH - 110;
  scale = Math.min(1, availW / device.offsetWidth, availH / device.offsetHeight);
  device.style.transform = `scale(${scale})`;
  deviceWrap.style.height = `${device.offsetHeight * scale}px`;
}

function setBlock(el, v) {
  const n = natural.get(el);
  for (const p of PROPS) el.style[p] = `${n[p] * v}px`;
  el.style.opacity = String(v);
}

function rectOf(el) {
  const d = device.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: (r.left - d.left) / scale, y: (r.top - d.top) / scale, w: r.width / scale, h: r.height / scale };
}

const START = { x: 470, y: 470 };
function moveCursor(target, k, pressed = false, show = true) {
  const r = rectOf(target);
  const x = lerp(START.x, r.x + r.w * 0.55, ease(k));
  const y = lerp(START.y, r.y + r.h * 0.5, ease(k));
  cursor.style.opacity = show ? '1' : '0';
  cursor.style.transform = `translate(${x}px, ${y}px) scale(${pressed ? 0.82 : 1})`;
}

function box(target, on, green = false) {
  pickBox.classList.toggle('green', green);
  pickBox.style.opacity = on ? '1' : '0';
  if (!on) return;
  const r = rectOf(target);
  Object.assign(pickBox.style, { left: `${r.x - 3}px`, top: `${r.y - 3}px`, width: `${r.w + 6}px`, height: `${Math.max(r.h, 0) + 6}px` });
}

function say(text) {
  toast.classList.toggle('on', !!text);
  if (text) toast.textContent = text;
}

function scene(i, t) {
  // 기본값
  let rel = 1, react = 1, com = 1, fold = 0, badgeN = '';
  const cls = { rel: '', react: '', com: '' };
  let cur = null;
  let pickT = null;
  let msg = '';
  let rulesK = 0;
  foldBtn.textContent = '보기';

  if (i === 0) { // 알아서 숨김(관련 기사까지 잘못 숨겨짐)
    const k = 1 - ease(seg(t, 0.3, 0.65));
    rel = k; com = k;
    if (t > 0.6) badgeN = '2';
  } else if (i === 1) { // 놓친 '실시간 반응'을 클릭해서 숨김
    rel = 0; com = 0; badgeN = '2';
    react = 1 - ease(seg(t, 0.58, 0.85));
    cur = { el: B.react, k: seg(t, 0.08, 0.45), pressed: t > 0.48 && t < 0.56, show: t < 0.9 };
    if (t > 0.3 && t < 0.86) pickT = { el: B.react, green: false };
    if (t > 0.6) { msg = '숨김 규칙을 저장했어요'; badgeN = '3'; }
  } else if (i === 2) { // 숨긴 곳을 드러내 '관련 기사'를 제외
    const inK = ease(seg(t, 0, 0.15));
    const outK = 1 - ease(seg(t, 0.75, 0.95));
    rel = inK; react = inK * outK; com = inK * outK;
    badgeN = '3';
    if (t < 0.8) { cls.react = 'reveal'; cls.com = 'reveal'; }
    cls.rel = t > 0.5 ? (t < 0.92 ? 'allow' : '') : (t < 0.8 ? 'reveal' : '');
    cur = { el: B.rel, k: seg(t, 0.15, 0.45), pressed: t > 0.47 && t < 0.53, show: t > 0.08 && t < 0.9 };
    if (t > 0.3 && t < 0.5) pickT = { el: B.rel, green: true };
    if (t > 0.55) msg = '제외 규칙을 저장했어요';
    if (t > 0.8) badgeN = '2';
  } else if (i === 3) { // 접어두기 → 보기
    react = 0; badgeN = '2';
    fold = ease(seg(t, 0.08, 0.3));
    com = ease(seg(t, 0.62, 0.85));
    cur = { el: foldBtn, k: seg(t, 0.3, 0.55), pressed: t > 0.57 && t < 0.63, show: t > 0.25 && t < 0.92 };
    if (t > 0.6) foldBtn.textContent = '다시 숨기기';
  } else { // 규칙 목록
    react = 0; com = 0; fold = 1; badgeN = '2';
    rulesK = ease(seg(t, 0, 0.3));
    rows.forEach((r, n) => r.classList.toggle('on', t > 0.25 + n * 0.09));
    cur = { el: exportBtn, k: seg(t, 0.62, 0.82), pressed: t > 0.84 && t < 0.9, show: t > 0.58 };
    if (t > 0.86) msg = 'CSV로 내보냈어요';
  }
  if (i !== 4) rows.forEach((r) => r.classList.remove('on'));

  setBlock(B.rel, rel);
  setBlock(B.react, react);
  setBlock(B.com, com);
  setBlock(B.fold, fold);
  for (const k of ['rel', 'react', 'com']) {
    B[k].classList.toggle('reveal', cls[k] === 'reveal');
    B[k].classList.toggle('allow', cls[k] === 'allow');
  }
  badge.textContent = badgeN;
  badge.classList.toggle('on', !!badgeN);
  rules.style.transform = `translateY(${(1 - rulesK) * 110}%)`;
  rules.style.opacity = String(rulesK);
  exportBtn.classList.toggle('glow', i === 4 && t > 0.8);
  if (cur) moveCursor(cur.el, cur.k, cur.pressed, cur.show);
  else cursor.style.opacity = '0';
  box(pickT?.el, !!pickT, pickT?.green);
  say(msg);
}

let lastIdx = -1;
function updateShow(y, vh) {
  const top = show.offsetTop;
  const p = clamp((y - top) / (show.offsetHeight - vh));
  const scaled = Math.min(p * 5, 4.9999);
  const idx = Math.floor(scaled);
  const t = scaled - idx;
  if (idx !== lastIdx) {
    captions.forEach((c, n) => c.classList.toggle('on', n === idx));
    lastIdx = idx;
  }
  bars.forEach((b, n) => b.style.setProperty('--p', n < idx ? 1 : n === idx ? t : 0));
  scene(idx, t);
}

// ---------- 3. 실제 화면: 두 줄이 반대로 흐름 ----------
const reel = $('#reel');
const reelRows = [...document.querySelectorAll('.reel-row')];
function updateReel(y, vh) {
  const r = reel.getBoundingClientRect();
  const k = clamp((vh - r.top) / (vh + r.height));
  for (const row of reelRows) {
    const range = Math.max(0, row.scrollWidth - innerWidth) + 120;
    const dir = Number(row.dataset.dir);
    const x = dir < 0 ? -k * range : -(1 - k) * range;
    row.style.transform = `translateX(${x}px)`;
  }
}

// ---------- 루프 ----------
let ticking = false;
function frame() {
  ticking = false;
  const y = scrollY;
  const vh = innerHeight;
  topBar.classList.toggle('scrolled', y > 10);
  if (!reduceMotion) updateHero(y, vh);
  updateShow(y, vh);
  if (!reduceMotion) updateReel(y, vh);
}
function request() {
  if (!ticking) { ticking = true; requestAnimationFrame(frame); }
}
addEventListener('scroll', request, { passive: true });
addEventListener('resize', () => { measure(); request(); });
addEventListener('load', () => { measure(); request(); });
(document.fonts?.ready || Promise.resolve()).then(() => { measure(); request(); });
measure();
frame();
