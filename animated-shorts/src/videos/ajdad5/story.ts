// Timeline of "Our ancestors, ep. 5: a word taller than a wall" (Rabia Balkhi): shots timed to the Dari voices
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
export type SetName = "roof" | "yard" | "attar" | "konya" | "library" | "field" | "hill" | "ghazni" | "desert" | "nandana"
  | "garden" | "court" | "cell" | "ruins" | "shrine" | "kabul";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetName; sunAz?: number; sunEl?: number; war?: boolean };
/** (ep4) the hill above Kabul, Nandana, the measuring party: kept for the shared set builder */
export const HX = 3000;
export const HILL = { x: HX, z: 0, top: 10, drop: 28 };
export const BENCH: V3 = [HX, 0, -6];
export const NX = 4000;
export const NM: V3 = [NX, 22, -30];
export const SUM: V3 = [NX + 0.6, 22, -26.2];
export const ROPE = { z: 45, x0: 30, x1: 130 };
/** ep5 frame story: a Kabul garden (Bagh-e Babur style) in the late afternoon. A takht (wooden platform with a carpet)
 *  beside a long water channel lined with cypresses; Baba and Farid sit on it. */
export const GX = 5000;
export const TAKHT: V3 = [GX, 0, -6];
export const BT: V3 = [GX - 0.45, 0.5, -6];
export const FT: V3 = [GX + 0.45, 0.5, -5.95];
/** where Farid stands by the water in the first shot */
export const FE: V3 = [GX + 2.0, 0, -3.2];
export const JUI = { x: GX + 3.2, w: 1.0, z0: 30, z1: -110 };
/** the bath-house cell (Balkh, 10th c.): a small domed stone room, light from star holes in the dome */
export const CX = 7000;
export const CELL = { x: CX, z: 0, r: 3.2, h: 3.4 };
export const WALLPOS: V3 = [CX + 0.1, 2.15, -CELL.r + 0.05];
/** today: Rabia's tomb in Balkh (blue-tiled dome on a plinth) */
export const SX = 6000;
export const TOMB = { x: SX, z: -12, r: 4.2, h: 5.0 };
const GL = { sunAz: 125, sunEl: 22 };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 200, light: "golden", set: "garden", ...GL },     // 02 I tore up my poem; they laughed
  { id: 2, a: 200, b: 430, light: "golden", set: "garden", ...GL },   // 03 tore it? come, sit by the water
  { id: 3, a: 430, b: 535, light: "golden", set: "garden", ...GL },   // 04 who listens? my words are worth nothing
  { id: 4, a: 535, b: 845, light: "golden", set: "garden", ...GL },   // 05 a thousand years ago in Balkh, a girl... Rabia Balkhi
  { id: 5, a: 845, b: 1035, light: "golden", set: "library" },        // 06 the emir's daughter, reading since childhood
  { id: 6, a: 1035, b: 1173, light: "golden", set: "library" },       // 07 the first woman poet of Dari
  { id: 7, a: 1173, b: 1243, light: "golden", set: "garden", ...GL },  // 08 a girl? in those days?
  { id: 8, a: 1243, b: 1465, light: "golden", set: "garden", ...GL },  // 09 her fame reached Bukhara
  { id: 9, a: 1465, b: 1665, light: "day", set: "court", sunAz: 140, sunEl: 40 }, // 10 Rudaki heard her poems, amazed
  { id: 10, a: 1665, b: 1850, light: "golden", set: "garden", ...GL }, // 11 not everyone was happy: her brother Harith
  { id: 11, a: 1850, b: 2020, light: "golden", set: "cell" },          // 12 Harith locked her in a bath-house
  { id: 12, a: 2020, b: 2130, light: "golden", set: "garden", ...GL }, // 13 locked up? and her poem?
  { id: 13, a: 2130, b: 2300, light: "golden", set: "cell" },          // 14 she did not give up: her last poem on the wall
  { id: 14, a: 2300, b: 2550, light: "golden", set: "cell" },          // 15 the poem
  { id: 15, a: 2550, b: 2745, light: "golden", set: "ruins", sunAz: 120, sunEl: 12 }, // 16 the wall is gone; the poem travelled
  { id: 16, a: 2745, b: 2870, light: "day", set: "shrine", sunAz: 135, sunEl: 42 },   // 17 her tomb in Balkh
  { id: 17, a: 2870, b: 2995, light: "day", set: "kabul", sunAz: 140, sunEl: 40 },    // 17 schools and hospitals in Kabul
  { id: 18, a: 2995, b: 3195, light: "golden", set: "garden", ...GL }, // 18 a word is taller than a wall
  { id: 19, a: 3195, b: 3320, light: "golden", set: "garden", ...GL }, // 19 I'll write it again and read it aloud!
  { id: 20, a: 3320, b: TOTAL, light: "golden", set: "garden", sunAz: 125, sunEl: 18 }, // 20 bravo; next: a painter of Herat
];
export const XFADE: Record<number, number> = { 5: 16, 9: 10, 11: 12, 13: 10, 15: 16, 16: 10, 17: 10, 18: 12 };
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


