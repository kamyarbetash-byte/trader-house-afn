// Timeline of "Our ancestors, ep. 4: a mountain and a mind" (al-Biruni): shots timed to the Dari voices
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
export type SetName = "roof" | "yard" | "attar" | "konya" | "library" | "field" | "hill" | "ghazni" | "desert" | "nandana";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetName; sunAz?: number; sunEl?: number; war?: boolean };
/** the hill above Kabul at sunset (frame story): plateau top at y 0, a flat stone bench near the edge, the city 28 m below */
export const HX = 3000;
export const HILL = { x: HX, z: 0, top: 10, drop: 28 };
export const BENCH: V3 = [HX, 0, -6];
export const BT: V3 = [HX - 0.45, 0.5, -6];
export const FT: V3 = [HX + 0.45, 0.5, -5.95];
/** where Farid stands at the edge in the first shot */
export const FE: V3 = [HX + 1.35, 0, -8.0];
/** Nandana: a plain, the salt-range mountain (top y 22 at NM) and a small fort */
export const NX = 4000;
export const NM: V3 = [NX, 22, -30];
export const SUM: V3 = [NX + 0.6, 22, -26.2];
/** the caliph's measuring party in the desert (dig set's open desert) */
export const ROPE = { z: 45, x0: 30, x1: 130 };
/** the lead man of the measuring party walks from CX0 to CX1 between CT0 and CT1 (s) */
export const CREW = { x0: 53.2, x1: 61.4, t0: 35.9, t1: 44.2 };
export const crewLead = (t: number) => CREW.x0 + (CREW.x1 - CREW.x0) * clamp01((t - CREW.t0) / (CREW.t1 - CREW.t0));
const HL = { sunAz: 118, sunEl: 19 };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 215, light: "golden", set: "hill", ...HL },     // 02 the science contest: they have everything, we have nothing
  { id: 2, a: 215, b: 400, light: "golden", set: "hill", ...HL },   // 03 nothing? come, sit
  { id: 3, a: 400, b: 505, light: "golden", set: "hill", ...HL },   // 04 nobody can do anything! (angry)
  { id: 4, a: 505, b: 855, light: "golden", set: "hill", ...HL },   // 05 nobody? a man from Khorasan measured the whole earth
  { id: 5, a: 855, b: 1070, light: "day", set: "ghazni", sunAz: 140, sunEl: 40 },  // 06 Khwarazm, Ghazni, Sultan Mahmud's court
  { id: 6, a: 1070, b: 1325, light: "day", set: "desert", sunAz: 130, sunEl: 45 }, // 07 the caliph's parties with ropes and poles
  { id: 7, a: 1325, b: 1570, light: "day", set: "nandana", sunAz: 140, sunEl: 35 }, // 08 no party, no money: alone, from a mountain
  { id: 8, a: 1570, b: 1735, light: "day", set: "nandana", sunAz: 140, sunEl: 35 }, // 09 the mountain's height with a triangle
  { id: 9, a: 1735, b: 1960, light: "golden", set: "nandana", sunAz: 120, sunEl: 16 }, // 10 on top: the dip of the horizon
  { id: 10, a: 1960, b: 2080, light: "golden", set: "hill", ...HL },  // 11 the horizon? where the sky meets the earth?
  { id: 11, a: 2080, b: 2315, light: "golden", set: "hill", ...HL },  // 12 one small angle, a little sum: the whole world
  { id: 12, a: 2315, b: 2485, light: "golden", set: "nandana", sunAz: 120, sunEl: 14 }, // 13 he wrote: 6340 km
  { id: 13, a: 2485, b: 2695, light: "night", set: "roof" },          // 14 today, satellites: 6371
  { id: 14, a: 2695, b: 2800, light: "golden", set: "hill", ...HL },  // 15 a mountain and an astrolabe?!
  { id: 15, a: 2800, b: 3030, light: "golden", set: "hill", ...HL },  // 16 and a mind
  { id: 16, a: 3030, b: 3230, light: "golden", set: "hill", ...HL },  // 17 you have a pen, a notebook, this hill
  { id: 17, a: 3230, b: 3415, light: "golden", set: "hill", ...HL },  // 18 my project: this hill's height with a triangle!
  { id: 18, a: 3415, b: TOTAL, light: "golden", set: "hill", sunAz: 118, sunEl: 16 }, // 19 bravo; next: a princess of Balkh
];
export const XFADE: Record<number, number> = { 5: 16, 6: 10, 7: 10, 9: 10, 10: 12, 12: 12, 13: 12, 14: 12 };
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


