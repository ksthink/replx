// 사용자 규칙 저장소
// chrome.storage.sync는 항목 하나에 8KB까지만 저장되므로, 규칙을 한 항목에 몰지 않고
// 사이트별 항목으로 나눠 저장합니다.
//   숨김 규칙: "uh:<사이트>" → [선택자, ...]
//   제외 규칙: "ua:<사이트>" → [선택자, ...]
// 예전 형식(userRules / userAllow 한 항목)은 처음 읽을 때 자동으로 옮깁니다.
(() => {
  const PREFIX = { userRules: 'uh:', userAllow: 'ua:' };
  const MODE_KEY = { hide: 'userRules', allow: 'userAllow' };
  const LEGACY_KEYS = ['userRules', 'userAllow'];

  const MAX_RULES_PER_HOST = 50;
  const MAX_SELECTOR_LEN = 500;
  // 항목 하나의 한도(8192바이트)에서 키 이름과 여유분을 뺀 값
  const MAX_ITEM_BYTES = 8000;

  const bytes = (key, value) => new TextEncoder().encode(key + JSON.stringify(value)).length;

  function isValidSelector(sel) {
    if (typeof sel !== 'string' || !sel.trim() || sel.length > MAX_SELECTOR_LEN) return false;
    if (typeof document === 'undefined') return true; // 서비스 워커에는 DOM이 없어 문법 검사는 페이지에서 합니다.
    try { document.createDocumentFragment().querySelector(sel); return true; } catch { return false; }
  }

  // "https://News.Example.com:8080/a/b" → "news.example.com"
  function normalizeHost(raw) {
    let h = String(raw ?? '').trim().toLowerCase();
    h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^\/\//, '');
    h = h.split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/^\*\./, '').replace(/\.$/, '');
    return /^[a-z0-9.-]+$/.test(h) && !h.startsWith('.') ? h : '';
  }

  function friendlyError(err) {
    const m = String(err?.message || err);
    if (/QuotaBytesPerItem|QUOTA_BYTES_PER_ITEM/i.test(m)) return new Error('이 사이트의 규칙 저장 공간(8KB)이 가득 찼어요. 쓰지 않는 규칙을 지워 주세요.');
    if (/QuotaBytes|QUOTA_BYTES/i.test(m)) return new Error('전체 규칙 저장 공간(100KB)이 가득 찼어요. 쓰지 않는 규칙을 지워 주세요.');
    if (/MaxItems|MAX_ITEMS/i.test(m)) return new Error('규칙을 저장한 사이트가 너무 많아요. 쓰지 않는 사이트의 규칙을 지워 주세요.');
    if (/WRITE_OPERATIONS/i.test(m)) return new Error('잠시 뒤에 다시 시도해 주세요(저장 횟수 제한).');
    return err instanceof Error ? err : new Error(m);
  }

  function cleanList(list) {
    return [...new Set((Array.isArray(list) ? list : []).filter(isValidSelector))].slice(0, MAX_RULES_PER_HOST);
  }

  // 예전 형식을 사이트별 항목으로 옮깁니다. 옮기는 데 실패해도 읽기는 계속 됩니다.
  async function migrateLegacy(all) {
    if (!LEGACY_KEYS.some((k) => k in all)) return;
    const patch = {};
    for (const key of LEGACY_KEYS) {
      const map = all[key];
      if (!map || typeof map !== 'object') continue;
      for (const [host, list] of Object.entries(map)) {
        const h = normalizeHost(host);
        const itemKey = PREFIX[key] + h;
        const merged = cleanList([...(all[itemKey] || []), ...(patch[itemKey] || []), ...(Array.isArray(list) ? list : [])]);
        if (h && merged.length) patch[itemKey] = merged;
      }
    }
    try {
      if (Object.keys(patch).length) await chrome.storage.sync.set(patch);
      await chrome.storage.sync.remove(LEGACY_KEYS);
      Object.assign(all, patch);
      for (const k of LEGACY_KEYS) delete all[k];
    } catch (e) {
      console.warn('[Replx] 규칙 형식 이전 실패:', e);
    }
  }

  // 저장된 모든 항목을 { userRules: {host: [...]}, userAllow: {host: [...]} } 모양으로 돌려줍니다.
  function mapsFrom(all) {
    const out = { userRules: {}, userAllow: {} };
    for (const [k, v] of Object.entries(all)) {
      for (const [mapKey, prefix] of Object.entries(PREFIX)) {
        if (k.startsWith(prefix) && Array.isArray(v) && v.length) out[mapKey][k.slice(prefix.length)] = v;
      }
    }
    // 아직 이전되지 않은 예전 형식도 함께 읽습니다.
    for (const key of LEGACY_KEYS) {
      const legacy = all[key];
      if (!legacy || typeof legacy !== 'object') continue;
      for (const [h, list] of Object.entries(legacy)) {
        if (Array.isArray(list)) out[key][h] = [...new Set([...(out[key][h] || []), ...list])];
      }
    }
    return out;
  }

  async function loadMaps() {
    const all = await chrome.storage.sync.get(null);
    await migrateLegacy(all);
    return mapsFrom(all);
  }

  async function getHost(mapKey, host) {
    const key = PREFIX[mapKey] + host;
    const data = await chrome.storage.sync.get(key);
    return Array.isArray(data[key]) ? data[key] : [];
  }

  async function setHost(mapKey, host, list) {
    const h = normalizeHost(host);
    if (!h) throw new Error(`사이트 주소가 올바르지 않아요: ${host}`);
    const key = PREFIX[mapKey] + h;
    const clean = cleanList(list);
    try {
      if (!clean.length) { await chrome.storage.sync.remove(key); return; }
      if (bytes(key, clean) > MAX_ITEM_BYTES) throw new Error('QUOTA_BYTES_PER_ITEM');
      await chrome.storage.sync.set({ [key]: clean });
    } catch (e) {
      throw friendlyError(e);
    }
  }

  async function addRule(mode, host, selector) {
    const mapKey = MODE_KEY[mode];
    if (!isValidSelector(selector)) throw new Error('올바르지 않거나 너무 긴 선택자예요.');
    const list = await getHost(mapKey, normalizeHost(host));
    if (list.includes(selector)) return false;
    if (list.length >= MAX_RULES_PER_HOST) throw new Error(`사이트당 최대 ${MAX_RULES_PER_HOST}개까지만 저장할 수 있어요.`);
    await setHost(mapKey, host, [...list, selector]);
    return true;
  }

  async function removeRule(mode, host, selector) {
    const mapKey = MODE_KEY[mode] || mode;
    const list = await getHost(mapKey, normalizeHost(host));
    await setHost(mapKey, host, list.filter((s) => s !== selector));
  }

  // 지도 전체를 바꿉니다(설정 페이지 저장·가져오기용). 바뀐 사이트만 씁니다.
  async function replaceMap(mapKey, map) {
    const all = await chrome.storage.sync.get(null);
    await migrateLegacy(all);
    const prefix = PREFIX[mapKey];
    const next = {};
    for (const [host, list] of Object.entries(map || {})) {
      const h = normalizeHost(host);
      if (!h) throw new Error(`사이트 주소가 올바르지 않아요: ${host}`);
      const clean = cleanList([...(next[prefix + h] || []), ...(Array.isArray(list) ? list : [])]);
      if (clean.length) next[prefix + h] = clean;
    }
    for (const [k, v] of Object.entries(next)) {
      if (bytes(k, v) > MAX_ITEM_BYTES) throw friendlyError(new Error('QUOTA_BYTES_PER_ITEM'));
    }
    const removeKeys = Object.keys(all).filter((k) => k.startsWith(prefix) && !(k in next));
    const setPatch = Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(all[k]) !== JSON.stringify(v)));
    try {
      if (Object.keys(setPatch).length) await chrome.storage.sync.set(setPatch);
      if (removeKeys.length) await chrome.storage.sync.remove(removeKeys);
    } catch (e) {
      throw friendlyError(e);
    }
  }

  // storage.onChanged의 changes에 규칙 변경이 들어 있는지
  const touchesRules = (changes) => Object.keys(changes).some((k) => k.startsWith('uh:') || k.startsWith('ua:') || LEGACY_KEYS.includes(k));

  self.CHH_STORE = {
    MAX_RULES_PER_HOST, MAX_SELECTOR_LEN, MODE_KEY,
    isValidSelector, normalizeHost, loadMaps, addRule, removeRule, replaceMap, touchesRules,
  };
})();
