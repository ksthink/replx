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
            sel = await page.locator("chh-picker .sel").text_content()
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

            check("no page errors", not errors, str(errors[:3]))

    if failures:
        print(f"\n{len(failures)}개 실패: {failures}")
        sys.exit(1)
    print("\n모든 테스트 통과")


asyncio.run(main())
