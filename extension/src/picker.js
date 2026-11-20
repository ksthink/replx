// 요소 직접 지정(피커): 마우스로 영역을 골라 사이트별 "숨김" 또는 "제외" 규칙으로 저장합니다.
//  - hide  : 고른 영역을 숨깁니다.
//  - allow : 고른 영역은 어떤 규칙에 걸려도 숨기지 않습니다(숨겨진 곳은 점선으로 드러내 보여 줌).
(() => {
  const IS_TOP = window === window.top;
  let state = null;

  const MODES = {
    hide: {
      color: '#e03a26', tint: 'rgba(224,58,38,.14)', tintSoft: 'rgba(224,58,38,.07)',
      bar: '💬 숨길 <b>영역</b>을 클릭하세요',
      title: '이 영역을 숨길까요?',
      save: '이 사이트에서 숨기기',
      other: '제외 모드로',
      note: '같은 선택자로 이 사이트의 다른 페이지에서도 숨겨져요.',
    },
    allow: {
      color: '#16a34a', tint: 'rgba(22,163,74,.14)', tintSoft: 'rgba(22,163,74,.07)',
      bar: '👁 <b>숨기지 않을 영역</b>을 클릭하세요 <span class="muted">· 숨겨진 곳은 빨간 점선으로 보여요</span>',
      title: '이 영역은 숨기지 않을까요?',
      save: '이 사이트에서 제외',
      other: '숨기기 모드로',
      note: '이 영역과 그 안팎은 어떤 규칙에 걸려도 숨기지 않아요.',
    },
  };

  // ---------- 선택자 생성 ----------
  const UNSTABLE_CLASS = /(\d{3,}|^(is-|has-)?(active|hover|focus|focused|open|opened|selected|show|shown|on|visible|hidden|current)$|^css-|^sc-|^jsx-|^svelte-|^_|__[a-zA-Z0-9]{5,}$|^[a-zA-Z]{1,3}[A-Z0-9][a-zA-Z0-9]{4,}$)/;

  function isStableId(el) {
    const id = el.id;
    if (!id || id.length > 40 || /\d{3,}|[a-f0-9]{8,}|^[:_]|^(ember|react|radix|headlessui|mui|yui)/i.test(id)) return false;
    try { return document.querySelectorAll(`#${CSS.escape(id)}`).length === 1; } catch { return false; }
  }

  function stableClasses(el) {
    return [...el.classList].filter((c) => c.length < 40 && !UNSTABLE_CLASS.test(c) && !c.startsWith('chh'));
  }

  function part(el) {
    if (isStableId(el)) return `#${CSS.escape(el.id)}`;
    const cls = stableClasses(el).slice(0, 3).map((c) => `.${CSS.escape(c)}`).join('');
    return el.localName + cls;
  }

  function count(sel) {
    try { return document.querySelectorAll(sel).length; } catch { return -1; }
  }

  function nthPart(el) {
    const p = part(el);
    if (p.startsWith('#') || !el.parentElement) return p;
    const same = [...el.parentElement.children].filter((c) => c.localName === el.localName);
    return same.length > 1 ? `${p}:nth-of-type(${same.indexOf(el) + 1})` : p;
  }

  function buildSelector(el) {
    if (isStableId(el)) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    for (let d = 0; cur && cur !== document.body && cur !== document.documentElement && d < 6; d++) {
      parts.unshift(part(cur));
      const sel = parts.join(' > ');
      const n = count(sel);
      if (/[.#]/.test(sel) && n >= 1 && n <= 2) return sel;
      if (parts[0].startsWith('#')) break;
      cur = cur.parentElement;
    }
    // 클래스만으로 특정이 안 되면 순번(nth-of-type)으로 경로를 만듭니다.
    const path = [];
    cur = el;
    for (let d = 0; cur && cur !== document.body && d < 8; d++) {
      path.unshift(nthPart(cur));
      const sel = path.join(' > ');
      if (path[0].startsWith('#') || count(sel) === 1) return sel;
      cur = cur.parentElement;
    }
    return `body > ${path.join(' > ')}`;
  }

  // ---------- 화면 요소 ----------
  const CSS_TEXT = `
    :host { all: initial; --c: #e03a26; --t: rgba(224,58,38,.14); --ts: rgba(224,58,38,.07); }
    .box { position: fixed; pointer-events: none; z-index: 2147483646; border: 2px solid var(--c);
      background: var(--t); border-radius: 3px; transition: all .06s linear; box-sizing: border-box; }
    .box.match { border-style: dashed; background: var(--ts); }
    .tag { position: fixed; z-index: 2147483647; pointer-events: none; background: #1f1f1f; color: #fff;
      font: 12px/1.4 -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; padding: 3px 7px; border-radius: 4px;
      max-width: 70vw; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar, .panel { position: fixed; left: 50%; transform: translateX(-50%); z-index: 2147483647; pointer-events: auto;
      background: #1f1f1f; color: #fff; font: 13px/1.5 -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.35); border-top: 3px solid var(--c); }
    .bar { bottom: 18px; padding: 9px 14px; display: flex; gap: 12px; align-items: center; white-space: nowrap; }
    .panel { bottom: 18px; padding: 12px 14px; width: min(580px, 92vw); }
    input.sel { all: unset; box-sizing: border-box; display: block; width: 100%; font: 12px/1.4 ui-monospace, Menlo, Consolas, monospace;
      background: #333; padding: 7px 9px; border-radius: 6px; margin: 6px 0 4px; color: #ffd591; border: 1px solid transparent; }
    input.sel:focus { border-color: #666; }
    input.sel.bad { border-color: #ff7875; color: #ff9c9c; }
    .info { font-size: 11.5px; color: #aaa; margin-bottom: 9px; min-height: 16px; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; }
    button { all: unset; cursor: pointer; padding: 6px 10px; border-radius: 6px; background: #3a3a3a; color: #fff; font-size: 12.5px; }
    button:hover { background: #4a4a4a; }
    button.primary { background: var(--c); } button.primary:hover { filter: brightness(1.1); }
    button:disabled, button.primary:disabled { opacity: .4; cursor: default; }
    button.mode { margin-left: auto; background: transparent; border: 1px solid #555; }
    kbd { background: #444; border-radius: 4px; padding: 0 5px; font-size: 11px; }
    .muted { color: #aaa; font-size: 12px; }
  `;

  function applyModeColors() {
    const m = MODES[state.mode];
    state.hostEl.style.setProperty('--c', m.color);
    state.hostEl.style.setProperty('--t', m.tint);
    state.hostEl.style.setProperty('--ts', m.tintSoft);
  }

  function makeRoot() {
    const host = document.createElement('chh-picker');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS_TEXT}</style><div class="box" hidden></div><div class="tag" hidden></div>`;
    document.documentElement.appendChild(host);
    return { host, root };
  }

  function rectStyle(node, r) {
    Object.assign(node.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  }

  function describe(el) {
    const r = el.getBoundingClientRect();
    return `${part(el)}  ·  ${Math.round(r.width)}×${Math.round(r.height)}`;
  }

  function draw() {
    if (!state || !state.cur) return;
    const box = state.root.querySelector('.box');
    const tag = state.root.querySelector('.tag');
    const r = state.cur.getBoundingClientRect();
    box.hidden = false;
    rectStyle(box, r);
    if (!state.locked) {
      tag.hidden = false;
      tag.textContent = describe(state.cur);
      tag.style.left = `${Math.max(4, r.left)}px`;
      tag.style.top = `${r.top > 28 ? r.top - 26 : r.bottom + 4}px`;
    } else {
      tag.hidden = true;
    }
  }

  function clearMatches() {
    state?.root.querySelectorAll('.box.match').forEach((b) => b.remove());
  }

  function showMatches(sel) {
    clearMatches();
    let els = [];
    try { els = [...document.querySelectorAll(sel)]; } catch { return -1; }
    for (const el of els) {
      if (el === state.cur) continue;
      const b = document.createElement('div');
      b.className = 'box match';
      rectStyle(b, el.getBoundingClientRect());
      state.root.appendChild(b);
    }
    return els.length;
  }

  const ourNode = (t) => t && t.closest && t.closest('chh-picker');

  // ---------- 이벤트 ----------
  function onMove(e) {
    if (!state || state.locked) return;
    const t = e.target;
    if (!(t instanceof Element) || ourNode(t) || t === document.documentElement || t === document.body) return;
    state.cur = t;
    state.history = [];
    draw();
  }

  function swallow(e) {
    if (!state || ourNode(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function onClick(e) {
    if (!state || ourNode(e.target)) return;
    swallow(e);
    if (!state.locked && state.cur) lock();
  }

  function goUp() {
    const p = state.cur?.parentElement;
    if (p && p !== document.body && p !== document.documentElement) {
      state.history.push(state.cur);
      state.cur = p;
      state.locked ? refreshPanel() : draw();
    }
  }

  function goDown() {
    const prev = state.history.pop();
    if (prev) { state.cur = prev; state.locked ? refreshPanel() : draw(); }
  }

  function onKey(e) {
    if (!state) return;
    const typing = e.composedPath()[0]?.localName === 'input';
    const k = e.key;
    if (k === 'Escape') { swallow(e); stop(true); return; }
    if (k === 'Enter') { e.preventDefault(); e.stopPropagation(); if (state.locked) save(); else if (state.cur) lock(); return; }
    if (typing) return; // 선택자 입력 중에는 다른 키를 가로채지 않음
    if (k === 'ArrowUp') { swallow(e); goUp(); }
    else if (k === 'ArrowDown') { swallow(e); goDown(); }
    else if (k === 'Tab') { swallow(e); toggleMode(); }
  }

  function onScroll() {
    if (!state) return;
    draw();
    if (state.locked && state.selector) showMatches(state.selector);
  }

  // ---------- 모드 ----------
  function toggleMode() {
    setMode(state.mode === 'hide' ? 'allow' : 'hide');
  }

  function setMode(mode) {
    state.mode = mode;
    applyModeColors();
    state.onModeChange?.(mode);
    if (state.locked) renderPanelText();
    else { state.root.querySelector('.bar')?.remove(); if (IS_TOP) addBar(); }
    // 드러내기/숨기기 CSS가 바뀌어 위치가 달라질 수 있어 다시 그립니다.
    requestAnimationFrame(() => { if (state) { draw(); if (state.locked) refreshPanel(false); } });
  }

  // ---------- 확인 패널 ----------
  function lock() {
    state.locked = true;
    state.root.querySelector('.bar')?.remove();
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px"><b class="title"></b><button class="mode" data-a="mode"></button></div>
      <input class="sel" spellcheck="false" aria-label="CSS 선택자">
      <div class="info"></div>
      <div class="row">
        <button class="primary" data-a="save"></button>
        <button data-a="up">↑ 더 넓게</button>
        <button data-a="down">↓ 좁게</button>
        <button data-a="repick">다시 고르기</button>
        <button data-a="cancel">취소</button>
      </div>
      <div class="muted note" style="margin-top:8px"></div>`;
    panel.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'save') save();
      else if (a === 'up') goUp();
      else if (a === 'down') goDown();
      else if (a === 'repick') repick();
      else if (a === 'cancel') stop(true);
      else if (a === 'mode') toggleMode();
    });
    const input = panel.querySelector('input.sel');
    input.addEventListener('input', () => { state.selector = input.value.trim(); state.edited = true; updateMatches(); });
    state.root.appendChild(panel);
    renderPanelText();
    refreshPanel();
  }

  function renderPanelText() {
    const m = MODES[state.mode];
    const panel = state.root.querySelector('.panel');
    if (!panel) return;
    panel.querySelector('.title').textContent = m.title;
    panel.querySelector('[data-a=save]').textContent = m.save;
    panel.querySelector('[data-a=mode]').textContent = `⇄ ${m.other}`;
    panel.querySelector('.note').innerHTML = `${m.note} 선택자는 직접 고칠 수 있어요. <kbd>Enter</kbd> 저장 · <kbd>↑</kbd><kbd>↓</kbd> 범위 · <kbd>Tab</kbd> 모드 · <kbd>Esc</kbd> 취소`;
  }

  // 요소가 바뀌면 선택자를 새로 만들고(rebuild=true), 모드만 바뀌면 사용자가 고친 선택자를 유지합니다.
  function refreshPanel(rebuild = true) {
    if (rebuild) { state.selector = buildSelector(state.cur); state.edited = false; }
    const input = state.root.querySelector('.panel input.sel');
    if (input && rebuild) input.value = state.selector;
    updateMatches();
    draw();
  }

  function updateMatches() {
    const panel = state.root.querySelector('.panel');
    const input = panel.querySelector('input.sel');
    const info = panel.querySelector('.info');
    const saveBtn = panel.querySelector('[data-a=save]');
    const n = state.selector ? showMatches(state.selector) : -1;
    const bad = n <= 0;
    input.classList.toggle('bad', bad);
    saveBtn.disabled = bad;
    info.textContent = n < 0 ? '올바른 CSS 선택자가 아니에요' : n === 0 ? '이 페이지에서 해당하는 요소가 없어요' : n === 1 ? '이 페이지에서 1곳이 해당돼요' : `이 페이지에서 ${n}곳이 해당돼요 (점선)`;
  }

  function repick() {
    state.locked = false;
    state.selector = null;
    clearMatches();
    state.root.querySelector('.panel')?.remove();
    if (IS_TOP) addBar();
  }

  function addBar() {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML = `<span>${MODES[state.mode].bar}</span><span class="muted"><kbd>↑</kbd> 상위 · <kbd>Tab</kbd> 모드 · <kbd>Esc</kbd> 취소</span>
      <button data-a="mode">⇄ ${MODES[state.mode].other}</button><button data-a="cancel">취소</button>`;
    bar.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'cancel') stop(true);
      else if (a === 'mode') toggleMode();
    });
    state.root.appendChild(bar);
  }

  function save() {
    if (!state?.selector || count(state.selector) <= 0) return;
    const { selector, host, onSave, mode } = state;
    stop(false);
    onSave?.(host, selector, mode);
  }

  // ---------- 시작/종료 ----------
  const BLOCK = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'contextmenu', 'auxclick'];

  function start({ host, mode = 'hide', onSave, onStop, onModeChange, preselect }) {
    if (state) return;
    const { host: el, root } = makeRoot();
    state = { host, mode, hostEl: el, root, cur: null, history: [], locked: false, onSave, onStop, onModeChange };
    applyModeColors();
    onModeChange?.(mode);
    // 탑 프레임에만 안내 바를 띄우고, iframe(예: 네이버 카페 본문)에서는 그 안에서 바로 고를 수 있게 합니다.
    if (IS_TOP) addBar();
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseover', onMove, true);
    for (const t of BLOCK) document.addEventListener(t, swallow, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll, true);
    if (preselect && preselect.isConnected) {
      state.cur = preselect;
      lock();
    }
  }

  function stop(cancelled) {
    if (!state) return;
    const { hostEl, onStop } = state;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseover', onMove, true);
    for (const t of BLOCK) document.removeEventListener(t, swallow, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll, true);
    hostEl.remove();
    state = null;
    onStop?.(cancelled);
  }

  self.CHH_PICKER = { start, stop: () => stop(true), isActive: () => !!state, buildSelector };
})();
