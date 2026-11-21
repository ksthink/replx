"""Chrome 웹 스토어용 이미지를 docs/store/에 만듭니다.
  - 스크린샷 5장(1280×800): 왼쪽 브라우저 페이지 + 오른쪽 Replx 팝업. 팝업 설정을 실제로 바꿔 가며 찍어서,
    설정에 따라 페이지가 어떻게 달라지는지 보여 줍니다. 바뀐 설정은 팝업에 빨간 테두리로 표시해요.
  - 작은 프로모션 타일(440×280), 마키 프로모션 타일(1400×560)
실행: python tests/store_assets.py
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


def scene_html(title: str, sub: str, page_png: Path, popup_png: Path, url: str, badge: str, mark: dict | None) -> str:
    """왼쪽: 브라우저 창(주소창·확장 아이콘·배지), 오른쪽: Replx 팝업. mark는 팝업 안에서 강조할 영역(팝업 좌표, CSS px)."""
    pw = 340  # 팝업 표시 폭(원래 320px)
    k = pw / 320
    mark_html = ""
    if mark:
        left = max(6, mark["x"] * k - 6)
        right = min(pw - 6, (mark["x"] + mark["width"]) * k + 6)
        mark_html = (f'<i class="mark" style="left:{left}px;top:{mark["y"] * k - 6}px;'
                     f'width:{right - left}px;height:{mark["height"] * k + 12}px"></i>')
    badge_html = f"<b>{badge}</b>" if badge else ""
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
      * {{ box-sizing: border-box; margin: 0; }}
      body {{ width: 1280px; height: 800px; overflow: hidden; font-family: {FONT};
        background: linear-gradient(160deg, #fff5f3 0%, #fbe3de 100%); color: #1f1f1f; }}
      header {{ display: flex; align-items: center; gap: 18px; padding: 36px 60px 24px; }}
      header img {{ width: 52px; height: 52px; }}
      h1 {{ font-size: 36px; letter-spacing: -0.5px; }}
      h1 b {{ color: {RED}; }}
      p.sub {{ font-size: 19px; color: #555; margin-top: 4px; }}
      .stage {{ display: flex; gap: 34px; justify-content: center; align-items: flex-start; padding: 0 60px; }}
      .browser {{ width: 786px; border-radius: 14px; overflow: hidden; background: #fff; box-shadow: 0 18px 44px rgba(120,40,30,.22); }}
      .bar {{ display: flex; align-items: center; gap: 12px; padding: 11px 14px; background: #eceef2; }}
      .dots {{ display: flex; gap: 7px; }} .dots i {{ width: 11px; height: 11px; border-radius: 50%; background: #c9ced6; }}
      .url {{ flex: 1; background: #fff; border-radius: 999px; padding: 5px 14px; font-size: 14px; color: #6b7280; }}
      .ext {{ position: relative; width: 26px; height: 26px; }}
      .ext img {{ width: 26px; height: 26px; border-radius: 6px; display: block; outline: 2px solid {RED}; outline-offset: 2px; }}
      .ext b {{ position: absolute; right: -9px; bottom: -8px; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 9px;
        background: {RED}; color: #fff; font-size: 11px; line-height: 18px; text-align: center; }}
      .browser > img {{ display: block; width: 786px; }}
      .side {{ width: {pw}px; }}
      .tag {{ display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 700; color: #444; margin: 0 0 10px 2px; }}
      .tag::before {{ content: ""; width: 0; height: 0; border-top: 7px solid transparent; border-bottom: 7px solid transparent; border-right: 10px solid {RED}; }}
      .popup {{ position: relative; border-radius: 14px; overflow: hidden; background: #fff; box-shadow: 0 18px 44px rgba(120,40,30,.22); }}
      .popup img {{ display: block; width: {pw}px; }}
      .mark {{ position: absolute; border: 3px solid {RED}; border-radius: 10px; box-shadow: 0 0 0 4px rgba(224,58,38,.18); }}
    </style></head><body>
      <header><img src="{data_uri(ICON)}"><div><h1>{title}</h1><p class="sub">{sub}</p></div></header>
      <div class="stage">
        <div class="browser">
          <div class="bar"><span class="dots"><i></i><i></i><i></i></span><span class="url">{url}</span>
            <span class="ext"><img src="{data_uri(ICON)}">{badge_html}</span></div>
          <img src="{data_uri(page_png)}">
        </div>
        <div class="side"><div class="tag">Replx 팝업</div>
          <div class="popup"><img src="{data_uri(popup_png)}">{mark_html}</div></div>
      </div>
    </body></html>"""


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


