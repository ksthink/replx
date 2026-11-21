// Replx 소개 영상 — render(t)가 t초(0~30)의 화면을 그립니다. 모든 움직임은 t만으로 결정돼요.
const DURATION = 30;
// 장면 경계(초). render.py가 장면마다 파일을 따로 만들고 이어 붙입니다.
const SCENES = [
  ['intro', 0, 3.2],
  ['auto', 3.2, 9],
  ['hide', 9, 15],
  ['allow', 15, 21],
  ['fold-rules', 21, 26],
  ['end', 26, 30],
];

const $ = (s) => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = (x) => x * x * (3 - 2 * x);
const easeOut = (x) => 1 - (1 - x) ** 3;
const back = (x) => { const c = 1.9; return x <= 0 ? 0 : 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- 인트로 말풍선 ----------
const BUBBLES = [
  ['ㅋㅋㅋㅋ 이게 맞냐', 6, 12], ['베스트 추천 1.2만', 66, 8, 'hot'], ['ㄹㅇ 공감', 84, 26], ['댓글 3,204', 3, 40, 'hot'],
  ['근데 그거 아님', 74, 46], ['1등', 20, 64], ['요약 좀', 58, 74], ['이건 좀 아니지 않나', 30, 6],
  ['↳ 답글 128개', 82, 70, 'hot'], ['출처는?', 8, 84], ['역시 믿고 거른다', 38, 88], ['ㅇㅈ', 92, 6],
  ['광고 아님?', 46, 20], ['ㄴㄴ 그건 아니고', 24, 30], ['와 미쳤다', 64, 30], ['첫 댓 ㅎㅎ', 46, 60],
  ['정독함', 88, 88], ['↳ 이분 뭐임', 2, 62], ['반대 312', 70, 88, 'hot'], ['ㅋㅋㅋ', 56, 50],
];
const bubbleEls = BUBBLES.map(([text, x, y, cls], i) => {
  const el = document.createElement('div');
  el.className = `bubble${cls ? ` ${cls}` : ''}`;
  el.textContent = text;
  el.style.left = `${x}%`;
  el.style.top = `${y}%`;
  const strike = document.createElement('i');
  el.append(strike);
  $('#bubbles').append(el);
  return { el, strike, i, x, y };
});

// ---------- 기기 모형 ----------
const SCALE = 1.62;
const device = $('#device');
device.style.transform = `scale(${SCALE})`;
const B = { rel: $('#bRelated'), react: $('#bReact'), com: $('#bComments'), fold: $('#bFold') };
const PROPS = ['height', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'];
const natural = new Map();
function measure() {
  for (const el of Object.values(B)) {
    for (const p of PROPS) el.style[p] = '';
    el.style.opacity = '';
    const cs = getComputedStyle(el);
    natural.set(el, Object.fromEntries(PROPS.map((p) => [p, p === 'height' ? el.offsetHeight : parseFloat(cs[p]) || 0])));
  }
}
function setBlock(el, v) {
  const n = natural.get(el);
  for (const p of PROPS) el.style[p] = `${n[p] * v}px`;
  el.style.opacity = String(v);
}
function rectOf(el) {
  const d = device.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: (r.left - d.left) / SCALE, y: (r.top - d.top) / SCALE, w: r.width / SCALE, h: r.height / SCALE };
}

const cursor = $('#cursor');
const ripple = $('#ripple');
const pickBox = $('#pickBox');
const toast = $('#toast');
const badge = $('#badge');
const rules = $('#rules');
const rows = [...rules.querySelectorAll('.r-row')];
const exportBtn = $('#exportBtn');
const foldBtn = $('#foldBtn');
const caps = [...document.querySelectorAll('.cap')];
const bars = [...document.querySelectorAll('#progress b')];

const START = { x: 470, y: 470 };
// 커서: from → 대상 중심으로 이동(k), clickAt(장면 시각)에 눌림과 물결
function drawCursor(target, k, lt, clickAt, visible) {
  const r = rectOf(target);
  const tx = r.x + r.w * 0.55;
  const ty = r.y + r.h * 0.5;
  const x = lerp(START.x, tx, ease(k));
  const y = lerp(START.y, ty, ease(k));
  const press = clickAt != null ? 1 - 0.18 * Math.sin(Math.PI * seg(lt, clickAt, clickAt + 0.22)) : 1;
  cursor.style.opacity = String(visible);
  cursor.style.transform = `translate(${x}px, ${y}px) scale(${press})`;
  if (clickAt != null) {
    const rp = seg(lt, clickAt + 0.05, clickAt + 0.6);
    ripple.style.left = `${tx}px`;
    ripple.style.top = `${ty}px`;
    ripple.style.opacity = rp > 0 && rp < 1 ? String(1 - rp) : '0';
    ripple.style.transform = `scale(${0.4 + rp * 1.6})`;
  }
}
function drawBox(target, a, green) {
  pickBox.classList.toggle('green', !!green);
  pickBox.style.opacity = String(a);
  if (!target || a <= 0) return;
  const r = rectOf(target);
  Object.assign(pickBox.style, { left: `${r.x - 3}px`, top: `${r.y - 3}px`, width: `${r.w + 6}px`, height: `${r.h + 6}px` });
}
function drawToast(text, a) {
  toast.textContent = text || toast.textContent;
  toast.style.opacity = String(a);
  toast.style.transform = `translate(-50%, ${(1 - a) * 12}px)`;
}
function drawBadge(n, popAt, lt) {
  badge.textContent = n;
  const s = n ? (popAt != null ? back(seg(lt, popAt, popAt + 0.35)) : 1) : 0;
  badge.style.transform = `scale(${s})`;
}

// ---------- 장면별 상태 ----------
function deviceScene(i, lt) {
  // 기본 상태
  let rel = 1, react = 1, com = 1, fold = 0;
  const cls = { rel: '', react: '', com: '' };
  let curTarget = null, curK = 0, clickAt = null, curVis = 0;
  let boxTarget = null, boxA = 0, boxGreen = false;
  let toastText = '', toastA = 0;
  let badgeN = '', popAt = null;
  let rulesK = 0;
  foldBtn.textContent = '보기';
  ripple.style.opacity = '0';

  if (i === 1) { // 자동 숨김 (관련 기사까지 잘못 숨김)
    const k = 1 - ease(seg(lt, 1.6, 2.8));
    rel = k; com = k;
    if (lt > 2.6) { badgeN = '2'; popAt = 2.6; }
  } else if (i === 2) { // 놓친 '실시간 반응'을 클릭해서 숨김
    rel = 0; com = 0; badgeN = '2';
    react = 1 - ease(seg(lt, 2.4, 3.3));
    curTarget = B.react; curK = seg(lt, 0.5, 1.8); clickAt = 2.0; curVis = seg(lt, 0.3, 0.6) * (1 - seg(lt, 4.8, 5.3));
    boxTarget = B.react; boxA = seg(lt, 1.3, 1.6) * (1 - seg(lt, 3.0, 3.3));
    toastText = '숨김 규칙을 저장했어요'; toastA = seg(lt, 2.6, 2.9) * (1 - seg(lt, 5.2, 5.6));
    if (lt > 2.6) { badgeN = '3'; popAt = 2.6; }
  } else if (i === 3) { // 숨긴 곳을 드러내 '관련 기사'를 제외
    const inK = ease(seg(lt, 0, 0.6));
    const outK = 1 - ease(seg(lt, 3.6, 4.4));
    rel = inK; react = inK * outK; com = inK * outK;
    badgeN = '3';
    if (lt < 3.9) { cls.react = 'reveal'; cls.com = 'reveal'; }
    cls.rel = lt > 2.3 ? (lt < 5.3 ? 'allow' : '') : 'reveal';
    curTarget = B.rel; curK = seg(lt, 0.7, 2.0); clickAt = 2.2; curVis = seg(lt, 0.5, 0.8) * (1 - seg(lt, 4.8, 5.3));
    boxTarget = B.rel; boxA = seg(lt, 1.4, 1.7) * (1 - seg(lt, 2.2, 2.4)); boxGreen = true;
    toastText = '제외 규칙을 저장했어요'; toastA = seg(lt, 2.5, 2.8) * (1 - seg(lt, 5.2, 5.6));
    if (lt > 4.2) { badgeN = '2'; popAt = 4.2; }
  } else if (i === 4) { // 접어두기 → 규칙 목록·CSV
    react = 0; badgeN = '2';
    fold = ease(seg(lt, 0.1, 0.6));
    com = ease(seg(lt, 1.75, 2.3)) * (1 - ease(seg(lt, 2.6, 3.0)));
    if (lt > 1.6) foldBtn.textContent = '다시 숨기기';
    rulesK = easeOut(seg(lt, 2.6, 3.2));
    rows.forEach((r, n) => { const a = seg(lt, 3.0 + n * 0.15, 3.3 + n * 0.15); r.style.opacity = String(a); r.style.transform = `translateX(${(1 - a) * -12}px)`; });
    if (lt < 2.5) {
      curTarget = foldBtn; curK = seg(lt, 0.5, 1.35); clickAt = 1.5; curVis = seg(lt, 0.35, 0.6) * (1 - seg(lt, 2.1, 2.4));
    } else {
      curTarget = exportBtn; curK = seg(lt, 3.5, 4.2); clickAt = 4.35; curVis = seg(lt, 3.4, 3.6);
      toastText = 'CSV로 내보냈어요'; toastA = seg(lt, 4.45, 4.7);
    }
  }
  if (i !== 4) rows.forEach((r) => { r.style.opacity = '0'; });

  setBlock(B.rel, rel); setBlock(B.react, react); setBlock(B.com, com); setBlock(B.fold, fold);
  for (const k of ['rel', 'react', 'com']) {
    B[k].classList.toggle('reveal', cls[k] === 'reveal');
    B[k].classList.toggle('allow', cls[k] === 'allow');
  }
  rules.style.transform = `translateY(${(1 - rulesK) * 110}%)`;
  rules.style.opacity = String(rulesK);
  drawBadge(badgeN, popAt, lt);
  if (curTarget) drawCursor(curTarget, curK, lt, clickAt, curVis); else cursor.style.opacity = '0';
  drawBox(boxTarget, boxA, boxGreen);
  toast.style.bottom = rulesK > 0 ? '215px' : '22px'; // 규칙 목록 창 위로 올려 버튼을 가리지 않게
  drawToast(toastText, toastA);
}

// ---------- 전체 ----------
function render(t) {
  t = clamp(t, 0, DURATION);

  // 인트로: 말풍선이 튀어나오고 → 빨간 줄로 지워지고 → 흩어짐
  for (const b of bubbleEls) {
    const pop = back(seg(t, 0.05 + b.i * 0.035, 0.45 + b.i * 0.035));
    const strike = easeOut(seg(t, 1.15 + b.i * 0.02, 1.45 + b.i * 0.02));
    const out = ease(seg(t, 1.7 + (b.i % 5) * 0.05, 2.4 + (b.i % 5) * 0.05));
    const dx = (b.x - 50) * 4 * out;
    const dy = (b.y - 50) * 3 * out;
    b.el.style.opacity = String(Math.min(seg(t, 0.05 + b.i * 0.035, 0.25 + b.i * 0.035), 1 - out));
    b.el.style.transform = `translate(${dx}px, ${dy}px) scale(${pop * (1 - out * 0.3)})`;
    b.strike.style.transform = `scaleX(${strike})`;
  }
  const logoIn = back(seg(t, 1.9, 2.5));
  const logoOut = ease(seg(t, 2.85, 3.3));
  const logo = $('#logo');
  logo.style.opacity = String(seg(t, 1.9, 2.2) * (1 - logoOut));
  logo.style.transform = `scale(${(0.7 + 0.3 * logoIn) * (1 - 0.15 * logoOut)}) translateY(${-60 * logoOut}px)`;

  // 기능 장면 공통 요소
  const inMain = t >= 3.2 && t < 26.4;
  const mainIn = easeOut(seg(t, 3.15, 3.8));
  const mainOut = ease(seg(t, 25.9, 26.4));
  const host = $('#deviceHost');
  host.style.opacity = String(mainIn * (1 - mainOut));
  host.style.transform = `translateX(${(1 - mainIn) * 260}px) scale(${1 - 0.04 * mainOut})`;
  host.style.visibility = inMain ? 'visible' : 'hidden';
  $('#brand').style.opacity = String(seg(t, 3.3, 3.8) * (1 - mainOut));
  $('#progress').style.opacity = String(seg(t, 3.3, 3.8) * (1 - mainOut));

  // 장면 판단
  let i = 0;
  for (let n = 0; n < SCENES.length; n++) if (t >= SCENES[n][1]) i = n;
  const lt = t - SCENES[i][1];
  if (i >= 1 && i <= 4) deviceScene(i, lt);
  else if (i === 5) deviceScene(4, 5);

  // 자막(장면 제목): 장면 4는 접어두기(0~2.5초)와 규칙 목록(2.5초~)로 나뉨
  const capTimes = [[3.35, 9], [9, 15], [15, 21], [21, 23.6], [23.6, 26]];
  caps.forEach((c, n) => {
    const [a, b] = capTimes[n];
    const k = Math.min(easeOut(seg(t, a + 0.05, a + 0.5)), 1 - ease(seg(t, b - 0.3, b)));
    c.style.opacity = String(clamp(k));
    c.style.transform = `translateY(calc(-50% + ${(1 - clamp(k)) * 30}px))`;
  });
  // 진행 막대
  capTimes.forEach(([a, b], n) => { bars[n].style.transform = `scaleX(${seg(t, a, b)})`; });

  // 엔딩
  const end = $('#end');
  const endIn = seg(t, 26.1, 26.6);
  end.style.opacity = String(endIn);
  end.style.visibility = t > 26 ? 'visible' : 'hidden';
  const parts = [...end.children];
  parts.forEach((p, n) => {
    const k = n === 0 ? back(seg(t, 26.3, 26.8)) : easeOut(seg(t, 26.45 + n * 0.12, 26.9 + n * 0.12));
    p.style.opacity = String(seg(t, 26.3 + n * 0.12, 26.6 + n * 0.12));
    p.style.transform = n === 0 ? `scale(${k})` : `translateY(${(1 - k) * 30}px)`;
  });
}

// ---------- 시작 ----------
window.SCENES = SCENES;
window.DURATION = DURATION;
window.render = render;
window.ready = document.fonts.ready.then(() => { measure(); render(0); return true; });

// 렌더러가 아닌 일반 브라우저에서 열면 미리보기 재생
if (!navigator.webdriver) {
  let t0 = performance.now(), paused = false, pt = 0;
  const loop = (now) => { if (!paused) { pt = ((now - t0) / 1000) % DURATION; render(pt); } requestAnimationFrame(loop); };
  window.ready.then(() => requestAnimationFrame(loop));
  addEventListener('keydown', (e) => {
    if (e.key === ' ') { paused = !paused; t0 = performance.now() - pt * 1000; }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { pt = clamp(pt + (e.key === 'ArrowRight' ? 1 : -1), 0, DURATION); t0 = performance.now() - pt * 1000; render(pt); }
  });
}
