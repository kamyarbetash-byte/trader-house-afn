# Sound for "Our ancestors, ep. 4 (al-Biruni), forked from ep. 3: the eighteen-year-old who cured the king": original score (D Hijaz: rubab, tabla, drone, pads, bells,
# a synthesized ney) + synthesized ambiences/effects + the three Dari voices, mixed to mix.wav (48 kHz, picture length).
# Same DSP kit and mix rule as the gold short: music +3 dB, SFX -6 dB, voice unchanged, music ducked ~3 dB under the voice.
# Picture times follow src/videos/ajdad2/story.ts (seconds = frame / 30).
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "bridge-short", "audio"))
from dsp import (SR, TAU, ns, tt, rng, lp, hp, bp, peq, shelf, colored, fades, phase, modal, pan, st, place, widen, make_ir,
                 convolve_st, integrated, true_peak, dbg, read_wav, write_wav, norm_to)
import instruments as I
import sfx_gen as G

FPS = 30
ROOT = os.path.join(HERE, "..")
TIM = json.load(open(os.path.join(ROOT, "voice", "timing.json")))
DUR = round(TIM["total"] * FPS) / FPS
W = lambda t: t
fr = lambda f: f / FPS
N = ns(DUR)
R = rng(1207)
rr = lambda: rng(int(R.integers(1 << 30)))
BEAT = 60 / 92
HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12]
deg = lambda k, base=62: base + HIJAZ[k % 7] + 12 * (k // 7)
mus = {k: np.zeros((2, N)) for k in ("drone", "rubab", "tabla", "perc", "pad", "bell", "ney")}
sfx = np.zeros((2, N))
LS = {l["n"]: (l["s"], l["e"]) for l in TIM["lines"]}

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



def ney(m, t, dur, vel=0.5, p=-0.1, bend=0.0):
    """breathy reed flute: soft harmonics with a slow vibrato that grows into the note, plus band-passed breath"""
    r = rr(); n = ns(dur); x = tt(dur)
    f = I.m2f(m) * (1 + 0.006 * np.sin(TAU * 5.2 * x) * np.clip(x / 0.5, 0, 1)) * (1 + bend * np.exp(-x / 0.08))
    ph = phase(f)
    y = np.sin(ph) + 0.32 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph) + 0.04 * np.sin(4 * ph)
    br = bp(r.standard_normal(n), I.m2f(m) * 1.2, I.m2f(m) * 4, 2) * 0.35 + hp(r.standard_normal(n), 3000) * 0.04
    env = np.minimum(1, x / 0.14) * np.minimum(1, (dur - x) / 0.3) ** 1.2
    put("ney", (y * 0.8 + br) * env * vel, t, 1.0, p)


def ney_line(t0, notes, step=0.62, vel=0.45):
    t = t0
    for k, L in notes:
        if k is not None: ney(deg(k, 62), t, step * L + 0.15, vel, bend=-0.03 if L >= 2 else 0.0)
        t += step * L


