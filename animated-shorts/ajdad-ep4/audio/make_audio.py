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
    # ---- the hill at sunset (0 - 17): frustrated, then angry
    drone(0.0, 17.2, (38, 44), 0.28, 700)
    padc(0.0, 7.2, (50, 53, 56), 0.16, 900, att=1.5)
    phrase(0.8, [(2, 2), 1, (2, 3), None, (1, 2), (0, 3)], step=BEAT, vel=0.32, dur=1.2)
    padc(7.1, 13.3, (50, 54, 57), 0.17, 1400, att=1.2)
    phrase(7.6, [(4, 2), 5, (4, 2), (2, 2), None, (4, 3)], step=BEAT, vel=0.34, dur=1.1)
    for k in range(5):
        tabla("ghe", 13.3 + k * 0.62, 0.4 + 0.03 * k); tabla("na", 13.6 + k * 0.62, 0.3)
    padc(13.2, 17.1, (50, 53, 56), 0.17, 900, att=0.4)
    # ---- "nobody?" (17 - 28.6): warm, building into the story; the name rings out
    drone(16.9, 28.8, (38, 45, 50), 0.28, 1000)
    padc(17.0, 28.6, (50, 54, 57, 62), 0.19, 1800, att=2.5)
    phrase(17.6, [(4, 2), None, 5, (4, 2), (7, 3), None, (8, 2), 7, (5, 2), (4, 3)], step=BEAT, vel=0.38, dur=1.1)
    for i, m in enumerate([81, 86, 90, 93, 98]):
        bell(m, 26.4 + i * 0.12, 0.3)
    # ---- Ghazni (28.6 - 35.8): a proud court theme
    drone(28.4, 35.9, (38, 45, 50), 0.26, 1300)
    padc(28.5, 35.8, (50, 54, 57, 62), 0.2, 2000, att=1.0)
    phrase(28.9, [(4, 2), 5, 7, (8, 2), 7, (5, 2), 4, (5, 2), 7, (8, 4)], vel=0.5)
    groove(29.2, 35.4, 0.4, sparse=True)
    # ---- the caliph's party (35.8 - 44.2): a plodding caravan rhythm, many men, many ropes
    drone(35.6, 44.4, (38, 44), 0.3, 700)
    padc(35.8, 44.2, (50, 53, 56), 0.17, 1000, att=0.8)
    for k in range(13):
        tabla("ghe", 36.0 + k * 0.62, 0.45); tabla("na", 36.31 + k * 0.62, 0.28)
    ney_line(37.0, [(2, 2), (1, 1), (2, 2), (4, 3), (2, 2), (1, 1), (0, 3)], step=0.62, vel=0.4)
    # ---- alone, from a mountain (44.2 - 52.3): one voice, determined
    drone(44.0, 52.5, (38, 45, 50), 0.26, 1300)
    padc(44.2, 52.3, (50, 54, 57, 62), 0.18, 1800, att=1.0)
    ney_line(44.6, [(4, 2), (5, 1), (7, 3), (5, 1), (4, 2), (7, 2), (8, 4)], step=0.6, vel=0.5)
    rubab(deg(7), 49.6, 0.6, 0.5); rubab(deg(8), 49.85, 0.6, 0.5); rubab(deg(9), 50.1, 0.65, 1.3)
    # ---- the triangle and the summit (52.3 - 65.3): curiosity, rising
    drone(52.1, 65.5, (38, 45, 50), 0.26, 1500)
    padc(52.3, 58.0, (50, 54, 57), 0.17, 1600, att=0.8)
    for k, t0 in enumerate([53.0, 54.3, 55.6, 56.6]):
        bell([81, 86, 90, 93][k], t0, 0.3)
    padc(57.8, 65.3, (50, 54, 57, 62, 66), 0.22, 2400, att=1.5)
    phrase(58.3, [(4, 2), 5, (7, 2), None, 8, (9, 2), 8, (7, 4)], step=BEAT, vel=0.4, dur=1.0)
    for i, m in enumerate([86, 90, 93, 98]):
        bell(m, 61.0 + i * 0.2, 0.25)
    # ---- the hill: the horizon, the whole world (65.3 - 77.2)
    drone(65.1, 77.4, (38, 45, 50), 0.28, 1400)
    padc(65.3, 77.2, (50, 54, 57, 62), 0.2, 2000, att=1.0)
    phrase(65.9, [(4, 2), None, 5, (4, 2), (2, 2), None, (4, 3)], step=BEAT, vel=0.34, dur=1.1)
    for k in range(6):
        bell([81, 83, 86, 88, 90, 93][k], 70.0 + k * 0.95, 0.22)
    groove(73.0, 77.0, 0.4, sparse=True)
    # ---- he wrote: 6340 (77.2 - 82.8) and today: 6371 (82.8 - 89.8)
    drone(77.0, 83.0, (38, 45, 50), 0.26, 1300)
    padc(77.2, 82.8, (50, 54, 57, 62), 0.2, 2000, att=0.8)
    for k in range(4):
        bell([86, 90, 93, 98][k], 79.3 + k * 0.35, 0.3)
    drone(82.6, 90.0, (38, 45, 50, 57), 0.24, 2200)
    padc(82.8, 89.8, (50, 54, 57, 62, 66), 0.22, 2800, att=1.5)
    for k in range(10):
        bell([93, 98, 102, 105][k % 4], 83.4 + k * 0.62, 0.16)
    for i, m in enumerate([81, 86, 90, 93, 98, 102]):
        bell(m, 88.6 + i * 0.1, 0.32)
    # ---- back on the hill (89.8 - 113.8): amazement, wisdom, the project
    drone(89.6, 93.6, (38, 45), 0.24, 900)
    rubab(deg(7), 91.0, 0.55, 0.5); rubab(deg(8), 91.25, 0.55, 0.5); rubab(deg(9), 91.5, 0.6, 1.2)
    drone(93.4, 108.0, (38, 45), 0.26, 800)
    padc(93.5, 107.9, (50, 54, 57), 0.17, 1500, att=2.0)
    phrase(94.0, [(4, 2), None, 5, (4, 2), (2, 2), None, (4, 2), (7, 4)], step=BEAT, vel=0.36, dur=1.2)
    phrase(101.4, [(4, 2), 5, (7, 2), None, 5, (4, 2), (2, 2), (4, 4)], step=BEAT, vel=0.34, dur=1.2)
    drone(107.8, 114.0, (38, 45, 50), 0.28, 1600)
    padc(107.9, 113.8, (50, 54, 57, 62, 66), 0.22, 2600, att=0.5)
    groove(108.3, 113.6, 0.5)
    phrase(108.4, tune[:10], vel=0.5)
    # ---- bravo; the next story (113.8 - end): proud, then a mysterious turn
    drone(113.6, DUR, (38, 45), 0.26, 800)
    padc(113.8, 117.2, (50, 54, 57), 0.18, 1600)
    phrase(114.0, [4, None, 3, 4, None, 2, None, (1, 1), 0, None, 4, 5, (4, 2)], step=BEAT / 2, vel=0.42, dur=0.35)
    padc(117.0, DUR - 0.3, (50, 53, 56), 0.18, 1200, att=1.2)
    ney_line(117.4, [(1, 2), (2, 1), (1, 2), (0, 4)], step=0.62, vel=0.4)
    for i, m in enumerate([86, 89, 93, 98]):
        bell(m, 121.6 + i * 0.12, 0.3)

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
    elif kind == "night":
        x = st(lp(colored(ns(d), r, -1.0), 600) * 0.05) + st(G.breeze(d, r, 0.3, 0.1, 500)) * 0.3
    elif kind == "war":
        x = st(lp(colored(ns(d), r, -1.5), 180) * 0.5) + st(G.breeze(d, r, 0.6, 0.3, 500)) * 0.5
    else:
        x = np.zeros((2, ns(d)))
    x = x * np.minimum(1, np.minimum(tt(d) / 0.3, (d - tt(d)) / 0.3))[None, :]
    S(t0, x, level_db, warp=False)



