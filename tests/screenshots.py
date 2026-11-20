"""README용 스크린샷을 docs/screenshots/에 다시 만듭니다.  실행: python tests/screenshots.py"""
import asyncio

from playwright.async_api import async_playwright

from harness import BASE, ROOT, extension_browser, send_to_active_tab

OUT = ROOT / "docs" / "screenshots"
VIEW = {"width": 1000, "height": 680}

# 팝업은 툴바에서 열리는 창이라 직접 찍을 수 없어서, 팝업 페이지를 탭으로 열고
# "현재 탭"을 바로 앞의 데모 탭으로 바꿔치기해 같은 화면을 재현합니다.
POPUP_SHIM = """
const _q = chrome.tabs.query.bind(chrome.tabs);
chrome.tabs.query = async () => {
  const me = await chrome.tabs.getCurrent();
  return (await _q({})).filter((t) => t.id !== me.id).slice(-1);
};
"""


async def shot(page, name, **kw):
    path = OUT / name
    await page.screenshot(path=str(path), **kw)
    print("saved", path.relative_to(ROOT))


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        async with extension_browser(p, viewport=VIEW) as (ctx, sw):
            page = await ctx.new_page()

            # 1. 끈 상태(원래 페이지)
            await sw.evaluate("() => chrome.storage.sync.set({ enabled: false })")
            await page.goto(BASE + "demo-community.html")
            await page.wait_for_timeout(1200)
            await shot(page, "01-before.png")

            # 2. 켠 상태: 완전히 숨김
            await sw.evaluate("() => chrome.storage.sync.set({ enabled: true, mode: 'hide' })")
            await page.goto(BASE + "demo-community.html")
            await page.wait_for_timeout(1800)
            await shot(page, "02-hidden.png")

            # 4. 접어두기
            await sw.evaluate("() => chrome.storage.sync.set({ mode: 'collapse' })")
            await page.goto(BASE + "demo-community.html")
            await page.wait_for_timeout(1800)
            await shot(page, "04-collapse.png")
            await sw.evaluate("() => chrome.storage.sync.set({ mode: 'hide' })")

            # 5~7. 직접 지정
            await page.goto(BASE + "demo-picker.html")
            await page.wait_for_timeout(1200)
            await send_to_active_tab(sw, {"type": "startPicker"})
            await page.wait_for_timeout(300)
            b = await page.locator(".yy p").nth(1).bounding_box()
            await page.mouse.move(b["x"] + 40, b["y"] + 10)
            await page.wait_for_timeout(200)
            await shot(page, "05-picker-hover.png")
            await page.mouse.click(b["x"] + 40, b["y"] + 10)
            await page.keyboard.press("ArrowUp")
            await page.keyboard.press("ArrowUp")
            await page.wait_for_timeout(250)
            await shot(page, "06-picker-confirm.png")
            await page.locator("chh-picker button[data-a=save]").click()
            await page.wait_for_timeout(1200)
            await shot(page, "07-picker-done.png")  # 아래에 "되돌리기" 알림이 함께 찍힘

            # 3. 팝업 (직접 지정한 숨김 규칙이 목록에 보이도록 피커 저장 뒤에 찍음)
            popup = await ctx.new_page()
            await popup.set_viewport_size({"width": 320, "height": 470})
            await popup.add_init_script(POPUP_SHIM)
            await popup.goto(sw.url.replace("src/background.js", "popup/popup.html"))
            await popup.wait_for_timeout(800)
            await shot(popup, "03-popup.png", full_page=True)
            await popup.close()
            await page.bring_to_front()

            # 9~10. 제외할 영역 고르기: 숨긴 곳이 빨간 점선으로 드러나고, 초록색으로 고름
            await page.goto(BASE + "demo-community.html")
            await page.wait_for_timeout(1500)
            await send_to_active_tab(sw, {"type": "startPicker", "mode": "allow"})
            await page.wait_for_timeout(300)
            await page.locator(".fdb_tag").scroll_into_view_if_needed()
            b = await page.locator(".fdb_lst_ul").bounding_box()
            await page.mouse.move(b["x"] + 200, b["y"] + 8)
            await page.wait_for_timeout(200)
            await shot(page, "09-allow-reveal.png")
            b = await page.locator(".fdb_tag").bounding_box()
            await page.mouse.move(b["x"] + 3, b["y"] + 3)
            await page.mouse.click(b["x"] + 3, b["y"] + 3)
            await page.keyboard.press("ArrowUp")
            await page.wait_for_timeout(250)
            await shot(page, "10-allow-confirm.png")
            await page.keyboard.press("Escape")

            # 8. 설정 페이지
            opts = await ctx.new_page()
            await opts.set_viewport_size({"width": 860, "height": 900})
            await opts.goto(sw.url.replace("src/background.js", "options/options.html"))
            await opts.wait_for_timeout(600)
            await shot(opts, "08-options.png", full_page=True)


asyncio.run(main())
