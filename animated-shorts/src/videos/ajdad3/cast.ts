// Our cast as lit flat sprites in the 3D world (gold short). Each frame every character asks for a drawing (a key +
// a draw call); the pool keeps one canvas per distinct drawing. Characters are yaw-only billboards shaded by
// cardShade(); standing ones get a contact blob. Effects (gold, glints, smoke, fire, the chest) are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, fxPuff, Outfit, Expr, FrontOpts, SideOpts, Prop, SKINS, KID } from "./toon";
import { fxGlint, fxGlow, fxGlyph, fxDigit, fxStep } from "./fx";
import MOUTHS from "./mouth.json";
import { FPS, D0, SHOTS, smooth, clamp01, KX, TEA, YARD, GAL, BT, FT, FIELD } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  glow = 1;
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; this.mat.color.setScalar(this.glow); this.soft.color.setScalar(this.glow); }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean; glow?: number };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" | "night" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden" | "night", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33], night: [0.3, 0.3, 0.42] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- our cast ("Our ancestors" ep. 3: al-Khwarizmi, step by step) ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };
const SK = SKINS;
const FARID: Outfit = { jacket: "#3b5f8f", pants: "#2f3542", boots: "#e8e4dc", hat: "hair", hair: "#1c1714", skin: SK[2] };
const BABA: Outfit = { jacket: "#55604a", pants: "#e6e0d2", boots: "#4a3426", long: "#ece6d8", hat: "karakul", cap: "#7a7680", beard: "#f0ede6", beardLen: 12, skin: SK[3] };
const KHW: Outfit = { jacket: "#2f5f6a", pants: "#e6dcc6", boots: "#4a3426", long: "#e8dcc0", hat: "turban", cap: "#f6f2e6", beard: "#2e221c", beardLen: 12, skin: SK[1] };
const BRO1: Outfit = { jacket: "#8c3b4a", pants: "#d8c9a8", boots: "#4a3426", long: "#c9b48a", hat: "pakol", cap: "#8a7a62", beard: "#3a2c24", beardLen: 8, skin: SK[3] };
const BRO2: Outfit = { jacket: "#3f6fb5", pants: "#e6dcc6", boots: "#3b2a22", long: "#d9cdb0", hat: "turban", cap: "#d9c9a8", moustache: "#3a2c24", skin: SK[2] };
const SCHOLARS: Outfit[] = [
  { jacket: "#4e5a7a", pants: "#d8c9a8", boots: "#4a3426", long: "#d8d0bc", hat: "turban", cap: "#ece4d0", beard: "#e6e2da", beardLen: 14, skin: SK[2] },
  { jacket: "#6a5a3a", pants: "#dcd2bd", boots: "#4a3426", long: "#e6dcc6", hat: "turban", cap: "#efe6d4", beard: "#9a9088", beardLen: 12, skin: SK[1] },
  { jacket: "#5a4a6a", pants: "#c4cfd6", boots: "#4a3426", long: "#c9c2d6", hat: "turban", cap: "#f1ece0", beard: "#3a2c24", beardLen: 10, skin: SK[3] },
];
const READERS: Outfit[] = [
  { jacket: "#3f6fb5", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#c9a25a", skin: SK[0] },
  { jacket: "#c25a7a", pants: "#3b3f52", boots: "#4a3426", hat: "bonnet", dress: "#5a8fc2", skin: SK[3] },
  { jacket: "#5d7a3a", pants: "#4a4239", boots: "#4a3426", hat: "karakul", cap: "#5b5660", beard: "#3a2c24", skin: SK[2] },
  { jacket: "#b5653f", pants: "#2f3340", boots: "#241f1f", hat: "hair", hair: "#141010", skin: SK[3] },
  { ...KID, jacket: "#e8c33a", pants: "#4a3f5e", hat: "cap", cap: "#4a6fd0", skin: SK[0] },
  { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#6a4a30", dress: "#d9a441", skin: SK[2] },
];

const okeyOf = new Map<Outfit, string>();
let okeyN = 0;
const okey = (o: Outfit) => { let k = okeyOf.get(o); if (!k) { k = "o" + okeyN++; okeyOf.set(o, k); } return k; };
const who = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, y: number, z: number, fo: FrontOpts, scale = 1, mirror = false, noBlob = false) => {
  const pl = person(cam, { i, o, okey: okey(o) }, x, y, z, { side: false, mirror: false }, fo, {} as SideOpts, scale);
  out.places.push(mirror ? { ...pl, mirror: true } : pl);
  if (!noBlob) blob(out, x, y, z, scale);
};
const at = (t: number, a: number) => t >= a - LEAD;
const walk = (t: number, t0: number, t1: number, p0: [number, number], p1: [number, number]) => {
  const u = clamp01((t - t0) / (t1 - t0)), d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const moving = t > t0 && t < t1;
  return { x: p0[0] + (p1[0] - p0[0]) * u, z: p0[1] + (p1[1] - p0[1]) * u, phase: q(((u * d) / 1.4) % 1, 60), mode: (moving ? "stroll" : "stand") as FrontOpts["mode"] };
};
const card = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, extra: Partial<FxPlace> = {}) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, ...extra });
const glint = (out: Stage, t: number, x: number, y: number, z: number, s: number, ph: number) => {
  const u = ((t * 0.9 + ph) % 1.6) / 1.6;
  if (u > 0.5) return;
  const k = q(u * 2, 12);
  card(out, `glint${k}`, 200, 200, (p) => fxGlint(p, k), x, y, z, s, s, { glow: 1.6 });
};
const glyphs = (out: Stage, f: number, f0: number, n: number, gap: number, o: [number, number, number], d: [number, number, number], w: number) => {
  for (let k = 0; k < n; k++) {
    const age = (f - (f0 + k * gap)) / FPS;
    if (age < 0) continue;
    const wob = Math.sin(age * 2.2 + k) * 0.25 * w;
    card(out, `glyph${k % 6}`, 360, 200, (p) => fxGlyph(p, k % 6), o[0] + d[0] * age + wob, o[1] + d[1] * age, o[2] + d[2] * age, w, w * 0.556, { glow: 1.35, rot: Math.sin(age + k) * 0.2 });
  }
};
const DIG = ["۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹", "۰", "+", "="];
/** golden numerals floating up and fading around (x, y, z), one every `gap` frames from f0, popping in */
const digits = (out: Stage, f: number, f0: number, n: number, gap: number, o: [number, number, number], spread: number, w: number, life = 2.6) => {
  for (let k = 0; k < n; k++) {
    const age = (f - (f0 + k * gap)) / FPS;
    if (age < 0 || age > life) continue;
    const pop = Math.min(1, age / 0.25) * (1 + 0.25 * Math.sin(Math.min(1, age / 0.25) * Math.PI)), fade = age > life - 0.5 ? (life - age) / 0.5 : 1;
    const a = k * 2.399, r = spread * (0.6 + 0.4 * ((k * 0.37) % 1));
    const ch = DIG[k % DIG.length], s = w * pop * fade;
    if (s <= 0.01) continue;
    card(out, `dig${k % DIG.length}`, 256, 256, (p) => fxDigit(p, ch), o[0] + Math.cos(a) * r, o[1] + age * 0.35 + Math.sin(age * 2 + k) * 0.04, o[2] + Math.sin(a) * 0.3 * r, s, s, { glow: 1.4, rot: Math.sin(age * 1.5 + k) * 0.15 });
  }
};
/** the step badges: ۱ ۲ ۳ pop in one by one at times ts (s) and turn green with a tick 1 s later */
const steps = (out: Stage, t: number, ts: number[], o: [number, number, number], gapX: number, w: number) => {
  ts.forEach((t0, k) => {
    if (t < t0) return;
    const u = Math.min(1, (t - t0) / 0.25), s = w * u * (1 + 0.3 * Math.sin(u * Math.PI)), done = t >= t0 + 1.0;
    card(out, `step${k}${done ? "d" : ""}`, 256, 256, (p) => fxStep(p, ["۱", "۲", "۳"][k], done), o[0] + (k - 1) * gapX, o[1] + 0.03 * Math.sin(t * 2 + k), o[2], s, s, { glow: 1.25 });
    if (done && t < t0 + 1.5) glint(out, t, o[0] + (k - 1) * gapX + 0.08, o[1] + 0.08, o[2] + 0.02, 0.16, 0);
  });
};

