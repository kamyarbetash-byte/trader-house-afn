// Timeline of "Our ancestors, ep. 1: the reed cut from Balkh": shots timed to the Dari voices (timing.json, made by
// ajdad-ep1/voice/assemble.py), set positions, cameras. Same camera grammar as the gold short.
export const FPS = 30;
import TIM from "./timing.json";
export const TOTAL = Math.round(TIM.total * FPS); // 131.8 s
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
export type SetName = "roof" | "gate" | "desert" | "attar" | "konya" | "yard" | "poem" | "library";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetName; sunAz?: number; sunEl?: number; war?: boolean };
const NIGHT = { sunAz: 140, sunEl: 32 };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 90, light: "night", set: "roof", ...NIGHT },            // title: Kabul at night, down to the roof
  { id: 2, a: 90, b: 168, light: "night", set: "roof", ...NIGHT },          // 02 twenty, no work
  { id: 3, a: 168, b: 350, light: "night", set: "roof", ...NIGHT },         // 03 always war
  { id: 4, a: 350, b: 540, light: "night", set: "roof", ...NIGHT },         // 04 Baba Kalan with tea
  { id: 5, a: 540, b: 600, light: "night", set: "roof", ...NIGHT },         // 05 so what
  { id: 6, a: 600, b: 862, light: "night", set: "roof", ...NIGHT },         // 06 listen. 800 years ago
  { id: 7, a: 862, b: 1025, light: "golden", set: "gate", sunAz: 120, sunEl: 20 },   // 07 Balkh: the family leaves
  { id: 8, a: 1025, b: 1192, light: "golden", set: "desert", sunAz: 22, sunEl: 7 },  // 08 years on the road
  { id: 9, a: 1192, b: 1445, light: "golden", set: "attar", sunAz: 130, sunEl: 24 }, // 09 Nishapur: Attar
  { id: 10, a: 1445, b: 1585, light: "day", set: "konya", sunAz: 140, sunEl: 40 },   // 10 grown up in Konya
  { id: 11, a: 1585, b: 1700, light: "night", set: "roof", ...NIGHT },      // 11 a migrant, like us
  { id: 12, a: 1700, b: 1862, light: "golden", set: "yard", sunAz: 140, sunEl: 26 }, // 12 he became a teacher
  { id: 13, a: 1862, b: 2120, light: "golden", set: "yard", sunAz: 135, sunEl: 12 }, // 13 he began to write: the reed
  { id: 14, a: 2120, b: 2368, light: "golden", set: "poem", sunAz: 18, sunEl: 6 },   // 14 Listen to the reed
  { id: 15, a: 2368, b: 2640, light: "golden", set: "library", sunAz: 170, sunEl: 66 }, // 15 translated, best-selling
  { id: 16, a: 2640, b: 2856, light: "night", set: "roof", ...NIGHT },      // 16 Rumi / Balkhi
  { id: 17, a: 2856, b: 3100, light: "night", set: "roof", ...NIGHT },      // 17 like you, young, homeless
  { id: 18, a: 3100, b: 3380, light: "night", set: "roof", ...NIGHT },      // 18 the poem: up into the stars
  { id: 19, a: 3380, b: 3470, light: "night", set: "roof", ...NIGHT },      // 19 you are from that root
  { id: 20, a: 3470, b: 3545, light: "night", set: "roof", ...NIGHT },      // 20 who else?
  { id: 21, a: 3545, b: TOTAL, light: "night", set: "roof", ...NIGHT },     // 21 tomorrow night ...
];
export const XFADE: Record<number, number> = { 7: 16, 8: 10, 9: 10, 10: 10, 11: 10, 12: 10, 13: 8, 14: 14, 15: 14, 16: 12 };
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
  r1b: (f: number) => dolly(P(RX + 1.0, 1.9, 4.6), P(RX - 0.3, 1.25, -2.2), pushK(f, 40, 0.0015), { fov: 44 }),
  r2a: (f: number) => dolly(P(F[0] + 0.35, 1.45, 1.4), P(F[0], 1.25, F[2]), pushK(f, 90, 0.0025), { fov: 38 }),
  r3a: (f: number) => dolly(P(F[0] - 0.15, 1.5, 0.5), Fh, pushK(f, 168, 0.002, 0.005, 30), { fov: 36, roll: -0.03 }),
  r4a: (f: number) => dolly(P(RX + 0.9, 1.6, 3.6), P(RX + 0.3, 1.2, -2.0), pushK(f, 350, 0.0018), { fov: 44 }),
  r5a: (f: number) => dolly(P(F[0] + 0.1, 1.48, 0.3), Fh, pushK(f, 540, 0.0025), { fov: 34, roll: 0.03 }),
  r6a: (f: number) => dolly(P(B[0] + 0.25, 1.55, 0.6), Bh, pushK(f, 600, 0.0028), { fov: 34 }),
  r6b: (f: number) => dolly(P(B[0] + 0.15, 1.52, -0.8), Bh, pushK(f, 760, 0.003, 0.006, 40), { fov: 32, roll: -0.025 }),
  r11a: (f: number) => dolly(P(F[0] - 0.3, 1.48, 0.35), Fh, pushK(f, 1585, 0.003), { fov: 34, roll: 0.025 }),
  r16a: (f: number) => dolly(P(B[0] + 0.3, 1.5, 0.4), Bh, pushK(f, 2640, 0.0025, 0.005, 30), { fov: 34 }),
  r17a: (f: number) => dolly(P(RX + 0.2, 1.5, 3.3), mid, pushK(f, 2856, 0.0015), { fov: 42 }),
  r18a: (f: number) => dolly(P(RX, 1.5, 2.6), mid, pushK(f, 3100, 0.0015), { fov: 42 }),
  r18b: (f: number) => ({ pos: P(RX + 0.3, 2.2, 4.4), look: P(RX - 22, 70, -150), fov: 50 }),
  r19a: (f: number) => dolly(P(B[0] + 0.2, 1.52, 0.1), Bh, pushK(f, 3380, 0.003), { fov: 34, roll: 0.02 }),
  r20a: (f: number) => dolly(P(F[0] - 0.2, 1.47, 0.2), Fh, pushK(f, 3470, 0.003, 0.006, 25), { fov: 34 }),
  r21a: (f: number) => dolly(P(RX + 0.5, 1.6, 3.4), mid, pushK(f, 3545, 0.0015), { fov: 42 }),
  r21b: (f: number) => zoom(P(RX + 4, 8, 17), P(RX - 1, 1.2, -6), 46, pushK(f, 3700, 0.0008)),
  // Balkh gate (palace set), golden morning
  g7a: (f: number) => zoom(P(PALACE.x + 11, 2.0, PALACE.z + 27), P(PALACE.x + 2.5, 3.2, PALACE.z + 3), 46, pushK(f, 862, 0.0015)),
  g7b: (f: number) => dolly(P(PALACE.x + 9.5, 2.6, PALACE.z + 17.5), P(PALACE.x + 6.0, 2.3, PALACE.z + 10.5), pushK(f, 950, 0.002), { fov: 40, roll: 0.02 }),
  // desert crossing, sun ahead
  d8a: (f: number) => zoom(P(CAR[0] + 2, 2.2, CAR[2] + 26), P(CAR[0], 3.4, CAR[2]), 44, pushK(f, 1025, 0.0012)),
  // Nishapur: Attar
  a9a: (f: number) => dolly(P(TEA[0] + 0.6, 1.55, TEA[2] + 5.4), P(TEA[0] + 0.25, 1.2, TEA[2]), pushK(f, 1192, 0.0018), { fov: 42 }),
  a9b: (f: number) => dolly(P(TEA[0] - 0.05, 1.42, TEA[2] + 2.3), P(TEA[0] - 0.3, 1.35, TEA[2] - 0.2), pushK(f, 1330, 0.0025, 0.006, 30), { fov: 36, roll: -0.025 }),
  // Konya
  k10a: (f: number) => zoom(P(KX + 3.2, 1.7, 3), P(KX + 0.6, 2.8, -14), 44, pushK(f, 1445, 0.002)),
  y12a: (f: number) => dolly(P(YARD[0] + 0.8, 1.7, YARD[2] + 5.8), P(YARD[0], 1.0, YARD[2] - 0.6), pushK(f, 1700, 0.002), { fov: 44 }),
  y13a: (f: number) => dolly(P(YARD[0] + 0.35, 1.05, YARD[2] + 1.5), P(YARD[0], 0.85, YARD[2] - 1.0), pushK(f, 1862, 0.002), { fov: 38 }),
  y13b: (f: number) => dolly(P(YARD[0] + 0.3, 1.2, YARD[2] + 2.2), P(YARD[0], 1.6, YARD[2] - 0.6), pushK(f, 1990, 0.0015), { fov: 42 }),
  // the reed in the sunset sky
  p14a: (f: number) => dolly(P(NEYP[0] + 0.6, NEYP[1] + 0.3, NEYP[2] + 6.5), NEYP, pushK(f, 2120, 0.0025), { fov: 40, roll: 0.02 }),
  // the world's libraries
  l15a: (f: number) => dolly(P(GAL[0] + 0.25, 1.75, GAL[2] + 2.4), P(GAL[0], 1.32, GAL[2]), pushK(f, 2368, 0.002), { fov: 38 }),
  l15b: (f: number) => dolly(P(GAL[0] + 0.2, 3.6, GAL[2] + 9.0), P(GAL[0], 1.4, GAL[2]), pushK(f, 2470, 0.0012), { fov: 44 }),
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S.r1a }, { f: 30, dur: 60, s: S.r1b }],
  2: [{ f: 90, s: S.r2a }],
  3: [{ f: 168, s: S.r3a }],
  4: [{ f: 350, s: S.r4a }],
  5: [{ f: 540, s: S.r5a }],
  6: [{ f: 600, s: S.r6a }, { f: 760, dur: 60, s: S.r6b }],
  7: [{ f: 854, s: S.g7a }, { f: 950, dur: 50, s: S.g7b }],
  8: [{ f: 1020, s: S.d8a }],
  9: [{ f: 1187, s: S.a9a }, { f: 1330, cut: true, s: S.a9b }],
  10: [{ f: 1440, s: S.k10a }],
  11: [{ f: 1580, s: S.r11a }],
  12: [{ f: 1695, s: S.y12a }],
  13: [{ f: 1858, s: S.y13a }, { f: 1990, dur: 60, s: S.y13b }],
  14: [{ f: 2113, s: S.p14a }],
  15: [{ f: 2361, s: S.l15a }, { f: 2470, dur: 90, s: S.l15b }],
  16: [{ f: 2634, s: S.r16a }],
  17: [{ f: 2856, s: S.r17a }],
  18: [{ f: 3100, s: S.r18a }, { f: 3150, dur: 170, s: S.r18b }],
  19: [{ f: 3380, s: S.r19a }],
  20: [{ f: 3470, s: S.r20a }],
  21: [{ f: 3545, s: S.r21a }, { f: 3700, dur: 220, s: S.r21b }],
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
  { f: 40, dur: 50, cInf: 7, focus: () => mid },
  { f: 90, cInf: 10, focus: () => Fh },
  { f: 350, cInf: 8, focus: () => mid },
  { f: 540, cInf: 11, focus: () => Fh },
  { f: 600, cInf: 11, focus: () => Bh },
  { f: 862, cInf: 0 },                                       // Balkh wide
  { f: 950, dur: 50, cInf: 5, focus: () => [PALACE.x + 6.0, 2.0, PALACE.z + 10.5] },
  { f: 1025, cInf: 0 },                                      // desert
  { f: 1192, cInf: 7, focus: () => [TEA[0] + 0.2, 1.3, TEA[2]] },
  { f: 1330, cInf: 11, focus: () => [TEA[0] - 0.3, 1.35, TEA[2] - 0.2] },
  { f: 1445, cInf: 0 },
  { f: 1585, cInf: 11, focus: () => Fh },
  { f: 1700, cInf: 6, focus: () => [YARD[0], 1.2, YARD[2] - 1.0] },
  { f: 1862, cInf: 10, focus: () => [YARD[0], 0.9, YARD[2] - 1.0] },
  { f: 2120, cInf: 6, focus: () => NEYP },
  { f: 2368, cInf: 10, focus: () => [GAL[0], 1.32, GAL[2]] },
  { f: 2470, dur: 90, cInf: 4, focus: () => [GAL[0], 1.32, GAL[2]] },
  { f: 2640, cInf: 11, focus: () => Bh },
  { f: 2856, cInf: 8, focus: () => mid },
  { f: 3150, dur: 120, cInf: 0 },
  { f: 3380, cInf: 11, focus: () => Bh },
  { f: 3470, cInf: 11, focus: () => Fh },
  { f: 3545, cInf: 8, focus: () => mid },
  { f: 3700, dur: 150, cInf: 2, focus: () => mid },
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