async def capture_popup(ctx, sw, path: Path, mark_selector: str | None):
    """팝업 페이지를 탭으로 열어 찍고, 강조할 요소의 위치를 돌려줍니다.
    팝업이 '현재 탭'으로 지금 보고 있는 페이지 탭을 쓰도록 tabs.query를 그 탭으로 고정합니다."""
    tab_id = await sw.evaluate("async () => (await chrome.tabs.query({ active: true }))[0].id")
    popup = await ctx.new_page()
    await popup.set_viewport_size({"width": 320, "height": 200})  # 낮게 두고 full_page로 내용 높이만큼 찍음
    await popup.add_init_script(f"chrome.tabs.query = async () => [await chrome.tabs.get({tab_id})];")
    await popup.goto(sw.url.replace("src/background.js", "popup/popup.html"))
    await popup.wait_for_timeout(700)
    box = await popup.locator(mark_selector).first.bounding_box() if mark_selector else None
    await popup.screenshot(path=str(path), full_page=True)
    await popup.close()
    return box


async def badge_text(sw):
    return await sw.evaluate("async () => { const [t] = await chrome.tabs.query({ active: true }); return chrome.action.getBadgeText({ tabId: t.id }); }")


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    raw = Path(tempfile.mkdtemp(prefix="replx-store-"))
    VIEW = {"width": 1000, "height": 700}
    async with async_playwright() as p:
        async with extension_browser(p, extra_args=[f"--host-resolver-rules=MAP {DEMO_HOST} 127.0.0.1"],
                                     viewport=VIEW, device_scale_factor=2) as (ctx, sw):
            page = await ctx.new_page()

            async def setup(settings: dict, url: str, hide=(), allow=()):
                await sw.evaluate("s => chrome.storage.sync.set(s)", {
                    "enabled": True, "mode": "hide", "autoDetect": True, "hideCounts": True, "disabledSites": [], **settings})
                await set_rules(sw, "hide", DEMO_HOST, list(hide))
                await set_rules(sw, "allow", DEMO_HOST, list(allow))
                await page.goto(BASE + url)
                await page.wait_for_timeout(1800)

            scenes = []

            # 1. 기본: 켜면 댓글과 댓글 수가 사라짐
            await setup({}, "demo-community.html")
            await page.screenshot(path=str(raw / "after.png"))  # 마키 타일에도 씀
            scenes.append(("켜면 <b>댓글이 사라져요</b>", "댓글 영역과 글 목록의 댓글 수를 찾아 숨겨요.",
                           "after.png", "header .switch", "board/123"))

            # 2. 숨김 방식: 접어두기
            await setup({"mode": "collapse"}, "demo-community.html")
            await page.screenshot(path=str(raw / "collapse.png"))
            scenes.append(("숨김 방식을 <b>접어두기</b>로", "댓글을 지우지 않고 접어 두었다가, 보기를 눌러 펼쳐요.",
                           "collapse.png", "label:has(#mode)", "board/123"))

            # 3. 이 사이트에서 끄기
            await setup({"disabledSites": [DEMO_HOST]}, "demo-community.html")
            await page.screenshot(path=str(raw / "off.png"))
            scenes.append(("사이트마다 <b>켜고 끄기</b>", "이 사이트에서 사용을 끄면 원래 페이지 그대로 보여요.",
                           "off.png", "label:has(#siteOn)", "board/123"))

            # 4. 숨김 규칙(직접 지정)
            await setup({}, "demo-picker.html", hide=["div.zz"])
            await page.screenshot(path=str(raw / "hide-rule.png"))
            scenes.append(("놓친 곳은 <b>숨김 규칙</b>으로", "자동으로 못 찾은 영역도 클릭해서 고르면 계속 숨겨요.",
                           "hide-rule.png", "#rulesBox", "blog/winter-books"))

            # 5. 제외 규칙: 제외한 영역을 팝업의 👁로 확인
            await setup({}, "demo-community.html", allow=[".fdb_lst_wrp"])
            await page.evaluate("scrollTo(0, 120)")
            await send_to_active_tab(sw, {"type": "flash", "selector": ".fdb_lst_wrp", "mode": "allow"})
            await page.wait_for_timeout(700)
            await page.screenshot(path=str(raw / "allow-rule.png"))
            scenes.append(("잘못 숨긴 곳은 <b>제외 규칙</b>으로", "제외한 영역은 어떤 규칙에 걸려도 다시 숨기지 않아요.",
                           "allow-rule.png", "#allowBox", "board/123"))

            # 마키 타일용: 제외 모드(숨긴 곳이 점선으로 드러남)
            await setup({}, "demo-community.html")
            await send_to_active_tab(sw, {"type": "startPicker", "mode": "allow"})
            await page.wait_for_timeout(300)
            b = await page.locator(".fdb_tag").bounding_box()
            await page.mouse.move(b["x"] + 3, b["y"] + 3)
            await page.mouse.click(b["x"] + 3, b["y"] + 3)
            await page.keyboard.press("ArrowUp")
            await page.wait_for_timeout(250)
            await page.screenshot(path=str(raw / "allow.png"))
            await page.keyboard.press("Escape")

            # 장면마다 같은 상태를 다시 만들어 팝업을 찍고 합칩니다.
            canvas = await ctx.new_page()
            await canvas.set_viewport_size({"width": 1280, "height": 800})
            setups = [
                ({}, "demo-community.html", (), ()),
                ({"mode": "collapse"}, "demo-community.html", (), ()),
                ({"disabledSites": [DEMO_HOST]}, "demo-community.html", (), ()),
                ({}, "demo-picker.html", ("div.zz",), ()),
                ({}, "demo-community.html", (), (".fdb_lst_wrp",)),
            ]
            for i, ((title, sub, png, mark_sel, path), (st, url, hide, allow)) in enumerate(zip(scenes, setups), 1):
                await page.bring_to_front()
                await setup(st, url, hide, allow)
                badge = await badge_text(sw)
                mark = await capture_popup(ctx, sw, raw / f"popup-{i}.png", mark_sel)
                await canvas.set_viewport_size({"width": 1280, "height": 800})
                await canvas.set_content(scene_html(title, sub, raw / png, raw / f"popup-{i}.png",
                                                    f"{DEMO_HOST}/{path}", badge, mark))
                await canvas.wait_for_timeout(300)
                out = OUT / f"screenshot-{i}.png"
                await canvas.screenshot(path=str(out))
                print("saved", out.relative_to(ROOT))

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

    # 2배 해상도로 찍은 것을 규격 크기로 줄이고, 웹 스토어가 받는 알파 없는 24비트 PNG로 저장합니다.
    from PIL import Image
    sizes = {"promo-small.png": (440, 280), "promo-marquee.png": (1400, 560)}
    for png in OUT.glob("*.png"):
        im = Image.open(png).convert("RGB")
        size = sizes.get(png.name, (1280, 800))
        if im.size != size:
            im = im.resize(size, Image.LANCZOS)
        im.save(png, optimize=True)


asyncio.run(main())