def build_music():
    tune = [4, 5, (4, 2), 3, 2, (1, 2), 2, 3, (4, 2), (7, 2), 6, 5, (4, 3), None]
    # ---- the garden (0 - 17.8): a torn poem, hurt, sad
    drone(0.0, 17.9, (38, 44), 0.26, 650)
    padc(0.0, 6.6, (50, 53, 56), 0.15, 850, att=1.5)
    ney_line(0.9, [(2, 3), (1, 1), (0, 3), (1, 2), (0, 4)], step=0.62, vel=0.36)
    padc(6.5, 14.2, (50, 54, 57), 0.17, 1300, att=1.2)
    phrase(7.2, [(4, 2), 5, (4, 2), (2, 2), None, (4, 3)], step=BEAT, vel=0.32, dur=1.1)
    padc(14.1, 17.8, (50, 53, 56), 0.15, 800, att=0.6)
    ney_line(14.6, [(1, 2), (0, 4)], step=0.7, vel=0.32)
    # ---- "a thousand years ago, in Balkh..." (17.8 - 28.3): warm, the name rings out
    drone(17.6, 28.5, (38, 45, 50), 0.27, 1000)
    padc(17.8, 28.3, (50, 54, 57, 62), 0.19, 1800, att=2.5)
    phrase(18.4, [(4, 2), None, 5, (4, 2), (7, 3), None, (8, 2), 7, (5, 2), (4, 3)], step=BEAT, vel=0.36, dur=1.1)
    for i, m in enumerate([81, 86, 90, 93, 98]):
        bell(m, 26.5 + i * 0.12, 0.3)
    # ---- the library in Balkh (28.3 - 39.0): a tender, graceful theme for Rabia
    drone(28.1, 39.2, (38, 45, 50), 0.24, 1500)
    padc(28.3, 39.0, (50, 54, 57, 62), 0.19, 2200, att=1.5)
    ney_line(28.9, [(4, 2), (5, 1), (7, 3), (8, 1), (7, 2), (5, 2), (4, 4)], step=0.62, vel=0.42)
    ney_line(34.9, [(7, 2), (8, 1), (9, 3), (8, 2), (7, 4)], step=0.62, vel=0.44)
    for i, m in enumerate([86, 90, 93, 98]):
        bell(m, 35.5 + i * 0.16, 0.26)
    # ---- the garden: a girl? her fame reached Bukhara (39.0 - 48.6)
    drone(38.8, 48.8, (38, 45, 50), 0.26, 1300)
    padc(39.0, 48.6, (50, 54, 57), 0.18, 1800, att=0.8)
    phrase(39.5, [(4, 1), (7, 2), None, (8, 2), 7, (5, 2), (4, 2), 5, (7, 2), (8, 3)], step=BEAT, vel=0.4, dur=0.9)
    groove(42.0, 48.4, 0.38, sparse=True)
    # ---- Bukhara: Rudaki hears her poem (48.6 - 55.5): a proud court theme, then wonder
    drone(48.4, 55.7, (38, 45, 50), 0.26, 1300)
    padc(48.6, 55.5, (50, 54, 57, 62), 0.2, 2000, att=1.0)
    phrase(48.9, [(4, 2), 5, 7, (8, 2), 7, (5, 2), (4, 4)], vel=0.46)
    for i, m in enumerate([81, 86, 90, 93, 98, 102]):
        bell(m, 52.2 + i * 0.12, 0.3)
    padc(52.4, 55.5, (50, 54, 57, 62, 66), 0.2, 2600, att=0.4)
    # ---- the garden, darker: her brother (55.5 - 61.6); the cell (61.6 - 67.4); "locked up?" (67.4 - 70.9)
    drone(55.3, 71.0, (36, 43), 0.3, 500)
    padc(55.5, 61.6, (48, 51, 55), 0.17, 700, att=1.0)
    ney_line(56.2, [(2, 2), (1, 2), (0, 4)], step=0.7, vel=0.34)
    padc(61.6, 67.4, (48, 51, 54), 0.18, 600, att=0.4)
    for k in range(6):
        tabla("ghe", 61.9 + k * 0.75, 0.38 + 0.03 * k)
    padc(67.4, 70.9, (48, 51, 55), 0.15, 600, att=0.3)
    # ---- the cell: she does not give up; the poem on the wall (70.9 - 84.8)
    drone(70.7, 85.0, (38, 45), 0.24, 900)
    padc(70.9, 76.7, (50, 53, 57), 0.17, 1200, att=1.0)
    ney_line(71.5, [(2, 2), (4, 2), (5, 3), (4, 1), (5, 2), (7, 4)], step=0.62, vel=0.4)
    padc(76.7, 84.8, (50, 54, 57, 62), 0.16, 1600, att=2.0)
    for k in range(7):
        bell([81, 86, 88, 90, 93, 90, 86][k], 77.0 + k * 1.05, 0.14)
    # ---- the wall is gone; the poem travelled a thousand years (84.8 - 91.4): rising
    drone(84.6, 91.6, (38, 45, 50), 0.26, 1800)
    padc(84.8, 91.4, (50, 54, 57, 62, 66), 0.21, 2600, att=1.6)
    phrase(85.4, [(4, 2), 5, (7, 2), None, 8, (9, 2), 8, (11, 4)], step=BEAT, vel=0.42, dur=1.0)
    for i, m in enumerate([86, 90, 93, 98, 102]):
        bell(m, 89.4 + i * 0.12, 0.3)
    # ---- today: Balkh and Kabul (91.4 - 99.8): bright, proud
    drone(91.2, 100.0, (38, 45, 50, 57), 0.24, 2200)
    padc(91.4, 99.8, (50, 54, 57, 62), 0.21, 2600, att=0.8)
    groove(91.8, 99.4, 0.5)
    phrase(92.0, tune[:12], vel=0.48)
    # ---- the garden: a word is taller than a wall (99.8 - 106.5)
    drone(99.6, 106.6, (38, 45), 0.26, 900)
    padc(99.8, 106.5, (50, 54, 57), 0.18, 1500, att=1.5)
    phrase(100.4, [(4, 2), None, 5, (4, 2), (2, 2), None, (4, 2), (7, 4)], step=BEAT, vel=0.36, dur=1.2)
    # ---- "I'll write it again!" (106.5 - 110.7)
    drone(106.4, 110.8, (38, 45, 50), 0.28, 1600)
    padc(106.5, 110.7, (50, 54, 57, 62, 66), 0.22, 2600, att=0.4)
    groove(106.8, 110.6, 0.5)
    phrase(106.9, tune[:8], vel=0.5)
    # ---- bravo; the next story (110.7 - end): proud, then a mysterious turn
    drone(110.6, DUR, (38, 45), 0.26, 800)
    padc(110.7, 114.6, (50, 54, 57), 0.18, 1600)
    phrase(111.0, [4, None, 3, 4, None, 2, None, (1, 1), 0, None, 4, 5, (4, 2)], step=BEAT / 2, vel=0.42, dur=0.35)
    padc(114.4, DUR - 0.3, (50, 53, 56), 0.18, 1200, att=1.2)
    ney_line(114.8, [(1, 2), (2, 1), (1, 2), (0, 4)], step=0.62, vel=0.4)
    for i, m in enumerate([86, 89, 93, 98]):
        bell(m, 120.4 + i * 0.12, 0.3)

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
    elif kind == "hill":
        x = st(G.breeze(d, r, 1.1, 0.35, 650)) * 0.8
        for k in range(3):
            x += pan(G.babble(d, rr(), R.uniform(110, 220), R.uniform(0.9, 1.15), 4.0, 0.6, 2000) * 0.02, R.uniform(-0.8, 0.8))
        x += pan(G.bird_chirps(d, r, 0.2, "sparrow") * 0.04, -0.4)
    elif kind == "garden":
        x = st(G.breeze(d, r, 0.45, 0.12, 900)) * 0.5 + pan(G.bird_chirps(d, r, 0.55, "sparrow") * 0.06, 0.4) + pan(G.bird_chirps(d, rr(), 0.35, "blackbird") * 0.05, -0.5)
        x += pan(lp(colored(ns(d), rr(), 0.0), 2200) * (0.03 + 0.012 * np.sin(tt(d) * 3.1)), 0.6)   # the water channel
    elif kind == "cell":
        x = st(lp(colored(ns(d), r, -1.0), 350) * 0.08)
    elif kind == "night":
        x = st(lp(colored(ns(d), r, -1.0), 600) * 0.05) + st(G.breeze(d, r, 0.3, 0.1, 500)) * 0.3
    elif kind == "war":
        x = st(lp(colored(ns(d), r, -1.5), 180) * 0.5) + st(G.breeze(d, r, 0.6, 0.3, 500)) * 0.5
    else:
        x = np.zeros((2, ns(d)))
    x = x * np.minimum(1, np.minimum(tt(d) / 0.3, (d - tt(d)) / 0.3))[None, :]
    S(t0, x, level_db, warp=False)



