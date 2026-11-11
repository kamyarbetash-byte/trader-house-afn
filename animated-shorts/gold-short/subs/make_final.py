# Dari subtitles + "Imran Rahbar" name + follow outro, burned onto the rendered short.
# usage: python3 gold-short/subs/make_final.py <in.mp4> <out.mp4>
import json, subprocess, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
G = os.path.dirname(HERE)
src, dst = sys.argv[1], sys.argv[2]
MAIN = 92.4
OUTRO = 7.0
TOTAL = MAIN + OUTRO
VO_AT = MAIN + 0.5          # outro voice start

lines = [l.strip() for l in open(f"{G}/voice_dari/lines_fa.txt", encoding="utf-8") if l.strip()]
tm = json.load(open(f"{G}/voice_dari/timemap.json"))["lines"]


def chunks(text, maxc=24):
    out, cur = [], []
    for w in text.split():
        if cur and len(" ".join(cur + [w])) > maxc and not (w.endswith(("،", ":")) and len(w) < 6):
            out.append(" ".join(cur)); cur = [w]
        else:
            cur.append(w)
        if w.endswith(("،", ",", ":")) and len(" ".join(cur)) > 12:
            out.append(" ".join(cur)); cur = []
    if cur: out.append(" ".join(cur))
    # don't leave a lonely single word at the end
    if len(out) > 1 and len(out[-1].split()) == 1:
        last = out.pop(); out[-1] += " " + last
    return out


def ts(t):
    t = max(0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


ev = []
for text, l in zip(lines, tm):
    a, b = l["fa"]
    parts = chunks(text)
    w = [len(p) + 4 for p in parts]
    t = a
    for p, k in zip(parts, w):
        d = (b - a) * k / sum(w)
        ev.append(("Sub", t, t + d + 0.12, r"{\fad(60,60)}" + p))
        t += d

# name at top, whole video
ev.append(("Name", 0, TOTAL, r"{\fad(400,0)}عمران راهبر"))
# outro card text
o = MAIN
ev.append(("Big", o + 0.3, TOTAL, r"{\fad(250,0)\t(0,250,\fscx100\fscy100)\fscx70\fscy70}گپ خو زیاد اس رفیق!"))
ev.append(("Mid", o + 2.0, TOTAL, r"{\fad(300,0)}اگر می‌خواهی ای قسم قصه‌ها بشنوی"))
ev.append(("Btn", o + 3.3, TOTAL, r"{\fad(200,0)\t(0,200,\fscx100\fscy100)\fscx60\fscy60}  پیج مره فالو کو!  "))

ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Vazirmatn ExtraBold,104,&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,6,2,2,70,70,440,1
Style: Name,Vazirmatn Black,80,&H0045C8FF,&H0045C8FF,&H70000000,&H00000000,0,0,0,0,100,100,0,0,3,16,0,8,60,60,110,1
Style: Big,Vazirmatn Black,170,&H0045C8FF,&H0045C8FF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,7,3,5,60,60,0,1
Style: Mid,Vazirmatn ExtraBold,96,&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,5,2,5,60,60,0,1
Style: Btn,Vazirmatn Black,140,&H00FFFFFF,&H00FFFFFF,&H002A2ADC,&H00000000,0,0,0,0,100,100,0,0,3,26,0,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
pos = {"Big": r"{\pos(540,820)}", "Mid": r"{\pos(540,1000)}", "Btn": r"{\pos(540,1180)}"}
for st, a, b, txt in ev:
    ass += f"Dialogue: 0,{ts(a)},{ts(b)},{st},,0,0,0,,{pos.get(st, '')}{txt}\n"
assf = f"{HERE}/gold_fa.ass"
open(assf, "w", encoding="utf-8").write(ass)

fonts = f"{G}/fonts"
music = f"{G}/audio/stem_music_fa.wav"
vo = f"{G}/voice_dari/outro.wav"
fc = (
    # outro background: last frame, blurred and darkened
    f"[0:v]trim=start={MAIN-0.04},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={OUTRO},"
    f"trim=duration={OUTRO},gblur=sigma=18,eq=brightness=-0.18:saturation=0.8,setpts=PTS-STARTPTS[ob];"
    f"[0:v]trim=duration={MAIN},setpts=PTS-STARTPTS[mv];"
    f"[mv][ob]concat=n=2:v=1:a=0,fps=30,ass='{assf}':fontsdir='{fonts}'[v];"
    # audio: main mix, then a soft music bed from the opening + outro voice
    f"[0:a]atrim=duration={MAIN},asetpts=PTS-STARTPTS[ma];"
    f"[1:a]atrim=start=2:duration={OUTRO},asetpts=PTS-STARTPTS,volume=0.55,afade=t=in:d=0.6,afade=t=out:st={OUTRO-1.6}:d=1.6[bed];"
    f"[2:a]atrim=start=0.22,asetpts=PTS-STARTPTS,adelay={int((VO_AT-MAIN)*1000)}:all=1,apad=whole_dur={OUTRO}[ov];"
    f"[bed][ov]amix=inputs=2:normalize=0,atrim=duration={OUTRO}[oa];"
    f"[ma][oa]concat=n=2:v=0:a=1,aresample=48000[a]"
)
cmd = ["ffmpeg", "-v", "error", "-y", "-i", src, "-i", music, "-i", vo,
       "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
       "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dst]
subprocess.run(cmd, check=True)
print("wrote", dst)
