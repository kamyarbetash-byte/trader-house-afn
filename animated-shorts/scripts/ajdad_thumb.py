import os
# usage: ajdad_thumb.py frame.png out.png ep "line1" "line2" zoom cy "hero name"
import sys, subprocess, numpy as np
from PIL import Image, ImageEnhance
src, out, ep, l1, l2 = sys.argv[1:6]
zoom = float(sys.argv[6]) if len(sys.argv) > 6 else 1.0
cy = float(sys.argv[7]) if len(sys.argv) > 7 else 0.5
hero = sys.argv[8] if len(sys.argv) > 8 else ""
im = Image.open(src).convert("RGB")
W, H = im.size
cw, ch = W / zoom, H / zoom
y0 = min(max(cy * H - ch / 2, 0), H - ch); x0 = (W - cw) / 2
im = im.crop((int(x0), int(y0), int(x0 + cw), int(y0 + ch))).resize((1080, 1920), Image.LANCZOS)
im = ImageEnhance.Color(im).enhance(1.25); im = ImageEnhance.Contrast(im).enhance(1.08)
a = np.asarray(im).astype(np.float32)
y = np.linspace(0, 1, 1920)[:, None]
dark = np.clip((y * 1920 - 1020) / 560, 0, 1) * 0.86 + np.clip((430 - y * 1920) / 430, 0, 1) * 0.6
xs = np.linspace(-1, 1, 1080)[None, :]; ys = np.linspace(-1, 1, 1920)[:, None]
vig = np.clip((xs**2 + ys**2 - 0.55) * 0.35, 0, 0.35)
a *= (1 - np.clip(dark + vig, 0, 0.9))[..., None]
Image.fromarray(a.clip(0, 255).astype(np.uint8)).save("bg.png")
fa = "۰۱۲۳۴۵۶۷۸۹"; epf = "".join(fa[int(c)] for c in ep)
rlm = "‏"
ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Name,Vazirmatn Black,50,&H0045C8FF,&H0045C8FF,&H40100A0A,&H00000000,0,0,0,0,100,100,0,0,3,18,0,5,0,0,0,-1
Style: Ser,Vazirmatn ExtraBold,54,&H00FFFFFF,&H00FFFFFF,&H00101010,&H90000000,0,0,0,0,100,100,0,0,1,5,3,5,0,0,0,-1
Style: H1,Vazirmatn Black,150,&H00FFFFFF,&H00FFFFFF,&H00101010,&H90000000,0,0,0,0,100,100,0,0,1,12,8,5,0,0,0,-1
Style: H2,Vazirmatn Black,172,&H0022D8FF,&H0022D8FF,&H00101010,&H90000000,0,0,0,0,100,100,0,0,1,14,9,5,0,0,0,-1
Style: Hero,Vazirmatn Black,100,&H00141414,&H00141414,&H0022D8FF,&H00000000,0,0,0,0,100,100,0,0,3,20,0,5,0,0,0,-1
Style: Btn,Vazirmatn Black,60,&H00FFFFFF,&H00FFFFFF,&H002A2ADC,&H00000000,0,0,0,0,100,100,0,0,3,22,0,5,0,0,0,-1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Name,,0,0,0,,{{\\pos(540,110)}}عمران راهبر
Dialogue: 0,0:00:00.00,0:00:05.00,Ser,,0,0,0,,{{\\pos(540,300)}}{rlm}اجداد ما چه کسانی بودند؟{rlm}
Dialogue: 0,0:00:00.00,0:00:05.00,H1,,0,0,0,,{{\\pos(540,1395)}}{rlm}{l1}{rlm}
Dialogue: 0,0:00:00.00,0:00:05.00,H2,,0,0,0,,{{\\pos(540,1570)}}{rlm}{l2}{rlm}
Dialogue: 0,0:00:00.00,0:00:05.00,Hero,,0,0,0,,{{\\pos(540,1225)}}{rlm}{hero}{rlm}
Dialogue: 0,0:00:00.00,0:00:05.00,Btn,,0,0,0,,{{\\pos(540,1745)}}قسمت {epf}
"""
open("t.ass", "w").write(ass)
# official channel avatar (brand/avatar_small.png) as a badge left of the channel name
av = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "brand", "avatar_small.png")
AX, AY = int(os.environ.get("AX", 236)), int(os.environ.get("AY", 40))
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "bg.png", "-i", av, "-filter_complex",
                f"[0:v]ass=t.ass:fontsdir=/home/user/trader-house-afn/animated-shorts/gold-short/fonts[b];[b][1:v]overlay={AX}:{AY}",
                "-frames:v", "1", out], check=True)