def build_sfx():
    # the garden: birds, a breeze, the water channel
    for a, b in [(0, 28.4), (38.8, 48.8), (55.3, 61.8), (67.2, 71.0), (99.6, DUR)]:
        amb(a, b, "garden", -10)
    for k in range(5):
        S(10.05 + k * 0.45, G.stroll_step(rr(), 0.7) * 0.5, -13, 0.3)                # Farid walks to the takht
    S(26.9, G.whoosh(1.4, rr(), 0.4, 600, 3500, 0.8, 0.4, 0.3) * 0.4, -10, 0.0)      # into the story
    amb(28.2, 39.2, "room", -12)
    for t0 in [32.2, 33.4, 36.0, 37.2]:
        S(t0, G.whoosh(0.7, rr(), 0.2, 1500, 5000, 0.4, 0.2, 0.3) * 0.2, -15, 0.1)   # golden words rise
    amb(48.4, 55.7, "city", -12)
    S(49.4, G.whoosh(0.5, rr(), 0.2, 1200, 4000, 0.4, 0.15, 0.3) * 0.25, -15, 0.3)   # the page unfolds
    S(52.2, G.whoosh(1.0, rr(), 0.3, 800, 3500, 0.6, 0.3, 0.3) * 0.35, -12, -0.2)    # Rudaki: wonder
    amb(61.6, 67.4, "cell", -9)
    for t0 in [62.3, 64.0, 69.0, 71.6, 73.9, 76.2, 80.9, 83.5]:
        S(t0, pop(rr(), 1500 + 200 * (t0 % 3), False) * 0.15, -20, ((t0 * 0.37) % 1) - 0.5)   # water drips
    for k in range(4):
        S(64.4 + k * 0.45, G.stroll_step(rr(), 0.9) * 0.6, -12, 0.4 + k * 0.1)        # Harith walks out
    S(66.15, slam(rr(), 1.0) * 0.6, -8, 0.5)                                         # the door shuts
    amb(70.7, 85.0, "cell", -10)
    for t0 in [73.1, 74.2, 75.3, 77.0, 78.4, 79.8, 81.2]:
        S(t0, G.whoosh(0.8, rr(), 0.25, 1500, 5000, 0.4, 0.25, 0.3) * 0.2, -15, 0.0)  # the script glows onto the wall
    amb(84.6, 91.6, "desert", -11)
    S(85.0, G.whoosh(3.0, rr(), 0.8, 400, 3000, 1.0, 1.2, 0.3) * 0.35, -11, 0.0)     # words fly up into the sky
    amb(91.2, 95.9, "yard", -10)
    amb(95.6, 100.0, "city", -10)
    for k in range(10):
        S(95.75 + k * 0.38, G.stroll_step(rr(), 0.6) * 0.45, -16, -0.4 + k * 0.08)   # schoolgirls walking
    S(107.0, G.whoosh(0.5, rr(), 0.2, 800, 3500, 0.4, 0.2, 0.3) * 0.4, -10, 0.2)     # Farid jumps up
    S(108.0, G.whoosh(0.4, rr(), 0.2, 1500, 5000, 0.4, 0.15, 0.3) * 0.25, -14, 0.3)  # the new page
    S(115.9, G.whoosh(2.4, rr(), 0.6, 500, 3000, 0.9, 0.7, 0.3) * 0.3, -11, -0.1)    # crane out

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
    v, sr = read_wav(os.path.join(ROOT, "voice", "voice.wav"))
    from scipy import signal
    v = signal.resample_poly(v, SR, sr, axis=-1)
    v = st(v[0])[:, :N]
    v = np.pad(v, ((0, 0), (0, N - v.shape[1])))
    v = norm_to(v, -16.5, "integrated")
    build_music(); build_sfx()
    music = sum(mus.values())
    music = music + 0.2 * convolve_st(music, make_ir(1.8, 7, hf=1.3))
    sx = sfx + 0.12 * convolve_st(sfx, make_ir(0.9, 9, hf=1.5))
    music = norm_to(music, -26.0, "integrated")
    sx = norm_to(sx, -27.0, "integrated")
    duck = np.zeros(N)
    for s0, s1 in LS.values():
        duck[max(0, ns(s0 - 0.08)):min(N, ns(s1 + 0.15))] = 1
    k = np.exp(-1 / (0.12 * SR)); env = np.empty(N); cur = 0.0
    for i in range(N):
        cur = duck[i] if duck[i] > cur else k * cur + (1 - k) * duck[i]
        env[i] = cur
    music = music * dbg(-3.0 * env)[None, :]
    music *= dbg(3.0); sx *= dbg(-6.0)
    mix = v + music + sx
    mix = mix * dbg(-15.0 - integrated(mix))
    mix = limiter(mix, -1.7)
    out = HERE
    write_wav(os.path.join(out, "mix.wav"), mix)
    for nm, x in (("stem_voice", v), ("stem_music", music), ("stem_sfx", sx)):
        write_wav(os.path.join(out, nm + ".wav"), x)
    print("mix", round(integrated(mix), 2), "LUFS, true peak", round(true_peak(mix), 2), "dBTP, length", mix.shape[1] / SR, "s")


if __name__ == "__main__":
    main()
