"""Chrome 웹 스토어용 이미지(1280×800 스크린샷 5장, 440×280 홍보 타일)를 docs/store/에 만듭니다.
실행: python tests/store_assets.py

확장이 올라간 크롬으로 실제 화면을 찍은 뒤, 안내 문구가 들어간 틀에 넣어 다시 찍습니다.
"""
import asyncio
import base64
import tempfile
from pathlib import Path

from playwright.async_api import async_playwright

from harness import PORT, ROOT, extension_browser, send_to_active_tab, set_rules

# 스토어 이미지에 localhost 대신 예시 도메인이 보이도록 테스트 서버를 이 이름으로 엽니다.
DEMO_HOST = "community.example.kr"
BASE = f"http://{DEMO_HOST}:{PORT}/"

OUT = ROOT / "docs" / "store"
ICON = ROOT / "extension" / "icons" / "128.png"
RED = "#e03a26"
FONT = '-apple-system, "Apple SD Gothic Neo", "Noto Sans CJK KR", "Noto Sans KR", "Malgun Gothic", sans-serif'

POPUP_SHIM = """
const _q = chrome.tabs.query.bind(chrome.tabs);
chrome.tabs.query = async () => {
  const me = await chrome.tabs.getCurrent();
  return (await _q({})).filter((t) => t.id !== me.id).slice(-1);
};
"""