def build_sfx():
    # the hill: wind at the top, a far city below, kites rattling
    for a, b in [(0, 28.8), (65.1, 77.4), (89.6, DUR)]:
        amb(a, b, "hill", -11)
    S(3.0, G.whoosh(0.4, rr(), 0.2, 1500, 5000, 0.4, 0.15, 0.3) * 0.2, -16, 0.3)      # phone
    for k in range(5):
        S(9.75 + k * 0.45, G.stroll_step(rr(), 0.7) * 0.5, -13, 0.3)                 # Farid walks to the bench
    S(13.5, G.whoosh(0.35, rr(), 0.2, 1200, 4000, 0.4, 0.15, 0.3) * 0.35, -12, 0.2)  # angry arm
    S(26.2, G.whoosh(1.4, rr(), 0.4, 600, 3500, 0.8, 0.4, 0.3) * 0.4, -10, 0.0)      # into the story
    amb(28.4, 35.9, "yard", -9)
    for k in range(7):
        S(28.95 + k * 0.67, G.stroll_step(rr(), 0.7) * 0.5, -14, -0.4 + k * 0.12)
    amb(35.6, 44.4, "desert", -7)
    for k in range(14):
        S(36.0 + k * 0.58, G.stroll_step(rr(), 0.9) * 0.5, -15, ((k * 0.37) % 1) - 0.5)
    S(36.4, G.babble(7.0, rr(), 150, 1.1, 4.0, 0.7, 2400) * 0.04, -15, 0.0)
    amb(44.0, 65.5, "desert", -10)
    for k in range(7):
        S(44.35 + k * 0.62, G.stroll_step(rr(), 0.7) * 0.5, -14, -0.3 + k * 0.1)
    for t0 in [53.0, 54.3, 55.6]:
        S(t0, G.whoosh(0.6, rr(), 0.2, 1500, 5000, 0.4, 0.2, 0.3) * 0.25, -14, 0.1)  # chalk lines
    S(56.6, pop(rr(), 650, True) * 0.4, -12, 0.0)
    S(57.9, G.whoosh(1.6, rr(), 0.5, 400, 2500, 0.8, 0.5, 0.2) * 0.35, -11, 0.0)     # up to the summit
    for t0 in [61.0, 62.4, 63.8]:
        S(t0, G.whoosh(0.6, rr(), 0.2, 1500, 5000, 0.4, 0.2, 0.3) * 0.25, -14, 0.2)
    for t0 in [70.2, 71.4, 72.6, 73.8]:
        S(t0, G.whoosh(0.6, rr(), 0.2, 1500, 5000, 0.4, 0.2, 0.3) * 0.22, -14, 0.0)  # the earth drawing
    amb(77.0, 83.0, "desert", -12)
    for k in range(4):
        S(79.3 + k * 0.35, pop(rr(), 700 + 80 * k, True) * 0.45, -11, -0.2 + k * 0.15)  # 6 3 4 0
    amb(82.6, 90.0, "night", -10)
    S(83.0, G.whoosh(6.0, rr(), 1.5, 300, 2000, 1.0, 2.0, 0.15) * 0.25, -14, -0.6)   # the satellite glides
    S(108.3, G.whoosh(0.5, rr(), 0.2, 800, 3500, 0.4, 0.2, 0.3) * 0.4, -10, 0.2)     # Farid jumps up
    for t0 in [110.5, 111.4, 112.2]:
        S(t0, G.whoosh(0.6, rr(), 0.2, 1500, 5000, 0.4, 0.2, 0.3) * 0.25, -14, 0.2)
    S(118.6, G.whoosh(2.4, rr(), 0.6, 500, 3000, 0.9, 0.7, 0.3) * 0.3, -11, -0.1)    # crane out

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
