# Sound for "Our ancestors, ep. 3: the eighteen-year-old who cured the king": original score (D Hijaz: rubab, tabla, drone, pads, bells,
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
    # ---- teahouse (0 - 14.3): Farid's sad walk-in, Baba's warm welcome, the angry outburst
    drone(0.0, 14.6, (38, 44), 0.28, 700)
    padc(0.0, 4.4, (50, 53, 56), 0.16, 900, att=1.2)
    phrase(0.6, [(2, 2), 1, (2, 3), None, (1, 2), (0, 3)], step=BEAT, vel=0.34, dur=1.2)
    padc(4.3, 10.2, (50, 54, 57), 0.17, 1400, att=1.2)
    phrase(5.0, [(4, 2), 5, (4, 2), (2, 2), None, (4, 3)], step=BEAT, vel=0.36, dur=1.1)
    for k in range(6):
        tabla("ghe", 10.3 + k * 0.62, 0.4 + 0.03 * k); tabla("na", 10.6 + k * 0.62, 0.3)
    padc(10.2, 14.4, (50, 53, 56), 0.17, 900, att=0.4)
    # ---- "nobody? listen" (14.3 - 26.8): a gentle smile, then the build into the story
    drone(14.3, 27.1, (38, 45, 50), 0.28, 1000)
    padc(14.4, 26.9, (50, 54, 57, 62), 0.19, 1800, att=2.5)
    phrase(15.0, [(4, 2), None, 5, (4, 2), (7, 3), None, (8, 2), 7, (5, 2), (4, 3)], step=BEAT, vel=0.38, dur=1.1)
    for i, m in enumerate([81, 86, 90, 93, 98]):
        bell(m, 24.6 + i * 0.14, 0.32)
    # ---- the House of Wisdom (26.8 - 33.5): bright, scholarly
    drone(26.7, 33.8, (38, 45, 50), 0.26, 1300)
    padc(26.8, 33.7, (50, 54, 57, 62), 0.2, 2000, att=1.0)
    phrase(27.1, [(4, 2), 5, 7, (8, 2), 7, (5, 2), 4, (5, 2), 7, (8, 4)], vel=0.5)
    # ---- the quarrel over the field (33.5 - 44.6): tense pulse
    drone(33.4, 45.0, (38, 44), 0.32, 600)
    padc(33.5, 44.8, (50, 53, 56), 0.17, 900, att=0.8)
    for k in range(16):
        tabla("ghe" if k % 2 == 0 else "tin", 33.8 + k * 0.42, 0.42 if k % 4 == 0 else 0.3)
    for k in range(4):
        phrase(34.2 + k * 2.6, [(1, 1), 2, (1, 2)], step=BEAT / 2, vel=0.36, dur=0.6)
    # ---- "it is not hard. step by step." (44.6 - 49.2): the lift
    drone(44.6, 49.5, (38, 45, 50), 0.28, 1400)
    padc(44.8, 49.4, (50, 54, 57, 62, 66), 0.22, 2400, att=1.0)
    for i, m in enumerate([86, 90, 93, 98]):
        bell(m, 47.3 + i * 0.2, 0.34)
    # ---- the steps (49.2 - 54.7): one bell for each step, a brighter one when it is done
    drone(49.2, 55.0, (38, 45, 50), 0.26, 1500)
    padc(49.3, 54.9, (50, 54, 57, 62), 0.18, 2000, att=0.8)
    for k, t0 in enumerate([50.0, 51.3, 52.6]):
        bell(81 + 5 * k, t0, 0.38); bell(93 + 5 * k, t0 + 1.0, 0.32)
    groove(49.6, 54.6, 0.35, sparse=True)
    # ---- peace and algebra (54.7 - 60.7): joyful
    drone(54.6, 61.0, (38, 45, 50), 0.28, 1600)
    padc(54.7, 60.9, (50, 54, 57, 62, 66), 0.22, 2500, att=0.8)
    phrase(54.9, [7, 8, (9, 2), 8, 7, (6, 2), 5, 4, (5, 2), (7, 4)], vel=0.55)
    for i, m in enumerate([81, 86, 90, 93, 98, 102]):
        bell(m, 58.3 + i * 0.13, 0.36)
    # ---- teahouse (60.7 - 70.2): "algebra?!", then the numerals pop out one by one
    drone(60.7, 70.4, (38, 45), 0.24, 900)
    rubab(deg(4), 61.2, 0.5, 0.5); rubab(deg(5), 61.45, 0.5, 0.5); rubab(deg(7), 61.7, 0.55, 1.0)
    padc(63.6, 70.3, (50, 54, 57), 0.17, 1500, att=1.0)
    for k in range(12):
        bell([81, 83, 86, 88, 90, 93][k % 6] + 12 * (k % 2), 64.83 + k * 0.3, 0.22)
    # ---- Europe and today (70.2 - 81.3): proud groove, the tune, the screens
    drone(70.1, 81.6, (38, 45, 50), 0.28, 1400)
    padc(70.2, 81.5, (50, 54, 57, 62), 0.2, 2000)
    groove(70.4, 81.0, 0.55)
    phrase(70.4, tune + [4, 5, 7, 8, (7, 2), 5, 4, 3, 2, (1, 2), (0, 3), None], vel=0.55)
    for i, m in enumerate([86, 90, 93, 98]):
        bell(m, 79.6 + i * 0.12, 0.33)
    # ---- "my phone?!" (81.3 - 85.1)
    drone(81.3, 85.3, (38, 45), 0.24, 900)
    rubab(deg(7), 83.4, 0.55, 0.5); rubab(deg(8), 83.65, 0.55, 0.5); rubab(deg(9), 83.9, 0.6, 1.2)
    # ---- the lesson (85.1 - 100): warm, patient
    drone(85.1, 100.3, (38, 45), 0.26, 800)
    padc(85.2, 100.2, (50, 54, 57), 0.17, 1500, att=2.0)
    phrase(85.8, [(4, 2), None, 5, (4, 2), (2, 2), None, (4, 2), (7, 4)], step=BEAT, vel=0.36, dur=1.2)
    phrase(93.2, [(4, 2), 5, (7, 2), None, 5, (4, 2), (2, 2), (4, 4)], step=BEAT, vel=0.34, dur=1.2)
    # ---- "I'll solve the first question now!" (100 - 103.8): the lift + the three steps
    padc(100.1, 103.9, (50, 54, 57, 62, 66), 0.22, 2600, att=0.5)
    for k, t0 in enumerate([101.6, 102.4, 103.2]):
        bell(86 + 4 * k, t0, 0.34)
    # ---- the teaser (103.8 - end)
    drone(103.8, DUR, (38, 45), 0.26, 800)
    padc(103.9, DUR - 0.3, (50, 54, 57), 0.18, 1600)
    phrase(104.2, [4, None, 3, 4, None, 2, None, (1, 1), 0, None, 4, 5, (4, 2), None, 4, None, 5, 7, None, (7, 2)], step=BEAT / 2, vel=0.42, dur=0.35)
    groove(104.6, 111.5, 0.35, sparse=True)
    rubab(deg(7), 111.9, 0.6, 1.6); rubab(deg(0), 111.9, 0.5, 1.6); rubab(deg(4), 111.9, 0.5, 1.6)
    for i, m in enumerate([86, 90, 93, 98]):
        bell(m, 111.8 + i * 0.1, 0.3)

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
    # the teahouse: a quiet street, the samovar, tea glasses
    for a, b in [(0, 14.5), (60.6, 70.3), (81.2, DUR)]:
        amb(a, b, "city", -13)
    for k in range(6):
        S(0.35 + k * 0.4, G.stroll_step(rr(), 0.7) * 0.5, -13, 0.3)          # Farid's slow steps
    S(1.0, G.whoosh(0.4, rr(), 0.2, 1500, 5000, 0.4, 0.15, 0.3) * 0.25, -15, 0.3)   # the exam paper
    S(7.6, G.clink(rr(), 3600, 0.25, 1.0) * 0.5, -12, -0.2)                   # tea glass
    S(10.4, G.whoosh(0.35, rr(), 0.2, 1200, 4000, 0.4, 0.15, 0.3) * 0.35, -12, 0.2)  # the paper slapped down
    S(24.4, G.whoosh(1.4, rr(), 0.4, 600, 3500, 0.8, 0.4, 0.3) * 0.4, -10, 0.0)      # into the story
    amb(26.7, 33.6, "yard", -9)
    for k in range(4):
        S(27.6 + k * 1.3, G.stroll_step(rr(), 0.7) * 0.5, -14, -0.4 + k * 0.25)
    S(28.0, G.whoosh(1.2, rr(), 0.4, 800, 4000, 0.7, 0.4, 0.3) * 0.3, -13, 0.1)      # golden words
    # the field: wind, birds, two angry voices far under the narration
    amb(33.4, 40.1, "desert", -8)
    S(33.6, G.babble(6.2, rr(), 150, 1.25, 5.0, 0.9, 2400) * 0.06, -12, 0.0)
    amb(40.0, 60.8, "yard", -10)
    S(40.3, G.babble(4.2, rr(), 160, 1.2, 5.0, 0.9, 2400) * 0.05, -14, 0.0)
    S(47.2, G.whoosh(0.8, rr(), 0.3, 1200, 5000, 0.5, 0.3, 0.3) * 0.3, -12, 0.1)     # the idea
    for t0 in [50.0, 51.3, 52.6]:
        S(t0, pop(rr(), 600, True) * 0.5, -10, 0.0)
        S(t0 + 1.0, G.clink(rr(), 3000, 0.25, 0.8) * 0.4, -13, 0.0)                  # ticked
    S(55.2, G.whoosh(1.0, rr(), 0.3, 500, 2600, 0.6, 0.3, 0.2) * 0.3, -12, 0.0)      # the hug
    S(58.2, G.whoosh(1.4, rr(), 0.4, 600, 3500, 0.8, 0.4, 0.3) * 0.4, -10, 0.0)      # a new science
    for k in range(12):
        S(64.83 + k * 0.3, pop(rr(), 700 + 60 * k, True) * 0.3, -15, ((k * 0.37) % 1) - 0.5)   # numerals
    amb(70.1, 74.5, "city", -9)
    amb(74.4, 81.4, "gallery", -9)
    for k in range(10):
        S(75.2 + k * 0.6, pop(rr(), 900 + 80 * (k % 4), True) * 0.25, -16, ((k * 0.61) % 1) - 0.5)  # screens
    S(83.3, G.whoosh(0.5, rr(), 0.2, 1500, 5000, 0.4, 0.15, 0.3) * 0.3, -12, 0.2)
    S(98.4, G.whoosh(0.4, rr(), 0.2, 1500, 5000, 0.4, 0.15, 0.3) * 0.3, -13, 0.2)    # picks up the paper
    for t0 in [101.6, 102.4, 103.2]:
        S(t0, pop(rr(), 650, True) * 0.45, -11, 0.1)
    S(110.6, G.whoosh(2.0, rr(), 0.5, 500, 3000, 0.9, 0.6, 0.3) * 0.3, -11, -0.1)    # crane out


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
