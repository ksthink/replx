"""확장을 실제 크롬에 올려 탐지·직접 지정·접기 동작을 검증합니다.  실행: python tests/e2e.py"""
import asyncio
import sys

from playwright.async_api import async_playwright

from harness import BASE, extension_browser, is_hidden, send_to_active_tab

failures = []


def check(name, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")
    if not ok:
        failures.append(name)


async def expect_page(page, url, expects, wait=1800):
    await page.goto(BASE + url)
    await page.wait_for_timeout(wait)
    got = {s: await is_hidden(page, s) for s in expects}
    check(url, got == expects, str(got))


async def main():
    async with async_playwright() as p:
        async with extension_browser(p) as (ctx, sw):
            page = await ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))

            # 자동 탐지
            await expect_page(page, "community.html", {"#cmtArea": True, "h1": False, ".rd_body": False, ".reply_num": True, "#gnb": False})
            await expect_page(page, "demo-community.html", {".fdb_lst_wrp": True, "h1": False, ".rd_body": False, ".reply_num": True})
            await expect_page(page, "obfuscated.html", {"section.q7z": True, "article": False})
            await expect_page(page, "news.html", {"article": False, ".quotes": False, ".related": False, "pre": False, ".share": False})
            await expect_page(page, "dynamic.html", {".comments": True, "h1": False}, wait=3500)
            await expect_page(page, "demo-picker.html", {".zz": False, ".other": False})
            # 다음 뉴스 구조: 규칙(v.daum.net 아님, localhost)이 없으니 자동 탐지가 댓글만 골라야 함
            await expect_page(page, "daum-like.html", {".comment_view": True, ".article_view": False, ".tit_view": False, ".main-content": False}, wait=3000)

            # iframe 안의 댓글
            await page.goto(BASE + "cafe.html")
            await page.wait_for_timeout(2000)
            fr = page.frame_locator("#cafe_main")
            c = await fr.locator(".CommentBox").evaluate("e => !e.checkVisibility()")
            t = await fr.locator(".title_text").evaluate("e => !e.checkVisibility()")
            check("iframe", c and not t, f"comment={c} title={t}")

            # 직접 지정(피커)
            await page.goto(BASE + "picker.html")
            await page.wait_for_timeout(1000)
            await send_to_active_tab(sw, {"type": "startPicker"})
            await page.wait_for_timeout(300)
            box = await page.locator(".yy p").first.bounding_box()
            await page.mouse.move(box["x"] + 5, box["y"] + 5)
            await page.mouse.click(box["x"] + 5, box["y"] + 5)
            await page.keyboard.press("ArrowUp")
            await page.keyboard.press("ArrowUp")
            await page.wait_for_timeout(150)
            sel = await page.locator("chh-picker input.sel").input_value()
            check("picker selector", sel == "div.zz", sel)
            await page.locator("chh-picker button[data-a=save]").click()
            await page.wait_for_timeout(1500)
            stored = await sw.evaluate("() => chrome.storage.sync.get('userRules')")
            check("picker stored", stored.get("userRules", {}).get("localhost") == ["div.zz"], str(stored))
            got = {s: await is_hidden(page, s) for s in (".zz", ".other", "h1")}
            check("picker hides", got == {".zz": True, ".other": False, "h1": False}, str(got))
            check("picker closed", await page.locator("chh-picker").count() == 0)
            await page.reload()
            await page.wait_for_timeout(1000)
            check("picker persists", await is_hidden(page, ".zz") is True)

            # 접어두기 + "댓글 아님"
            await sw.evaluate("() => chrome.storage.sync.set({ mode: 'collapse' })")
            await page.goto(BASE + "obfuscated.html")
            await page.wait_for_timeout(1800)
            check("collapse placeholder", await page.locator("chh-ph").count() == 1)
            await page.locator("chh-ph button[data-a=show]").click()
            await page.wait_for_timeout(200)
            check("collapse show", await is_hidden(page, "section.q7z") is False)
            await page.locator("chh-ph button[data-a=notc]").click()
            await page.wait_for_timeout(1200)
            await page.reload()
            await page.wait_for_timeout(1800)
            check("not-comment exception", await is_hidden(page, "section.q7z") is False and await page.locator("chh-ph").count() == 0)

            # 잠깐 보기
            await sw.evaluate("() => chrome.storage.sync.set({ mode: 'hide' })")
            await page.goto(BASE + "community.html")
            await page.wait_for_timeout(1500)
            await send_to_active_tab(sw, {"type": "toggleShow"})
            await page.wait_for_timeout(300)
            check("peek", await is_hidden(page, "#cmtArea") is False)

            # 제외 피커: 자동 탐지로 숨겨진 #cmtArea를 드러내 클릭해 제외
            await page.goto(BASE + "community.html")
            await page.wait_for_timeout(1500)
            check("allow: hidden before", await is_hidden(page, "#cmtArea") is True)
            await send_to_active_tab(sw, {"type": "startPicker", "mode": "allow"})
            await page.wait_for_timeout(300)
            check("allow: revealed while picking", await is_hidden(page, "#cmtArea") is False)
            box = await page.locator(".fdb_tag").bounding_box()
            await page.mouse.move(box["x"] + 3, box["y"] + 3)
            await page.mouse.click(box["x"] + 3, box["y"] + 3)
            await page.keyboard.press("ArrowUp")
            await page.wait_for_timeout(150)
            sel = await page.locator("chh-picker input.sel").input_value()
            check("allow: selector", sel == "#cmtArea", sel)
            await page.keyboard.press("Enter")
            await page.wait_for_timeout(1500)
            allow = (await sw.evaluate("() => chrome.storage.sync.get('userAllow')"))["userAllow"].get("localhost", [])
            check("allow: stored", "#cmtArea" in allow, str(allow))
            check("allow: stays visible", await is_hidden(page, "#cmtArea") is False)
            check("allow: toast shown", await page.locator("chh-toast").count() == 1)
            await page.locator("chh-toast button").click()
            await page.wait_for_timeout(1500)
            allow = (await sw.evaluate("() => chrome.storage.sync.get('userAllow')"))["userAllow"].get("localhost", [])
            check("allow: undo removes rule", "#cmtArea" not in allow, str(allow))
            check("allow: hidden again after undo", await is_hidden(page, "#cmtArea") is True)

            # 제외 규칙이 숨김 규칙의 바깥(조상)도 막는지, 잘못된 선택자가 섞여도 나머지가 동작하는지
            await sw.evaluate("""() => chrome.storage.sync.set({
                userRules: { localhost: ['div.zz', 'div[', '.other'] },
                userAllow: { localhost: ['section.q7z', 'div[', '.yy'] } })""")
            await page.goto(BASE + "picker.html")
            await page.wait_for_timeout(1200)
            got = {s: await is_hidden(page, s) for s in (".zz", ".yy", ".other")}
            check("allow: guards ancestor + invalid selectors ignored", got == {".zz": False, ".yy": False, ".other": True}, str(got))
            await sw.evaluate("() => chrome.storage.sync.set({ userRules: {}, userAllow: { localhost: ['section.q7z'] } })")

            # 숨김 피커에서 선택자 직접 편집
            await page.goto(BASE + "demo-picker.html")
            await page.wait_for_timeout(1200)
            await send_to_active_tab(sw, {"type": "startPicker", "mode": "hide"})
            await page.wait_for_timeout(300)
            box = await page.locator(".yy p").first.bounding_box()
            await page.mouse.move(box["x"] + 5, box["y"] + 5)
            await page.mouse.click(box["x"] + 5, box["y"] + 5)
            await page.locator("chh-picker input.sel").fill("div[")
            await page.wait_for_timeout(100)
            check("edit: invalid disables save", await page.locator("chh-picker button[data-a=save]").is_disabled())
            await page.locator("chh-picker input.sel").fill(".yy p:nth-of-type(2)")
            await page.wait_for_timeout(100)
            info = await page.locator("chh-picker .info").text_content()
            check("edit: live count", "1곳" in info, info)
            await page.locator("chh-picker input.sel").press("Enter")
            await page.wait_for_timeout(1500)
            got = [await page.locator(".yy p").nth(i).evaluate("e => !e.checkVisibility()") for i in range(3)]
            check("edit: only edited target hidden", got == [False, True, False], str(got))

            check("no page errors", not errors, str(errors[:3]))

    if failures:
        print(f"\n{len(failures)}개 실패: {failures}")
        sys.exit(1)
    print("\n모든 테스트 통과")


asyncio.run(main())
