// Timeline of "The Gold That Hid for Fourteen Years": shots timed to the narration words (gold-short/voice/words.json),
// the world's set positions, and the camera grammar of the bridge short: hard cuts on big jumps, smootherstep glides
// 18-40 f, every hold creeps in 0.15-0.35 %/f (0.6 %/f on punch words), 7-frame flip kicks on impacts, 4-5 deg rolls.
export const FPS = 30;
export const TOTAL = 2067; // voice.wav = 68.90 s
export const D0 = 0; // ground height of every set (build.ts house() default)
export type V3 = [number, number, number];

// ---------------- Dari cut: time warp ----------------
// The picture is timed to the English narration (TOTAL frames). The Dari narration (Google Gemini TTS via Speko) is
// longer, so the output timeline is warped: every English line start/end maps onto its Dari line start/end, piecewise
// linear in between. Output frame F shows story frame srcFrame(F) (fractional: motion slows down smoothly).
import TM from "./timemap.json";
const ANCH: [number, number][] = [[0, 0], ...TM.lines.flatMap((l) => [[l.en[0], l.fa[0]], [l.en[1], l.fa[1]]] as [number, number][]), [TM.en_total, TM.fa_total]];
export const OUT_FRAMES = Math.round(TM.fa_total * 30);
/** output time (s) -> story time (s) */
export const srcTime = (tn: number) => {
  for (let i = 1; i < ANCH.length; i++) if (tn <= ANCH[i][1]) {
    const [e0, f0] = ANCH[i - 1], [e1, f1] = ANCH[i];
    return e0 + ((e1 - e0) * (tn - f0)) / Math.max(1e-6, f1 - f0);
  }
  return TM.en_total;
};
export const srcFrame = (F: number) => Math.min(2066, srcTime(F / 30) * 30);

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

