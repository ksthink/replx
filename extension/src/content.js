// 페이지마다 실행되는 메인 스크립트: 규칙 CSS 주입 → 규칙/직접지정 요소 표시 → 자동 탐지 → 접기 표시
(() => {
  if (window.__CHH_LOADED__) return;
  window.__CHH_LOADED__ = true;

  const RULES = self.CHH_RULES;
  const HOST = location.hostname;
  const IS_TOP = window === window.top;
  const COUNT_GENERIC = '[class*="reply_num"],[class*="replyNum"],[class*="reply_cnt"],[class*="replyCnt"],[class*="cmt_cnt"],[class*="cmt_num"],[class*="cmtNum"],[class*="comment_count"],[class*="commentCount"],[class*="comment-count"],[class*="comments-count"],[class*="CommentCount"]';

  const DEFAULTS = self.CHH_DEFAULTS;

  let settings = { ...DEFAULTS };
  let showAll = false; // "잠깐 보기"
  let revealing = false; // 제외 영역 고르는 중: 숨긴 곳을 점선으로 드러냄
  let style = null;
  let lastContextTarget = null;

  // ---------- 유틸 ----------
  function hostSuffixes(h) {
    const parts = h.split('.');
    const out = [];
    for (let i = 0; i < Math.max(1, parts.length - 1); i++) out.push(parts.slice(i).join('.'));
    return out;
  }
  const SUFFIXES = hostSuffixes(HOST);
  const matchHost = (list) => list.some((h) => SUFFIXES.includes(h));

  function siteSelectors() {
    return SUFFIXES.map((s) => RULES.sites[s]).filter(Boolean).join(', ');
  }
  function countSelectors() {
    return [COUNT_GENERIC, ...SUFFIXES.map((s) => RULES.countSelectors[s]).filter(Boolean)].join(', ');
  }
  function userSelectors() {
    return SUFFIXES.flatMap((s) => settings.userRules[s] || []);
  }
  function allowSelectors() {
    return SUFFIXES.flatMap((s) => settings.userAllow[s] || []);
  }
  function splitSelectors(str) {
    // 쉼표로 나누되 괄호 안의 쉼표는 유지
    const out = [];
    let depth = 0, buf = '';
    for (const ch of str) {
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth--;
      if (ch === ',' && depth === 0) { if (buf.trim()) out.push(buf.trim()); buf = ''; } else buf += ch;
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }
  // 선택자 하나하나를 검사해 잘못된 것은 버립니다(:has() 안에 잘못된 선택자가 들어가면 규칙 전체가 무시되기 때문).
  const validSel = (s) => { try { document.createDocumentFragment().querySelector(s); return true; } catch { return false; } };

  function qsa(sel) {
    try { return [...document.querySelectorAll(sel)]; } catch { return []; }
  }

  const isActive = () => settings.enabled && !showAll && !matchHost(settings.disabledSites) && !matchHost(settings.excludedSites);

  // ---------- CSS ----------
  function allowGuard() {
    const a = allowSelectors().filter(validSel).join(', ');
    // 제외 영역 자신, 그 안쪽, 그것을 품은 바깥쪽 모두 숨기지 않습니다.
    return a ? `:not(:is(${a})):not(:is(${a}) *):not(:has(${a}))` : '';
  }

  function buildCss() {
    if (!isActive()) return '';
    // 기사 제목(h1)이나 본문을 품은 요소는 규칙에 걸려도 숨기지 않습니다(규칙이 너무 넓게 잡힌 경우의 안전장치).
    const guard = `:not([data-chh-show]):not(pre *):not(code *):not(textarea):not(:has(h1, ${self.CHH_DETECTOR.ARTICLE_SEL}))${allowGuard()}`;
    const hideSel = [siteSelectors(), ...userSelectors().filter(validSel)].filter(Boolean).join(', ');
    // 제외 영역을 고르는 동안에는 숨긴 곳을 지우지 않고 빨간 점선으로 보여 줍니다.
    const decl = revealing
      ? '{outline:2px dashed #e03a26!important;outline-offset:-2px!important;background-color:rgba(224,58,38,.05)!important}'
      : '{display:none!important}';
    let css = '';
    // :is()는 잘못된 선택자가 섞여도 나머지를 살려 둡니다.
    if (hideSel) css += `:is(${hideSel})${guard}${decl}\n`;
    css += `[data-chh]${guard}${decl}\n`;
    if (settings.hideCounts) css += `:is(${countSelectors()}):not(textarea)${allowGuard()}${decl}\n`;
    if (revealing) css += 'chh-ph{display:none!important}\n';
    return css;
  }

  function applyCss() {
    if (!style) {
      style = document.createElement('style');
      style.id = 'chh-style';
      (document.head || document.documentElement).appendChild(style);
    }
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
    style.textContent = buildCss();
  }

  // ---------- 표시/접기 ----------
  function isAllowed(el) {
    const allows = allowSelectors();
    return allows.some((s) => { try { return el.matches(s) || !!el.closest(s) || !!el.querySelector(s); } catch { return false; } });
  }

  function userIsTypingIn(el) {
    const a = document.activeElement;
    return a && a !== document.body && el.contains(a) && (a.isContentEditable || /^(textarea|input)$/.test(a.localName)) && (a.value || a.textContent || '').length > 0;
  }

  function mark(el, kind) {
    if (el.hasAttribute('data-chh') || el.closest('[data-chh]')) return false;
    if (isAllowed(el) || userIsTypingIn(el)) return false;
    if (el.querySelector(`h1, ${self.CHH_DETECTOR.ARTICLE_SEL}`)) return false; // 본문을 품은 요소는 숨기지 않음
    el.setAttribute('data-chh', kind);
    return true;
  }

  function placeholderFor(el) {
    const prev = el.previousElementSibling;
    return prev && prev.localName === 'chh-ph' ? prev : null;
  }

  function addPlaceholder(el) {
    if (placeholderFor(el) || !el.parentNode) return;
    const kind = el.getAttribute('data-chh') || 'rule';
    const ph = document.createElement('chh-ph');
    const root = ph.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host{all:initial;display:block;margin:8px 0}
      .w{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 12px;border:1px dashed #bbb;border-radius:8px;
        font:13px/1.4 -apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#666;background:rgba(127,127,127,.06)}
      button{all:unset;cursor:pointer;padding:3px 8px;border-radius:5px;background:rgba(127,127,127,.15);color:#333;font-size:12px}
      button:hover{background:rgba(127,127,127,.28)}
      .s{margin-left:auto;font-size:11px;color:#999}
    </style>
    <div class="w"><span>💬 댓글이 숨겨져 있어요</span><button data-a="show">보기</button>
    ${kind === 'auto' ? '<button data-a="notc">여기는 댓글 아님</button><span class="s">자동 감지</span>' : ''}</div>`;
    root.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'show') {
        if (el.hasAttribute('data-chh-show')) { el.removeAttribute('data-chh-show'); e.target.textContent = '보기'; }
        else { el.setAttribute('data-chh-show', ''); e.target.textContent = '다시 숨기기'; }
      } else if (a === 'notc') {
        markNotComment(el);
      }
    });
    el.parentNode.insertBefore(ph, el);
  }

  function clearMarks() {
    document.querySelectorAll('chh-ph').forEach((p) => p.remove());
    document.querySelectorAll('[data-chh]').forEach((el) => { el.removeAttribute('data-chh'); el.removeAttribute('data-chh-show'); });
  }

  async function markNotComment(el) {
    const sel = self.CHH_PICKER.buildSelector(el);
    placeholderFor(el)?.remove();
    el.removeAttribute('data-chh');
    await addRule('allow', HOST, sel);
  }

  // ---------- 규칙 저장/되돌리기 ----------
  const KEY = { hide: 'userRules', allow: 'userAllow' };

  async function addRule(mode, host, selector) {
    const key = KEY[mode];
    const data = await chrome.storage.sync.get({ [key]: {} });
    const list = new Set(data[key][host] || []);
    list.add(selector);
    data[key][host] = [...list];
    await chrome.storage.sync.set({ [key]: data[key] });
    toast(mode === 'hide' ? '숨김 규칙을 저장했어요' : '제외 규칙을 저장했어요', selector, () => removeRule(mode, host, selector));
  }

  async function removeRule(mode, host, selector) {
    const key = KEY[mode];
    const data = await chrome.storage.sync.get({ [key]: {} });
    data[key][host] = (data[key][host] || []).filter((s) => s !== selector);
    if (!data[key][host].length) delete data[key][host];
    await chrome.storage.sync.set({ [key]: data[key] });
  }

  function toast(text, selector, undo) {
    document.querySelectorAll('chh-toast').forEach((t) => t.remove());
    const host = document.createElement('chh-toast');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host{all:initial}
      .t{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483647;display:flex;gap:10px;align-items:center;
        background:#1f1f1f;color:#fff;padding:9px 12px 9px 14px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.3);
        font:13px/1.4 -apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;max-width:90vw}
      code{font:11.5px ui-monospace,Menlo,Consolas,monospace;color:#ffd591;max-width:40vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      button{all:unset;cursor:pointer;padding:4px 9px;border-radius:6px;background:#3a3a3a;font-size:12px}
      button:hover{background:#4a4a4a}
    </style><div class="t"><span></span><code></code><button>되돌리기</button></div>`;
    root.querySelector('span').textContent = text;
    root.querySelector('code').textContent = selector;
    root.querySelector('button').addEventListener('click', () => { undo(); host.remove(); });
    document.documentElement.appendChild(host);
    setTimeout(() => host.remove(), 7000);
  }

  // 팝업의 규칙 목록에서 👁를 누르면 그 규칙에 해당하는 곳을 잠깐 드러내 깜빡여 보여 줍니다.
  function flash(selector, mode) {
    const els = qsa(selector);
    const color = mode === 'allow' ? '#16a34a' : '#e03a26';
    els.forEach((el) => {
      el.setAttribute('data-chh-show', '');
      el.style.setProperty('outline', `3px solid ${color}`, 'important');
      el.style.setProperty('outline-offset', '-3px', 'important');
    });
    if (els[0] && IS_TOP) els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => els.forEach((el) => {
      el.removeAttribute('data-chh-show');
      el.style.removeProperty('outline');
      el.style.removeProperty('outline-offset');
    }), 2500);
    return els.length;
  }

  // ---------- 스캔 ----------
  const counts = { rule: 0, user: 0, auto: 0 };

  function scan() {
    if (!document.body) return;
    if (!isActive()) { report(); return; }
    applyCss();

    let ruleHits = 0;
    for (const s of splitSelectors(siteSelectors())) for (const el of qsa(s)) { if (mark(el, 'rule')) counts.rule++; ruleHits++; }
    let userHits = 0;
    for (const s of userSelectors()) for (const el of qsa(s)) { if (mark(el, 'user')) counts.user++; userHits++; }

    // 알려진 규칙이 이미 잡았다면 자동 탐지는 건너뜁니다(오탐 방지).
    if (settings.autoDetect && ruleHits === 0 && userHits === 0 && self.CHH_DETECTOR) {
      const found = self.CHH_DETECTOR.detect({
        catchall: RULES.catchallSelectors,
        skip: (el) => el.closest('[data-chh]') || isAllowed(el),
      });
      for (const f of found) if (mark(f.el, 'auto')) counts.auto++;
    }

    if (settings.mode === 'collapse') document.querySelectorAll('[data-chh]').forEach(addPlaceholder);
    report();
  }

  let timer = null;
  let lastRun = 0;
  function schedule() {
    if (timer) return;
    const wait = Math.max(250, 900 - (Date.now() - lastRun));
    timer = setTimeout(() => {
      timer = null;
      lastRun = Date.now();
      if (document.visibilityState === 'hidden') { document.addEventListener('visibilitychange', schedule, { once: true }); return; }
      scan();
    }, wait);
  }

  function report() {
    const total = document.querySelectorAll('[data-chh]').length;
    chrome.runtime.sendMessage({ type: 'count', count: isActive() ? total : 0 }).catch(() => {});
  }

  function rescanFromScratch() {
    clearMarks();
    counts.rule = counts.user = counts.auto = 0;
    applyCss();
    scan();
  }

  // ---------- 피커 연결 ----------
  function setReveal(on) {
    if (revealing === on) return;
    revealing = on;
    applyCss();
  }

  function startPicker(mode, preselect) {
    self.CHH_PICKER.start({
      host: HOST,
      mode,
      preselect,
      onModeChange: (m) => setReveal(m === 'allow'),
      onSave: async (host, selector, m) => {
        setReveal(false);
        await addRule(m, host, selector);
        chrome.runtime.sendMessage({ type: 'pickerDone' }).catch(() => {});
      },
      onStop: (cancelled) => {
        setReveal(false);
        if (cancelled) chrome.runtime.sendMessage({ type: 'pickerDone' }).catch(() => {});
      },
    });
  }

  document.addEventListener('contextmenu', (e) => { lastContextTarget = e.target; }, true);

  // ---------- 메시지 ----------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg.type) {
      case 'getState':
        if (!IS_TOP) return;
        sendResponse({
          host: HOST,
          active: isActive(),
          showAll,
          excluded: matchHost(settings.excludedSites),
          counts: {
            rule: document.querySelectorAll('[data-chh="rule"]').length,
            user: document.querySelectorAll('[data-chh="user"]').length,
            auto: document.querySelectorAll('[data-chh="auto"]').length,
          },
        });
        return;
      case 'toggleShow':
        showAll = msg.value ?? !showAll;
        applyCss();
        if (showAll) document.querySelectorAll('chh-ph').forEach((p) => (p.style.display = 'none'));
        else { document.querySelectorAll('chh-ph').forEach((p) => (p.style.display = '')); scan(); }
        report();
        sendResponse?.({ showAll });
        return;
      case 'startPicker':
        startPicker(msg.mode || 'hide', null);
        return;
      case 'pickContextTarget':
        if (lastContextTarget && document.contains(lastContextTarget)) startPicker('hide', lastContextTarget);
        return;
      case 'flash':
        sendResponse?.({ n: flash(msg.selector, msg.mode) });
        return;
      case 'stopPicker':
        if (self.CHH_PICKER.isActive()) self.CHH_PICKER.stop();
        return;
      case 'rescan':
        rescanFromScratch();
        return;
      default:
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const k of Object.keys(changes)) if (k in DEFAULTS) settings[k] = changes[k].newValue ?? DEFAULTS[k];
    rescanFromScratch();
  });

  // ---------- 시작 ----------
  // 설정을 읽기 전에도 기본값(켜짐)으로 규칙 CSS를 먼저 넣어 깜빡임을 막습니다.
  applyCss();
  chrome.storage.sync.get(DEFAULTS).then((s) => {
    settings = { ...DEFAULTS, ...s };
    applyCss();
    if (document.body) schedule();
  });

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.addedNodes.length) {
        for (const n of m.addedNodes) if (n.nodeType === 1 && !/^chh-(ph|picker|toast)$/.test(n.localName)) { schedule(); return; }
      }
    }
  });
  const startObserving = () => { mo.observe(document.documentElement, { childList: true, subtree: true }); schedule(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserving, { once: true });
  else startObserving();

  // SPA 내비게이션(유튜브 등) 대응
  window.addEventListener('yt-navigate-finish', () => rescanFromScratch());
  window.addEventListener('popstate', () => schedule());
})();