def data_uri(path: Path) -> str:
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def frame_html(title: str, sub: str, body: str) -> str:
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
      * {{ box-sizing: border-box; margin: 0; }}
      body {{ width: 1280px; height: 800px; overflow: hidden; font-family: {FONT};
        background: linear-gradient(160deg, #fff5f3 0%, #fbe3de 100%); color: #1f1f1f; }}
      header {{ display: flex; align-items: center; gap: 18px; padding: 40px 60px 26px; }}
      header img {{ width: 56px; height: 56px; }}
      h1 {{ font-size: 38px; letter-spacing: -0.5px; }}
      h1 b {{ color: {RED}; }}
      p.sub {{ font-size: 19px; color: #555; margin-top: 6px; }}
      .stage {{ display: flex; gap: 28px; justify-content: center; align-items: flex-start; padding: 0 60px; }}
      .shot {{ border-radius: 12px; overflow: hidden; box-shadow: 0 14px 40px rgba(120,40,30,.22); background: #fff; }}
      .shot img {{ display: block; }}
      .label {{ text-align: center; font-size: 16px; font-weight: 700; color: #444; margin-bottom: 10px; }}
      .label.on {{ color: {RED}; }}
    </style></head><body>
      <header><img src="{data_uri(ICON)}"><div><h1>{title}</h1><p class="sub">{sub}</p></div></header>
      <div class="stage">{body}</div>
    </body></html>"""


def shot_div(path: Path, width: int, label: str = "", on: bool = False) -> str:
    lab = f'<div class="label{" on" if on else ""}">{label}</div>' if label else ""
    return f'<div>{lab}<div class="shot"><img src="{data_uri(path)}" width="{width}"></div></div>'


PROMO_HTML = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  * {{ box-sizing: border-box; margin: 0; }}
  body {{ width: 440px; height: 280px; overflow: hidden; font-family: {FONT};
    background: linear-gradient(150deg, {RED} 0%, #c22a17 100%); color: #fff;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }}
  img {{ width: 92px; height: 92px; filter: drop-shadow(0 6px 14px rgba(0,0,0,.25)); }}
  h1 {{ font-size: 40px; letter-spacing: -0.5px; }}
  p {{ font-size: 17px; opacity: .95; }}
</style></head><body>
  <img src="{data_uri(ICON)}"><h1>Replx</h1><p>댓글은 숨기고, 글에만 집중</p>
</body></html>"""


def marquee_html(raw: Path) -> str:
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  * {{ box-sizing: border-box; margin: 0; }}
  body {{ width: 1400px; height: 560px; overflow: hidden; font-family: {FONT}; color: #fff;
    background: linear-gradient(150deg, {RED} 0%, #c22a17 100%); position: relative; }}
  .copy {{ position: absolute; left: 90px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; }}
  .copy img {{ width: 96px; height: 96px; border-radius: 22px; filter: drop-shadow(0 10px 20px rgba(0,0,0,.25)); }}
  .copy h1 {{ font-size: 96px; line-height: 1; letter-spacing: -0.05em; margin: 20px 0 14px; }}
  .copy p {{ font-size: 32px; font-weight: 700; opacity: .95; letter-spacing: -0.02em; }}
  .shot {{ position: absolute; border-radius: 16px; overflow: hidden; box-shadow: 0 30px 60px -20px rgba(0,0,0,.45); }}
  .shot img {{ display: block; }}
  .s1 {{ right: 300px; top: 70px; transform: rotate(-3deg); }}
  .s2 {{ right: 40px; top: 150px; transform: rotate(3deg); }}
</style></head><body>
  <div class="copy"><img src="{data_uri(ICON)}"><h1>Replx</h1><p>댓글은 숨기고, 글에만 집중</p></div>
  <div class="shot s1"><img src="{data_uri(raw / 'after.png')}" width="560"></div>
  <div class="shot s2"><img src="{data_uri(raw / 'allow.png')}" width="520"></div>
</body></html>"""


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    raw = Path(tempfile.mkdtemp(prefix="replx-store-"))
    async with async_playwright() as p:
        async with extension_browser(p, extra_args=[f"--host-resolver-rules=MAP {DEMO_HOST} 127.0.0.1"], viewport={"width": 1100, "height": 760}) as (ctx, sw):
            page = await ctx.new_page()

            # 원본 화면들
            await sw.evaluate("() => chrome.storage.sync.set({ enabled: false })")
            await page.goto(BASE + "demo-community.html")
            await page.wait_for_timeout(1000)
            await page.screenshot(path=str(raw / "before.png"))

            await sw.evaluate("() => chrome.storage.sync.set({ enabled: true, mode: 'hide' })")
            await page.goto(BASE + "demo-community.html")
            await page.wait_for_timeout(1800)
            await page.screenshot(path=str(raw / "after.png"))

            await page.goto(BASE + "demo-picker.html")
            await page.wait_for_timeout(1000)
            await send_to_active_tab(sw, {"type": "startPicker", "mode": "hide"})
            await page.wait_for_timeout(300)
            b = await page.locator(".yy p").nth(1).bounding_box()
            await page.mouse.move(b["x"] + 40, b["y"] + 10)
            await page.mouse.click(b["x"] + 40, b["y"] + 10)
            await page.keyboard.press("ArrowUp")
            await page.keyboard.press("ArrowUp")
            await page.wait_for_timeout(250)
            await page.screenshot(path=str(raw / "pick.png"))
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(1200)

            await page.goto(BASE + "demo-community.html")
            await page.wait_for_timeout(1500)
            await send_to_active_tab(sw, {"type": "startPicker", "mode": "allow"})
            await page.wait_for_timeout(300)
            b = await page.locator(".fdb_tag").bounding_box()
            await page.mouse.move(b["x"] + 3, b["y"] + 3)
            await page.mouse.click(b["x"] + 3, b["y"] + 3)
            await page.keyboard.press("ArrowUp")
            await page.wait_for_timeout(250)
            await page.screenshot(path=str(raw / "allow.png"))
            await page.keyboard.press("Escape")

            await sw.evaluate("() => chrome.storage.sync.set({ mode: 'collapse' })")
            await page.goto(BASE + "demo-community.html")
            await page.wait_for_timeout(1800)
            await page.screenshot(path=str(raw / "collapse.png"))
            await sw.evaluate("() => chrome.storage.sync.set({ mode: 'hide' })")

            popup = await ctx.new_page()
            await popup.set_viewport_size({"width": 320, "height": 560})
            await popup.add_init_script(POPUP_SHIM)
            await popup.goto(sw.url.replace("src/background.js", "popup/popup.html"))
            await popup.wait_for_timeout(800)
            await popup.screenshot(path=str(raw / "popup.png"), full_page=True)
            await popup.close()

            # 규칙 목록 창(예시 규칙)
            await set_rules(sw, "hide", "news.example.com", [".comment_list", "#cbox_module"])
            await set_rules(sw, "allow", "news.example.com", [".article_body"])
            rules = await ctx.new_page()
            await rules.set_viewport_size({"width": 860, "height": 520})
            await rules.goto(sw.url.replace("src/background.js", "popup/rules.html"))
            await rules.wait_for_timeout(600)
            await rules.screenshot(path=str(raw / "rules.png"))
            await rules.close()

            # 틀에 넣어 1280×800으로 찍기
            frames = [
                ("댓글은 숨기고, <b>글에만 집중</b>", "커뮤니티·뉴스·영상 사이트의 댓글 영역을 찾아 숨겨요.",
                 shot_div(raw / "before.png", 560, "끄기 전") + shot_div(raw / "after.png", 560, "Replx 켠 후", True)),
                ("못 숨긴 댓글은 <b>클릭해서 숨기기</b>", "영역을 고르고 범위를 조절하면 그 사이트의 규칙으로 저장돼요.",
                 shot_div(raw / "pick.png", 880)),
                ("잘못 숨겨진 곳은 <b>클릭해서 되살리기</b>", "숨긴 곳이 점선으로 드러나요. 제외한 영역은 다시 숨기지 않아요.",
                 shot_div(raw / "allow.png", 880)),
                ("사이트마다 <b>내 방식대로</b>", "완전히 숨기거나 접어 두고, 사이트별로 켜고 끌 수 있어요.",
                 shot_div(raw / "collapse.png", 760) + shot_div(raw / "popup.png", 300)),
                ("규칙은 <b>한눈에 보고 관리</b>", "모든 사이트의 규칙을 한 창에서 지우고, CSV로 내보내고 가져와요.",
                 shot_div(raw / "rules.png", 980)),
            ]
            canvas = await ctx.new_page()
            await canvas.set_viewport_size({"width": 1280, "height": 800})
            for i, (title, sub, body) in enumerate(frames, 1):
                await canvas.set_content(frame_html(title, sub, body))
                await canvas.wait_for_timeout(300)
                path = OUT / f"screenshot-{i}.png"
                await canvas.screenshot(path=str(path))
                print("saved", path.relative_to(ROOT))

            await canvas.set_viewport_size({"width": 440, "height": 280})
            await canvas.set_content(PROMO_HTML)
            await canvas.wait_for_timeout(300)
            path = OUT / "promo-small.png"
            await canvas.screenshot(path=str(path))
            print("saved", path.relative_to(ROOT))

            await canvas.set_viewport_size({"width": 1400, "height": 560})
            await canvas.set_content(marquee_html(raw))
            await canvas.wait_for_timeout(300)
            path = OUT / "promo-marquee.png"
            await canvas.screenshot(path=str(path))
            print("saved", path.relative_to(ROOT))

    # 웹 스토어는 알파 채널 없는 24비트 PNG만 받으므로 RGB로 다시 저장합니다.
    from PIL import Image
    for png in OUT.glob("*.png"):
        im = Image.open(png)
        if im.mode != "RGB":
            im.convert("RGB").save(png)


asyncio.run(main())