const Bh: V3 = [BT[0], 1.48, BT[2]], Fh: V3 = [FT[0], 1.42, FT[2]], hmid: V3 = [HX, 1.15, BT[2] - 0.2];
const Feh: V3 = [FE[0], 1.45, FE[2]];
const PX = PALACE.x, PZ = PALACE.z;
/** Biruni's walk past the Ghazni gate and across the Nandana plain */
export const GW = { x0: PX - 3.2, x1: PX + 0.6, z: PZ + 3.6 };
export const NW = { x0: NX - 5.0, x1: NX - 0.6, z: 7.0 };
const S = {
  // the hill above Kabul at sunset
  h1a: (f: number) => dolly(P(HX + 0.2, 2.9, -1.2), P(HX + 0.9, 0.7, -8.6), pushK(f, 0, 0.0016), { fov: 46 }),
  h1b: (f: number) => dolly(P(FE[0] - 0.45, 1.55, FE[2] + 2.5), Feh, pushK(f, 110, 0.0025, 0.006, 25), { fov: 36 }),
  h2a: (f: number) => dolly(P(BT[0] + 0.3, 1.5, BT[2] + 2.6), Bh, pushK(f, 215, 0.0022), { fov: 36 }),
  h2b: (f: number) => dolly(P(HX + 0.6, 1.7, BT[2] + 4.6), P(HX + 0.5, 1.0, BT[2] - 1.0), pushK(f, 300, 0.0015), { fov: 42 }),
  h3a: (f: number) => dolly(P(FT[0] - 0.1, 1.45, FT[2] + 2.0), Fh, pushK(f, 400, 0.0025, 0.007, 25), { fov: 34, roll: -0.025 }),
  h4a: (f: number) => dolly(P(HX + 0.1, 1.45, BT[2] + 3.6), hmid, pushK(f, 505, 0.0015), { fov: 42 }),
  h4b: (f: number) => dolly(P(BT[0] + 0.2, 1.5, BT[2] + 2.0), Bh, pushK(f, 690, 0.003, 0.006, 40), { fov: 34, roll: 0.02 }),
  h10a: (f: number) => dolly(P(FT[0] + 0.15, 1.45, FT[2] + 1.9), Fh, pushK(f, 1960, 0.002, 0.009, 18), { fov: 34, roll: 0.03 }),
  h11a: (f: number) => dolly(P(HX + 0.05, 1.5, BT[2] + 3.9), [HX, 1.7, BT[2] - 0.5], pushK(f, 2080, 0.0012), { fov: 46 }),
  h14a: (f: number) => dolly(P(FT[0] - 0.15, 1.45, FT[2] + 1.9), Fh, pushK(f, 2695, 0.003, 0.009, 18), { fov: 34, roll: -0.02 }),
  h15a: (f: number) => dolly(P(BT[0] + 0.2, 1.5, BT[2] + 2.1), Bh, pushK(f, 2800, 0.0025), { fov: 34 }),
  h16a: (f: number) => dolly(P(HX + 0.05, 1.45, BT[2] + 3.4), hmid, pushK(f, 3030, 0.0016), { fov: 42 }),
  h17a: (f: number) => dolly(P(FT[0] + 0.35, 1.7, FT[2] + 3.2), [FT[0] + 0.25, 1.35, FT[2]], pushK(f, 3230, 0.0022), { fov: 42 }),
  h18a: (f: number) => dolly(P(HX + 0.1, 1.5, BT[2] + 3.5), hmid, pushK(f, 3415, 0.0015), { fov: 42 }),
  h18c: (f: number) => zoom(P(HX + 4, 6.5, BT[2] + 15), P(HX, 0.6, BT[2] - 3), 44, pushK(f, 3560, 0.0008)),
  // Ghazni: the citadel gate (palace set)
  g5a: (f: number) => zoom(P(PX + 0.4, 1.6, PZ + 9.5), P(PX - 0.9, 1.9, PZ + 2.5), 44, pushK(f, 850, 0.0015)),
  g5b: (f: number) => dolly(P(GW.x1 + 0.3, 1.5, GW.z + 2.6), [GW.x1, 1.45, GW.z], pushK(f, 965, 0.0025), { fov: 36 }),
  // the caliph's party in the desert
  d6a: (f: number): Shot => ({ pos: P(crewLead(f / FPS) - 3.4, 2.0, ROPE.z + 8.5), look: P(crewLead(f / FPS) - 2.0, 0.95, ROPE.z - 0.5), fov: 46 }),
  d6b: (f: number): Shot => ({ pos: P(crewLead(f / FPS) + 1.2, 1.45, ROPE.z + 4.0), look: P(crewLead(f / FPS) - 0.6, 1.2, ROPE.z + 0.75), fov: 40 }),
  // Nandana: the plain and the mountain
  n7a: (f: number): Shot => ({ pos: P(NX - 3.2 + 0.006 * (f - 1325), 1.7, NW.z + 7.5), look: P(NX - 2.6 + 0.01 * (f - 1325), 4.5, -14), fov: 48 }),
  n7b: (f: number) => dolly(P(NW.x1 + 0.25, 1.5, NW.z + 2.4), [NW.x1, 1.45, NW.z], pushK(f, 1455, 0.003, 0.007, 30), { fov: 34 }),
  n8a: (f: number) => zoom(P(NX - 23, 2.4, 31), P(NX - 7, 9.5, -20), 52, pushK(f, 1570, 0.001)),
  n9a: (f: number) => dolly(P(SUM[0] + 3.4, SUM[1] + 1.7, SUM[2] + 3.4), [SUM[0] + 0.3, SUM[1] + 1.2, SUM[2]], pushK(f, 1735, 0.0018), { fov: 46 }),
  n9b: (_f: number): Shot => ({ pos: P(SUM[0] + 1.7, SUM[1] + 1.8, SUM[2] + 2.7), look: P(SUM[0] - 3.5, SUM[1] - 0.5, SUM[2] - 30), fov: 50 }),
  n12a: (f: number) => dolly(P(SUM[0] + 0.3, SUM[1] + 1.5, SUM[2] + 2.9), [SUM[0], SUM[1] + 1.35, SUM[2]], pushK(f, 2315, 0.002), { fov: 42 }),
  // today: the night sky over Kabul (rooftop set), a satellite passing
  r13a: (f: number) => zoom(P(RX + 0.5, 1.4, 3.5), P(RX + 6, 26, -60), 52, pushK(f, 2485, 0.0012)),
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S.h1a }, { f: 110, cut: true, s: S.h1b }],
  2: [{ f: 215, s: S.h2a }, { f: 300, cut: true, s: S.h2b }],
  3: [{ f: 400, s: S.h3a }],
  4: [{ f: 505, s: S.h4a }, { f: 690, cut: true, s: S.h4b }],
  5: [{ f: 847, s: S.g5a }, { f: 965, cut: true, s: S.g5b }],
  6: [{ f: 1065, s: S.d6a }, { f: 1205, cut: true, s: S.d6b }],
  7: [{ f: 1320, s: S.n7a }, { f: 1455, cut: true, s: S.n7b }],
  8: [{ f: 1570, s: S.n8a }],
  9: [{ f: 1730, s: S.n9a }, { f: 1830, cut: true, s: S.n9b }],
  10: [{ f: 1954, s: S.h10a }],
  11: [{ f: 2080, s: S.h11a }],
  12: [{ f: 2309, s: S.n12a }],
  13: [{ f: 2479, s: S.r13a }],
  14: [{ f: 2689, s: S.h14a }],
  15: [{ f: 2800, s: S.h15a }],
  16: [{ f: 3030, s: S.h16a }],
  17: [{ f: 3230, s: S.h17a }],
  18: [{ f: 3415, s: S.h18a }, { f: 3560, dur: 80, s: S.h18c }],
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
  { f: 0, cInf: 6, focus: () => [HX + 0.9, 0.9, -7.6] },
  { f: 110, cInf: 10, focus: () => Feh },
  { f: 215, cInf: 10, focus: () => Bh },
  { f: 300, cInf: 7, focus: () => [HX + 0.5, 1.0, BT[2] - 0.6] },
  { f: 400, cInf: 10, focus: () => Fh },
  { f: 505, cInf: 7, focus: () => hmid },
  { f: 690, cInf: 10, focus: () => Bh },
  { f: 855, cInf: 4, focus: () => [GW.x0 + 1.5, 1.4, GW.z] },
  { f: 965, cInf: 9, focus: () => [GW.x1, 1.45, GW.z] },
  { f: 1070, cInf: 4, focus: (f) => [crewLead(f / FPS) - 1.5, 1.0, ROPE.z + 0.75] },
  { f: 1205, cInf: 8, focus: (f) => [crewLead(f / FPS) - 0.6, 1.2, ROPE.z + 0.75] },
  { f: 1325, cInf: 4, focus: () => [NX - 2.5, 1.4, NW.z] },
  { f: 1455, cInf: 10, focus: () => [NW.x1, 1.45, NW.z] },
  { f: 1570, cInf: 0 },
  { f: 1735, cInf: 5, focus: () => [SUM[0], SUM[1] + 1.3, SUM[2]] },
  { f: 1830, cInf: 0 },
  { f: 1960, cInf: 10, focus: () => Fh },
  { f: 2080, cInf: 5, focus: () => hmid },
  { f: 2315, cInf: 9, focus: () => [SUM[0], SUM[1] + 1.2, SUM[2]] },
  { f: 2485, cInf: 0 },
  { f: 2695, cInf: 10, focus: () => Fh },
  { f: 2800, cInf: 10, focus: () => Bh },
  { f: 3030, cInf: 7, focus: () => hmid },
  { f: 3230, cInf: 7, focus: () => [FT[0] + 0.25, 1.35, FT[2]] },
  { f: 3415, cInf: 7, focus: () => hmid },
  { f: 3560, dur: 60, cInf: 2, focus: () => hmid },
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
