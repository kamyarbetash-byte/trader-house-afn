# Sound for "The Gold That Hid for Fourteen Years": original score + synthesized effects + the narration, mixed to
# mix.wav (48 kHz, exactly the picture length). Everything is own numpy synthesis using the bridge short's DSP kit
# (bridge-short/audio: dsp.py, instruments.py, sfx_gen.py). Picture times mirror src/videos/gold/story.ts + cast.ts.
# Mix rule: music +3 dB, SFX -6 dB against the base balance, voice unchanged. Music ducks ~3 dB under the voice.
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "bridge-short", "audio"))
from dsp import (SR, TAU, ns, tt, rng, lp, hp, bp, peq, shelf, colored, fades, phase, modal, pan, st, place, widen, make_ir,
                 convolve_st, integrated, true_peak, dbg, read_wav, write_wav, norm_to)
import instruments as I
import sfx_gen as G

FPS = 30
TOTAL = 2067
ROOT = os.path.join(HERE, "..")
LANG = os.environ.get("LANG_CUT", "fa")   # "fa": Dari narration on the warped picture; "en": the English cut
fr = lambda f: f / FPS
words = json.load(open(os.path.join(ROOT, "voice", "words.json")))
if LANG == "fa":
    TM = json.load(open(os.path.join(ROOT, "voice_dari", "timemap.json")))
    _A = [(0.0, 0.0)] + [p for l in TM["lines"] for p in ((l["en"][0], l["fa"][0]), (l["en"][1], l["fa"][1]))] + [(TM["en_total"], TM["fa_total"])]
    W = lambda t: float(np.interp(t, [a for a, _ in _A], [b for _, b in _A]))   # story time -> output time
    DUR = round(TM["fa_total"] * FPS) / FPS
else:
    W = lambda t: t
    DUR = TOTAL / FPS
N = ns(DUR)
R = rng(1978)
rr = lambda: rng(int(R.integers(1 << 30)))

