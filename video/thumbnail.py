"""유튜브 섬네일(1280×720 PNG)을 video/out/에 만듭니다.  실행: python video/thumbnail.py
C안은 video/out/thumb-photo.jpg(인물 사진, 인물은 오른쪽)를 배경으로 씁니다."""
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
        for v in ("a", "b", "c"):
            await page.goto((HERE / "thumbnail.html").as_uri() + f"?v={v}")
            await page.evaluate("window.ready")
            await page.wait_for_load_state("networkidle")
            path = OUT / f"thumbnail-{v}.png"
            await page.screenshot(path=str(path))
            print("saved", path.relative_to(HERE.parent), f"{path.stat().st_size // 1024}KB")
        await browser.close()


asyncio.run(main())
