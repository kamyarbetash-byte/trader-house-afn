// Timeline of "Our ancestors, ep. 3: step by step" (al-Khwarizmi): shots timed to the Dari voices
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
export type SetName = "roof" | "yard" | "attar" | "konya" | "library" | "field";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetName; sunAz?: number; sunEl?: number; war?: boolean };
/** teahouse seats (takht top at y 0.48): Baba on the left, Farid on the right; Farid walks in from the street on the right */
export const BT: V3 = [TEA[0] - 0.4, 0.5, TEA[2] - 0.3];
export const FT: V3 = [TEA[0] + 0.5, 0.5, TEA[2] - 0.25];
/** the inherited field in front of Baghdad's wall (palace set) */
export const FIELD: V3 = [PALACE.x, 0, PALACE.z + 9];
const TEAL = { sunAz: 125, sunEl: 20 };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 125, light: "golden", set: "attar", ...TEAL },     // 02 Farid walks in: failed maths, thirty out of a hundred
  { id: 2, a: 125, b: 300, light: "golden", set: "attar", ...TEAL },   // 03 Baba: sit, have tea
  { id: 3, a: 300, b: 430, light: "golden", set: "attar", ...TEAL },   // 04 maths is useless! (angry)
  { id: 4, a: 430, b: 805, light: "golden", set: "attar", ...TEAL },   // 05 nobody? listen: Muhammad al-Khwarizmi
  { id: 5, a: 805, b: 1005, light: "golden", set: "yard", sunAz: 140, sunEl: 30 }, // 06 Baghdad, the House of Wisdom
  { id: 6, a: 1005, b: 1200, light: "day", set: "field", sunAz: 150, sunEl: 42 },  // 07 two brothers, one inherited field
  { id: 7, a: 1200, b: 1475, light: "golden", set: "yard", sunAz: 140, sunEl: 30 }, // 08 everyone said hard; step by step
  { id: 8, a: 1475, b: 1640, light: "golden", set: "yard", sunAz: 140, sunEl: 30 }, // 09 big problem in small steps
  { id: 9, a: 1640, b: 1820, light: "golden", set: "yard", sunAz: 140, sunEl: 22 }, // 10 the brothers make peace: algebra
  { id: 10, a: 1820, b: 1905, light: "golden", set: "attar", ...TEAL }, // 11 algebra?! the one we learn at school?
  { id: 11, a: 1905, b: 2105, light: "golden", set: "attar", ...TEAL }, // 12 the numerals and zero
  { id: 12, a: 2105, b: 2232, light: "day", set: "konya", sunAz: 150, sunEl: 44 },  // 13 Europe: "Algoritmi"
  { id: 13, a: 2232, b: 2440, light: "golden", set: "library", sunAz: 170, sunEl: 66 }, // 14 today: every phone
  { id: 14, a: 2440, b: 2552, light: "golden", set: "attar", ...TEAL }, // 15 my phone works by his name?!
  { id: 15, a: 2552, b: 2770, light: "golden", set: "attar", ...TEAL }, // 16 like Ibn Sina, he was not afraid
  { id: 16, a: 2770, b: 2998, light: "golden", set: "attar", ...TEAL }, // 17 your exam too: step by step
  { id: 17, a: 2998, b: 3115, light: "golden", set: "attar", ...TEAL }, // 18 I'll solve the first question now!
  { id: 18, a: 3115, b: TOTAL, light: "golden", set: "attar", sunAz: 125, sunEl: 14 }, // 19 bravo; next: the man who measured the earth
];
export const XFADE: Record<number, number> = { 5: 16, 6: 10, 7: 10, 9: 10, 10: 10, 12: 12, 13: 12, 14: 12 };
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


