// 규칙 데이터(data/*.json)를 콘텐츠 스크립트가 동기적으로 읽을 수 있는 src/rules.js로 합칩니다.
// 사용법: node tools/build-rules.mjs  (extension/data → extension/src/rules.js)
// --check: 생성 결과가 커밋된 rules.js와 다르면 실패(CI용)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'extension');
const up = JSON.parse(readFileSync(join(root, 'data/upstream-sites.json'), 'utf8'));
const kr = JSON.parse(readFileSync(join(root, 'data/kr-sites.json'), 'utf8'));

const sites = { ...up.sites };
for (const [host, sel] of Object.entries(kr.sites)) {
  sites[host] = sites[host] ? `${sites[host]}, ${sel}` : sel;
}

const rules = {
  sites,
  countSelectors: kr.count_selectors,
  // 업스트림 catchall은 무조건 숨기지 않고, 자동 탐지 엔진의 "강한 신호"로만 씁니다.
  catchallSelectors: up.catchall_selectors,
  excludedSelectors: up.excluded_selectors,
  excludedSites: up.excluded_sites,
};

const out = `// 자동 생성 파일입니다. 직접 고치지 말고 data/*.json을 수정한 뒤 tools/build-rules.mjs를 실행하세요.
// 사이트 규칙 일부는 grantwinney/hide-comments-everywhere (MIT)에서 가져왔습니다.
self.CHH_RULES = ${JSON.stringify(rules, null, 1)};
`;
if (process.argv.includes('--check')) {
  const cur = readFileSync(join(root, 'src/rules.js'), 'utf8');
  if (cur !== out) { console.error('src/rules.js가 data/*.json과 다릅니다. node tools/build-rules.mjs를 실행하세요.'); process.exit(1); }
} else {
  writeFileSync(join(root, 'src/rules.js'), out);
}
console.log(`rules.js: ${Object.keys(sites).length} sites${process.argv.includes('--check') ? ' (up to date)' : ''}`);