// ---------------- sets (world positions) ----------------
/** dig site: the Hill of Gold, a low plateau mound with a trench cut into it */
export const DIG = { top: 2.2, rTop: 11, rBase: 20, trench: { x: 5, z: 3, floor: 0.6 } };
export const TABLE_DIG: V3 = [8, DIG.top, 5.2]; // finds table on the mound (top at y + 0.8)
/** Kabul: museum front facade on z = -20 centred on x = 1000; the palace (Arg) wall at x 1200; teahouse; courtyard */
export const KX = 1000;
export const MUSEUM = { x: KX, z: -20, w: 30, d: 14, h: 9.4 };
export const PLAQUE: V3 = [KX + 3.4, 1.85, MUSEUM.z + 0.06];
export const PALACE = { x: 1500, z: -10 };
export const TEA: V3 = [KX, 0, 80];
export const YARD: V3 = [KX, 0, 150];
/** underground bank vault: room x -1008..-992, z -6..6; round door in the back wall, gold chamber behind it */
export const VX = -1000;
export const VDOOR: V3 = [VX, 2.15, -5.72];
export const VTABLE: V3 = [VX, 0, 2];
/** museum gallery (empty case for "Gone", the crown under a spotlight at the end) */
export const GAL: V3 = [-1000, 0, 200];
export const GCASE_EMPTY: V3 = [-1006, 0, 196];

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type SetName = "vault" | "dig" | "kabul" | "palace" | "tea" | "yard" | "gallery";
export type ShotDef = { id: number; a: number; b: number; light: Light; set: SetName; sunAz?: number; sunEl?: number; war?: boolean };
const VAULT_SUN = { sunAz: 150, sunEl: 62 }; // a lamp overhead, slightly behind the lens
const GAL_SUN = { sunAz: 170, sunEl: 66 };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 177, light: "golden", set: "vault", ...VAULT_SUN },      // hook: gold, door slams, the keyholders
  { id: 2, a: 177, b: 257, light: "day", set: "dig" },                       // It's 1978 / northern Afghanistan
  { id: 3, a: 257, b: 348, light: "day", set: "dig" },                       // diggers / Hill of Gold
  { id: 4, a: 348, b: 399, light: "day", set: "dig" },                       // the name turns out to be honest
  { id: 5, a: 399, b: 470, light: "day", set: "dig" },                       // six graves, 2000 years old
  { id: 6, a: 470, b: 540, light: "day", set: "dig" },                       // crowns, belts, tiny golden rams
  { id: 7, a: 540, b: 613, light: "day", set: "kabul", sunAz: 145, sunEl: 40 },                     // to the national museum in Kabul
  { id: 8, a: 613, b: 648, light: "golden", set: "kabul", war: true, sunAz: 60, sunEl: 10 },       // then the wars come
  { id: 9, a: 648, b: 683, light: "golden", set: "kabul", war: true },       // rockets hit the roof
  { id: 10, a: 683, b: 755, light: "golden", set: "kabul", war: true, sunAz: 115, sunEl: 14 },      // thieves carry off
  { id: 11, a: 755, b: 800, light: "golden", set: "gallery", ...GAL_SUN },   // and the gold? gone.
  { id: 12, a: 800, b: 872, light: "day", set: "tea" },                      // everyone says melted down and sold
  { id: 13, a: 872, b: 903, light: "golden", set: "vault", ...VAULT_SUN },   // except it wasn't
  { id: 14, a: 903, b: 1007, light: "golden", set: "vault", ...VAULT_SUN },  // 1989: workers carry it in
  { id: 15, a: 1007, b: 1035, light: "golden", set: "vault", ...VAULT_SUN }, // locked it in a vault
  { id: 16, a: 1035, b: 1066, light: "day", set: "palace" },                 // under the palace
  { id: 17, a: 1066, b: 1109, light: "golden", set: "vault", ...VAULT_SUN }, // each kept one key
  { id: 18, a: 1109, b: 1176, light: "day", set: "palace" },                 // Luckily ...
  { id: 19, a: 1176, b: 1252, light: "day", set: "palace" },                 // Unluckily ...
  { id: 20, a: 1252, b: 1382, light: "golden", set: "yard", sunAz: 140, sunEl: 26 },                // a lock with many keys / friends
  { id: 21, a: 1382, b: 1469, light: "golden", set: "yard", sunAz: 140, sunEl: 26 },                // threaten one friend: one key
  { id: 22, a: 1469, b: 1548, light: "day", set: "tea" },                    // fourteen years, said nothing
  { id: 23, a: 1548, b: 1688, light: "golden", set: "vault", ...VAULT_SUN }, // 2003: can't find them, safecracker
  { id: 24, a: 1688, b: 1763, light: "golden", set: "vault", ...VAULT_SUN }, // behind the door: every piece
  { id: 25, a: 1763, b: 1926, light: "golden", set: "kabul", sunAz: 150, sunEl: 20 },               // the motto at the museum door
  { id: 26, a: 1926, b: TOTAL, light: "golden", set: "gallery", ...GAL_SUN },// toured the world, in the spotlight
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 7: 8, 8: 12, 11: 6, 12: 6, 14: 8, 20: 8, 22: 8, 23: 8, 25: 10, 26: 10 };
export const FLASH_AT = 177;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- story state ----------------
/** vault door angle (rad, 0 = shut, opening toward the room) for shot id at frame f */
export const doorAngle = (id: number, f: number) => {
  const open = 1.75;
  if (id === 1) return open * (1 - easeOut((f - 58) / 12) ** 2 * 0 - smooth((f - 56) / 14));
  if (id === 14) return open;
  if (id === 15) return open * (1 - smooth((f - 1005) / 15));
  if (id === 24) return open * easeOut((f - 1690) / 24);
  return 0;
};
/** the chamber behind the door glows while the door is open */
export const glowAt = (id: number, f: number) => clamp01(doorAngle(id, f) / 0.6);
/** rocket flight in shot 9: 0 at launch .. 1 at the roof */
export const ROCKET_HIT = 671;
export const ROOF_HIT: V3 = [KX - 3, MUSEUM.h + 0.4, MUSEUM.z - 4];
/** the friends' chest: padlocks still on */
export const locksAt = (id: number, f: number) => (id === 21 && f >= 1432 ? 4 : 5);

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

