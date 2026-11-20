// 콘텐츠 스크립트·팝업·설정 페이지가 함께 쓰는 기본 설정
self.CHH_DEFAULTS = {
  enabled: true,
  mode: 'hide', // 'hide' | 'collapse'
  autoDetect: true,
  hideCounts: true,
  disabledSites: [],
  excludedSites: ['mail.google.com', 'docs.google.com', 'github.com', 'gitlab.com', 'notion.so', 'figma.com', 'slack.com', 'talk.hyvor.com'],
  userRules: {}, // { host: [selector] }  직접 지정한 숨김 영역
  userAllow: {}, // { host: [selector] }  "여기는 댓글 아님"
};
