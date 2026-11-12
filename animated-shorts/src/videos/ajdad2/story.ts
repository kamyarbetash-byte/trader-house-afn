// Timeline of "Our ancestors, ep. 2: the eighteen-year-old who cured the king" (Ibn Sina): shots timed to the Dari voices
// (timing.json, made by ajdad-ep2/voice/assemble.py), set positions, cameras. Same camera grammar as the gold short.
export const FPS = 30;
import TIM from "./timing.json";
export const TOTAL = Math.round(TIM.total * FPS); // 103.1 s
export const OUT_FRAMES = TOTAL;
export const srcFrame = (F: number) => F;
export const D0 = 0;
export type V3 = [number, number, number];
/** start / end frame of voice line n ("02".."21") */
export const LINE = (n: string) => { const l = TIM.lines.find((x) => x.n === n)!; return [l.s * FPS, l.e * FPS] as const; };

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- sets (world positions; the gold short's sets are reused as other places) ----------------
export const DIG = { top: 2.2, rTop: 11, rBase: 20, trench: { x: 5, z: 3, floor: 0.6 } };
export const TABLE_DIG: V3 = [8, DIG.top, 5.2];
export const KX = 1000;
export const MUSEUM = { x: KX, z: -20, w: 30, d: 14, h: 9.4 }; // Konya: the madrasa
export const PLAQUE: V3 = [KX + 3.4, 1.85, MUSEUM.z + 0.06];
export const PALACE = { x: 1500, z: -10 };                      // Balkh: the city wall and gate
export const TEA: V3 = [KX, 0, 80];                            // Nishapur: Attar's shop
export const YARD: V3 = [KX, 0, 150];                          // Konya: the teaching courtyard
export const VX = -1000;
export const VDOOR: V3 = [VX, 2.15, -5.72];
export const VTABLE: V3 = [VX, 0, 2];
export const GAL: V3 = [-1000, 0, 200];                        // today: a library / bookshop of the world
export const GCASE_EMPTY: V3 = [-1006, 0, 196];
/** the king's room: an open corner of the gallery, in front of the paintings on the back wall */
export const KR: V3 = [-1003, 0, 192];
/** Kabul rooftop at night (Farid and Baba Kalan): roof deck at y 0, parapet at z = -3, the city 4.5 m below */
export const RX = 2000;
export const ROOF = { x: RX, z: 0, w: 14, d: 10, par: -3.0, city: -4.5 };
export const FSEAT: V3 = [RX - 0.42, 0.5, -2.0];
export const BSEAT: V3 = [RX + 0.48, 0.5, -2.0];
/** desert crossing of the caravan, and the reed in the sunset sky (dig set's open desert) */
export const CAR: V3 = [70, 0, 45];
export const NEYP: V3 = [60, 6, 110];

// ---------------- shots ----------------
export type Light = "day" | "golden" | "night";
export type SetName = "roof" | "yard" | "attar" | "konya" | "library";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetName; sunAz?: number; sunEl?: number; war?: boolean };
const NIGHT = { sunAz: 140, sunEl: 32 };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 150, light: "night", set: "roof", ...NIGHT },            // title + 02 couldn't sleep: Rumi
  { id: 2, a: 150, b: 320, light: "night", set: "roof", ...NIGHT },          // 03 tonight: the eighteen-year-old
  { id: 3, a: 320, b: 435, light: "night", set: "roof", ...NIGHT },          // 04 what can an 18-year-old do?
  { id: 4, a: 435, b: 670, light: "night", set: "roof", ...NIGHT },          // 05 listen. 1000 years ago, near Bukhara
  { id: 5, a: 670, b: 830, light: "golden", set: "yard", sunAz: 140, sunEl: 26 }, // 06 Husayn, the Quran by heart at ten
  { id: 6, a: 830, b: 990, light: "night", set: "yard", ...NIGHT },          // 07 read a book forty times
  { id: 7, a: 990, b: 1080, light: "night", set: "roof", ...NIGHT },         // 08 forty times?!
  { id: 8, a: 1080, b: 1150, light: "night", set: "roof", ...NIGHT },        // 09 but he didn't give up
  { id: 9, a: 1150, b: 1360, light: "golden", set: "attar", sunAz: 130, sunEl: 24 }, // 09 the bookseller: three dirhams
  { id: 10, a: 1360, b: 1545, light: "golden", set: "yard", sunAz: 135, sunEl: 14 }, // 10 the lock opens: alms
  { id: 11, a: 1545, b: 1780, light: "day", set: "konya", sunAz: 140, sunEl: 40 },   // 11 the king is ill, physicians give up
  { id: 12, a: 1780, b: 1980, light: "golden", set: "library", sunAz: 170, sunEl: 66 }, // 12 Ibn Sina cures the king
  { id: 13, a: 1980, b: 2030, light: "night", set: "roof", ...NIGHT },       // 13 his reward? gold?
  { id: 14, a: 2030, b: 2210, light: "night", set: "roof", ...NIGHT },       // 14 the key of the king's library
  { id: 15, a: 2210, b: 2400, light: "golden", set: "library", sunAz: 170, sunEl: 66 }, // 15 the Canon, 600 years in Europe
  { id: 16, a: 2400, b: 2545, light: "day", set: "konya", sunAz: 150, sunEl: 44 },   // 16 Avicenna, father of medicine
  { id: 17, a: 2545, b: 2740, light: "night", set: "roof", ...NIGHT },       // 17 he too was young: he didn't give up
  { id: 18, a: 2740, b: 2815, light: "night", set: "roof", ...NIGHT },       // 18 then I start tonight
  { id: 19, a: 2815, b: TOTAL, light: "night", set: "roof", ...NIGHT },      // 19 bravo; tomorrow: the name in every phone
];
export const XFADE: Record<number, number> = { 5: 16, 6: 10, 7: 10, 9: 12, 10: 10, 11: 12, 12: 10, 13: 10, 15: 14, 16: 10, 17: 12 };
export const FLASH_AT = -100;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// gold-short state the shared world code still asks for (no vault in this film)
export const doorAngle = (_id: number, _f: number) => 0;
export const glowAt = (_id: number, _f: number) => 0;
export const ROCKET_HIT = -1;
export const ROOF_HIT: V3 = [0, 0, 0];
export const locksAt = () => 5;

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });
const P = (x: number, y: number, z: number): V3 => [x, y, z];


