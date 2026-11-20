const DEFAULTS = self.CHH_DEFAULTS;
const $ = (id) => document.getElementById(id);

const mapToText = (map) => Object.entries(map).flatMap(([h, sels]) => sels.map((s) => `${h} | ${s}`)).join('\n');
const listToText = (list) => list.join('\n');

function textToMap(text, label) {
  const map = {};
  text.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const idx = line.indexOf('|');
    if (idx < 0) throw new Error(`${label} ${i + 1}번째 줄: "사이트 | 선택자" 형식이 아니에요`);
    const host = line.slice(0, idx).trim().toLowerCase();
    const sel = line.slice(idx + 1).trim();
    try { document.createDocumentFragment().querySelector(sel); } catch { throw new Error(`${label} ${i + 1}번째 줄: 올바르지 않은 선택자예요 (${sel})`); }
    (map[host] ||= []).push(sel);
  });
  return map;
}
const textToList = (text) => text.split('\n').map((l) => l.trim().toLowerCase()).filter(Boolean);

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
    const data = JSON.parse(await e.target.files[0].text());
    const patch = {};
    for (const k of Object.keys(DEFAULTS)) if (k in data) patch[k] = data[k];
    await chrome.storage.sync.set(patch);
    await load();
    msg('가져왔어요');
  } catch { msg('가져오기에 실패했어요. JSON 파일을 확인해 주세요.', true); }
};

load();
