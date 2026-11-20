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
  function qsa(sel) {
    try { return [...document.querySelectorAll(sel)]; } catch { return []; }
  }

  const isActive = () => settings.enabled && !showAll && !matchHost(settings.disabledSites) && !matchHost(settings.excludedSites);

  // ---------- CSS ----------
  function buildCss() {
    if (!isActive()) return '';
    const guard = ':not([data-chh-show]):not(pre *):not(code *):not(textarea)';
    const hideSel = [siteSelectors(), ...userSelectors()].filter(Boolean).join(', ');
    let css = '';
    // :is()는 잘못된 선택자가 섞여도 나머지를 살려 둡니다.
    if (hideSel) css += `:is(${hideSel})${guard}{display:none!important}\n`;
    css += `[data-chh]${guard}{display:none!important}\n`;
    if (settings.hideCounts) css += `:is(${countSelectors()}):not(textarea){display:none!important}\n`;
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
    return allows.some((s) => { try { return el.matches(s) || !!el.closest(s); } catch { return false; } });
  }

  function userIsTypingIn(el) {
    const a = document.activeElement;
    return a && a !== document.body && el.contains(a) && (a.isContentEditable || /^(textarea|input)$/.test(a.localName)) && (a.value || a.textContent || '').length > 0;
  }

  function mark(el, kind) {
    if (el.hasAttribute('data-chh') || el.closest('[data-chh]')) return false;
    if (isAllowed(el) || userIsTypingIn(el)) return false;
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
    const data = await chrome.storage.sync.get({ userAllow: {} });
    const list = new Set(data.userAllow[HOST] || []);
    list.add(sel);
    data.userAllow[HOST] = [...list];
    await chrome.storage.sync.set({ userAllow: data.userAllow });
    placeholderFor(el)?.remove();
    el.removeAttribute('data-chh');
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
  function startPicker(preselect) {
    self.CHH_PICKER.start({
      host: HOST,
      preselect,
      onSave: async (host, selector) => {
        const data = await chrome.storage.sync.get({ userRules: {} });
        const list = new Set(data.userRules[host] || []);
        list.add(selector);
        data.userRules[host] = [...list];
        await chrome.storage.sync.set({ userRules: data.userRules });
        chrome.runtime.sendMessage({ type: 'pickerDone' }).catch(() => {});
      },
      onStop: (cancelled) => { if (cancelled) chrome.runtime.sendMessage({ type: 'pickerDone' }).catch(() => {}); },
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
        startPicker(null);
        return;
      case 'pickContextTarget':
        if (lastContextTarget && document.contains(lastContextTarget)) startPicker(lastContextTarget);
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
        for (const n of m.addedNodes) if (n.nodeType === 1 && n.localName !== 'chh-ph' && n.localName !== 'chh-picker') { schedule(); return; }
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
