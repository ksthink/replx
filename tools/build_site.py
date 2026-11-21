"""GitHub Pages용 사이트를 _site/에 만듭니다.
- site/ 의 소개 페이지를 복사
- 아이콘과 스토어 스크린샷을 assets/로 복사
- PRIVACY.md → privacy/index.html, PRIVACY.en.md → privacy/en/index.html

실행: pip install markdown && python tools/build_site.py
"""
import html
import re
import shutil
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_site"

PAGE = """<!doctype html>
<html lang="{lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <link rel="icon" href="{root}assets/icon-128.png">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
  <link rel="stylesheet" href="{root}style.css">
  <link rel="stylesheet" href="{root}doc.css">
</head>
<body>
  <header class="top">
    <a class="brand" href="{root}"><img src="{root}assets/icon-128.png" alt="" width="32" height="32"><span>Replx</span></a>
    <nav><a href="{root}">{home}</a><a href="https://github.com/ksthink/replx">GitHub</a></nav>
  </header>
  <main class="doc">
{body}
  </main>
  <footer class="foot"><p>{contact} <a href="mailto:ksthink@metaphr.dev">ksthink@metaphr.dev</a></p></footer>
</body>
</html>
"""


def render(md_path: Path, out_path: Path, lang: str, root: str, links: dict):
    text = md_path.read_text(encoding="utf-8")
    for src, dst in links.items():
        text = text.replace(f"]({src})", f"]({dst})")
    body = markdown.markdown(text, extensions=["tables"])
    title = re.search(r"<h1>(.*?)</h1>", body)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(PAGE.format(
        lang=lang,
        title=html.unescape(title.group(1)) if title else "Replx",
        root=root,
        body=body,
        home="소개" if lang == "ko" else "Home",
        contact="문의" if lang == "ko" else "Contact",
    ), encoding="utf-8")
    print("built", out_path.relative_to(ROOT))


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(ROOT / "site", OUT)
    assets = OUT / "assets"
    (assets / "store").mkdir(parents=True)
    shutil.copy(ROOT / "extension" / "icons" / "128.png", assets / "icon-128.png")
    for png in (ROOT / "docs" / "store").glob("*.png"):
        shutil.copy(png, assets / "store" / png.name)

    render(ROOT / "PRIVACY.md", OUT / "privacy" / "index.html", "ko", "../", {"PRIVACY.en.md": "en/"})
    render(ROOT / "PRIVACY.en.md", OUT / "privacy" / "en" / "index.html", "en", "../../", {"PRIVACY.md": "../"})
    (OUT / ".nojekyll").write_text("")
    print("site ready:", OUT.relative_to(ROOT))


main()
