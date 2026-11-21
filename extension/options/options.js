const DEFAULTS = self.CHH_DEFAULTS;
const $ = (id) => document.getElementById(id);

const MAX_RULES_PER_HOST = 50;
const MAX_SELECTOR_LEN = 500;
const VALID_MODES = new Set(['hide', 'collapse']);

const isValidSelector = (sel) => {
  if (typeof sel !== 'string' || !sel.trim() || sel.length > MAX_SELECTOR_LEN) return false;
  try { document.createDocumentFragment().querySelector(sel); return true; } catch { return false; }
};

const mapToText = (map) => Object.entries(map || {}).flatMap(([h, sels]) => (Array.isArray(sels) ? sels : []).map((s) => `${h} | ${s}`)).join('\n');
const listToText = (list) => (Array.isArray(list) ? list : []).join('\n');

function textToMap(text, label) {
  const map = {};
  text.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const idx = line.indexOf('|');
    if (idx < 0) throw new Error(`${label} ${i + 1}번째 줄: "사이트 | 선택자" 형식이 아니에요`);
    const host = line.slice(0, idx).trim().toLowerCase();
    const sel = line.slice(idx + 1).trim();
    if (!host) throw new Error(`${label} ${i + 1}번째 줄: 사이트 주소가 비어 있어요`);
    if (!isValidSelector(sel)) throw new Error(`${label} ${i + 1}번째 줄: 올바르지 않거나 너무 긴 선택자예요 (${sel})`);
    const list = (map[host] ||= []);
    if (list.length >= MAX_RULES_PER_HOST) throw new Error(`${label} (${host}): 사이트당 최대 ${MAX_RULES_PER_HOST}개까지만 저장할 수 있어요`);
    if (!list.includes(sel)) list.push(sel);
  });
  return map;
}
const textToList = (text) => text.split('\n').map((l) => l.trim().toLowerCase()).filter(Boolean);

function sanitizeRuleMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('규칙 형식이 올바르지 않아요.');
  const clean = {};
  for (const [host, sels] of Object.entries(raw)) {
    const h = String(host).trim().toLowerCase();
    if (!h || !Array.isArray(sels)) throw new Error(`잘못된 호스트 규칙: ${host}`);
    const valid = [...new Set(sels.filter((s) => isValidSelector(s)))].slice(0, MAX_RULES_PER_HOST);
    if (valid.length) clean[h] = valid;
  }
  return clean;
}

function sanitizeSiteList(raw) {
  if (!Array.isArray(raw)) throw new Error('사이트 목록 형식이 올바르지 않아요.');
  return [...new Set(raw.filter((s) => typeof s === 'string').map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

function validateImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON 객체 형식이 아니에요.');
  const patch = {};
  if ('enabled' in data) {
    if (typeof data.enabled !== 'boolean') throw new Error('enabled 값이 잘못되었어요.');
    patch.enabled = data.enabled;
  }
  if ('mode' in data) {
    if (!VALID_MODES.has(data.mode)) throw new Error('mode 값이 잘못되었어요.');
    patch.mode = data.mode;
  }
  if ('autoDetect' in data) {
    if (typeof data.autoDetect !== 'boolean') throw new Error('autoDetect 값이 잘못되었어요.');
    patch.autoDetect = data.autoDetect;
  }
  if ('hideCounts' in data) {
    if (typeof data.hideCounts !== 'boolean') throw new Error('hideCounts 값이 잘못되었어요.');
    patch.hideCounts = data.hideCounts;
  }
  if ('disabledSites' in data) patch.disabledSites = sanitizeSiteList(data.disabledSites);
  if ('excludedSites' in data) patch.excludedSites = sanitizeSiteList(data.excludedSites);
  if ('userRules' in data) patch.userRules = sanitizeRuleMap(data.userRules);
  if ('userAllow' in data) patch.userAllow = sanitizeRuleMap(data.userAllow);
  return patch;
}

function msg(text, err = false) {
  $('msg').textContent = text;
  $('msg').className = err ? 'err' : '';
  if (!err) setTimeout(() => ($('msg').textContent = ''), 2500);
}

async function load() {
  const s = await chrome.storage.sync.get(DEFAULTS);
  $('userRules').value = mapToText(s.userRules);
  $('userAllow').value = mapToText(s.userAllow);
  $('excludedSites').value = listToText(s.excludedSites);
  $('disabledSites').value = listToText(s.disabledSites);
}

$('save').onclick = async () => {
  try {
    await chrome.storage.sync.set({
      userRules: textToMap($('userRules').value, '숨김 규칙'),
      userAllow: textToMap($('userAllow').value, '제외 규칙'),
      excludedSites: textToList($('excludedSites').value),
      disabledSites: textToList($('disabledSites').value),
    });
    msg('저장했어요');
  } catch (e) { msg(e.message, true); }
};

$('export').onclick = async () => {
  const s = await chrome.storage.sync.get(DEFAULTS);
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'comment-hider-settings.json';
  a.click();
};

$('import').onclick = () => $('file').click();
$('file').onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    const patch = validateImport(data);
    await chrome.storage.sync.set(patch);
    await load();
    msg('가져왔어요');
  } catch (err) {
    msg(err?.message || '가져오기에 실패했어요. JSON 파일을 확인해 주세요.', true);
  } finally {
    e.target.value = '';
  }
};

load();