const CR = P(VX, 1.22, VTABLE[2]); // the crown on the vault table
const S = {
  // 1 hook (vault): crown CU -> the door slams on "disappeared" -> the keyholders in a row, punch on "never said a word"
  h1a: (f: number) => dolly(P(VX - 0.4, 1.42, 4.0), CR, pushK(f, 0, 0.003), { fov: 34, roll: -0.03 }),
  h1b: (f: number) => dolly(P(VX + 2.6, 1.7, 2.6), P(VX - 0.3, 1.9, -5.6), pushK(f, 52, 0.0025), { fov: 44 }),
  h1c: (f: number) => dolly(P(VX + 0.4, 1.5, 2.9), P(VX, 1.42, -2.7), pushK(f, 104, 0.0022, 0.006, 32), { fov: 47, roll: 0.035 }),
  // 2 dig aerial, crane down; 3 diggers MS, elder points; 4 low on the trench floor up at the digger; 5 top-down graves
  d2a: (f: number) => zoom(P(24, 11, 30), P(0, 2.2, 0), 44, pushK(f, 170, 0.002)),
  d2b: (f: number) => zoom(P(14, 6.2, 19), P(0, 3.0, 2), 42, pushK(f, 214, 0.002)),
  d3a: (f: number) => dolly(P(1.6, 3.85, 12.4), P(0.3, 3.15, 3.9), pushK(f, 257, 0.0022), { fov: 46 }),
  d3b: (f: number) => dolly(P(5.6, 3.8, 10.4), P(2.4, 3.3, 5.4), pushK(f, 318, 0.0015, 0.006, 30), { fov: 40, roll: -0.035 }),
  d4a: (f: number) => dolly(P(0.7, 1.15, -0.6), P(0, 2.55, 3.4), pushK(f, 348, 0.003, 0.006, 30), { fov: 46, roll: 0.04 }),
  d5a: (f: number) => dolly(P(7.0, 13.5, 0.2), P(0, 0.6, 0), pushK(f, 399, 0.0025), { fov: 40 }),
  d6a: (f: number) => dolly(P(TABLE_DIG[0] - 0.7, 3.45, 7.0), P(TABLE_DIG[0] - 0.8, 3.24, TABLE_DIG[2]), pushK(f, 470, 0.003, 0.006, 15), { fov: 34, roll: 0.03 }),
  d6b: (f: number) => dolly(P(TABLE_DIG[0] + 0.1, 3.4, 6.85), P(TABLE_DIG[0], 3.14, TABLE_DIG[2]), pushK(f, 485, 0.003, 0.006, 13), { fov: 34, roll: -0.03 }),
  d6c: (f: number) => dolly(P(TABLE_DIG[0] + 0.95, 3.4, 6.55), P(TABLE_DIG[0] + 0.82, 3.2, TABLE_DIG[2]), pushK(f, 498, 0.0025, 0.006, 30), { fov: 32 }),
  // 7-8 the museum (day, then dusk smoke); 9 the rocket; 10 thieves at the door
  k7a: (f: number) => zoom(P(KX + 7, 2.4, 6), P(KX, 4.4, MUSEUM.z), 44, pushK(f, 536, 0.0018)),
  k8a: (f: number) => zoom(P(KX + 4, 3.5, 14), P(KX - 1, 6.5, MUSEUM.z), 46, pushK(f, 607, 0.002)),
  k9a: (f: number) => zoom(P(KX + 12, 1.8, 2), P(KX - 1, 7.6, MUSEUM.z), 44, pushK(f, 648, 0.0025, 0.006, 25), { roll: -0.04 }),
  k10a: (f: number) => dolly(P(KX + 4.6, 1.55, -8.6), P(KX + 0.4, 1.35, -16), pushK(f, 683, 0.0025), { fov: 42 }),
  // 11 empty case, punch on "Gone"
  g11a: (f: number) => dolly(P(GCASE_EMPTY[0] + 0.3, 1.5, GCASE_EMPTY[2] + 2.3), P(GCASE_EMPTY[0], 1.25, GCASE_EMPTY[2]), pushK(f, 755, 0.0025), { fov: 36 }),
  g11b: (f: number) => dolly(P(GCASE_EMPTY[0] + 0.2, 1.42, GCASE_EMPTY[2] + 1.5), P(GCASE_EMPTY[0], 1.28, GCASE_EMPTY[2]), pushK(f, 780, 0.002), { fov: 36, roll: 0.04 }),
  // 12 gossip at the teahouse
  t12a: (f: number) => dolly(P(KX + 0.9, 1.75, 86.2), P(KX + 0.1, 1.45, 80.2), pushK(f, 800, 0.0025), { fov: 42 }),
  // 13 the crown in the dark ("Except it wasn't")
  v13a: (f: number) => dolly(P(VX + 0.25, 1.28, 2.95), CR, pushK(f, 872, 0.004, 0.007, 25), { fov: 32, roll: 0.035 }),
  // 14 1989 workers carry crates in; 15 the door shuts; 16 the palace above; 17 keys up
  v14a: (f: number) => dolly(P(VX + 2.2, 1.85, 4.2), P(VX - 0.2, 1.5, -4.5), pushK(f, 903, 0.002), { fov: 44 }),
  v14b: (f: number) => dolly(P(VX + 2.9, 1.6, 2.7), P(VX + 0.4, 1.3, -3.0), pushK(f, 958, 0.0022), { fov: 44, roll: 0.03 }),
  v15a: (f: number) => dolly(P(VX + 2.6, 1.7, 2.6), P(VX - 0.3, 1.9, -5.6), pushK(f, 1007, 0.0025, 0.006, 20), { fov: 42, roll: -0.035 }),
  p16a: (f: number) => zoom(P(PALACE.x + 9, 1.4, 34), P(PALACE.x, 11, PALACE.z), 46, pushK(f, 1035, 0.002)),
  p16b: (f: number) => zoom(P(PALACE.x + 9, 1.4, 34), P(PALACE.x + 1, 1.0, PALACE.z + 6), 46, pushK(f, 1050, 0.002)),
  v17a: (f: number) => dolly(P(VX - 0.3, 1.6, 2.8), P(VX, 1.6, -2.7), pushK(f, 1066, 0.0025, 0.006, 30), { fov: 47 }),
  // 18-19 the same palace framing: thieves, then officials
  p18a: (f: number) => dolly(P(PALACE.x + 0.9, 1.6, 1.6), P(PALACE.x + 0.2, 1.4, -4.4), pushK(f, 1109, 0.0022), { fov: 42 }),
  p18b: (f: number) => dolly(P(PALACE.x + 0.7, 1.55, 0.9), P(PALACE.x + 0.2, 1.45, -4.4), pushK(f, 1150, 0.002), { fov: 40, roll: 0.035 }),
  p19a: (f: number) => dolly(P(PALACE.x + 0.9, 1.6, 1.6), P(PALACE.x + 0.2, 1.4, -4.4), pushK(f, 1176, 0.0022), { fov: 42 }),
  p19b: (f: number) => dolly(P(PALACE.x + 0.7, 1.55, 0.9), P(PALACE.x + 0.2, 1.45, -4.4), pushK(f, 1220, 0.002), { fov: 40, roll: -0.035 }),
  // 20-21 courtyard: friends with keys around the chest; the bully
  y20a: (f: number) => dolly(P(KX + 0.3, 1.75, YARD[2] + 6.6), P(KX, 1.05, YARD[2] - 0.5), pushK(f, 1252, 0.002), { fov: 46 }),
  y20b: (f: number) => dolly(P(KX - 0.6, 1.6, YARD[2] + 5.4), P(KX, 1.15, YARD[2] - 0.6), pushK(f, 1340, 0.002), { fov: 42, roll: 0.035 }),
  y21a: (f: number) => dolly(P(KX + 2.4, 1.55, YARD[2] + 4.4), P(KX + 1.0, 1.25, YARD[2] - 0.3), pushK(f, 1382, 0.0022, 0.006, 25), { fov: 42 }),
  y21b: (f: number) => dolly(P(KX + 1.5, 1.5, YARD[2] + 5.0), P(KX + 0.35, 1.05, YARD[2] - 0.2), pushK(f, 1425, 0.0025), { fov: 44, roll: -0.035 }),
  // 22 fourteen years at the teahouse (the beard grows)
  t22a: (f: number) => dolly(P(KX - 0.5, 1.5, 83.4), P(KX - 0.3, 1.25, 80.2), pushK(f, 1469, 0.0028), { fov: 38 }),
  // 23 officials + list; the safecracker drilling; 24 the door opens, the gold, the faces
  v23a: (f: number) => dolly(P(VX + 0.4, 1.6, 2.9), P(VX, 1.5, -3.0), pushK(f, 1548, 0.0022), { fov: 46 }),
  v23b: (f: number) => dolly(P(VX + 3.3, 1.4, -1.0), P(VX + 1.1, 1.25, -5.0), pushK(f, 1646, 0.003), { fov: 44, roll: 0.035 }),
  v24a: (f: number) => dolly(P(VX + 0.3, 1.8, -1.2), P(VX, 1.9, -8.5), pushK(f, 1688, 0.0035, 0.006, 25), { fov: 44 }),
  v24b: (f: number) => dolly(P(VX - 0.2, 1.7, -8.6), P(VX, 1.5, -2.6), pushK(f, 1728, 0.0025), { fov: 42, roll: -0.03 }),
  // 25 the museum at golden hour, then the plaque by the door
  k25a: (f: number) => zoom(P(KX + 6, 2.0, 4), P(KX + 0.5, 3.6, MUSEUM.z), 44, pushK(f, 1758, 0.002)),
  k25b: (f: number) => dolly(P(PLAQUE[0] - 0.55, 1.95, PLAQUE[2] + 2.5), P(PLAQUE[0], PLAQUE[1], PLAQUE[2]), pushK(f, 1838, 0.0025, 0.006, 30), { fov: 38 }),
  // 26 the crown under the spotlight, the crowd; crane out to the end
  g26a: (f: number) => dolly(P(GAL[0] + 0.4, 1.6, GAL[2] + 3.4), P(GAL[0], 1.42, GAL[2]), pushK(f, 1926, 0.0022), { fov: 40 }),
  g26b: (f: number) => dolly(P(GAL[0] - 0.3, 1.5, GAL[2] + 2.2), P(GAL[0], 1.45, GAL[2]), pushK(f, 1990, 0.002), { fov: 38, roll: 0.03 }),
  g26c: (f: number) => dolly(P(GAL[0], 4.6, GAL[2] + 7.6), P(GAL[0], 1.2, GAL[2]), pushK(f, 2028, 0.0015), { fov: 44 }),
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S.h1a }, { f: 52, cut: true, s: S.h1b }, { f: 104, cut: true, s: S.h1c }],
  2: [{ f: 170, s: S.d2a }, { f: 214, dur: 36, s: S.d2b }],
  3: [{ f: 257, s: S.d3a }, { f: 318, dur: 22, s: S.d3b }],
  4: [{ f: 348, s: S.d4a }],
  5: [{ f: 399, s: S.d5a }],
  6: [{ f: 470, s: S.d6a }, { f: 485, cut: true, s: S.d6b }, { f: 498, cut: true, s: S.d6c }],
  7: [{ f: 536, s: S.k7a }],
  8: [{ f: 607, s: S.k8a }],
  9: [{ f: 648, s: S.k9a }],
  10: [{ f: 683, s: S.k10a }],
  11: [{ f: 752, s: S.g11a }, { f: 778, cut: true, s: S.g11b }],
  12: [{ f: 797, s: S.t12a }],
  13: [{ f: 872, s: S.v13a }],
  14: [{ f: 899, s: S.v14a }, { f: 958, cut: true, s: S.v14b }],
  15: [{ f: 1007, s: S.v15a }],
  16: [{ f: 1035, s: S.p16a }, { f: 1042, dur: 22, s: S.p16b }],
  17: [{ f: 1066, s: S.v17a }],
  18: [{ f: 1109, s: S.p18a }, { f: 1150, dur: 20, s: S.p18b }],
  19: [{ f: 1176, s: S.p19a }, { f: 1220, dur: 20, s: S.p19b }],
  20: [{ f: 1248, s: S.y20a }, { f: 1340, dur: 28, s: S.y20b }],
  21: [{ f: 1382, s: S.y21a }, { f: 1425, cut: true, s: S.y21b }],
  22: [{ f: 1465, s: S.t22a }],
  23: [{ f: 1544, s: S.v23a }, { f: 1646, cut: true, s: S.v23b }],
  24: [{ f: 1688, s: S.v24a }, { f: 1728, cut: true, s: S.v24b }],
  25: [{ f: 1758, s: S.k25a }, { f: 1838, cut: true, s: S.k25b }, { f: 1902, dur: 30, s: rolled(S.k25b, 0.03) }],
  26: [{ f: 1921, s: S.g26a }, { f: 1990, cut: true, s: S.g26b }, { f: 2024, dur: 40, s: S.g26c }],
};

