const $ = (id) => document.getElementById(id);

const STORE = self.CHH_STORE;
const { MAX_RULES_PER_HOST, isValidSelector, normalizeHost } = STORE;

let settings = { userRules: {}, userAllow: {} };

function showMsg(text, err = false) {
  const el = $('msg');
  el.textContent = text;
  el.className = err ? 'err' : '';
  if (!err) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 3000);
}

function flattenMap(map) {
  const rows = [];
  for (const [site, sels] of Object.entries(map || {})) {
    if (!Array.isArray(sels)) continue;
    for (const sel of sels) rows.push({ site, sel });
  }
  rows.sort((a, b) => a.site.localeCompare(b.site) || a.sel.localeCompare(b.sel));
  return rows;
}

function renderTable(tbody, emptyEl, countEl, map, key) {
  tbody.innerHTML = '';
  const rows = flattenMap(map);
  countEl.textContent = `(${rows.length})`;
  emptyEl.hidden = rows.length > 0;

  for (const { site, sel } of rows) {
    const tr = document.createElement('tr');

    const tdSite = document.createElement('td');
    tdSite.className = 'site';
    tdSite.textContent = site;

    const tdSel = document.createElement('td');
    tdSel.className = 'sel';
    const code = document.createElement('code');
    code.textContent = sel;
    tdSel.appendChild(code);

    const tdAct = document.createElement('td');
    tdAct.className = 'act';
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.title = '삭제';
    del.onclick = async () => {
      try {
        await STORE.removeRule(key, site, sel);
        await load();
      } catch (err) {
        showMsg(`삭제하지 못했어요: ${err.message}`, true);
      }
    };
    tdAct.appendChild(del);

    tr.append(tdSite, tdSel, tdAct);
    tbody.appendChild(tr);
  }
  return rows.length;
}

function render() {
  const b = renderTable($('blockBody'), $('blockEmpty'), $('blockCount'), settings.userRules, 'userRules');
  const a = renderTable($('allowBody'), $('allowEmpty'), $('allowCount'), settings.userAllow, 'userAllow');
  $('summary').textContent = `총 ${b + a}개 규칙 (차단 ${b} · 제외 ${a})`;
}

// ---------- CSV 유틸 (RFC 4180 호환) ----------
function csvEscape(val) {
  const s = String(val ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\r') {
        if (clean[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else if (ch === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// ---------- Export / Import ----------
$('exportBtn').onclick = () => {
  const lines = ['type,site,selector'];
  for (const { site, sel } of flattenMap(settings.userRules)) {
    lines.push([csvEscape('block'), csvEscape(site), csvEscape(sel)].join(','));
  }
  for (const { site, sel } of flattenMap(settings.userAllow)) {
    lines.push([csvEscape('allow'), csvEscape(site), csvEscape(sel)].join(','));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'replx-rules.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showMsg('CSV 파일로 내보냈어요.');
};

$('importBtn').onclick = () => $('csvFile').click();

$('csvFile').onchange = async (e) => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error('빈 CSV 파일이에요.');

    let startIdx = 0;
    const h0 = rows[0].map((c) => c.trim().toLowerCase());
    if (h0[0] === 'type' || h0[0] === '구분') startIdx = 1;

    const nextRules = structuredClone(settings.userRules || {});
    const nextAllow = structuredClone(settings.userAllow || {});
    let added = 0;
    let skipped = 0;

    for (let i = startIdx; i < rows.length; i++) {
      const cols = rows[i];
      if (cols.length < 3) { skipped++; continue; }
      const rawType = cols[0].trim().toLowerCase();
      const site = normalizeHost(cols[1]); // https://, 경로, 포트를 떼고 도메인만 남김
      const sel = cols[2].trim();

      let target = null;
      if (['block', 'hide', '차단', '숨김'].includes(rawType)) target = nextRules;
      else if (['allow', 'exclude', '제외'].includes(rawType)) target = nextAllow;

      if (!target || !site || !isValidSelector(sel)) { skipped++; continue; }
      const list = (target[site] ||= []);
      if (list.includes(sel)) continue;
      if (list.length >= MAX_RULES_PER_HOST) { skipped++; continue; }
      list.push(sel);
      added++;
    }

    await STORE.replaceMap('userRules', nextRules);
    await STORE.replaceMap('userAllow', nextAllow);
    await load();
    showMsg(`가져오기 완료: ${added}개 추가${skipped ? ` (${skipped}개 건너뜀)` : ''}`);
  } catch (err) {
    showMsg(err?.message || 'CSV 가져오기에 실패했어요.', true);
  } finally {
    e.target.value = '';
  }
};

async function load() {
  settings = await STORE.loadMaps();
  render();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && STORE.touchesRules(changes)) load();
});

load();