// ---- life: lip sync from the voice track, head and body that never freeze ----
const MO = MOUTHS as Record<string, string>;
const talkOf = (k: "F" | "B", f: number) => Number(MO[k][f] ?? 0) || 0;
/** someone talking without a recorded voice (the quarrel): a lively flap */
const flap = (t: number, i: number) => { const v = Math.abs(Math.sin(t * 8.3 + i) * Math.sin(t * 3.1 + 2 * i)); return v > 0.55 ? 3 : v > 0.3 ? 2 : v > 0.1 ? 1 : 0; };
const q2 = (v: number) => Math.round(v * 2) / 2;
/** head bob / body sway: livelier while talking, a slow breath otherwise; `amp` scales it (angry shakes) */
const life = (t: number, i: number, talk: number, amp = 1): Partial<FrontOpts> => talk > 0
  ? { headTilt: q2(amp * (2.2 * Math.sin(t * 4.1 + i) + 0.8 * talk)), tilt: q2(amp * 1.1 * Math.sin(t * 1.9 + i)) }
  : { headTilt: q2(amp * 1.0 * Math.sin(t * 0.9 + i)), tilt: q2(amp * 0.5 * Math.sin(t * 0.7 + 2 * i)) };
const pick = <T,>(t: number, keys: [number, T][]): T => { let v = keys[0][1]; for (const [a, x] of keys) if (at(t, a)) v = x; return v; };