// impact kicks (s): the door slams, the rocket, the key grab, the door shut in 1989, the vault door clunk open
const KICKS: [number, number][] = [[70 / FPS, 1.2], [ROCKET_HIT / FPS, 1.6], [1392 / FPS, 0.6], [1020 / FPS, 1.2], [1691 / FPS, 0.6]];
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
  { f: 0, cInf: 15 },                              // crown CU (focus = look)
  { f: 52, cInf: 8 },                              // the door
  { f: 104, cInf: 10, focus: () => [VX, 1.55, -2.4] }, // keyholders' eyes
  { f: 177, cInf: 0 },                             // dig aerial
  { f: 257, cInf: 9, focus: () => [0.3, 3.75, 3.8] }, // diggers
  { f: 348, cInf: 10, focus: () => [0, 3.6, 3.4] },   // digger looking down
  { f: 399, cInf: 0 },                             // graves top-down
  { f: 470, cInf: 14 },                            // finds inserts
  { f: 540, cInf: 0 },                             // museum wides, rocket, thieves
  { f: 683, cInf: 8, focus: () => [KX + 1.2, 1.6, -14.5] },
  { f: 755, cInf: 12 },                            // empty case
  { f: 800, cInf: 9, focus: () => [KX + 0.1, 1.5, 80.4] },
  { f: 872, cInf: 15 },                            // crown in the dark
  { f: 903, cInf: 6 },
  { f: 1007, cInf: 8 },
  { f: 1035, cInf: 0 },                            // palace
  { f: 1066, cInf: 11, focus: () => [VX, 1.6, -2.5] },
  { f: 1109, cInf: 8, focus: () => [PALACE.x + 0.2, 1.55, -3.9] },
  { f: 1252, cInf: 7, focus: () => [KX, 1.2, YARD[2] - 0.6] },
  { f: 1382, cInf: 9, focus: () => [KX + 1.0, 1.5, YARD[2] - 0.2] },
  { f: 1469, cInf: 12, focus: () => [KX - 0.3, 1.3, 80.3] },
  { f: 1548, cInf: 9, focus: () => [VX, 1.6, -2.9] },
  { f: 1646, cInf: 10 },
  { f: 1688, cInf: 6 },
  { f: 1728, cInf: 11, focus: () => [VX, 1.6, -2.7] },
  { f: 1763, cInf: 0 },                            // museum golden wide
  { f: 1838, cInf: 13 },                           // plaque (focus = look)
  { f: 1926, cInf: 10, focus: () => [GAL[0], 1.45, GAL[2]] },
  { f: 2024, dur: 40, cInf: 4, focus: () => [GAL[0], 1.45, GAL[2]] },
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
