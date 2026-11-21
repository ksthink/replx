// 콘텐츠 스크립트·팝업·설정 페이지가 함께 쓰는 기본 설정
self.CHH_DEFAULTS = {
  enabled: true,
  mode: 'hide', // 'hide' | 'collapse'
  autoDetect: true,
  hideCounts: true,
  disabledSites: [],
  excludedSites: ['mail.google.com', 'docs.google.com', 'github.com', 'gitlab.com', 'notion.so', 'figma.com', 'slack.com', 'talk.hyvor.com'],
};
// 직접 지정한 숨김·제외 규칙은 사이트별 항목으로 따로 저장합니다(src/store.js).
