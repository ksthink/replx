"""완성된 무음 영상(out/video-only.mp4)에 배경음악과 효과음을 장면 타이밍에 맞춰 입힙니다.

필요한 파일(같은 폴더, 기본 video/audio/):
  music.mp3   배경음악(30초)
  pop.mp3     말풍선이 튀어나올 때
  strike.mp3  말풍선을 빨간 줄로 지울 때
  chime.mp3   로고·엔딩 등장
  click.mp3   커서 클릭
  swoosh.mp3  장면 전환·영역이 접힐 때
  blip.mp3    숫자 배지·저장 알림

실행: python video/mix.py [--audio-dir 폴더]   →  video/out/replx-intro-sound.mp4
영상은 다시 인코딩하지 않고(-c:v copy) 소리만 붙입니다.
"""
import argparse
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
DURATION = 30.0

# (소리, 시각(초), 볼륨) — 시각은 scenes.js의 타임라인과 맞춘 값
CUES = []
CUES += [("pop", 0.05 + i * 0.035, 0.32) for i in range(0, 20, 2)]           # 말풍선 튀어나옴
CUES += [("strike", t, 0.5) for t in (1.15, 1.32, 1.5)]                       # 빨간 줄로 지움
CUES += [("swoosh", 1.7, 0.45), ("chime", 1.9, 0.7)]                          # 흩어짐, 로고
CUES += [("swoosh", 3.1, 0.5)]                                               # 기기 등장
CUES += [("swoosh", 4.8, 0.3), ("blip", 5.8, 0.5)]                            # 자동 숨김, 배지
CUES += [("swoosh", 9.0, 0.3), ("click", 11.0, 0.9), ("swoosh", 11.4, 0.3), ("blip", 11.6, 0.5)]   # 숨길 영역
CUES += [("swoosh", 15.0, 0.3), ("click", 17.2, 0.9), ("blip", 17.5, 0.5), ("swoosh", 18.6, 0.3)]  # 제외할 영역
CUES += [("click", 22.5, 0.9), ("swoosh", 23.6, 0.4), ("click", 25.35, 0.9), ("blip", 25.45, 0.5)]  # 접어두기·규칙
CUES += [("swoosh", 26.05, 0.45), ("chime", 26.3, 0.75)]                      # 엔딩


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio-dir", default=str(HERE / "audio"))
    ap.add_argument("--music-volume", type=float, default=0.55)
    args = ap.parse_args()
    adir = Path(args.audio_dir)
    video = OUT / "video-only.mp4"
    if not video.exists():
        raise SystemExit("먼저 python video/render.py 로 영상을 만드세요.")

    names = sorted({c[0] for c in CUES})
    inputs = ["-i", str(video), "-i", str(adir / "music.mp3")]
    idx = {}
    for n in names:
        idx[n] = len(inputs) // 2
        inputs += ["-i", str(adir / f"{n}.mp3")]

    # 효과음은 같은 파일을 여러 번 쓰므로 asplit으로 나눈 뒤 각자 지연·볼륨을 줍니다.
    counts = {n: sum(1 for c in CUES if c[0] == n) for n in names}
    parts = [f"[1:a]volume={args.music_volume},afade=t=in:st=0:d=0.4,afade=t=out:st={DURATION - 1.6}:d=1.6,"
             f"atrim=0:{DURATION},aresample=48000[music]"]
    for n in names:
        outs = "".join(f"[{n}{k}]" for k in range(counts[n]))
        parts.append(f"[{idx[n]}:a]aresample=48000,asplit={counts[n]}{outs}" if counts[n] > 1 else f"[{idx[n]}:a]aresample=48000{outs}")
    used = {n: 0 for n in names}
    labels = ["[music]"]
    for i, (n, t, vol) in enumerate(CUES):
        k = used[n]
        used[n] += 1
        ms = int(t * 1000)
        parts.append(f"[{n}{k}]volume={vol},adelay={ms}|{ms}[c{i}]")
        labels.append(f"[c{i}]")
    parts.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=first,alimiter=limit=0.95,atrim=0:{DURATION}[mix]")

    final = OUT / "replx-intro-sound.mp4"
    tmp = OUT / "replx-intro-sound.tmp.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(parts),
           "-map", "0:v", "-map", "[mix]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(tmp)]
    subprocess.run(cmd, check=True)
    tmp.rename(final)
    print("done:", final.relative_to(HERE.parent))


main()
