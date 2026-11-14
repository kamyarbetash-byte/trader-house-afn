# Channel avatar (official profile photo, brand/profile.jpg) cut into a circle with a gold ring,
# for the top-of-video badge and the outro. usage: python3 scripts/brand_avatar.py
from PIL import Image, ImageDraw, ImageFilter
import os
B = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "brand")
src = Image.open(f"{B}/profile.jpg").convert("RGB")
W = src.width
# the photo is already a circle on white: keep 97% of it so no white fringe shows
r0 = int(W * 0.485)
c = W // 2
src = src.crop((c - r0, c - r0, c + r0, c + r0))

def make(size, ring, out):
    S = size * 4                      # supersample for smooth edges
    ph = src.resize((S - 2 * ring * 4, S - 2 * ring * 4), Image.LANCZOS)
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, S - 1, S - 1), fill=(255, 200, 69, 255))           # gold ring (same gold as the titles)
    d.ellipse((ring * 2, ring * 2, S - 1 - ring * 2, S - 1 - ring * 2), fill=(150, 100, 20, 255))
    m = Image.new("L", ph.size, 0)
    ImageDraw.Draw(m).ellipse((0, 0, ph.width - 1, ph.height - 1), fill=255)
    im.paste(ph, (ring * 4, ring * 4), m)
    im = im.resize((size, size), Image.LANCZOS)
    # soft drop shadow
    pad = size // 8
    out_im = Image.new("RGBA", (size + 2 * pad, size + 2 * pad), (0, 0, 0, 0))
    sh = Image.new("L", out_im.size, 0)
    ImageDraw.Draw(sh).ellipse((pad, pad + size // 30, pad + size, pad + size + size // 30), fill=150)
    sh = sh.filter(ImageFilter.GaussianBlur(size / 25))
    out_im.paste((0, 0, 0, 255), (0, 0), sh)
    out_im.alpha_composite(im, (pad, pad))
    out_im.save(f"{B}/{out}")
    print(out, out_im.size)

make(380, 12, "avatar_big.png")
make(112, 5, "avatar_small.png")
