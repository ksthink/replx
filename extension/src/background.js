// 서비스 워커: 배지 숫자, 단축키, 우클릭 메뉴, 피커 종료 브로드캐스트
const tabCounts = new Map(); // tabId -> Map(frameId -> count)

function updateBadge(tabId) {
  const frames = tabCounts.get(tabId);
  let total = 0;
  if (frames) for (const c of frames.values()) total += c;
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#e03a26' });
  chrome.action.setBadgeText({ tabId, text: total ? String(total) : '' });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;
  const tabId = sender.tab?.id;
  if (msg.type === 'count' && tabId != null) {
    const count = (typeof msg.count === 'number' && Number.isFinite(msg.count) && msg.count >= 0)
      ? Math.floor(msg.count)
      : 0;
    if (!tabCounts.has(tabId)) tabCounts.set(tabId, new Map());
    tabCounts.get(tabId).set(sender.frameId, count);
    updateBadge(tabId);
  } else if (msg.type === 'pickerDone' && tabId != null) {
    chrome.tabs.sendMessage(tabId, { type: 'stopPicker' }).catch(() => {});
  } else if (msg.type === 'getCount' && typeof msg.tabId === 'number') {
    const frames = tabCounts.get(msg.tabId);
    let total = 0;
    if (frames) for (const c of frames.values()) total += c;
    sendResponse({ total });
  }
});

chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') { tabCounts.delete(tabId); updateBadge(tabId); }
});
chrome.tabs.onRemoved.addListener((tabId) => tabCounts.delete(tabId));

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'chh-pick', title: 'Replx: 이 부분 숨기기 지정', contexts: ['all'] });
    chrome.contextMenus.create({ id: 'chh-allow', title: 'Replx: 숨긴 곳 중 제외할 영역 고르기', contexts: ['all'] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab?.id == null) return;
  if (info.menuItemId === 'chh-pick') {
    chrome.tabs.sendMessage(tab.id, { type: 'pickContextTarget' }, { frameId: info.frameId ?? 0 }).catch(() => {});
  } else if (info.menuItemId === 'chh-allow') {
    chrome.tabs.sendMessage(tab.id, { type: 'startPicker', mode: 'allow' }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (command === 'toggle-show') chrome.tabs.sendMessage(tab.id, { type: 'toggleShow' }).catch(() => {});
  if (command === 'start-picker') chrome.tabs.sendMessage(tab.id, { type: 'startPicker', mode: 'hide' }).catch(() => {});
  if (command === 'start-allow-picker') chrome.tabs.sendMessage(tab.id, { type: 'startPicker', mode: 'allow' }).catch(() => {});
});