const F = FSEAT, B = BSEAT, Fh: V3 = [F[0], 1.42, F[2]], Bh: V3 = [B[0], 1.5, B[2]], mid: V3 = [RX, 1.25, -2.0];
const S = {
  // roof, night
  r1a: (f: number) => zoom(P(RX + 5, 10, 16), P(RX - 2, 2, -40), 46, pushK(f, 0, 0.001)),
  r1b: (f: number) => dolly(P(RX + 0.6, 1.7, 3.2), P(RX - 0.2, 1.25, -2.1), pushK(f, 30, 0.0018), { fov: 42 }),
  r1c: (f: number) => dolly(P(F[0] + 0.3, 1.47, 0.9), Fh, pushK(f, 80, 0.0025), { fov: 36 }),
  r2a: (f: number) => dolly(P(B[0] + 0.25, 1.55, 0.6), Bh, pushK(f, 150, 0.0025), { fov: 34 }),
  r3a: (f: number) => dolly(P(F[0] - 0.15, 1.48, 0.4), Fh, pushK(f, 320, 0.0025, 0.006, 25), { fov: 34, roll: -0.025 }),
  r4a: (f: number) => dolly(P(B[0] + 0.15, 1.53, 0.2), Bh, pushK(f, 435, 0.0022), { fov: 34 }),
  r4b: (f: number) => dolly(P(B[0] + 0.1, 1.52, -0.25), Bh, pushK(f, 560, 0.0025, 0.005, 40), { fov: 34, roll: 0.02 }),
  r7a: (f: number) => dolly(P(F[0] + 0.1, 1.48, 0.3), Fh, pushK(f, 990, 0.002, 0.007, 20), { fov: 34, roll: 0.03 }),
  r8a: (f: number) => dolly(P(B[0] + 0.3, 1.5, 0.4), Bh, pushK(f, 1080, 0.003), { fov: 34 }),
  r13a: (f: number) => dolly(P(F[0] - 0.25, 1.47, 0.3), Fh, pushK(f, 1980, 0.003, 0.008, 20), { fov: 34, roll: -0.02 }),
  r14a: (f: number) => dolly(P(RX + 0.2, 1.45, 2.4), P(RX + 0.1, 1.35, -2.0), pushK(f, 2030, 0.0018), { fov: 42 }),
  r17a: (f: number) => dolly(P(RX + 0.2, 1.5, 3.3), mid, pushK(f, 2545, 0.0015), { fov: 42 }),
  r17b: (f: number) => dolly(P(B[0] + 0.2, 1.52, 0.1), Bh, pushK(f, 2640, 0.0028), { fov: 34, roll: 0.02 }),
  r18a: (f: number) => dolly(P(F[0] - 0.2, 1.47, 0.25), Fh, pushK(f, 2740, 0.003), { fov: 34 }),
  r19a: (f: number) => dolly(P(RX + 0.5, 1.6, 3.4), mid, pushK(f, 2815, 0.0015), { fov: 42 }),
  r19b: (f: number) => dolly(P(F[0] + 0.25, 1.46, 0.5), Fh, pushK(f, 2990, 0.004, 0.008, 20), { fov: 34 }),
  r19c: (f: number) => zoom(P(RX + 4, 8, 17), P(RX - 1, 1.2, -6), 46, pushK(f, 3040, 0.0008)),
  // Bukhara courtyard: the boy and his teacher (golden), the teen alone with a lamp (night), the lock opens (golden)
  y5a: (f: number) => dolly(P(YARD[0] + 0.0, 1.2, YARD[2] + 3.3), P(YARD[0] - 0.05, 0.85, YARD[2] - 0.85), pushK(f, 662, 0.002), { fov: 40 }),
  y6a: (f: number) => dolly(P(YARD[0] + 0.3, 1.05, YARD[2] + 1.6), P(YARD[0], 0.85, YARD[2] - 1.0), pushK(f, 825, 0.0022, 0.005, 30), { fov: 38, roll: -0.02 }),
  y10a: (f: number) => dolly(P(YARD[0] + 0.5, 1.2, YARD[2] + 2.4), P(YARD[0] + 0.2, 1.0, YARD[2] - 0.8), pushK(f, 1355, 0.0018), { fov: 40 }),
  y10b: (f: number) => dolly(P(YARD[0] + 0.5, 1.3, YARD[2] + 3.0), P(YARD[0] + 0.5, 1.1, YARD[2] - 0.8), pushK(f, 1450, 0.0012), { fov: 42 }),
  // the bazaar: the bookseller
  a9a: (f: number) => dolly(P(TEA[0] + 0.6, 1.55, TEA[2] + 5.4), P(TEA[0] + 0.25, 1.2, TEA[2]), pushK(f, 1144, 0.0018), { fov: 42 }),
  a9b: (f: number) => dolly(P(TEA[0] + 0.25, 1.4, TEA[2] + 3.9), P(TEA[0] + 0.12, 1.1, TEA[2] + 0.1), pushK(f, 1285, 0.0022, 0.005, 30), { fov: 38, roll: 0.02 }),
  // the palace (Konya madrasa set): physicians come out shaking their heads; later Europe's university
  k11a: (f: number) => zoom(P(KX + 1.8, 1.5, -3.5), P(KX + 0.2, 1.8, -13), 46, pushK(f, 1539, 0.0015)),
  k16a: (f: number) => zoom(P(KX - 1.8, 1.25, -3.8), P(KX + 0.1, 3.2, -14), 50, pushK(f, 2395, 0.002)),
  // the palace room (library set): the king; later the Canon under the spotlight
  l12a: (f: number) => dolly(P(KR[0] + 0.5, 1.55, KR[2] + 3.6), P(KR[0] + 0.1, 1.05, KR[2] - 0.2), pushK(f, 1775, 0.0018), { fov: 42 }),
  l12b: (f: number) => dolly(P(KR[0] - 0.3, 1.2, KR[2] + 2.0), P(KR[0] - 0.4, 0.95, KR[2] - 0.3), pushK(f, 1900, 0.0025), { fov: 36 }),
  l15a: (f: number) => dolly(P(GAL[0] + 0.25, 1.75, GAL[2] + 2.4), P(GAL[0], 1.32, GAL[2]), pushK(f, 2203, 0.002), { fov: 38 }),
  l15b: (f: number) => dolly(P(GAL[0] + 0.2, 3.6, GAL[2] + 9.0), P(GAL[0], 1.4, GAL[2]), pushK(f, 2290, 0.0012), { fov: 44 }),
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S.r1a }, { f: 20, dur: 45, s: S.r1b }, { f: 80, cut: true, s: S.r1c }],
  2: [{ f: 150, s: S.r2a }],
  3: [{ f: 320, s: S.r3a }],
  4: [{ f: 435, s: S.r4a }, { f: 560, dur: 70, s: S.r4b }],
  5: [{ f: 662, s: S.y5a }],
  6: [{ f: 825, s: S.y6a }],
  7: [{ f: 985, s: S.r7a }],
  8: [{ f: 1080, s: S.r8a }],
  9: [{ f: 1144, s: S.a9a }, { f: 1285, cut: true, s: S.a9b }],
  10: [{ f: 1355, s: S.y10a }, { f: 1450, dur: 70, s: S.y10b }],
  11: [{ f: 1539, s: S.k11a }],
  12: [{ f: 1775, s: S.l12a }, { f: 1900, cut: true, s: S.l12b }],
  13: [{ f: 1975, s: S.r13a }],
  14: [{ f: 2030, s: S.r14a }],
  15: [{ f: 2203, s: S.l15a }, { f: 2290, dur: 90, s: S.l15b }],
  16: [{ f: 2395, s: S.k16a }],
  17: [{ f: 2539, s: S.r17a }, { f: 2640, cut: true, s: S.r17b }],
  18: [{ f: 2740, s: S.r18a }],
  19: [{ f: 2815, s: S.r19a }, { f: 2990, cut: true, s: S.r19b }, { f: 3040, cut: true, s: S.r19c }],
};

