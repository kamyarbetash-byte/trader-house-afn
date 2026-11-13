# "Our ancestors" ep. 4 (al-Biruni): Dari subtitles, gold fact labels, series title, "to be continued", channel name and
# the series outro ("kaka, the next story is on its way"), burned onto the rendered picture with the mix.
# usage: python3 ajdad-ep2/subs/make_final.py <video.mp4> <out.mp4>
import json, subprocess, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
G = os.path.dirname(HERE)
src, dst = sys.argv[1], sys.argv[2]
TIM = json.load(open(f"{G}/voice/timing.json"))
MAIN = round(TIM["total"] * 30) / 30
OUTRO = 7.0
TOTAL = MAIN + OUTRO
VO_AT = MAIN + 0.5          # outro voice start



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
POEM = set()
for l in TIM["lines"]:
    a, b, text = l["s"], l["e"], l["text"]
    st_ = "Poem" if l["n"] in POEM else "Sub"
    parts = chunks(text)
    w = [len(p) + 4 for p in parts]
    t = a
    for p, k in zip(parts, w):
        d = (b - a) * k / sum(w)
        ev.append((st_, t, t + d, r"{\fad(60,60)}" + p))
        t += d

# name at top, whole video
ev.append(("Name", 0, TOTAL, r"{\fad(400,0)}عمران راهبر"))
# outro card text
o = MAIN
ev.append(("Big", o + 0.3, TOTAL, r"{\fad(250,0)\t(0,250,\fscx100\fscy100)\fscx70\fscy70}دوست عزیز، قصهٔ بعدی ده راه اس!"))
ev.append(("Mid", o + 2.2, TOTAL, r"{\fad(300,0)}پیج ره فالو کو که جا نمانی"))
ev.append(("Btn", o + 3.0, TOTAL, r"{\fad(200,0)\t(0,200,\fscx100\fscy100)\fscx60\fscy60}  فالو کو!  "))
# series title at the start, "to be continued" at the end of the story
ev.append(("Title", 0.2, 4.6, r"{\fad(300,400)\pos(540,700)}اجداد ما چه کسانی بودند؟"))
ev.append(("Ep", 0.7, 4.6, r"{\fad(300,400)\pos(540,850)}قسمت ۴ — یک کوه و یک عقل"))
ev.append(("Title", MAIN - 1.6, MAIN, r"{\fad(300,0)\pos(540,700)}ادامه دارد…"))
ev.append(("Ep", MAIN - 1.3, MAIN, r"{\fad(300,0)\pos(540,850)}قسمت ۵: شاهزادهٔ شاعرِ بلخ"))
# gold fact labels over the story
POP = r"{\fad(150,250)\t(0,180,\fscx100\fscy100)\fscx70\fscy70\pos(540,560)}"
for a, b, txt in [(25.6, 28.1, "ابوریحان بیرونی"), (29.0, 33.4, "غزنی — دربار سلطان محمود"), (36.3, 40.6, "بغداد، سدهٔ نهم"),
                  (53.0, 56.8, "قلعهٔ نندنه"), (79.6, 82.7, "شعاع زمین: \u200f۶۳۴۰ کیلومتر"), (84.4, 87.4, "امروز: \u200f۶۳۷۱ کیلومتر"),
                  (87.5, 89.8, "فرق: کمتر از \u200f۱٪")]:
    ev.append(("Lab", a, b, POP + (r"{\fs86}" if len(txt) > 14 else "") + txt))

ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Vazirmatn ExtraBold,104,&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,6,2,2,70,70,440,-1
Style: Poem,Vazirmatn ExtraBold,100,&H0045C8FF,&H0045C8FF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,6,2,2,70,70,440,-1
Style: Title,Vazirmatn Black,104,&H0045C8FF,&H0045C8FF,&H00101010,&HA0000000,0,0,0,0,100,100,0,0,1,8,4,5,40,40,0,-1
Style: Ep,Vazirmatn ExtraBold,70,&H00FFFFFF,&H00FFFFFF,&H00101010,&HA0000000,0,0,0,0,100,100,0,0,1,6,3,5,40,40,0,-1
Style: Name,Vazirmatn Black,80,&H0045C8FF,&H0045C8FF,&H70000000,&H00000000,0,0,0,0,100,100,0,0,3,16,0,8,60,60,110,-1
Style: Big,Vazirmatn Black,118,&H0045C8FF,&H0045C8FF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,7,3,5,60,60,0,-1
Style: Mid,Vazirmatn ExtraBold,96,&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,5,2,5,60,60,0,-1
Style: Lab,Vazirmatn Black,120,&H0045C8FF,&H0045C8FF,&H00101010,&HA0000000,0,0,0,0,100,100,0,0,1,9,4,5,40,40,0,-1
Style: Btn,Vazirmatn Black,140,&H00FFFFFF,&H00FFFFFF,&H002A2ADC,&H00000000,0,0,0,0,100,100,0,0,3,26,0,5,60,60,0,-1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
pos = {"Big": r"{\pos(540,820)}", "Mid": r"{\pos(540,1000)}", "Btn": r"{\pos(540,1180)}"}
for st, a, b, txt in ev:
    ass += f"Dialogue: 0,{ts(a)},{ts(b)},{st},,0,0,0,,{pos.get(st, '')}{txt}\n"
assf = f"{HERE}/ajdad4.ass"
open(assf, "w", encoding="utf-8").write(ass)
if os.environ.get("ASS_ONLY"): sys.exit(0)

fonts = f"{G}/../gold-short/fonts"
music = f"{G}/audio/stem_music.wav"
vo = f"{G}/voice/t20.wav"
mix = f"{G}/audio/mix.wav"
fc = (
    # outro background: last frame, blurred and darkened
    f"[0:v]trim=start={MAIN-0.04},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={OUTRO},"
    f"trim=duration={OUTRO},gblur=sigma=18,eq=brightness=-0.18:saturation=0.8,setpts=PTS-STARTPTS[ob];"
    f"[0:v]trim=duration={MAIN},setpts=PTS-STARTPTS[mv];"
    f"[mv][ob]concat=n=2:v=1:a=0,fps=30,ass='{assf}':fontsdir='{fonts}'[v];"
    # audio: main mix, then a soft music bed from the opening + outro voice
    f"[3:a]atrim=duration={MAIN},asetpts=PTS-STARTPTS[ma];"
    f"[1:a]atrim=start=108.3:duration={OUTRO},asetpts=PTS-STARTPTS,volume=0.55,afade=t=in:d=0.6,afade=t=out:st={OUTRO-1.6}:d=1.6[bed];"
    f"[2:a]aresample=48000,volume=1.6,asetpts=PTS-STARTPTS,adelay={int((VO_AT-MAIN)*1000)}:all=1,apad=whole_dur={OUTRO}[ov];"
    f"[bed][ov]amix=inputs=2:normalize=0,atrim=duration={OUTRO}[oa];"
    f"[ma][oa]concat=n=2:v=0:a=1,aresample=48000[a]"
)
cmd = ["ffmpeg", "-v", "error", "-y", "-i", src, "-i", music, "-i", vo, "-i", mix,
       "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
       "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dst]
subprocess.run(cmd, check=True)
print("wrote", dst)