const Bh: V3 = [BT[0], 1.48, BT[2]], Fh: V3 = [FT[0], 1.42, FT[2]], hmid: V3 = [GX, 1.15, BT[2] - 0.2];
const Feh: V3 = [FE[0], 1.45, FE[2]];
const LIB: V3 = [1000, 0, 150];
/** Bukhara court (palace set): Rudaki and the messenger in front of the gate */
const PX = PALACE.x, PZ = PALACE.z;
export const RUD: V3 = [PX - 0.7, 0, PZ + 3.2];
export const MSG: V3 = [PX + 0.75, 0, PZ + 3.5];
const S = {
  // the garden
  g1a: (f: number) => zoom(P(GX + 4.6, 2.4, 6.5), P(GX + 1.4, 1.0, -6.5), 46, pushK(f, 0, 0.0016)),
  g1b: (f: number) => dolly(P(FE[0] - 0.55, 1.5, FE[2] + 2.4), Feh, pushK(f, 105, 0.0025, 0.006, 25), { fov: 36 }),
  g2a: (f: number) => dolly(P(BT[0] + 0.3, 1.5, BT[2] + 2.6), Bh, pushK(f, 200, 0.0022), { fov: 36 }),
  g2b: (f: number) => dolly(P(GX + 0.9, 1.75, BT[2] + 5.2), P(GX + 0.35, 1.0, BT[2] - 0.6), pushK(f, 300, 0.0015), { fov: 44 }),
  g3a: (f: number) => dolly(P(FT[0] - 0.1, 1.45, FT[2] + 2.0), Fh, pushK(f, 430, 0.0025, 0.007, 25), { fov: 34, roll: -0.025 }),
  g4a: (f: number) => dolly(P(GX + 0.1, 1.45, BT[2] + 3.6), hmid, pushK(f, 535, 0.0015), { fov: 42 }),
  g4b: (f: number) => dolly(P(BT[0] + 0.2, 1.5, BT[2] + 2.0), Bh, pushK(f, 700, 0.003, 0.006, 40), { fov: 34, roll: 0.02 }),
  g7a: (f: number) => dolly(P(FT[0] + 0.15, 1.45, FT[2] + 1.9), Fh, pushK(f, 1173, 0.002, 0.009, 18), { fov: 34, roll: 0.03 }),
  g8a: (f: number) => dolly(P(GX - 0.6, 1.6, BT[2] + 3.4), [GX - 0.1, 1.3, BT[2] - 0.3], pushK(f, 1243, 0.0016), { fov: 44 }),
  g10a: (f: number) => dolly(P(BT[0] + 0.15, 1.45, BT[2] + 2.1), Bh, pushK(f, 1665, 0.0035), { fov: 34, roll: -0.015 }),
  g12a: (f: number) => dolly(P(FT[0] - 0.12, 1.45, FT[2] + 1.8), Fh, pushK(f, 2020, 0.002, 0.012, 14), { fov: 34, roll: 0.03 }),
  g18a: (f: number) => dolly(P(GX + 0.1, 1.45, BT[2] + 3.4), hmid, pushK(f, 2995, 0.0016), { fov: 42 }),
  g18b: (f: number) => dolly(P(BT[0] + 0.2, 1.5, BT[2] + 2.0), Bh, pushK(f, 3110, 0.003), { fov: 34 }),
  g19a: (f: number) => dolly(P(FT[0] + 0.35, 1.7, FT[2] + 3.2), [FT[0] + 0.25, 1.35, FT[2]], pushK(f, 3195, 0.0022), { fov: 42 }),
  g20a: (f: number) => dolly(P(GX + 0.1, 1.5, BT[2] + 3.5), hmid, pushK(f, 3320, 0.0015), { fov: 42 }),
  g20c: (f: number) => zoom(P(GX - 3, 7.5, BT[2] + 16), P(GX + 0.5, 0.8, BT[2] - 4), 44, pushK(f, 3480, 0.0008)),
  // Balkh: the library of the emir's palace (House of Wisdom set)
  l5a: (f: number) => dolly(P(LIB[0] + 0.9, 1.25, LIB[2] + 2.3), [LIB[0] + 0.15, 0.75, LIB[2] - 0.6], pushK(f, 845, 0.0022), { fov: 40 }),
  l6a: (f: number) => dolly(P(LIB[0] - 0.4, 1.55, LIB[2] + 2.6), [LIB[0] + 0.1, 1.45, LIB[2] - 0.7], pushK(f, 1035, 0.0028, 0.006, 30), { fov: 38 }),
  // Bukhara: Rudaki hears her poem
  c9a: (f: number) => zoom(P(PX + 0.3, 1.6, PZ + 9.0), P(PX, 1.5, PZ + 3.2), 40, pushK(f, 1465, 0.0015)),
  c9b: (f: number) => dolly(P(RUD[0] + 0.25, 1.5, RUD[2] + 2.2), [RUD[0], 1.45, RUD[2]], pushK(f, 1565, 0.004, 0.01, 20), { fov: 34 }),
  // the bath-house cell
  x11a: (f: number) => dolly(P(CX + 0.2, 1.5, 2.8), [CX + 0.15, 1.2, -1.0], pushK(f, 1850, 0.0018), { fov: 52 }),
  x11b: (f: number) => dolly(P(CX - 0.4, 1.4, 0.4), [CX - 0.6, 1.35, -1.6], pushK(f, 1950, 0.0035), { fov: 36, roll: -0.02 }),
  x13a: (f: number) => dolly(P(CX + 0.9, 1.4, 0.8), [CX + 0.05, 1.75, -2.6], pushK(f, 2130, 0.0022), { fov: 50 }),
  x14a: (f: number) => dolly(P(CX + 0.15, 1.35, 0.3), [CX + 0.1, 1.85, -2.7], pushK(f, 2300, 0.0018), { fov: 48 }),
  // the ruins at sunset: the poem flies up
  r15a: (f: number) => zoom(P(-3, 2.6, 13), P(0.5, 4.8, -3), 50, pushK(f, 2550, 0.001)),
  // today: Balkh, the tomb; Kabul, the school
  s16a: (f: number) => zoom(P(SX + 3.5, 1.7, TOMB.z + 18), P(SX, 4.2, TOMB.z), 48, pushK(f, 2745, 0.0016)),
  k17a: (f: number): Shot => ({ pos: P(1000 + 2.0 - 0.006 * (f - 2870), 1.6, 12), look: P(1000 - 0.5, 2.6, -20), fov: 50 }),
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S.g1a }, { f: 105, cut: true, s: S.g1b }],
  2: [{ f: 200, s: S.g2a }, { f: 300, cut: true, s: S.g2b }],
  3: [{ f: 430, s: S.g3a }],
  4: [{ f: 535, s: S.g4a }, { f: 700, cut: true, s: S.g4b }],
  5: [{ f: 837, s: S.l5a }],
  6: [{ f: 1035, s: S.l6a }],
  7: [{ f: 1173, s: S.g7a }],
  8: [{ f: 1243, s: S.g8a }],
  9: [{ f: 1460, s: S.c9a }, { f: 1565, cut: true, s: S.c9b }],
  10: [{ f: 1665, s: S.g10a }],
  11: [{ f: 1844, s: S.x11a }, { f: 1950, cut: true, s: S.x11b }],
  12: [{ f: 2020, s: S.g12a }],
  13: [{ f: 2125, s: S.x13a }],
  14: [{ f: 2300, s: S.x14a }],
  15: [{ f: 2542, s: S.r15a }],
  16: [{ f: 2740, s: S.s16a }],
  17: [{ f: 2865, s: S.k17a }],
  18: [{ f: 2989, s: S.g18a }, { f: 3110, cut: true, s: S.g18b }],
  19: [{ f: 3195, s: S.g19a }],
  20: [{ f: 3320, s: S.g20a }, { f: 3480, dur: 80, s: S.g20c }],
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
  { f: 0, cInf: 6, focus: () => [FE[0], 1.2, FE[2]] },
  { f: 105, cInf: 10, focus: () => Feh },
  { f: 200, cInf: 10, focus: () => Bh },
  { f: 300, cInf: 7, focus: () => [GX + 0.6, 1.0, BT[2] - 0.2] },
  { f: 430, cInf: 10, focus: () => Fh },
  { f: 535, cInf: 7, focus: () => hmid },
  { f: 700, cInf: 10, focus: () => Bh },
  { f: 845, cInf: 6, focus: () => [LIB[0] + 0.15, 0.8, LIB[2] - 0.5] },
  { f: 1035, cInf: 7, focus: () => [LIB[0] + 0.1, 1.45, LIB[2] - 0.7] },
  { f: 1173, cInf: 10, focus: () => Fh },
  { f: 1243, cInf: 6, focus: () => hmid },
  { f: 1465, cInf: 4, focus: () => [PX, 1.4, PZ + 3.3] },
  { f: 1565, cInf: 9, focus: () => [RUD[0], 1.45, RUD[2]] },
  { f: 1665, cInf: 10, focus: () => Bh },
  { f: 1850, cInf: 5, focus: () => [CX, 1.2, -1.0] },
  { f: 1950, cInf: 8, focus: () => [CX - 0.6, 1.35, -1.6] },
  { f: 2020, cInf: 10, focus: () => Fh },
  { f: 2130, cInf: 5, focus: () => [CX + 0.1, 1.5, -2.25] },
  { f: 2300, cInf: 5, focus: () => [CX + 0.1, 1.6, -2.3] },
  { f: 2550, cInf: 0 },
  { f: 2745, cInf: 3, focus: () => [SX, 2.5, TOMB.z + 6] },
  { f: 2870, cInf: 3, focus: () => [1000, 1.4, 4] },
  { f: 2995, cInf: 7, focus: () => hmid },
  { f: 3110, cInf: 10, focus: () => Bh },
  { f: 3195, cInf: 7, focus: () => [FT[0] + 0.25, 1.35, FT[2]] },
  { f: 3320, cInf: 7, focus: () => hmid },
  { f: 3480, dur: 60, cInf: 2, focus: () => hmid },
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