# ================================================================ music
BEAT = 60 / 96
D = 50  # D3
HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12]          # D Eb F# G A Bb C D
deg = lambda k, base=62: base + HIJAZ[k % 7] + 12 * (k // 7)
mus = {k: np.zeros((2, N)) for k in ("drone", "rubab", "tabla", "perc", "pad", "bell")}


def put(bus, x, t, g=1.0, p=0.0, warp=True):
    x = np.asarray(x)
    place(mus[bus], pan(x, p) if x.ndim == 1 else x, W(t) if warp else t, g)


def rubab(m, t, vel=0.7, dur=0.9, p=0.15, bright=0.65):
    """plucked lute: pluck + a sympathetic octave shimmer"""
    f = I.m2f(m)
    y = I.pluck(f, vel, rr(), dur, bright, 0.12)
    y[: ns(dur * 0.7)] += 0.18 * I.pluck(2 * f, vel, rr(), dur * 0.7, 0.4, 0.2)[: len(y)]
    put("rubab", y, t, 1.0, p)


def tabla(kind, t, vel=0.7):
    r = rr()
    if kind == "ghe":   # bass stroke with the palm-press pitch bend
        d = 0.5
        y = np.exp(-tt(d) / 0.18) * np.sin(phase(78 * (1 + 0.5 * np.exp(-tt(d) / 0.05)))) + 0.2 * lp(r.standard_normal(ns(d)), 300) * np.exp(-tt(d) / 0.01)
        put("tabla", fades(y * vel, 0.0005, 0.05), t, 1.0, -0.1)
    elif kind == "na":  # rim stroke, ringing harmonic modes of the treble drum
        f0 = 520
        y = modal(0.45, [(f0, 1.0, 0.16), (f0 * 2, 0.6, 0.1), (f0 * 3, 0.35, 0.06), (f0 * 4.02, 0.2, 0.04)], r)
        y += bp(r.standard_normal(ns(0.45)), 2000, 7000, 1) * np.exp(-tt(0.45) / 0.004) * 0.6
        put("tabla", y * vel * 0.55, t, 1.0, 0.15)
    elif kind == "tin":
        y = modal(0.25, [(1040, 1.0, 0.05), (1560, 0.4, 0.03)], r)
        put("tabla", y * vel * 0.35, t, 1.0, 0.2)
    else:  # "ke": dead slap
        y = bp(r.standard_normal(ns(0.08)), 300, 2500, 1) * np.exp(-tt(0.08) / 0.012)
        put("tabla", y * vel * 0.5, t, 1.0, -0.15)


def groove(t0, t1, vel=0.7, sparse=False):
    """a 4-beat theka-like pattern: ghe na tin na | ghe ghe tin na (8th notes)"""
    pat = ["ghe", "na", "tin", "na", "ghe", "ghe", "tin", "na"] if not sparse else ["ghe", None, "na", None, "ghe", None, "tin", None]
    t, i = t0, 0
    while t < t1 - 0.05:
        k = pat[i % 8]
        if k:
            tabla(k, t, vel * (1.0 if i % 4 == 0 else 0.75))
        if not sparse and i % 8 == 7:
            tabla("ke", t + BEAT / 4, vel * 0.6)
        t += BEAT / 2
        i += 1


def drone(t0, t1, notes=(38, 45), vel=0.35, warm=600):
    d = W(t1) - W(t0)
    put("drone", I.pad([I.m2f(n) for n in notes], d, vel, rr(), att=min(1.0, d / 3), rel=0.8, warm=warm, detune=5), W(t0), warp=False)


def padc(t0, t1, notes, vel=0.3, warm=1400, att=0.5):
    put("pad", I.pad([I.m2f(n) for n in notes], W(t1) - W(t0), vel, rr(), att=att, rel=1.0, warm=warm), W(t0), warp=False)


def phrase(t0, notes, step=BEAT / 2, vel=0.7, p=0.15, dur=0.8):
    """notes: scale degrees (int) or None rests; tuples (degree, length in steps)"""
    t = t0
    for n in notes:
        k, L = (n, 1) if not isinstance(n, tuple) else n
        if k is not None:
            rubab(deg(k), t, vel * (0.9 + 0.2 * R.uniform()), dur * L ** 0.5, p)
            if L >= 2:  # tremolo on long notes (rubab style)
                for j in range(1, int(L * 2)):
                    rubab(deg(k), t + j * step / 2, vel * 0.45, 0.25, p)
        t += step * L


def bell(m, t, vel=0.5):
    put("bell", I.glock(I.m2f(m), vel, rr(), 1.8), t, 1.0, 0.25)


def build_music():
    w = lambda s: s  # times in seconds
    # hook (0 - 5.9): mysterious low drone, a few rubab notes, glint bells
    drone(0.0, 6.4, (38, 45), 0.4)
    phrase(0.25, [0, None, 1, None, (2, 2), 1, 0, None, None, (4, 2), 3, (2, 3)], vel=0.55, p=-0.1)
    for tm, m in [(0.35, 86), (1.25, 90), (3.6, 93)]:
        bell(m, tm, 0.3)
    # dig (5.9 - 18.05): bright rubab tune over the groove
    drone(5.8, 18.3, (38, 45, 50), 0.3, 900)
    groove(7.25, 18.0, 0.65)
    tune = [4, 5, (4, 2), 3, 2, (1, 2), 2, 3, (4, 2), (7, 2), 6, 5, (4, 3), None,
            4, 5, 7, 8, (7, 2), 5, 4, 3, 2, (1, 2), (0, 3), None]
    phrase(7.25, tune, vel=0.7)
    phrase(7.25 + len(tune) * 0 + 16 * BEAT / 2 * 2 + 0.0, [None], vel=0.0)
    phrase(12.85, [7, 8, (9, 2), 8, 7, (6, 2), 5, 4, (5, 2), (4, 4)], vel=0.75, p=-0.15)
    for tm in (12.62, 12.72, 12.82):
        bell(86 + int((tm - 12.6) * 40), tm, 0.45)
    # museum (18.05 - 20.5): resolve
    drone(18.0, 20.9, (38, 45, 50), 0.28)
    groove(18.0, 20.45, 0.5, sparse=True)
    phrase(18.07, [(4, 2), 3, 2, (1, 2), (0, 4)], vel=0.6)
    # war (20.5 - 25.2): dark pad, timpani, no melody
    padc(20.5, 25.4, (38, 39, 45), 0.32, 700, att=0.2)
    for tm, v in [(20.88, 0.8), (21.65, 0.6), (22.37, 1.0), (23.6, 0.5), (24.5, 0.55)]:
        put("perc", I.timpani(I.m2f(38), v, rr(), 2.2), tm, 0.9)
    # "Gone" (26.08): a single high note, then playful gossip pizzicato (26.7 - 29.1)
    rubab(deg(9), 26.08, 0.5, 1.5, 0.3)
    phrase(26.75, [4, None, 3, 4, None, 2, None, (1, 1), 0, None, 4, 5, (4, 2)], step=BEAT / 2, vel=0.5, dur=0.35)
    groove(26.75, 29.1, 0.35, sparse=True)
    # "Except it wasn't" -> 1989 secret (29.1 - 37.0): heartbeat low plucks under a pad
    bell(93, 29.65, 0.5); bell(98, 29.75, 0.35)
    padc(30.1, 37.1, (38, 45, 51), 0.25, 900)
    for k in range(int((37.0 - 30.15) / (BEAT))):
        tm = 30.15 + k * BEAT
        rubab(38, tm, 0.55, 0.5, -0.2, 0.3); rubab(38, tm + 0.18, 0.35, 0.4, -0.2, 0.3)
    put("perc", I.timpani(I.m2f(38), 0.9, rr(), 2.0), fr(1020), 1.0)
    for i in range(5):
        bell(81 + HIJAZ[i], 35.62 + i * 0.16, 0.35)
    # Luckily / Unluckily (37.0 - 41.8): deadpan stings
    rubab(deg(7), 37.0, 0.6, 0.6); rubab(deg(4), 37.3, 0.6, 1.2)
    rubab(deg(4), 39.25, 0.6, 0.6); rubab(deg(1), 39.55, 0.6, 0.9); rubab(deg(0), 39.85, 0.5, 1.6)
    # analogy (41.8 - 49.0): playful groove + tune; the bully's deflate
    drone(41.7, 49.2, (38, 45), 0.22)
    groove(41.8, 46.1, 0.45, sparse=True)
    phrase(41.8, [0, 2, 4, None, 4, 5, (4, 2), 2, 4, 7, None, (7, 2), 5, 4, (2, 2), None], vel=0.55)
    phrase(45.5, [7, 7, (8, 2)], vel=0.6)
    for i, tm in enumerate([46.12, 46.32]):
        put("perc", I.timpani(I.m2f(45 - i * 2), 0.5, rr(), 1.0), tm, 0.8)
    for i, m in enumerate([57, 56, 55, 50]):  # "womp womp"
        rubab(m, 47.72 + i * 0.22, 0.55, 0.5 if i < 3 else 1.4, 0.0, 0.3)
    # fourteen years (49.0 - 51.6): gentle
    padc(49.0, 51.8, (50, 54, 57), 0.22, 1600)
    phrase(49.1, [(4, 2), (5, 2), (4, 2), (2, 2), (1, 4)], step=BEAT / 2, vel=0.45, dur=1.2)
    # 2003 (51.6 - 56.3): build: accelerating pulse + roll into the door
    padc(51.6, 56.4, (38, 45, 51), 0.25, 900)
    t, gap = 51.7, 0.42
    while t < 56.2:
        rubab(38, t, 0.45 + 0.25 * (t - 51.7) / 4.5, 0.35, -0.2, 0.3)
        t += gap; gap = max(0.13, gap * 0.95)
    for tm, v in I.snare_roll(54.9, 56.3, 0.08, 0.5, rr(), 26):
        put("perc", I.snare(v, rr(), 0.25, 1.0, 0.6), tm, 0.5)
    # door opens (56.35): big swell in D major + bells + cymbal
    put("perc", I.cymbal(0.7, rr(), 3.2, 0.8), 56.37, 0.6)
    put("perc", I.timpani(I.m2f(38), 1.0, rr(), 2.5), 56.37, 1.0)
    padc(56.3, 58.9, (50, 54, 57, 62, 66), 0.4, 2200, att=0.25)
    for i, m in enumerate([74, 78, 81, 86, 90, 93]):
        bell(m, 57.18 + i * 0.09, 0.5)
    # motto (58.8 - 64.3): warm, slow melody
    drone(58.7, 64.6, (38, 45, 50), 0.25, 1200)
    padc(58.8, 64.5, (50, 54, 57), 0.22, 1800, att=1.2)
    phrase(59.2, [(4, 2), 5, 4, (2, 2), 1, 2, (4, 4), (7, 2), 6, 5, (4, 3), None, (2, 2), (1, 2), (0, 4)], step=BEAT / 2, vel=0.5, dur=1.0)
    # finale (64.3 - end): full groove, tune, bells; ends on D with a cymbal
    drone(64.2, DUR, (38, 45, 50), 0.3, 1200)
    padc(64.3, DUR - 0.4, (50, 54, 57, 62), 0.25, 2000)
    groove(64.31, 67.9, 0.65)
    phrase(64.31, tune[:14], vel=0.7)
    rubab(deg(7), 67.95, 0.8, 1.5); rubab(deg(0), 67.95, 0.6, 1.5); rubab(deg(4), 67.95, 0.6, 1.5)
    tabla("ghe", 67.95, 0.9)
    put("perc", I.cymbal(0.55, rr(), 2.4, 0.7), 67.95, 0.5)
    for i, m in enumerate([86, 90, 93, 98]):
        bell(m, 66.0 + i * 0.12, 0.35)


# ================================================================ sfx
sfx = np.zeros((2, N))


def S(t, x, g_db=0.0, p=0.0, warp=True):
    x = np.asarray(x, float)
    place(sfx, pan(x, p) if x.ndim == 1 else x, W(t) if warp else t, dbg(g_db))


def cat(*xs):
    """sum mono signals of different lengths (zero-padded)"""
    n = max(len(x) for x in xs)
    return sum(np.pad(np.asarray(x, float), (0, n - len(x))) for x in xs)


def noise(d, r):
    return r.standard_normal(ns(d))


def slam(r, big=1.0):
    d = 1.6
    t = tt(d)
    body = modal(d, [(52, 1.0, 0.5), (73, 0.7, 0.35), (118, 0.5, 0.25), (231, 0.35, 0.12), (412, 0.25, 0.08), (1890, 0.12, 0.06), (2770, 0.1, 0.05)], r)
    hit = lp(noise(d, r), 1800) * np.exp(-t / 0.02)
    return fades((body * 1.2 + hit) * big, 0, 0.2)


def explosion(r, d=2.5):
    t = tt(d)
    boom = np.sin(phase(55 * (1 + 1.2 * np.exp(-t / 0.08)))) * np.exp(-t / 0.5)
    crack = bp(noise(d, r), 200, 4000, 2) * np.exp(-t / 0.12)
    rumble = lp(noise(d, r), 220, 2) * np.exp(-t / 0.9) * 2.5
    return fades(boom * 1.4 + crack + rumble, 0, 0.3)


def crackle(d, r, rate=30):
    y = np.zeros(ns(d))
    for tm in np.sort(r.uniform(0, d, int(rate * d))):
        c = bp(noise(0.02, r), 1500, 6000, 1) * np.exp(-tt(0.02) / 0.002) * r.uniform(0.2, 1)
        i = ns(tm); y[i:i + len(c)] += c[: len(y) - i]
    return y + lp(noise(d, r), 400) * 0.15


def drill(d, r):
    t = tt(d)
    f = 165 * (1 + 0.04 * np.sin(TAU * 7 * t)) * (1 - 0.15 * (np.sin(TAU * 1.3 * t) > 0.6))
    ph = phase(f)
    y = sum(np.sin(k * ph) / k for k in range(1, 18)) * 0.5
    grind = bp(noise(d, r), 2500, 7000, 2) * (0.6 + 0.4 * np.sin(TAU * 11 * t))
    return fades(lp(y, 4000) + grind * 0.5, 0.03, 0.08)


def pop(r, f0=500, up=True):
    t = tt(0.15)
    return fades(np.sin(phase(f0 * (1 + (1.5 if up else -0.5) * (t / 0.15)))) * np.exp(-t / 0.05), 0.001, 0.02)


def rocket(d, r):
    t = tt(d)
    whistle = np.sin(phase(np.linspace(1700, 650, len(t)))) * 0.4
    hiss = bp(noise(d, r), 800, 5000, 2) * 0.6
    env = np.clip(t / d, 0, 1) ** 1.5
    return fades((whistle + hiss) * env, 0.05, 0.01)


def keys_jingle(r, n=4):
    y = np.zeros(ns(0.6))
    for k in range(n):
        c = G.clink(r, r.uniform(2800, 4200), 0.2, 1.0)
        i = ns(k * r.uniform(0.03, 0.07)); y[i:i + len(c)] += c[: len(y) - i] * r.uniform(0.5, 1)
    return y


def amb(t0, t1, kind, level_db=0.0):
    t0, t1 = W(t0), W(t1)
    d = t1 - t0
    r = rr()
    if kind == "desert":
        x = st(G.breeze(d, r, 1.0, 0.25, 700)) + pan(G.bird_chirps(d, r, 0.12, "sparrow") * 0.04, 0.5)
    elif kind == "city":
        x = st(G.breeze(d, r, 0.5, 0.1, 800)) * 0.6
        for k in range(5):
            x += pan(G.babble(d, rr(), R.uniform(110, 220), R.uniform(0.9, 1.15), 4.0, 0.6, 2800) * 0.05, R.uniform(-0.8, 0.8))
        x += pan(G.bird_chirps(d, r, 0.35, "sparrow") * 0.05, -0.4)
    elif kind == "room":
        x = st(lp(colored(ns(d), r, -1.0), 400) * 0.08)
    elif kind == "gallery":
        x = st(lp(colored(ns(d), r, -1.0), 500) * 0.06)
        for k in range(6):
            x += pan(G.babble(d, rr(), R.uniform(120, 240), R.uniform(0.9, 1.2), 3.6, 0.4, 2600) * 0.03, R.uniform(-0.9, 0.9))
    elif kind == "yard":
        x = st(G.breeze(d, r, 0.4, 0.1, 900)) * 0.5 + pan(G.bird_chirps(d, r, 0.5, "sparrow") * 0.06, 0.4) + pan(G.bird_chirps(d, rr(), 0.3, "blackbird") * 0.05, -0.5)
    elif kind == "war":
        x = st(lp(colored(ns(d), r, -1.5), 180) * 0.5) + st(G.breeze(d, r, 0.6, 0.3, 500)) * 0.5
    else:
        x = np.zeros((2, ns(d)))
    x = x * np.minimum(1, np.minimum(tt(d) / 0.3, (d - tt(d)) / 0.3))[None, :]
    S(t0, x, level_db, warp=False)


def build_sfx():
    # ---- hook (vault)
    amb(0, 5.9, "room", -2)
    for tm in (0.3, 1.25, 1.95):
        S(tm, G.clink(rr(), 5200, 0.4, 1.0) * 0.4, -8, 0.2)
    S(fr(56), G.creak(0.5, rr(), 60, 140, rough=0.15) * 0.8, -6, -0.3)
    S(fr(70), slam(rr(), 1.0), 0, -0.1)
    S(fr(176) - 0.25, G.whoosh(0.6, rr(), 0.25, 500, 4200, 0.9, 0.09, 0.4), -6)
    # ---- dig
    amb(5.9, 18.05, "desert", 0)
    for k in range(14):
        tm = 8.6 + k * 0.33 + R.uniform(-0.03, 0.03)
        if tm < 13.3:
            S(tm, cat(bp(noise(0.25, rr()), 1200, 5000, 1) * np.exp(-tt(0.25) / 0.06) * 0.6, G.stroll_step(rr(), 0.8) * 0.4), -10, R.uniform(-0.5, 0.5))
    S(12.6, I.triangle(0.7, rr(), 2.0, 2600), -4, 0.1)
    S(12.62, G.clink(rr(), 3900, 0.3, 1.0), -2)
    for n in range(6):
        S(fr(402 + n * 5), pop(rr(), 400 + n * 60), -10, -0.5 + n * 0.2)
    for f in (470, 485, 498):
        S(fr(f), I.triangle(0.5, rr(), 1.2, 3200 + f), -10, 0.15)
    # ---- Kabul museum
    amb(18.0, 20.6, "city", -2)
    for k in range(10):
        S(18.0 + k * 0.3, G.stroll_step(rr(), 0.4), -16, 0.3)
    # ---- war
    amb(20.4, 25.3, "war", 0)
    S(20.6, lp(explosion(rr(), 2.0), 400), -10, -0.7)
    S(21.3, lp(explosion(rr(), 2.0), 300), -12, 0.6)
    S(fr(649), rocket(W(fr(ROCKET := 671)) - W(fr(649)), rr()), -2, -0.6)
    S(fr(ROCKET), explosion(rr(), 2.8), 0, 0.0)
    for k in range(8):
        S(fr(ROCKET) + 0.25 + k * 0.17, G.clink(rr(), R.uniform(900, 2500), 0.15, 0.6) * 0.4, -8, R.uniform(-0.6, 0.6))
    S(fr(ROCKET) + 0.2, st(crackle(W(25.2) - W(22.6), rr())), -14)
    for k in range(14):
        S(22.8 + k * 0.19, G.stroll_step(rr(), 0.6), -10, 0.4)
    # ---- Gone (gallery) + gossip (teahouse)
    amb(25.2, 26.75, "gallery", -8)
    S(fr(781), lp(noise(0.6, rr()), 1200) * np.exp(-tt(0.6) / 0.15) * 0.3, -8)
    amb(26.7, 29.15, "city", -4)
    for k, (b, sc) in enumerate([(130, 1.0), (170, 1.05), (110, 0.95)]):
        S(26.75 + k * 0.2, G.babble(2.2, rr(), b, sc, 4.5, 0.8, 3400) * 0.25, -6, [-0.4, 0.3, 0.0][k])
    S(27.0, pop(rr(), 600), -6, 0.3)
    S(27.35, G.clink(rr(), 3300, 0.3, 0.8), -10, -0.3)
    # ---- Except / 1989 vault
    amb(29.1, 34.6, "room", -2)
    S(29.6, I.triangle(0.6, rr(), 2.0, 3000), -6)
    for k in range(18):
        S(30.2 + k * 0.21, G.stroll_step(rr(), 0.5), -12, -0.1 + 0.02 * k)
    for tm in (31.5, 32.3, 33.0):
        S(tm, modal(0.4, [(120, 1, 0.08), (260, 0.5, 0.05)], rr()), -8)
    S(fr(1005), G.creak(0.6, rr(), 50, 120, rough=0.2), -6)
    S(fr(1020), slam(rr(), 1.0), 0)
    amb(34.5, 35.55, "city", -10)
    amb(35.5, 37.0, "room", -2)
    for i in range(5):
        S(35.62 + i * 0.16, keys_jingle(rr()), -8, -0.6 + 0.3 * i)
    # ---- Luckily / Unluckily (palace)
    amb(36.95, 41.8, "desert", -4)
    for k in range(4):
        S(37.9 + k * 0.13, hp(noise(0.1, rr()), 3000) * np.exp(-tt(0.1) / 0.03) * 0.3, -14, 0.3)
        S(40.1 + k * 0.13, hp(noise(0.1, rr()), 3000) * np.exp(-tt(0.1) / 0.03) * 0.3, -14, 0.3)
    S(39.4, bp(noise(0.35, rr()), 1500, 6000, 1) * np.exp(-tt(0.35) / 0.1) * 0.4, -12, -0.3)  # paper rustle
    # ---- courtyard analogy
    amb(41.8, 49.0, "yard", 0)
    for i in range(5):
        S(42.83 + i * 0.12, keys_jingle(rr(), 3), -10, -0.6 + 0.3 * i)
    S(fr(1392) - 0.15, G.whoosh(0.35, rr(), 0.15, 600, 3000, 0.7, 0.05, 0.2), -6, 0.4)
    S(fr(1392), keys_jingle(rr(), 5), -4, 0.4)
    S(fr(1392) + 0.05, G.whoa(rr(), 380, 0.5) * 0.5, -8, 0.5)
    S(fr(1432), cat(G.clink(rr(), 2400, 0.25, 0.9), modal(0.2, [(800, 0.5, 0.03)], rr())), -4, -0.1)
    for k in range(4):
        S(46.0 + k * 0.25, G.stroll_step(rr(), 0.5), -12, 0.5)
    # ---- fourteen years (teahouse)
    amb(48.9, 51.7, "city", -6)
    S(49.4, G.clink(rr(), 3100, 0.3, 0.8), -10)
    S(49.0, bp(noise(2.6, rr()), 2000, 6000, 1) * np.linspace(0, 1, ns(2.6)) ** 2 * 0.15, -12)
    # ---- 2003 vault
    amb(51.6, 58.85, "room", -2)
    S(53.0, bp(noise(0.4, rr()), 1500, 6000, 1) * np.exp(-tt(0.4) / 0.1) * 0.4, -12, -0.3)
    for k in range(5):
        S(54.6 + k * 0.32, G.stroll_step(rr(), 0.6), -10, 0.4)
    S(55.0, modal(0.4, [(95, 1, 0.1), (210, 0.5, 0.05)], rr()), -8, 0.4)
    S(fr(1660), drill(W(fr(1688)) - W(fr(1660)), rr()), -6, 0.3)
    S(fr(1660), crackle(W(fr(1688)) - W(fr(1660)), rr(), 60), -10, 0.3)
    S(fr(1688), cat(G.clink(rr(), 1900, 0.4, 0.8), slam(rr(), 0.4)), -4)
    S(fr(1690), G.creak(0.9, rr(), 40, 90, rough=0.25), -4, -0.2)
    S(fr(1690), G.whoosh(0.9, rr(), 0.5, 200, 1500, 1.0, 0.3, 0.2), -8)
    S(57.5, cat(G.whoa(rr(), 160, 0.8) * 0.5, G.whoa(rr(), 200, 0.8) * 0.4), -8)
    # ---- motto (museum, golden) + gallery finale
    amb(58.8, 64.35, "yard", -4)
    for k in range(16):
        S(58.6 + k * 0.28, G.stroll_step(rr(), 0.4), -16, 0.4)
    amb(64.2, DUR, "gallery", -2)
    S(64.6, cat(G.whoa(rr(), 180, 0.9) * 0.4, G.whoa(rr(), 260, 0.8) * 0.3), -10, -0.2)
    S(fr(2024), G.whoosh(1.3, rr(), 0.6, 250, 1800, 0.9, 0.3, 0.15), -10)
    ta = W(67.6); env = np.minimum(1, tt(DUR - ta) / 0.4)
    S(ta, G.applause(DUR - ta, rr(), 30, env) * 0.6, -6, warp=False)


# ================================================================ mix
def limiter(x, ceil_db=-1.2, look=0.003, rel=0.08):
    from scipy.ndimage import maximum_filter1d
    c = dbg(ceil_db)
    pk = maximum_filter1d(np.abs(x).max(0), size=ns(look) * 2 + 1)
    g = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    a = np.exp(-1 / (rel * SR))
    out = np.empty_like(g); cur = 1.0
    for i in range(len(g)):  # instant attack (look-ahead peak), exponential release
        cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]
        out[i] = cur
    return x * out[None, :]