const farid = (cam: CamInfo, out: Stage, t: number, f: number, fo: FrontOpts) => {
  const talk = talkOf("F", f);
  who(cam, out, 1, FARID, FT[0], FT[1], FT[2], { mode: "sit", blink: lidAt(t, 1), facing: -1, look: -1, ...life(t, 1, talk, fo.expr === "angry" ? 1.8 : 1), talk, ...fo });
};
const baba = (cam: CamInfo, out: Stage, t: number, f: number, fo: FrontOpts) => {
  const talk = talkOf("B", f);
  who(cam, out, 2, BABA, BT[0], BT[1], BT[2], { mode: "sit", blink: lidAt(t, 2), facing: 1, look: 1, ...life(t, 2, talk), talk, ...fo });
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], f = Math.round(t * FPS);
  LNAME = s.light;
  findSun(cam, SUN);
  switch (s.set) {
    case "attar": { // the teahouse
      if (id === 1) { // Farid walks in from the street, head down, the exam paper in his hand
        const w = walk(t, 0.0, 2.5, [TEA[0] + 2.75, TEA[2] + 1.9], [TEA[0] + 1.75, TEA[2] + 0.75]);
        const talk = talkOf("F", f);
        who(cam, out, 1, FARID, w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: "sad", prop: "list", blink: lidAt(t, 1), facing: -1, look: -1,
          headTilt: w.mode === "stroll" ? -4 : q2(-3 + 1.5 * Math.sin(t * 3)), talk }, 1, true);
        baba(cam, out, t, f, { expr: pick(t, [[0, "smile_closed"], [2.4, "worried"]]), prop: pick<Prop>(t, [[0, "tea"], [2.6, null]]) });
      } else {
        const fe: Record<number, FrontOpts> = {
          2: { expr: "sad", prop: "list" },
          3: { expr: "angry", prop: "list" },
          4: { expr: pick(t, [[0, "stern"], [15.6, "neutral"], [21.5, "smile"], [25.0, "shock"]]), prop: pick<Prop>(t, [[0, "list"], [17, null]]) },
          10: { expr: "excited", prop: null },
          11: { expr: pick(t, [[0, "shock"], [65.5, "grin"]]), prop: null },
          14: { expr: pick(t, [[0, "shock"], [83.4, "excited"]]), prop: "phone", look: pick(t, [[0, 0], [83.4, -1]]) },
          15: { expr: pick(t, [[0, "smile"], [88.5, "smile_closed"]]), prop: pick<Prop>(t, [[0, "phone"], [87, null]]) },
          16: { expr: pick(t, [[0, "neutral"], [97.6, "smile_closed"]]), prop: pick<Prop>(t, [[0, null], [98.6, "list"]]) },
          17: { expr: pick(t, [[0, "smile"], [101.4, "excited"]]), prop: "list" },
          18: { expr: pick(t, [[0, "grin"], [106.5, "shock"], [109.5, "grin"]]), prop: "list", look: pick(t, [[0, 0], [106.5, -1]]) },
        };
        farid(cam, out, t, f, fe[id]);
        const be: Record<number, FrontOpts> = {
          2: { expr: pick(t, [[0, "worried"], [6.2, "smile"], [8.2, "smile_closed"]]), prop: pick<Prop>(t, [[0, "gesture"], [7.4, "tea"]]) },
          3: { expr: "worried", prop: "tea" },
          4: { expr: pick(t, [[0, "smile"], [16.0, "smile_closed"], [19.5, "grin"], [23.8, "relief"]]), prop: pick<Prop>(t, [[0, "gesture"], [19.5, "point"], [22.8, "gesture"]]) },
          10: { expr: "grin", prop: "tea" },
          11: { expr: pick(t, [[0, "grin"], [66.2, "relief"]]), prop: pick<Prop>(t, [[0, "point"], [66.0, "gesture"]]) },
          14: { expr: "smile_closed", prop: "tea" },
          15: { expr: pick(t, [[0, "smile_closed"], [86.6, "smile"], [90.0, "grin"]]), prop: pick<Prop>(t, [[0, "gesture"], [90, "point"]]) },
          16: { expr: pick(t, [[0, "smile"], [95.5, "smile_closed"]]), prop: pick<Prop>(t, [[0, "point"], [94.3, "gesture"], [97.0, "point"]]) },
          17: { expr: "relief", prop: "tea" },
          18: { expr: pick(t, [[0, "laugh"], [105.2, "grin"], [107.0, "smile"]]), prop: pick<Prop>(t, [[0, "gesture"], [107.0, "point"]]) },
        };
        baba(cam, out, t, f, be[id]);
        if (id === 4 && f >= 735) { // the story begins: a warm glow and golden words rise between them
          const k = smooth((f - 735) / 30);
          card(out, "storyGlow", 256, 256, (p) => fxGlow(p, "#ffd98a"), TEA[0] + 0.05, 1.5, TEA[2] - 0.1, 1.1 * k, 1.1 * k, { soft: true, glow: 0.8 });
          glyphs(out, f, 740, 5, 9, [TEA[0], 1.3, TEA[2] - 0.1], [0.05, 0.5, 0.05], 0.3);
        }
        if (id === 11) digits(out, f, 1945, 12, 9, [BT[0] + 0.15, 1.45, BT[2] + 0.2], 0.55, 0.22);
        if (id === 14 && f >= 2500) digits(out, f, 2500, 6, 8, [FT[0] - 0.05, 1.3, FT[2] + 0.25], 0.3, 0.14, 2.0);
        if (id === 17) steps(out, t, [101.6, 102.4, 103.2], [FT[0] - 0.05, 1.95, FT[2] + 0.1], 0.2, 0.15);
      }
      break;
    }
    case "yard": { // Baghdad, the House of Wisdom
      const [x, , z] = YARD;
      const kx = x - 0.1, kz = z - 1.0;
      if (id === 5) { // al-Khwarizmi writes; scholars come and go with books
        who(cam, out, 31, KHW, kx, D0, kz, { mode: "sit", expr: pick(t, [[0, "smile_closed"], [30.5, "smile"]]), prop: "book", blink: lidAt(t, 31), facing: 1, look: 0, ...life(t, 31, 0) });
        const w1 = walk(t, 26.8, 32.5, [x - 2.6, z - 1.9], [x + 2.4, z - 1.7]);
        who(cam, out, 32, SCHOLARS[0], w1.x, D0, w1.z, { mode: w1.mode, phase: w1.phase, expr: "smile_closed", prop: "book", blink: lidAt(t, 32) });
        who(cam, out, 33, SCHOLARS[1], x + 1.5, D0, z - 1.5, { mode: "sit", expr: "smile", prop: "book", blink: lidAt(t, 33), facing: -1, ...life(t, 33, 0) });
        glyphs(out, f, 830, 7, 18, [kx + 0.45, 0.95, kz + 0.2], [0.2, 0.5, 0.1], 0.32);
      } else if (id === 7) { // the brothers bring their quarrel; everyone says it's too hard; he smiles: step by step
        const calm = at(t, 45.0);
        who(cam, out, 31, KHW, kx, D0, kz, { mode: "sit", expr: pick(t, [[0, "neutral"], [44.6, "smile"]]), prop: pick<Prop>(t, [[0, "book"], [44.6, "gesture"], [47.2, "point"]]),
          blink: lidAt(t, 31, [44.6]), facing: 1, look: 0, talk: t > 45.3 && t < 48.9 ? flap(t, 31) : 0, ...life(t, 31, t > 45.3 && t < 48.9 ? 1 : 0) });
        const bt1 = !calm ? flap(t, 1) * (Math.sin(t * 1.7) > 0 ? 1 : 0) : 0, bt2 = !calm ? flap(t, 2) * (Math.sin(t * 1.7) <= 0 ? 1 : 0) : 0;
        who(cam, out, 41, BRO1, x - 0.95, D0, z + 0.1, { mode: "stand", expr: calm ? "worried" : "angry", prop: calm ? null : "point", blink: lidAt(t, 41), facing: 1, look: 1, talk: bt1, ...life(t, 41, bt1, 1.8) });
        who(cam, out, 42, BRO2, x + 1.0, D0, z + 0.15, { mode: "stand", expr: calm ? "worried" : "angry", prop: calm ? null : "point", blink: lidAt(t, 42), facing: -1, look: -1, talk: bt2, ...life(t, 42, bt2, 1.8) }, 1, true);
        // the onlookers: "too hard!" (shaking heads)
        for (let i = 0; i < 2; i++) who(cam, out, 34 + i, SCHOLARS[i + 1], x + (i ? 2.0 : -2.1), D0, z - 1.8, { mode: "stand", expr: at(t, 45.5) ? "shock" : "nervous", prop: "book", blink: lidAt(t, 34 + i),
          headTilt: at(t, 45.5) ? 0 : q2(5 * Math.sin(t * 6 + i)), facing: i ? -1 : 1 });
        if (f >= 1420) { glint(out, t, kx + 0.35, 1.45, kz + 0.25, 0.18, 0); card(out, "ideaGlow", 256, 256, (p) => fxGlow(p, "#ffe9a8"), kx + 0.3, 1.35, kz + 0.2, 0.6, 0.6, { soft: true, glow: 0.8 }); }
      } else if (id === 8) { // a big problem cut into small steps: 1, 2, 3 light up and get ticked
        who(cam, out, 31, KHW, kx, D0, kz, { mode: "sit", expr: pick(t, [[0, "smile"], [53.5, "grin"]]), prop: pick<Prop>(t, [[0, "book"], [53.4, "gesture"]]), blink: lidAt(t, 31), facing: 1, look: 0, ...life(t, 31, 0) });
        steps(out, t, [50.0, 51.3, 52.6], [kx + 0.05, 1.7, kz + 0.3], 0.34, 0.26);
      } else { // peace: the brothers hug; a new science is born
        who(cam, out, 31, KHW, kx, D0, kz, { mode: "sit", expr: "relief", prop: "gesture", blink: lidAt(t, 31), facing: 1, look: 1, ...life(t, 31, 0) });
        const k = smooth((t - 55.0) / 1.2), lx = x - 0.95 + 0.62 * k, rx = x + 1.65 - 0.62 * k;
        who(cam, out, 41, BRO1, lx, D0, z - 0.2, { mode: k < 1 && k > 0 ? "stroll" : "stand", phase: q((t * 1.6) % 1, 60), expr: at(t, 56.0) ? "laugh" : "smile", prop: at(t, 56.0) ? "gesture" : null, blink: lidAt(t, 41), facing: 1, look: 1, tilt: at(t, 56.0) ? 6 : 0, headTilt: at(t, 56) ? 8 : 0 });
        who(cam, out, 42, BRO2, rx, D0, z - 0.15, { mode: k < 1 && k > 0 ? "stroll" : "stand", phase: q((t * 1.6 + 0.5) % 1, 60), expr: at(t, 56.0) ? "grin" : "smile", prop: at(t, 56.0) ? "gesture" : null, blink: lidAt(t, 42), facing: -1, look: -1, tilt: at(t, 56.0) ? -6 : 0, headTilt: at(t, 56) ? -8 : 0 }, 1, true);
        if (f >= 1690) { const g = smooth((f - 1690) / 25); card(out, "peaceGlow", 256, 256, (p) => fxGlow(p, "#ffd98a"), x + 0.35, 1.2, z - 0.1, 1.4 * g, 1.0 * g, { soft: true, glow: 0.7 }); }
        glyphs(out, f, 1745, 8, 6, [x + 0.35, 1.5, z - 0.1], [0.0, 0.9, 0.15], 0.34);
        if (f >= 1745) for (let i = 0; i < 3; i++) glint(out, t, x + 0.1 + i * 0.25, 1.7 + i * 0.12, z, 0.15, i * 0.5);
      }
      break;
    }
    case "field": { // two brothers quarrel over the inherited field, pointing at each other
      const [x, , z] = FIELD;
      const on1 = Math.sin(t * 1.6) > 0;
      const t1 = on1 ? flap(t, 1) : 0, t2 = !on1 ? flap(t, 2) : 0;
      who(cam, out, 41, BRO1, x - 0.65, D0, z, { mode: "stand", expr: "angry", prop: on1 ? "point" : "gesture", blink: lidAt(t, 41), facing: 1, look: 1, talk: t1, ...life(t, 41, t1, 2.2) });
      who(cam, out, 42, BRO2, x + 0.65, D0, z + 0.05, { mode: "stand", expr: on1 ? "angry" : "angry", prop: !on1 ? "point" : "gesture", blink: lidAt(t, 42), facing: -1, look: -1, talk: t2, ...life(t, 42, t2, 2.2) }, 1, true);
      break;
    }
    case "konya": { // Europe: students come out of the university with his book - "Algoritmi"
      for (let i = 0; i < 4; i++) {
        const v = walk(t, 70.4 + i * 0.3, 74.6 + i * 0.3, [KX - 2.0 + i * 1.3, -17.6 - (i % 2) * 0.7], [KX - 1.7 + i * 1.25, -11.2 - (i % 2) * 0.5]);
        who(cam, out, 55 + i, READERS[i], v.x, D0, v.z, { mode: v.mode, phase: v.phase, expr: i % 2 ? "smile" : "grin", prop: "book", blink: lidAt(t, 55 + i) });
      }
      break;
    }
    case "library": { // today: everyone on their phones, numerals rising out of every screen
      const [x, , z] = GAL;
      const ring: [number, number, number][] = [[x - 1.3, z - 0.9, 1], [x + 1.3, z - 0.8, 1], [x - 0.45, z - 1.7, 1], [x + 0.55, z - 1.8, 0.78], [x - 1.8, z + 1.1, 1], [x + 1.9, z + 1.0, 1]];
      ring.forEach(([px, pz, sc], i) => {
        who(cam, out, 73 + i, READERS[i], px, D0, pz, { mode: "stand", expr: at(t, 77.5 + i * 0.2) ? (i % 2 ? "grin" : "excited") : "smile", prop: "phone", blink: lidAt(t, 73 + i), facing: px < x ? 1 : -1, ...life(t, 73 + i, 0) }, sc);
        digits(out, Math.round(t * FPS), 2250 + i * 11, 6, 22, [px, 1.35 * sc + 0.2, pz + 0.15], 0.25, 0.16, 2.4);
      });
      break;
    }
  }
  return out;
};
export { FPS, bodySide };
