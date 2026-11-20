const DEFAULTS = self.CHH_DEFAULTS;
const $ = (id) => document.getElementById(id);

let tab = null;
let host = '';
let settings = { ...DEFAULTS };

function suffixes(h) {
  const p = h.split('.');
  return (p.length > 1 ? p.slice(0, -1) : p).map((_, i) => p.slice(i).join('.'));
}

async function save(patch) {
  Object.assign(settings, patch);
  await chrome.storage.sync.set(patch);
}

function send(msg, opts) {
  return chrome.tabs.sendMessage(tab.id, msg, opts).catch(() => null);
}

function renderList(ul, box, map, key) {
  ul.innerHTML = '';
  const entries = suffixes(host).flatMap((h) => (map[h] || []).map((sel) => ({ h, sel })));
  box.hidden = entries.length === 0;
  for (const { h, sel } of entries) {
    const li = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = h === host ? sel : `${sel}  (${h})`;
    const see = document.createElement('button');
    see.textContent = '👁';
    see.className = 'see';
    see.title = '페이지에서 위치 보기';
    see.onclick = async () => {
      const r = await send({ type: 'flash', selector: sel, mode: key === 'userAllow' ? 'allow' : 'hide' }, { frameId: 0 });
      see.title = r?.n ? `이 페이지에서 ${r.n}곳` : '이 페이지에는 해당하는 곳이 없어요';
      if (!r?.n) { see.textContent = '∅'; setTimeout(() => (see.textContent = '👁'), 1200); }
    };
    const del = document.createElement('button');
    del.textContent = '✕';
    del.title = '삭제';
    del.onclick = async () => {
      const next = { ...settings[key] };
      next[h] = (next[h] || []).filter((s) => s !== sel);
      if (!next[h].length) delete next[h];
      await save({ [key]: next });
      render();
    };
    li.append(code, see, del);
    ul.append(li);
  }
}

async function render() {
  $('enabled').checked = settings.enabled;
  $('mode').value = settings.mode;
  $('autoDetect').checked = settings.autoDetect;
  $('hideCounts').checked = settings.hideCounts;

  const supported = /^https?:/.test(tab?.url || '');
  const excluded = supported && suffixes(host).some((h) => settings.excludedSites.includes(h));
  $('host').textContent = supported ? host : '이 페이지에서는 동작하지 않아요';
  $('siteOn').checked = supported && !settings.disabledSites.includes(host) && !excluded;
  $('siteOn').disabled = !supported || excluded;
  $('pick').disabled = !supported || !settings.enabled;
  $('pickAllow').disabled = !supported || !settings.enabled;
  $('peek').disabled = !supported;

  renderList($('rules'), $('rulesBox'), settings.userRules, 'userRules');
  renderList($('allows'), $('allowBox'), settings.userAllow, 'userAllow');

  if (!supported) { $('status').textContent = ''; return; }
  const state = await send({ type: 'getState' }, { frameId: 0 });
  const { total } = await chrome.runtime.sendMessage({ type: 'getCount', tabId: tab.id });
  if (!state) {
    $('status').textContent = '페이지를 새로고침하면 적용돼요.';
    return;
  }
  $('peek').textContent = state.showAll ? '다시 숨기기' : '잠깐 보기';
  if (excluded) $('status').textContent = '제외 사이트예요 (전체 설정에서 바꿀 수 있어요)';
  else if (!state.active && !state.showAll) $('status').textContent = '꺼져 있어요';
  else if (state.showAll) $('status').textContent = '잠깐 보는 중이에요';
  else if (!total) $('status').textContent = '숨긴 댓글 영역이 없어요';
  else {
    const c = state.counts;
    const parts = [];
    if (c.rule) parts.push(`기본 규칙 ${c.rule}`);
    if (c.auto) parts.push(`자동 탐지 ${c.auto}`);
    if (c.user) parts.push(`직접 지정 ${c.user}`);
    const frames = total - (c.rule + c.auto + c.user);
    if (frames > 0) parts.push(`내부 프레임 ${frames}`);
    $('status').textContent = `댓글 영역 ${total}곳을 숨겼어요 · ${parts.join(' · ')}`;
  }
}

async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { host = new URL(tab.url).hostname; } catch { host = ''; }
  if (!host) {
    // URL을 못 받으면 페이지 안의 스크립트에게 물어봅니다.
    const st = await chrome.tabs.sendMessage(tab.id, { type: 'getState' }, { frameId: 0 }).catch(() => null);
    if (st?.host) { host = st.host; tab = { ...tab, url: `https://${host}/` }; }
  }
  settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };

  $('enabled').onchange = (e) => save({ enabled: e.target.checked }).then(render);
  $('mode').onchange = (e) => save({ mode: e.target.value });
  $('autoDetect').onchange = (e) => save({ autoDetect: e.target.checked }).then(render);
  $('hideCounts').onchange = (e) => save({ hideCounts: e.target.checked });
  $('siteOn').onchange = async (e) => {
    const set = new Set(settings.disabledSites);
    e.target.checked ? set.delete(host) : set.add(host);
    await save({ disabledSites: [...set] });
    render();
  };
  $('peek').onclick = async () => { await send({ type: 'toggleShow' }); setTimeout(render, 100); };
  $('pick').onclick = async () => { await send({ type: 'startPicker', mode: 'hide' }); window.close(); };
  $('pickAllow').onclick = async () => { await send({ type: 'startPicker', mode: 'allow' }); window.close(); };
  $('openOptions').onclick = (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); };

  render();
}

init();