// impact kicks (s): the door slams, the rocket, the key grab, the door shut in 1989, the vault door clunk open
const KICKS: [number, number][] = [];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 0 },
  { f: 20, dur: 45, cInf: 7, focus: () => mid },
  { f: 80, cInf: 10, focus: () => Fh },
  { f: 150, cInf: 11, focus: () => Bh },
  { f: 320, cInf: 11, focus: () => Fh },
  { f: 435, cInf: 11, focus: () => Bh },
  { f: 670, cInf: 8, focus: () => [YARD[0] - 0.1, 0.85, YARD[2] - 0.85] },
  { f: 830, cInf: 10, focus: () => [YARD[0], 0.9, YARD[2] - 1.0] },
  { f: 990, cInf: 11, focus: () => Fh },
  { f: 1080, cInf: 11, focus: () => Bh },
  { f: 1150, cInf: 7, focus: () => [TEA[0] + 0.2, 1.3, TEA[2]] },
  { f: 1285, cInf: 8, focus: () => [TEA[0] + 0.2, 1.1, TEA[2] + 0.1] },
  { f: 1360, cInf: 8, focus: () => [YARD[0] + 0.2, 1.0, YARD[2] - 0.8] },
  { f: 1545, cInf: 0 },
  { f: 1780, cInf: 7, focus: () => [KR[0] + 0.1, 1.05, KR[2] - 0.2] },
  { f: 1900, cInf: 10, focus: () => [KR[0] - 0.45, 0.95, KR[2] - 0.3] },
  { f: 1980, cInf: 11, focus: () => Fh },
  { f: 2030, cInf: 8, focus: () => [RX + 0.1, 1.35, -2.0] },
  { f: 2210, cInf: 10, focus: () => [GAL[0], 1.32, GAL[2]] },
  { f: 2290, dur: 90, cInf: 4, focus: () => [GAL[0], 1.32, GAL[2]] },
  { f: 2400, cInf: 0 },
  { f: 2545, cInf: 8, focus: () => mid },
  { f: 2640, cInf: 11, focus: () => Bh },
  { f: 2740, cInf: 11, focus: () => Fh },
  { f: 2815, cInf: 8, focus: () => mid },
  { f: 2990, cInf: 11, focus: () => Fh },
  { f: 3040, dur: 50, cInf: 2, focus: () => mid },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};
export const T_OF = T;
