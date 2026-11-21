"""video/index.html을 1920×1080, 30fps MP4로 렌더링합니다.

사용법
  pip install playwright && python -m playwright install chromium   (ffmpeg 필요)
  python video/render.py                  # 전체 영상 → video/out/replx-intro.mp4
  python video/render.py --frames 2 6.5   # 지정한 시각(초)만 JPEG로 → video/out/frame-*.jpg
  python video/render.py --audio bgm.mp3  # 배경 음악을 입혀 만들기(없으면 무음 트랙)

장면마다 MP4를 따로 만든 뒤(-c copy로) 이어 붙이고, 마지막에 소리를 붙입니다.
CHROME_PATH 환경 변수가 있으면 그 크롬을 씁니다.
"""
import argparse
import asyncio
import os
import subprocess
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
FPS = 30
W, H = 1920, 1080
ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS)]


async def open_page(p):
    launch = {"executable_path": os.environ["CHROME_PATH"]} if os.environ.get("CHROME_PATH") else {}
    browser = await p.chromium.launch(**launch)
    page = await browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    await page.goto((HERE / "index.html").as_uri())
    await page.evaluate("window.ready")
    return browser, page


async def shot(page, t):
    await page.evaluate("t => render(t)", t)
    return await page.screenshot(type="jpeg", quality=92)


async def render_scene(page, name, start, end):
    final = OUT / f"scene-{name}.mp4"
    tmp = OUT / f"scene-{name}.tmp.mp4"
    n = round((end - start) * FPS)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-", *ENC, str(tmp)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        proc.stdin.write(await shot(page, start + i / FPS))
    proc.stdin.close()
    if proc.wait() != 0:
        raise SystemExit(f"ffmpeg 실패: {name}")
    tmp.rename(final)
    print(f"scene {name}: {n} frames")
    return final


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", nargs="*", type=float)
    ap.add_argument("--audio")
    args = ap.parse_args()
    OUT.mkdir(exist_ok=True)

    async with async_playwright() as p:
        browser, page = await open_page(p)
        if args.frames:
            for t in args.frames:
                path = OUT / f"frame-{t:05.2f}.jpg"
                path.write_bytes(await shot(page, t))
                print("saved", path.relative_to(HERE.parent))
            await browser.close()
            return
        scenes = await page.evaluate("window.SCENES")
        files = [await render_scene(page, name, a, b) for name, a, b in scenes]
        await browser.close()

    listing = OUT / "scenes.txt"
    listing.write_text("".join(f"file '{f.name}'\n" for f in files))
    silent = OUT / "video-only.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(silent)], check=True)

    final = OUT / "replx-intro.mp4"
    tmp = OUT / "replx-intro.tmp.mp4"
    if args.audio:
        audio = ["-i", args.audio, "-map", "0:v", "-map", "1:a", "-af", "afade=t=out:st=28.5:d=1.5"]
    else:  # 무음 트랙(일부 플랫폼은 소리 트랙이 있어야 안정적으로 처리)
        audio = ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-map", "0:v", "-map", "1:a"]
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(silent), *audio, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", "-movflags", "+faststart", str(tmp)], check=True)
    tmp.rename(final)
    print("done:", final.relative_to(HERE.parent))


asyncio.run(main())
