# Chrome 웹 스토어 등록 자료

Chrome 웹 스토어 개발자 대시보드에 그대로 붙여 넣을 수 있게 정리한 문구와 파일 목록입니다.

## 패키지

- 업로드 파일: manifest 버전을 올려 main에 푸시하면 [Release](../.github/workflows/release.yml) 워크플로가 만드는 `replx-vX.Y.Z.zip`([최신 릴리스](https://github.com/ksthink/replx/releases/latest)). `extension/` 폴더를 그대로 압축한 파일이에요.
- 업로드 전 확인: `manifest.json`의 `version`이 이전에 올린 버전보다 커야 해요.

## 스토어 등록정보(Store listing)

| 항목 | 값 |
|---|---|
| 이름 | Replx (manifest에서 가져옴) |
| 요약(최대 132자) | 커뮤니티·뉴스·유튜브의 댓글을 숨깁니다. 숨길 곳과 숨기지 않을 곳을 클릭해서 직접 지정할 수 있어요. (manifest에서 가져옴) |
| 카테고리 | 생산성 → 도구(Productivity → Tools) 권장 |
| 언어 | 한국어 |
| 스토어 아이콘 | `extension/icons/128.png` (128×128) |
| 스크린샷(1280×800) | `docs/store/screenshot-1.png` ~ `screenshot-5.png` |
| 작은 홍보 타일(440×280) | `docs/store/promo-small.png` |
| 마키 홍보 타일(1400×560, 선택) | `docs/store/promo-marquee.png` |
| 홈페이지 URL | https://ksthink.github.io/replx/ |
| 지원 URL | https://github.com/ksthink/replx/issues |
| 연락처 이메일 | ksthink@metaphr.dev (계정 탭에서 인증 필요) |

### 상세 설명(한국어)

```
Replx는 커뮤니티, 뉴스, 유튜브 등 웹사이트의 댓글 영역을 깔끔하게 숨겨 본문에만 집중할 수 있게 돕는 확장 프로그램입니다.

[주요 기능]
• 자동 댓글 숨김: 국내외 주요 사이트에 맞춘 기본 규칙과 자동 탐지로 댓글 영역과 댓글 수 표시를 숨깁니다.
• 숨길 영역·제외할 영역 직접 지정: 마우스 클릭만으로 원하는 영역을 숨기거나, 잘못 숨겨진 영역을 제외해 다시 보이게 할 수 있습니다.
• 제외·차단 목록 관리: 전용 목록 창에서 사이트별 차단·제외 규칙을 한눈에 확인하고 삭제할 수 있으며, CSV 파일로 내보내거나 가져올 수 있습니다.
• 숨김 방식 선택: 댓글을 완전히 숨기거나, 필요할 때만 펼쳐 볼 수 있는 접어두기 모드를 고를 수 있습니다.

[개인정보 보호]
Replx는 규칙 처리와 댓글 탐지를 모두 브라우저 안에서만 수행합니다. 방문 기록이나 웹페이지 데이터를 수집하지 않으며, 외부 서버로 전송하지도 않습니다.
개인정보처리방침: https://ksthink.github.io/replx/privacy/

[문의]
ksthink@metaphr.dev

Replx는 YouTube 등 각 사이트의 운영사와 관련이 없는 독립 프로젝트입니다.
```

### Detailed description (English)

```
Replx neatly hides comment sections on websites such as communities, news sites, and YouTube, so you can focus on the content itself.

[Key features]
• Automatic comment hiding: Built-in rules for major sites in Korea and worldwide, plus auto-detection, hide comment sections and comment counts.
• Pick areas to hide or exclude: With a few clicks, hide any extra area you want, or exclude an area that was hidden by mistake so it stays visible.
• Exclude/Block list: See and delete the block and exclude rules for every site in one window, and export or import them as a CSV file.
• Choose how to hide: Hide comments completely, or use collapse mode to fold them and open them only when you want.

[Privacy]
Replx processes all rules and detection inside your browser only. It does not collect your browsing history or web page data, and it never sends anything to an external server.
Privacy policy: https://ksthink.github.io/replx/privacy/en/

[Contact]
ksthink@metaphr.dev

Replx is an independent project and is not affiliated with YouTube or any other site.
```

## 개인정보 보호 관행(Privacy practices) 탭

### 단일 목적(Single purpose)

```
Replx hides comment sections on web pages. It finds comment areas using built-in site rules and on-device structural detection, and lets users click to add areas to hide or exclude areas that should stay visible on each site.
```

### 권한 사유(Permission justification)

| 권한 | 붙여 넣을 문구 |
|---|---|
| `storage` | `Saves the user's settings (on/off, hiding style) and the hide/exclude rules the user creates for each site (domain + CSS selector) in chrome.storage.sync. No data leaves the browser except through Chrome Sync controlled by the user.` |
| `contextMenus` | `Adds right-click menu items that let the user start picking an area to hide, or an area to exclude, directly on the page.` |
| 호스트 권한(콘텐츠 스크립트 `http://*/*`, `https://*/*`) | `The single purpose is hiding comment sections on whatever site the user reads, and users can add rules for any site, so the content script must run on all http/https pages (and in frames, where some sites load comments). The script only adds CSS to hide comment areas and reads page structure locally to detect them. It makes no network requests and does not collect or transmit page content.` |

### 원격 코드(Remote code)

- 선택: **아니요, 원격 코드를 사용하지 않습니다(No, I am not using remote code).**
- 모든 코드와 사이트 규칙(`src/rules.js`)이 패키지에 들어 있고, 네트워크 요청이 없어요.

### 데이터 사용(Data usage)

수집 항목 체크는 판단이 필요한 부분이에요. 정책상 "수집"은 개발자나 제3자에게 전달되는 것을 말하고, Replx는 아무것도 전달하지 않아요. 다만 공식 FAQ는 브라우저 안에서만 처리하는 데이터도 처리 방식을 밝히라고 하므로, 아래 둘 중 하나를 고르세요.

- **최소 신고(권장)**: 수집 항목은 모두 체크하지 않고, 개인정보처리방침에 브라우저 안에서만 처리한다고 밝혀 두기(이미 PRIVACY.md에 있음).
- **보수적 신고**: "웹사이트 콘텐츠(Website content)"에 체크. 콘텐츠 스크립트가 페이지 구조를 읽는다는 점을 반영하는 선택이에요. 스토어 페이지에 "웹사이트 콘텐츠를 다룸"이라고 표시돼요.

아래 세 가지 인증에는 모두 체크합니다.

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

### 개인정보처리방침 URL

```
https://ksthink.github.io/replx/privacy/
```

영어 버전은 https://ksthink.github.io/replx/privacy/en/ 이에요. 두 페이지 모두 `PRIVACY.md`, `PRIVACY.en.md`에서 Pages 워크플로가 자동으로 만들어요.

## 계정(Account) 탭

- 연락처 이메일 인증을 마쳐야 게시할 수 있어요.
- 판매자(trader) 여부 신고를 요구하면, 수익을 내지 않는 개인 프로젝트라면 "판매자 아님(non-trader)"을 고릅니다.

## 제출 전 점검

- [ ] `node tools/build-rules.mjs --check` 통과
- [ ] CI 통과(E2E 테스트)
- [ ] 업로드할 zip을 압축 해제해 `chrome://extensions`에서 직접 불러와 동작 확인
- [ ] manifest 권한이 `storage`, `contextMenus`뿐인지 확인
- [ ] 스크린샷·홍보 타일이 최신 화면인지 확인
