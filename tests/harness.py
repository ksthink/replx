"""테스트·스크린샷 공용 도우미: 픽스처 서버와 확장이 로드된 크롬을 띄웁니다."""
import os
import shutil
import subprocess
import sys
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "extension"
FIXTURES = ROOT / "tests" / "fixtures"
PORT = int(os.environ.get("REPLX_TEST_PORT", "8765"))
BASE = f"http://localhost:{PORT}/"


@asynccontextmanager
async def extension_browser(playwright, **ctx_kwargs):
    srv = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "-d", str(FIXTURES)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(0.8)
    profile = tempfile.mkdtemp(prefix="replx-")
    launch = dict(
        headless=True,
        args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}", "--no-sandbox"],
        **ctx_kwargs,
    )
    # CHROME_PATH가 있으면 그 크롬을, 없으면 Playwright의 Chromium(확장 지원)을 씁니다.
    if os.environ.get("CHROME_PATH"):
        launch["executable_path"] = os.environ["CHROME_PATH"]
    else:
        launch["channel"] = "chromium"
    ctx = await playwright.chromium.launch_persistent_context(profile, **launch)
    try:
        sw = ctx.service_workers[0] if ctx.service_workers else await ctx.wait_for_event("serviceworker", timeout=15000)
        yield ctx, sw
    finally:
        await ctx.close()
        srv.terminate()
        shutil.rmtree(profile, ignore_errors=True)


async def send_to_active_tab(sw, msg: dict):
    await sw.evaluate(
        "async (m) => { const [t] = await chrome.tabs.query({ active: true }); await chrome.tabs.sendMessage(t.id, m); }",
        msg,
    )


async def is_hidden(page_or_frame, selector: str):
    return await page_or_frame.evaluate(
        "s => { const e = document.querySelector(s); return e ? !e.checkVisibility() : 'missing'; }", selector
    )