def main():
    v, sr = read_wav(os.path.join(ROOT, "voice_dari" if LANG == "fa" else "voice", "voice.wav"))
    from scipy import signal
    v = signal.resample_poly(v, SR, sr, axis=-1)
    v = st(v[0])[:, :N]
    v = np.pad(v, ((0, 0), (0, N - v.shape[1])))
    v = norm_to(v, -16.5, "integrated")
    build_music(); build_sfx()
    ir = make_ir(1.6, 7, hf=1.3)
    music = sum(mus.values())
    music = music + 0.18 * convolve_st(music, ir)
    sx = sfx + 0.12 * convolve_st(sfx, make_ir(0.9, 9, hf=1.5))
    music = norm_to(music, -26.0, "integrated")
    sx = norm_to(sx, -27.0, "integrated")
    # duck the music ~3 dB while the voice speaks
    duck = np.zeros(N)
    spans = [(l["fa"][0], l["fa"][1]) for l in TM["lines"]] if LANG == "fa" else [(wd["start"], wd["end"]) for wd in words]
    for s0, s1 in spans:
        a, b = ns(s0 - 0.08), ns(s1 + 0.15)
        duck[max(0, a):min(N, b)] = 1
    k = np.exp(-1 / (0.12 * SR)); env = np.empty(N); cur = 0.0
    for i in range(N):
        cur = duck[i] if duck[i] > cur else k * cur + (1 - k) * duck[i]
        env[i] = cur
    music = music * dbg(-3.0 * env)[None, :]
    music *= dbg(3.0); sx *= dbg(-6.0)   # house rule: music +3 dB, SFX -6 dB, voice unchanged
    mix = v + music + sx
    mix = mix * dbg(-15.0 - integrated(mix))
    mix = limiter(mix)
    out = os.path.join(ROOT, "audio")
    sfx_ = "" if LANG == "en" else "_fa"
    write_wav(os.path.join(out, f"mix{sfx_}.wav"), mix)
    for nm, x in (("stem_voice", v), ("stem_music", music), ("stem_sfx", sx)):
        write_wav(os.path.join(out, nm + sfx_ + ".wav"), x)
    print("mix", round(integrated(mix), 2), "LUFS, true peak", round(true_peak(mix), 2), "dBTP, length", mix.shape[1] / SR, "s")


if __name__ == "__main__":
    main()
