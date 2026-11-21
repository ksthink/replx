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


def prepare_extension() -> Path:
    """확장을 임시 폴더에 복사하고, 테스트 도구가 피커·알림 안을 볼 수 있게 셰도 DOM만 open으로 바꿉니다.
    배포되는 확장은 closed 그대로입니다."""
    dst = Path(tempfile.mkdtemp(prefix="replx-ext-")) / "extension"
    shutil.copytree(EXT, dst)
    changed = 0
    for js in (dst / "src").glob("*.js"):
        text = js.read_text(encoding="utf-8")
        n = text.count("mode: 'closed'")
        if n:
            js.write_text(text.replace("mode: 'closed'", "mode: 'open'"), encoding="utf-8")
            changed += n
    if changed < 3:
        raise RuntimeError(f"셰도 DOM 치환 개수가 예상과 달라요({changed}). picker/content의 attachShadow를 확인하세요.")
    return dst


@asynccontextmanager
async def extension_browser(playwright, **ctx_kwargs):
    srv = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "-d", str(FIXTURES)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    time.sleep(0.8)
    profile = tempfile.mkdtemp(prefix="replx-")
    ext = prepare_extension()
    launch = dict(
        headless=True,
        args=[f"--disable-extensions-except={ext}", f"--load-extension={ext}", "--no-sandbox"],
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
        shutil.rmtree(ext.parent, ignore_errors=True)


async def send_to_active_tab(sw, msg: dict):
    await sw.evaluate(
        "async (m) => { const [t] = await chrome.tabs.query({ active: true }); await chrome.tabs.sendMessage(t.id, m); }",
        msg,
    )


async def is_hidden(page_or_frame, selector: str):
    return await page_or_frame.evaluate(
        "s => { const e = document.querySelector(s); return e ? !e.checkVisibility() : 'missing'; }", selector
    )


async def get_rules(sw, mode: str, host: str):
    """저장된 규칙 목록. mode: 'hide' 또는 'allow' (사이트별 항목 uh:/ua:)"""
    key = ("uh:" if mode == "hide" else "ua:") + host
    data = await sw.evaluate("k => chrome.storage.sync.get(k)", key)
    return data.get(key, [])


async def set_rules(sw, mode: str, host: str, selectors: list):
    key = ("uh:" if mode == "hide" else "ua:") + host
    if selectors:
        await sw.evaluate("([k, v]) => chrome.storage.sync.set({ [k]: v })", [key, selectors])
    else:
        await sw.evaluate("k => chrome.storage.sync.remove(k)", key)
