// Chrome 웹 스토어에 등록되면 주소를 넣으세요. 비어 있으면 직접 설치 안내를 보여 줍니다.
const STORE_URL = '';

const $ = (s) => document.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 설치 버튼 ----------
if (STORE_URL) {
  $('#getBtn').href = STORE_URL;
  $('#storeBtn').href = STORE_URL;
  $('#storeReady').hidden = false;
  $('#storePending').hidden = true;
}

// ---------- 체험 데모 ----------
const toggle = $('#demoOn');
const comments = $('#comments');
const folded = $('#folded');
const peekBtn = $('#peekBtn');
const hint = $('#demoHint');
const modeButtons = [...document.querySelectorAll('.seg button')];
let mode = 'hide';
let peeking = false;

function setCollapsed(el, collapsed) {
  if (collapsed) {
    el.style.maxHeight = `${el.scrollHeight}px`;
    el.getBoundingClientRect(); // 시작 높이를 확정해야 접히는 움직임이 보입니다.
    el.classList.add('hidden');
    el.style.maxHeight = '0px';
  } else {
    el.classList.remove('hidden');
    el.style.maxHeight = `${el.scrollHeight}px`;
    const done = () => { el.style.maxHeight = ''; el.removeEventListener('transitionend', done); };
    if (reduceMotion) done(); else el.addEventListener('transitionend', done);
  }
}

function pickedCount() {
  return comments.querySelectorAll('.gone').length;
}

function renderHint() {
  const n = pickedCount();
  if (toggle.checked) {
    hint.textContent = mode === 'hide'
      ? 'Replx가 댓글 영역을 찾아 숨겼어요. 스위치를 끄면 다시 보여요.'
      : '댓글을 지우지 않고 접어 뒀어요. 보기를 누르면 펼쳐져요.';
    return;
  }
  hint.textContent = n
    ? `직접 숨긴 댓글이 ${n}개 있어요. `
    : '꺼진 상태예요. 댓글을 누르면 그 부분만 직접 숨겨져요.';
  if (n) {
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'linkish';
    undo.textContent = '다시 보이기';
    undo.onclick = () => { comments.querySelectorAll('.gone').forEach((e) => e.classList.remove('gone')); renderHint(); };
    hint.append(undo);
  }
}

function render() {
  const on = toggle.checked;
  modeButtons.forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.mode === mode));
    b.disabled = !on;
  });
  comments.classList.toggle('picking', !on);
  folded.hidden = !(on && mode === 'collapse');
  const hide = on && !(mode === 'collapse' && peeking);
  if (hide !== comments.classList.contains('hidden')) setCollapsed(comments, hide);
  peekBtn.textContent = peeking ? '다시 숨기기' : '보기';
  renderHint();
}

toggle.addEventListener('change', () => { peeking = false; render(); });
modeButtons.forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; peeking = false; render(); }));
peekBtn.addEventListener('click', () => { peeking = !peeking; render(); });

// 꺼진 상태에서 댓글(또는 머리글)을 누르면 그 부분만 숨겨요 — 확장의 "숨길 영역 지정"을 흉내 냅니다.
comments.addEventListener('click', (e) => {
  if (toggle.checked) return;
  const target = e.target.closest('.c-item, .c-head');
  if (!target) return;
  if (target.classList.contains('c-head')) comments.querySelectorAll('.c-item, .c-head').forEach((x) => x.classList.add('gone'));
  else target.classList.add('gone');
  renderHint();
});

// 처음 한 번: 댓글이 보이다가 Replx가 켜지며 접히는 장면
toggle.checked = false;
render();
setTimeout(() => { toggle.checked = true; render(); }, reduceMotion ? 0 : 1100);

// ---------- 화면 탭 ----------
const ALTS = {
  1: 'Replx를 켜기 전과 후의 커뮤니티 글 화면',
  2: '못 숨긴 댓글 영역을 클릭해 숨김 규칙으로 저장하는 화면',
  3: '숨겨진 영역이 점선으로 드러나고, 클릭해 제외 규칙으로 저장하는 화면',
  4: '댓글을 접어 둔 페이지와 Replx 팝업',
  5: '사이트별 차단·제외 규칙을 모아 보는 목록 창',
};
const tabs = [...document.querySelectorAll('.tabs [role=tab]')];
const shot = $('#shotImg');
function selectTab(btn, focus = false) {
  tabs.forEach((t) => { t.setAttribute('aria-selected', String(t === btn)); t.tabIndex = t === btn ? 0 : -1; });
  const i = btn.dataset.i;
  shot.src = `assets/store/screenshot-${i}.png`;
  shot.alt = ALTS[i];
  if (focus) btn.focus();
}
tabs.forEach((t, idx) => {
  t.tabIndex = idx === 0 ? 0 : -1;
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(idx + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next, true);
  });
});
// 다른 화면을 미리 받아 두어 탭을 바꿀 때 깜빡이지 않게 합니다.
addEventListener('load', () => { for (let i = 2; i <= 5; i++) new Image().src = `assets/store/screenshot-${i}.png`; });
