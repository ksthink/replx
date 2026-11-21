"""유튜브 섬네일(1280×720 PNG) 두 가지를 video/out/에 만듭니다.  실행: python video/thumbnail.py"""
import asyncio
import os
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"


async def main():
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        launch = {"executable_path": os.environ["CHROME_PATH"]} if os.environ.get("CHROME_PATH") else {}
        browser = await p.chromium.launch(**launch)
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        for v in ("a", "b"):
            await page.goto((HERE / "thumbnail.html").as_uri() + f"?v={v}")
            await page.evaluate("window.ready")
            path = OUT / f"thumbnail-{v}.png"
            await page.screenshot(path=str(path))
            print("saved", path.relative_to(HERE.parent), f"{path.stat().st_size // 1024}KB")
        await browser.close()


asyncio.run(main())