const Bh: V3 = [BT[0], 1.48, BT[2]], Fh: V3 = [FT[0], 1.42, FT[2]], tmid: V3 = [TEA[0] + 0.05, 1.2, TEA[2] - 0.3];
const [YX, , YZ] = YARD, KH: V3 = [YX - 0.1, 0.95, YZ - 1.0];
const S = {
  // teahouse, late golden afternoon
  t1a: (f: number) => dolly(P(TEA[0] + 2.0, 1.45, TEA[2] + 5.0), P(TEA[0] + 2.4 - 0.6 * glide(f / 75), 1.15, TEA[2] + 1.3), pushK(f, 0, 0.002), { fov: 40 }),
  t1b: (f: number) => dolly(P(TEA[0] + 0.85, 1.5, TEA[2] + 6.2), P(TEA[0] + 0.75, 1.1, TEA[2] - 0.1), pushK(f, 75, 0.002), { fov: 42 }),
  t2a: (f: number) => dolly(P(BT[0] + 0.25, 1.5, BT[2] + 2.6), Bh, pushK(f, 125, 0.0022), { fov: 36 }),
  t3a: (f: number) => dolly(P(FT[0] - 0.1, 1.45, FT[2] + 2.0), Fh, pushK(f, 300, 0.0025, 0.007, 25), { fov: 34, roll: -0.025 }),
  t4a: (f: number) => dolly(P(TEA[0] + 0.1, 1.45, TEA[2] + 3.6), tmid, pushK(f, 430, 0.0015), { fov: 42 }),
  t4b: (f: number) => dolly(P(BT[0] + 0.2, 1.5, BT[2] + 2.0), Bh, pushK(f, 640, 0.003, 0.006, 40), { fov: 34, roll: 0.02 }),
  t10a: (f: number) => dolly(P(FT[0] + 0.1, 1.45, FT[2] + 1.8), Fh, pushK(f, 1820, 0.002, 0.009, 18), { fov: 34, roll: 0.03 }),
  t11a: (f: number) => dolly(P(BT[0] + 0.3, 1.55, BT[2] + 2.6), [BT[0], 1.6, BT[2]], pushK(f, 1905, 0.002), { fov: 40 }),
  t14a: (f: number) => dolly(P(FT[0] - 0.15, 1.45, FT[2] + 1.9), Fh, pushK(f, 2440, 0.003, 0.009, 18), { fov: 34, roll: -0.02 }),
  t15a: (f: number) => dolly(P(TEA[0] + 0.05, 1.45, TEA[2] + 3.3), tmid, pushK(f, 2552, 0.0016), { fov: 42 }),
  t16a: (f: number) => dolly(P(BT[0] + 0.2, 1.5, BT[2] + 2.1), Bh, pushK(f, 2770, 0.0025), { fov: 34 }),
  t16b: (f: number) => dolly(P(FT[0] - 0.1, 1.45, FT[2] + 2.0), Fh, pushK(f, 2900, 0.003), { fov: 34 }),
  t17a: (f: number) => dolly(P(FT[0] + 0.05, 1.42, FT[2] + 1.9), Fh, pushK(f, 2998, 0.003, 0.008, 20), { fov: 34 }),
  t18a: (f: number) => dolly(P(TEA[0] + 0.1, 1.5, TEA[2] + 3.5), tmid, pushK(f, 3115, 0.0015), { fov: 42 }),
  t18c: (f: number) => zoom(P(TEA[0] + 3, 6.5, TEA[2] + 16), P(TEA[0], 1.2, TEA[2] - 2), 44, pushK(f, 3320, 0.0008)),
  // Baghdad: the House of Wisdom (courtyard with book walls)
  y5a: (f: number) => dolly(P(YX + 1.2, 2.4, YZ + 7.0), P(YX, 1.1, YZ - 1.2), pushK(f, 800, 0.0022), { fov: 44 }),
  y5b: (f: number) => dolly(P(YX + 0.2, 1.15, YZ + 2.2), KH, pushK(f, 900, 0.002), { fov: 38 }),
  y7a: (f: number) => dolly(P(YX + 0.05, 1.45, YZ + 5.6), P(YX + 0.0, 1.0, YZ - 0.6), pushK(f, 1195, 0.0015), { fov: 46 }),
  y7b: (f: number) => dolly(P(YX - 0.05, 1.1, YZ + 1.7), KH, pushK(f, 1385, 0.003, 0.007, 25), { fov: 36 }),
  y8a: (f: number) => dolly(P(YX + 0.15, 1.45, YZ + 2.6), P(YX + 0.0, 1.35, YZ - 1.0), pushK(f, 1470, 0.0018), { fov: 40 }),
  y9a: (f: number) => dolly(P(YX + 0.2, 1.4, YZ + 4.4), P(YX + 0.15, 1.05, YZ - 0.5), pushK(f, 1635, 0.0018), { fov: 42 }),
  // the field before the city wall: the quarrel
  f6a: (f: number) => zoom(P(FIELD[0] + 1.2, 1.7, FIELD[2] + 7.5), P(FIELD[0], 1.2, FIELD[2] - 0.8), 44, pushK(f, 1000, 0.002)),
  f6b: (f: number) => dolly(P(FIELD[0] + 0.15, 1.4, FIELD[2] + 4.4), P(FIELD[0], 1.25, FIELD[2]), pushK(f, 1100, 0.003, 0.007, 25), { fov: 40, roll: 0.02 }),
  // Europe (madrasa set) and today (library set)
  k12a: (f: number) => zoom(P(KX - 1.8, 1.25, -3.8), P(KX + 0.1, 3.2, -14), 50, pushK(f, 2100, 0.002)),
  l13a: (f: number) => dolly(P(GAL[0] + 0.2, 3.2, GAL[2] + 8.0), P(GAL[0], 1.4, GAL[2]), pushK(f, 2225, 0.0016), { fov: 44 }),
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S.t1a }, { f: 75, cut: true, s: S.t1b }],
  2: [{ f: 125, s: S.t2a }],
  3: [{ f: 300, s: S.t3a }],
  4: [{ f: 430, s: S.t4a }, { f: 640, cut: true, s: S.t4b }],
  5: [{ f: 797, s: S.y5a }, { f: 900, cut: true, s: S.y5b }],
  6: [{ f: 1000, s: S.f6a }, { f: 1100, cut: true, s: S.f6b }],
  7: [{ f: 1195, s: S.y7a }, { f: 1385, cut: true, s: S.y7b }],
  8: [{ f: 1470, s: S.y8a }],
  9: [{ f: 1635, s: S.y9a }],
  10: [{ f: 1815, s: S.t10a }],
  11: [{ f: 1905, s: S.t11a }],
  12: [{ f: 2099, s: S.k12a }],
  13: [{ f: 2226, s: S.l13a }],
  14: [{ f: 2434, s: S.t14a }],
  15: [{ f: 2552, s: S.t15a }],
  16: [{ f: 2770, s: S.t16a }, { f: 2900, cut: true, s: S.t16b }],
  17: [{ f: 2998, s: S.t17a }],
  18: [{ f: 3115, s: S.t18a }, { f: 3320, dur: 70, s: S.t18c }],
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
  { f: 0, cInf: 8, focus: () => [TEA[0] + 2.0, 1.3, TEA[2] + 1.1] },
  { f: 75, cInf: 5, focus: () => [TEA[0] + 0.75, 1.2, TEA[2] + 0.2] },
  { f: 125, cInf: 10, focus: () => Bh },
  { f: 300, cInf: 10, focus: () => Fh },
  { f: 430, cInf: 7, focus: () => tmid },
  { f: 640, cInf: 10, focus: () => Bh },
  { f: 805, cInf: 5, focus: () => [YX, 1.1, YZ - 1.2] },
  { f: 900, cInf: 9, focus: () => KH },
  { f: 1005, cInf: 5, focus: () => [FIELD[0], 1.3, FIELD[2]] },
  { f: 1100, cInf: 9, focus: () => [FIELD[0], 1.35, FIELD[2]] },
  { f: 1200, cInf: 6, focus: () => [YX + 0.3, 1.0, YZ - 0.6] },
  { f: 1385, cInf: 9, focus: () => KH },
  { f: 1475, cInf: 7, focus: () => [YX, 1.3, YZ - 1.0] },
  { f: 1640, cInf: 7, focus: () => [YX + 0.7, 1.05, YZ - 0.4] },
  { f: 1820, cInf: 10, focus: () => Fh },
  { f: 1905, cInf: 9, focus: () => [BT[0], 1.6, BT[2]] },
  { f: 2105, cInf: 0 },
  { f: 2232, cInf: 4, focus: () => [GAL[0], 1.4, GAL[2]] },
  { f: 2440, cInf: 10, focus: () => Fh },
  { f: 2552, cInf: 7, focus: () => tmid },
  { f: 2770, cInf: 10, focus: () => Bh },
  { f: 2900, cInf: 10, focus: () => Fh },
  { f: 3115, cInf: 7, focus: () => tmid },
  { f: 3320, dur: 60, cInf: 2, focus: () => tmid },
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
