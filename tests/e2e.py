"""확장을 실제 크롬에 올려 탐지·직접 지정·접기 동작을 검증합니다.  실행: python tests/e2e.py"""
import asyncio
import sys

from playwright.async_api import async_playwright

from harness import BASE, extension_browser, get_rules, is_hidden, send_to_active_tab, set_rules

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
            stored = await get_rules(sw, "hide", "localhost")
            check("picker stored", stored == ["div.zz"], str(stored))
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
            allow = await get_rules(sw, "allow", "localhost")
            check("allow: stored", "#cmtArea" in allow, str(allow))
            check("allow: stays visible", await is_hidden(page, "#cmtArea") is False)
            check("allow: toast shown", await page.locator("chh-toast").count() == 1)
            await page.locator("chh-toast button").click()
            await page.wait_for_timeout(1500)
            allow = await get_rules(sw, "allow", "localhost")
            check("allow: undo removes rule", "#cmtArea" not in allow, str(allow))
            check("allow: hidden again after undo", await is_hidden(page, "#cmtArea") is True)

            # 제외 규칙이 숨김 규칙의 바깥(조상)도 막는지, 잘못된 선택자가 섞여도 나머지가 동작하는지
            # (동기화로 들어온 값이 깨져 있는 경우를 흉내 내려고 저장소에 직접 넣음)
            await set_rules(sw, "hide", "localhost", ["div.zz", "div[", ".other"])
            await set_rules(sw, "allow", "localhost", ["section.q7z", "div[", ".yy"])
            await page.goto(BASE + "picker.html")
            await page.wait_for_timeout(1200)
            got = {s: await is_hidden(page, s) for s in (".zz", ".yy", ".other")}
            check("allow: guards ancestor + invalid selectors ignored", got == {".zz": False, ".yy": False, ".other": True}, str(got))
            await set_rules(sw, "hide", "localhost", [])
            await set_rules(sw, "allow", "localhost", ["section.q7z"])

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

            # 사이트 저장 공간(8KB)이 차면 저장하지 않고 오류 알림을 보여 줌(되돌리기 버튼 없음)
            await set_rules(sw, "hide", "localhost", [f".filler-{i}-" + "x" * 170 for i in range(42)])
            await page.goto(BASE + "demo-picker.html")
            await page.wait_for_timeout(1200)
            await send_to_active_tab(sw, {"type": "startPicker", "mode": "hide"})
            await page.wait_for_timeout(300)
            box = await page.locator(".other").bounding_box()
            await page.mouse.move(box["x"] + 5, box["y"] + 5)
            await page.mouse.click(box["x"] + 5, box["y"] + 5)
            await page.locator("chh-picker input.sel").fill(".other" + ":not(.never)" * 30)
            await page.locator("chh-picker input.sel").press("Enter")
            await page.wait_for_timeout(1200)
            text = await page.locator("chh-toast span").text_content()
            check("quota: error toast", "저장하지 못했어요" in text and "8KB" in text, text)
            check("quota: no undo on error", await page.locator("chh-toast button").count() == 0)
            check("quota: nothing saved", len(await get_rules(sw, "hide", "localhost")) == 42)
            check("quota: page unchanged", await is_hidden(page, ".other") is False)
            await set_rules(sw, "hide", "localhost", [])

            # 예전 형식(userRules 한 항목)은 자동으로 사이트별 항목으로 옮겨지고 그대로 적용됨
            await sw.evaluate("() => chrome.storage.sync.set({ userRules: { localhost: ['.other'] }, userAllow: { 'example.org': ['.keep'] } })")
            await page.goto(BASE + "demo-picker.html")
            await page.wait_for_timeout(1500)
            check("legacy: still applied", await is_hidden(page, ".other") is True)
            legacy = await sw.evaluate("() => chrome.storage.sync.get(['userRules', 'userAllow'])")
            check("legacy: migrated", legacy == {} and await get_rules(sw, "hide", "localhost") == [".other"]
                  and await get_rules(sw, "allow", "example.org") == [".keep"], str(legacy))
            await set_rules(sw, "hide", "localhost", [])
            await set_rules(sw, "allow", "example.org", [])

            # 제외·차단 목록 창: CSV 가져오기(주소 정리, 잘못된 줄 건너뛰기)
            rules_page = await ctx.new_page()
            await rules_page.goto(sw.url.replace("src/background.js", "popup/rules.html"))
            await rules_page.wait_for_timeout(500)
            csv = "type,site,selector\nblock,https://News.Example.com:8080/a/b,.c1\nallow,news.example.com,\"div.a, div.b\"\nblock,ok.com,div[\nfoo,ok.com,.x\n"
            await rules_page.locator("#csvFile").set_input_files(files=[{"name": "r.csv", "mimeType": "text/csv", "buffer": csv.encode()}])
            await rules_page.wait_for_timeout(800)
            msg_text = await rules_page.locator("#msg").text_content()
            got = (await get_rules(sw, "hide", "news.example.com"), await get_rules(sw, "allow", "news.example.com"), await get_rules(sw, "hide", "ok.com"))
            check("csv import", got == ([".c1"], ["div.a, div.b"], []) and "2개 추가" in msg_text and "2개 건너뜀" in msg_text, f"{got} {msg_text}")
            allow_rows = await rules_page.locator("#allowBody td.site").all_text_contents()
            check("csv table", await rules_page.locator("#blockBody tr").count() == 1 and "news.example.com" in allow_rows, str(allow_rows))
            await rules_page.locator("#blockBody button.del").click()
            await rules_page.wait_for_timeout(500)
            check("csv delete", await get_rules(sw, "hide", "news.example.com") == [] and await rules_page.locator("#blockBody tr").count() == 0)
            await rules_page.close()

            # 팝업: activeTab 권한 없이도 현재 사이트와 숨긴 개수를 보여 줌
            await page.goto(BASE + "community.html")
            await page.wait_for_timeout(1500)
            popup = await ctx.new_page()
            await popup.add_init_script("""
              const _q = chrome.tabs.query.bind(chrome.tabs);
              chrome.tabs.query = async () => {
                const me = await chrome.tabs.getCurrent();
                const t = (await _q({})).filter((x) => x.id !== me.id).slice(-1);
                window.__seenUrl = t[0] && t[0].url;
                return t;
              };""")
            await popup.goto(sw.url.replace("src/background.js", "popup/popup.html"))
            await popup.wait_for_timeout(800)
            host = await popup.locator("#host").text_content()
            status = await popup.locator("#status").text_content()
            seen = await popup.evaluate("window.__seenUrl")
            check("popup without activeTab", host == "localhost" and "숨겼어요" in status and not (await popup.locator("#pick").is_disabled()),
                  f"host={host} status={status} tab.url={seen!r}")
            await popup.close()

            check("no page errors", not errors, str(errors[:3]))

    if failures:
        print(f"\n{len(failures)}개 실패: {failures}")
        sys.exit(1)
    print("\n모든 테스트 통과")


asyncio.run(main())
