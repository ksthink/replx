// 댓글 영역 자동 탐지 엔진 (브라우저 안에서만 동작, 외부 전송 없음)
// 후보 요소를 모은 뒤 여러 신호를 점수로 합산해 댓글 영역을 고릅니다.
(() => {
  const KW_RE = /(comment|cmt|repl(?:y|ies|e)|disqus|giscus|utteranc|livere|u_cbox|cbox|fdb_lst|talkback|guestbook|댓글|답글|코멘트)/i;
  const NEG_RE = /(no-?comments?|comments?[-_]?(count|cnt|num|icon|btn|button|link|toggle-btn)|cmt_?(cnt|num)|reply_?(num|cnt|count|btn|button)|replynum|\bnav\b|gnb|lnb|navbar|menu|toolbar|share|related|recommend|banner|\bads?\b|editor-toolbar)/i;
  const LABEL_RE = /^\s*(전체\s*|베스트\s*|최신\s*)?(댓글|코멘트|comments?|replies|답글|responses?|discussion)\s*[\(\[\{]?\s*[\d,]*\s*[\)\]\}]?\s*(개|건)?\s*[:：]?\s*$/i;
  const FORM_RE = /(댓글|답글|코멘트|의견|comment|reply|join the discussion|add a response|leave a response)/i;
  const TIME_RE = /(\b\d{1,2}:\d{2}\b)|(\d{2,4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2})|(\d+\s*(초|분|시간|일|주|개월|달|년)\s*전)|(\d+\s*(sec|second|min|minute|hr|hour|day|week|month|year)s?\s+ago)|(방금|just now|어제|yesterday)/i;
  const ACTION_RE = /^(답글|답글쓰기|답글 달기|대댓글|추천|비추천|비추|신고|좋아요|공감|비공감|reply|like|dislike|report|upvote|downvote)\s*\d*$/i;
  const AUTHOR_RE = /(nick|author|writer|user|member|profile|avatar|name)/i;
  const COMMENT_IFRAME = 'iframe[src*="disqus"],iframe[src*="livere"],iframe[src*="giscus"],iframe[src*="utteranc"],iframe[title*="comment" i],iframe[id*="comment" i]';

  const MAX_SCAN = 6000;
  const MAX_SECTIONS = 5;
  const THRESHOLD = 5;

  function attrString(el) {
    const cls = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
    return `${el.localName} ${el.id} ${cls} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('data-testid') || ''} ${el.getAttribute('name') || ''}`;
  }

  function hasKeyword(el) {
    const a = attrString(el);
    return KW_RE.test(a) && !NEG_RE.test(a);
  }

  function shortText(el) {
    const t = (el.textContent || '').trim();
    return t.length <= 24 ? t : null;
  }

  function signature(el) {
    const cls = [...el.classList].filter((c) => !/\d/.test(c)).sort().join('.');
    return `${el.localName}.${cls}`;
  }

  // 반복되는 형제 요소 중 댓글처럼 생긴 것(시간·작성자·답글/추천 버튼)이 많은 목록을 찾습니다.
  function itemLooksLikeComment(item) {
    const text = (item.textContent || '').trim();
    if (text.length < 4 || text.length > 4000) return false;
    let signals = 0;
    if (TIME_RE.test(text)) signals++;
    let author = false;
    let action = false;
    const nodes = item.querySelectorAll('*');
    const lim = Math.min(nodes.length, 80);
    for (let i = 0; i < lim; i++) {
      const n = nodes[i];
      if (!author && (AUTHOR_RE.test(attrString(n)) || (n.localName === 'img' && (n.width || 0) > 0 && n.width <= 64))) author = true;
      if (!action && n.childElementCount === 0) {
        const t = shortText(n);
        if (t && ACTION_RE.test(t)) action = true;
      }
      if (author && action) break;
    }
    if (author) signals++;
    if (action) signals++;
    return signals >= 2;
  }

  function findRepeatedList(root) {
    let best = null;
    const queue = [[root, 0]];
    let visited = 0;
    while (queue.length && visited < 250) {
      const [node, depth] = queue.shift();
      visited++;
      const kids = node.children;
      if (kids.length >= 3) {
        const counts = new Map();
        for (const k of kids) counts.set(signature(k), (counts.get(signature(k)) || 0) + 1);
        let topSig = null;
        let top = 0;
        for (const [s, c] of counts) if (c > top) { top = c; topSig = s; }
        if (top >= 3 && top / kids.length >= 0.5) {
          const items = [...kids].filter((k) => signature(k) === topSig).slice(0, 15);
          const ok = items.filter(itemLooksLikeComment).length;
          if (ok / items.length >= 0.5 && (!best || ok > best.n)) best = { list: node, n: ok };
        }
      }
      if (depth < 4) for (const k of kids) queue.push([k, depth + 1]);
    }
    return best;
  }

  function hasLabel(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);
    let n = walker.currentNode;
    for (let i = 0; i < 60 && n; i++, n = walker.nextNode()) {
      if (n.childElementCount <= 2) {
        const t = shortText(n);
        if (t && LABEL_RE.test(t)) return true;
      }
    }
    return false;
  }

  function hasCommentForm(el) {
    const fields = el.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""], input[type="text"]');
    let anyTextarea = false;
    for (let i = 0; i < Math.min(fields.length, 6); i++) {
      const f = fields[i];
      if (f.localName === 'textarea') anyTextarea = true;
      const hint = `${f.getAttribute('placeholder') || ''} ${f.getAttribute('aria-label') || ''} ${f.getAttribute('name') || ''} ${f.id} ${f.getAttribute('title') || ''}`;
      if (FORM_RE.test(hint)) return 3;
    }
    return anyTextarea ? 1 : 0;
  }

  function score(el, ctx) {
    if (el.closest('pre, code')) return { s: -99 };
    const why = [];
    let s = 0;
    const kw = hasKeyword(el);
    if (kw) { s += 3; why.push('kw'); }
    if (ctx.catchall && safeMatches(el, ctx.catchall)) { s += 1; why.push('catchall'); }
    if (hasLabel(el)) { s += 3; why.push('label'); }
    const form = hasCommentForm(el);
    if (form) { s += form; why.push('form'); }
    const rep = findRepeatedList(el);
    if (rep) { s += rep.n >= 5 ? 5 : 4; why.push(`list${rep.n}`); }
    if (el.querySelector(COMMENT_IFRAME) || (el.matches && el.matches(COMMENT_IFRAME))) { s += 4; why.push('iframe'); }

    if (el.querySelector('h1')) { s -= 6; why.push('-h1'); }
    if (/^(nav|header)$/.test(el.localName) || el.getAttribute('role') === 'navigation') { s -= 5; why.push('-nav'); }
    const len = (el.textContent || '').length;
    if (ctx.bodyLen > 2000 && len > ctx.bodyLen * 0.85) { s -= 6; why.push('-huge'); }
    if (el.getBoundingClientRect().height < 20 && !el.querySelector(COMMENT_IFRAME)) { s -= 3; why.push('-tiny'); }
    return { s, why, len, kw };
  }

  function safeMatches(el, sel) {
    try { return el.matches(sel); } catch { return false; }
  }

  function addWithAncestors(set, el, up) {
    let cur = el;
    for (let i = 0; i <= up && cur && cur !== document.body && cur !== document.documentElement; i++) {
      set.add(cur);
      cur = cur.parentElement;
    }
  }

  /**
   * @param {Object} opts
   * @param {(el: Element) => boolean} opts.skip  - 이미 처리됐거나 사용자가 "댓글 아님"으로 지정한 요소
   * @param {string} [opts.catchall]               - 업스트림 범용 셀렉터(약한 신호)
   * @returns {{el: Element, score: number, why: string[]}[]}
   */
  function detect(opts = {}) {
    const body = document.body;
    if (!body) return [];
    const ctx = { bodyLen: (body.textContent || '').length, catchall: opts.catchall };
    const cands = new Set();

    const all = body.getElementsByTagName('*');
    const lim = Math.min(all.length, MAX_SCAN);
    for (let i = 0; i < lim; i++) {
      const el = all[i];
      if (el.closest('chh-ph, chh-picker')) continue;
      if (hasKeyword(el) && !(el.parentElement && hasKeyword(el.parentElement))) addWithAncestors(cands, el, 2);
      else if (el.localName === 'textarea') addWithAncestors(cands, el.parentElement, 6);
      else if (el.childElementCount <= 2) {
        const t = shortText(el);
        if (t && LABEL_RE.test(t) && el.parentElement) addWithAncestors(cands, el.parentElement, 4);
      }
    }
    body.querySelectorAll(COMMENT_IFRAME).forEach((f) => addWithAncestors(cands, f.parentElement, 3));

    const passing = [];
    for (const el of cands) {
      if (!el.isConnected || (opts.skip && opts.skip(el))) continue;
      const r = score(el, ctx);
      if (r.s >= THRESHOLD) passing.push({ el, score: r.s, why: r.why, len: r.len, kw: r.kw });
    }

    // 바깥쪽 요소를 우선하되, 본문까지 삼킬 만큼 넓은 요소는 버립니다.
    // - 안쪽에 "댓글" 이름표가 붙은 후보가 있는데 바깥쪽엔 없으면 안쪽을 고릅니다.
    // - 바깥쪽이 안쪽보다 텍스트가 꽤 많으면(본문 포함 가능성) 안쪽을 고릅니다.
    const depth = (el) => { let d = 0; for (let c = el; c; c = c.parentElement) d++; return d; };
    passing.sort((a, b) => depth(a.el) - depth(b.el));
    const chosen = [];
    for (const p of passing) {
      if (chosen.some((c) => c.el.contains(p.el))) continue;
      const inner = passing.filter((q) => q !== p && p.el.contains(q.el));
      const tooBroad = inner.some((q) => (q.kw && !p.kw) || p.len - q.len > q.len * 0.5 + 150);
      if (tooBroad) continue;
      chosen.push(p);
      if (chosen.length >= MAX_SECTIONS) break;
    }
    return chosen;
  }

  self.CHH_DETECTOR = { detect, _score: score };
})();
