// Our cast as lit flat sprites in the 3D world (gold short). Each frame every character asks for a drawing (a key +
// a draw call); the pool keeps one canvas per distinct drawing. Characters are yaw-only billboards shaded by
// cardShade(); standing ones get a contact blob. Effects (gold, glints, smoke, fire, the chest) are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, fxPuff, Outfit, Expr, FrontOpts, SideOpts, Prop, SKINS, KID } from "./toon";
import { fxGlint, fxGlow, fxGlyph, fxDigit, fxStep, fxCamel, fxKite, fxScript, fxScraps, fxShaft } from "./fx";
import MOUTHS from "./mouth.json";
import { FPS, D0, SHOTS, smooth, clamp01, BT, FT, FE, HX, GX, JUI, CX, CELL, WALLPOS, SX, TOMB, PALACE, RUD, MSG, camAt, V3 } from "./story";
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
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean; glow?: number; yaw?: number };
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
const SCHOLARS: Outfit[] = [
  { jacket: "#4e5a7a", pants: "#d8c9a8", boots: "#4a3426", long: "#d8d0bc", hat: "turban", cap: "#ece4d0", beard: "#e6e2da", beardLen: 14, skin: SK[2] },
  { jacket: "#6a5a3a", pants: "#dcd2bd", boots: "#4a3426", long: "#e6dcc6", hat: "turban", cap: "#efe6d4", beard: "#9a9088", beardLen: 12, skin: SK[1] },
  { jacket: "#5a4a6a", pants: "#c4cfd6", boots: "#4a3426", long: "#c9c2d6", hat: "turban", cap: "#f1ece0", beard: "#3a2c24", beardLen: 10, skin: SK[3] },
];
/** Rabia Balkhi: the emir's daughter (deep rose dress, a pale gold headscarf); as a girl a lighter pink */
const RABIA: Outfit = { jacket: "#8a2f5a", pants: "#5a1f3a", boots: "#4a3426", dress: "#8a2f5a", hat: "hijab", veil: "#f1d48a", skin: SK[1] };
const RABIA_KID: Outfit = { jacket: "#c25a7a", pants: "#7a2f4a", boots: "#4a3426", dress: "#c25a7a", hat: "hijab", veil: "#f6e3b0", skin: SK[1], build: "kid" };
/** her brother Harith: dark, stern, a sword at his belt */
const HARITH: Outfit = { jacket: "#4a2a2a", pants: "#2f2a2a", boots: "#241f1f", long: "#3a2a2a", hat: "turban", cap: "#2a2a30", beard: "#1c1714", beardLen: 10, skin: SK[3], sword: true };
/** Rudaki, the master poet of the Samanid court: old, white beard */
const RUDAKI: Outfit = { jacket: "#6a5a3a", pants: "#e6dcc6", boots: "#4a3426", long: "#e8dcc0", hat: "turban", cap: "#f1ece0", beard: "#f0ede6", beardLen: 16, skin: SK[2] };
/** today: schoolgirls (black dress, white headscarf), women and men visiting the tomb */
const GIRL = (i: number): Outfit => ({ jacket: "#22222a", pants: "#22222a", boots: "#241f1f", dress: "#22222a", hat: "hijab", veil: "#f6f6f2", skin: SK[i % 4], build: "kid" });
const WOMEN: Outfit[] = [
  { jacket: "#3f6fb5", pants: "#2f3542", boots: "#241f1f", dress: "#3f6fb5", hat: "hijab", veil: "#2f4a7a", skin: SK[2] },
  { jacket: "#2f6a43", pants: "#2f3542", boots: "#241f1f", dress: "#2f6a43", hat: "hijab", veil: "#e8dcc0", skin: SK[3] },
  { jacket: "#8c3b4a", pants: "#2f3542", boots: "#241f1f", dress: "#8c3b4a", hat: "hijab", veil: "#3a2a3a", skin: SK[1] },
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
/** a walking camel card (feet on y), canvas faces +x */
const camel = (out: Stage, x: number, y: number, z: number, dist: number, blanket: string, sc = 1) => {
  const k = q((dist / 2.2) % 1, 12);
  card(out, `camel${k}${blanket}`, 800, 640, (p) => fxCamel(p, k, blanket), x, y + 1.04 * sc, z, 2.6 * sc, 2.08 * sc);
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

// ---- screen overlays: diagrams glued to the picture (canvas points land on given screen points) ----
const pcam = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 1500);
const camOf = (id: number, f: number) => {
  const c = camAt(id, f);
  pcam.position.set(...c.pos); pcam.up.set(0, 1, 0); pcam.lookAt(...c.look); pcam.rotateZ(c.roll);
  pcam.fov = c.fov; pcam.updateProjectionMatrix(); pcam.updateMatrixWorld();
  return pcam;
};
const ndcOf = (id: number, f: number, w: V3): [number, number] => { const v = new THREE.Vector3(...w).project(camOf(id, f)); return [v.x, v.y]; };
const atDepth = (c: THREE.PerspectiveCamera, n: [number, number], d: number) => {
  const fw = c.getWorldDirection(new THREE.Vector3()), v = new THREE.Vector3(n[0], n[1], 0.5).unproject(c).sub(c.position).normalize();
  return c.position.clone().addScaledVector(v, d / v.dot(fw));
};
/** stretch a card so canvas point uA lands on screen point A (ndc) and uB on B, at depth d in front of the lens */
const overlay = (out: Stage, id: number, f: number, key: string, cw: number, ch: number, draw: (p: Pen) => void,
  A: [number, number], uA: [number, number], B: [number, number], uB: [number, number], d: number, glow = 1.3) => {
  const c = camOf(id, f), a = atDepth(c, A, d), b = atDepth(c, B, d);
  const right = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 1);
  const ab = b.clone().sub(a), W = ab.dot(right) / (uB[0] - uA[0]), H = -ab.dot(up) / (uB[1] - uA[1]);
  const m = a.clone().addScaledVector(right, -(uA[0] - 0.5) * W).addScaledVector(up, (uA[1] - 0.5) * H);
  card(out, key, cw, ch, draw, m.x, m.y, m.z, Math.abs(W), Math.abs(H), { glow });
};
/** an undistorted card centred on screen point n (ndc), hf = its height as a fraction of the frame height */
const overlayC = (out: Stage, id: number, f: number, key: string, cw: number, ch: number, draw: (p: Pen) => void, n: [number, number], hf: number, d: number, glow = 1.3) => {
  const c = camOf(id, f), m = atDepth(c, n, d), H = 2 * d * Math.tan((c.fov * Math.PI) / 360) * hf;
  card(out, key, cw, ch, draw, m.x, m.y, m.z, (H * cw) / ch, H, { glow });
};
const prog = (t: number, a: number, b: number) => q(clamp01((t - a) / (b - a)), 24);
/** a row of golden numerals popping in one by one from t0 (s), centred on o, gap m apart (right to left for Persian reading is not needed: digits read left to right) */
const numRow = (out: Stage, t: number, t0: number, s: string, o: [number, number, number], gap: number, w: number, dt = 0.35) => {
  [...s].forEach((ch, k) => {
    const age = t - (t0 + k * dt);
    if (age < 0) return;
    const pop = Math.min(1, age / 0.25), sc = w * pop * (1 + 0.25 * Math.sin(pop * Math.PI));
    card(out, `num${ch}`, 256, 256, (p) => fxDigit(p, ch), o[0] + (k - (s.length - 1) / 2) * gap, o[1] + 0.03 * Math.sin(t * 2 + k), o[2], sc, sc, { glow: 1.4 });
  });
};
/** paper kites over the city: bobbing on the wind, tails waving */
const KITES: [number, number, number, string][] = [[HX - 26, 17, -58, "#e2453c"], [HX + 32, 24, -84, "#3f6fb5"], [HX + 9, 31, -112, "#f4c542"], [HX - 48, 27, -130, "#59a65a"]];
const kites = (out: Stage, t: number) => KITES.forEach(([x, y, z, col], i) => {
  const ph = q((t * 0.8 + i * 0.3) % 1, 12);
  card(out, `kite${i}${ph}`, 256, 512, (p) => fxKite(p, col, ph), x + 2.2 * Math.sin(t * 0.6 + i), y + 1.2 * Math.sin(t * 0.9 + 2 * i), z, 3.0, 6.0, { rot: q(0.18 * Math.sin(t * 1.1 + i), 20) });
});

const farid = (cam: CamInfo, out: Stage, t: number, f: number, fo: FrontOpts) => {
  const talk = talkOf("F", f);
  who(cam, out, 1, FARID, FT[0], FT[1], FT[2], { mode: "sit", blink: lidAt(t, 1), facing: -1, look: -1, ...life(t, 1, talk, fo.expr === "angry" ? 1.8 : 1), talk, ...fo });
};
const baba = (cam: CamInfo, out: Stage, t: number, f: number, fo: FrontOpts) => {
  const talk = talkOf("B", f);
  who(cam, out, 2, BABA, BT[0], BT[1], BT[2], { mode: "sit", blink: lidAt(t, 2), facing: 1, look: 1, ...life(t, 2, talk), talk, ...fo });
};
/** the torn poem: scraps on the takht beside Farid */
const scraps = (out: Stage) => card(out, "scraps", 512, 256, (p) => fxScraps(p), FT[0] + 0.62, 0.485, FT[2] + 0.25, 0.55, 0.28, { flat: true, rot: 0.3 });
/** soft shafts of light from the dome's star holes */
const shafts = (out: Stage, t: number) => [[-0.7, -0.6], [0.5, -1.2], [0.1, 0.4]].forEach(([dx, dz], i) =>
  card(out, `shaft${i}`, 256, 512, (p) => fxShaft(p), CX + dx, 1.9, dz, 1.0, 3.6, { soft: true, glow: 0.55 + 0.08 * Math.sin(t * 0.7 + i) }));
/** the poem written on the cell wall, a wall-aligned card (k 0..1 written) */
const script = (out: Stage, k: number, glow: number) => {
  if (k <= 0) return;
  card(out, `script${q(k, 48)}`, 1024, 512, (p) => fxScript(p, k), WALLPOS[0], WALLPOS[1], WALLPOS[2] + 0.32, 1.5, 0.75, { yaw: 0, glow });
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], f = Math.round(t * FPS);
  LNAME = s.light;
  findSun(cam, SUN);
  switch (s.set) {
    case "garden": { // a Kabul garden in the late afternoon: the takht by the water
      if (id < 19) scraps(out);
      if (id === 1) { // Farid by the water: the torn poem; Baba on the takht behind him
        const talk = talkOf("F", f);
        who(cam, out, 1, FARID, FE[0], D0, FE[2], { mode: "stand", expr: pick(t, [[0, "sad"], [2.4, "cry"], [3.6, "stern"], [5.4, "sad"]]), prop: null, blink: lidAt(t, 1, [2.4, 3.6]), facing: -1,
          look: pick(t, [[0, 0], [1.5, -1]]), ...life(t, 1, talk), headTilt: q2(-4 + (talk ? 1.5 * Math.sin(t * 4) : 0)), talk });
        baba(cam, out, t, f, { expr: pick(t, [[0, "smile_closed"], [2.6, "worried"]]), prop: "tea" });
      } else if (id === 2) { // Baba: tore it? come, sit by the water. Farid walks over and sits
        baba(cam, out, t, f, { expr: pick(t, [[0, "worried"], [8.4, "smile"], [11.3, "smile_closed"], [12.6, "smile"]]), prop: pick<Prop>(t, [[0, "gesture"], [9.4, "point"], [11.4, "gesture"]]) });
        if (t < 12.3) {
          const w = walk(t, 10.0, 12.3, [FE[0], FE[2]], [FT[0] + 0.05, FT[2] + 0.35]);
          who(cam, out, 1, FARID, w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: "sad", prop: null, blink: lidAt(t, 1), facing: -1, look: -1, headTilt: w.mode === "stroll" ? -3 : 0 });
        } else farid(cam, out, t, f, { expr: "sad", prop: null, headTilt: -4 });
      } else {
        const fe: Record<number, FrontOpts> = {
          3: { expr: pick(t, [[0, "sad"], [15.6, "cry"], [16.6, "sad"]]), prop: null, headTilt: -5 },
          4: { expr: pick(t, [[0, "sad"], [21.5, "neutral"], [26.6, "shock"]]), prop: null, look: pick(t, [[0, -1], [21.5, 0]]) },
          7: { expr: pick(t, [[0, "shock"], [40.4, "excited"]]), prop: null },
          8: { expr: pick(t, [[0, "smile"], [46.0, "grin"]]), prop: null },
          10: { expr: pick(t, [[0, "smile"], [58.5, "worried"]]), prop: null },
          12: { expr: pick(t, [[0, "shock"], [68.9, "worried"]]), prop: null },
          18: { expr: pick(t, [[0, "worried"], [102.0, "neutral"], [104.6, "smile"]]), prop: null },
          20: { expr: pick(t, [[0, "grin"], [116.0, "shock"], [119.0, "grin"]]), prop: "list", look: pick(t, [[0, 0], [116.0, -1]]) },
        };
        if (id === 19) { // Farid jumps up with a new page: I'll write it again and read it aloud!
          const talk = talkOf("F", f), up = at(t, 107.0);
          who(cam, out, 1, FARID, FT[0] + (up ? 0.15 : 0), up ? D0 : FT[1], FT[2] + (up ? 0.25 : 0), { mode: up ? "stand" : "sit", expr: pick(t, [[0, "smile"], [107.0, "excited"], [109.3, "laugh"]]),
            prop: pick<Prop>(t, [[0, null], [107.0, "list"], [108.6, "point"], [109.6, "list"]]), blink: lidAt(t, 1, [107.0]), facing: -1, look: -1, ...life(t, 1, talk, 1.4), talk });
          baba(cam, out, t, f, { expr: pick(t, [[0, "smile"], [107.6, "grin"]]), prop: "tea" });
          if (t > 108.0) glyphs(out, f, 3245, 4, 10, [FT[0] + 0.45, 1.55, FT[2] + 0.2], [0.05, 0.45, 0.04], 0.22);
        } else farid(cam, out, t, f, fe[id]);
        const be: Record<number, FrontOpts> = {
          3: { expr: "worried", prop: null },
          4: { expr: pick(t, [[0, "smile"], [20.5, "smile_closed"], [23.0, "grin"], [26.4, "relief"]]), prop: pick<Prop>(t, [[0, "gesture"], [23.0, "point"], [25.5, "gesture"]]) },
          7: { expr: "smile_closed", prop: null },
          8: { expr: pick(t, [[0, "grin"], [44.0, "laugh"], [46.5, "grin"]]), prop: pick<Prop>(t, [[0, "point"], [44.5, "gesture"]]) },
          10: { expr: pick(t, [[0, "neutral"], [57.6, "stern"], [60.0, "worried"]]), prop: pick<Prop>(t, [[0, null], [57.8, "gesture"]]) },
          12: { expr: "sad", prop: null },
          18: { expr: pick(t, [[0, "smile_closed"], [103.6, "smile"], [104.6, "grin"]]), prop: pick<Prop>(t, [[0, "gesture"], [104.4, "point"]]) },
          20: { expr: pick(t, [[0, "laugh"], [112.3, "grin"], [114.6, "smile"]]), prop: pick<Prop>(t, [[0, "gesture"], [114.6, "point"]]) },
        };
        if (id !== 19) baba(cam, out, t, f, be[id]);
        if (id === 4 && f >= 790) { // the story begins: a warm glow and golden words rise between them
          const k = smooth((f - 790) / 30);
          card(out, "storyGlow", 256, 256, (p) => fxGlow(p, "#ffd98a"), GX, 1.5, BT[2] - 0.1, 1.1 * k, 1.1 * k, { soft: true, glow: 0.8 });
          glyphs(out, f, 795, 5, 9, [GX, 1.3, BT[2] - 0.1], [0.05, 0.5, 0.05], 0.3);
        }
      }
      break;
    }
    case "library": { // Balkh: the emir's library
      const L: V3 = [1000, 0, 150];
      if (id === 5) { // a girl reading at the book stand
        who(cam, out, 31, RABIA_KID, L[0] + 0.2, D0, L[2] - 1.0, { mode: "stand", expr: pick(t, [[0, "smile_closed"], [31.2, "smile"], [33.0, "grin"]]), prop: "book", blink: lidAt(t, 31), facing: 0, look: pick(t, [[0, 0], [31.2, 1]]), ...life(t, 31, 0) });
        if (t > 32.0) glyphs(out, f, 965, 5, 11, [L[0] + 0.55, 0.95, L[2] - 0.8], [0.08, 0.38, 0.05], 0.18);
      } else { // grown up: she writes, and the words rise
        who(cam, out, 32, RABIA, L[0] + 0.1, D0, L[2] - 0.9, { mode: "stand", expr: pick(t, [[0, "smile_closed"], [35.6, "smile"], [37.4, "grin"]]), prop: "book", blink: lidAt(t, 32, [35.6]), facing: 0, look: 0, ...life(t, 32, 0) });
        glyphs(out, f, 1040, 8, 12, [L[0] + 0.62, 1.15, L[2] - 0.7], [0.1, 0.42, 0.05], 0.22);
        card(out, "rGlow", 256, 256, (p) => fxGlow(p, "#ffd98a"), L[0] + 0.3, 0.95, L[2] - 0.6, 0.7, 0.7, { soft: true, glow: 0.5 });
      }
      break;
    }
    case "court": { // Bukhara: a messenger reads her poem; Rudaki is amazed
      const talk = t > 49.3 && t < 54.6 ? flap(t, 3) : 0;
      who(cam, out, 41, SCHOLARS[1], MSG[0], D0, MSG[2], { mode: "stand", expr: "smile", prop: "list", blink: lidAt(t, 41), facing: -1, look: -1, ...life(t, 41, talk), talk }, 1, true);
      who(cam, out, 42, RUDAKI, RUD[0], D0, RUD[2], { mode: "stand", expr: pick(t, [[0, "neutral"], [52.2, "shock"], [54.0, "relief"]]), prop: pick<Prop>(t, [[0, null], [54.0, "gesture"]]), blink: lidAt(t, 42, [52.2, 54.0]), facing: 1, look: 1, ...life(t, 42, 0, at(t, 52.2) ? 1.6 : 1) });
      who(cam, out, 43, SCHOLARS[0], PALACE.x - 2.6, D0, PALACE.z + 1.6, { mode: "stand", expr: pick(t, [[0, "smile"], [52.4, "shock"]]), prop: "book", blink: lidAt(t, 43), facing: 1, ...life(t, 43, 0) });
      who(cam, out, 44, SCHOLARS[2], PALACE.x + 2.4, D0, PALACE.z + 1.8, { mode: "stand", expr: pick(t, [[0, "smile_closed"], [52.6, "grin"]]), prop: "list", blink: lidAt(t, 44), facing: -1, ...life(t, 44, 0) }, 1, true);
      if (t > 50.0) glyphs(out, f, 1505, 7, 12, [MSG[0] - 0.1, 1.5, MSG[2] + 0.1], [-0.12, 0.35, 0.02], 0.22);
      break;
    }
    case "cell": { // the bath-house cell
      shafts(out, t);
      if (id === 11) { // Harith points her in and leaves; she stays alone
        const R: V3 = [CX - 0.6, 0, -1.6];
        who(cam, out, 32, RABIA, R[0], D0, R[2], { mode: "stand", expr: pick(t, [[0, "worried"], [64.2, "sad"], [66.0, "cry"]]), prop: null, blink: lidAt(t, 32, [64.2, 66.0]), facing: 1, look: pick(t, [[0, 1], [65.8, 0]]), ...life(t, 32, 0) });
        if (t < 66.2) {
          const w = walk(t, 64.4, 66.2, [CX + 0.8, -0.4], [CX + 2.4, 2.0]);
          who(cam, out, 45, HARITH, w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: "angry", prop: pick<Prop>(t, [[0, "point"], [64.4, null]]), blink: lidAt(t, 45), facing: -1, look: -1, ...life(t, 45, 0, 1.5) }, 1, true);
        }
      } else { // she writes her last poem on the wall
        const R: V3 = id === 13 ? [CX - 0.15, 0, -2.25] : [CX + 0.1, 0, -2.3];
        const ex = id === 13 ? pick<FrontOpts["expr"]>(t, [[0, "sad"], [72.0, "stern"], [74.5, "smile_closed"]]) : pick<FrontOpts["expr"]>(t, [[0, "smile_closed"], [80.5, "relief"], [83.0, "smile_closed"]]);
        who(cam, out, 32, RABIA, R[0], D0, R[2], { mode: "stand", expr: ex, prop: id === 13 && t > 73.0 ? "point" : null, blink: lidAt(t, 32, [72.0, 74.5]), facing: 1, look: 1, ...life(t, 32, 0) });
        const k = id === 13 ? 0.55 * prog(t, 73.0, 76.4) : 0.55 + 0.45 * prog(t, 76.9, 82.5);
        script(out, k, 1.25 + 0.15 * Math.sin(t * 2.2));
        if (id === 14 && t > 80.0) glyphs(out, f, 2400, 6, 14, [WALLPOS[0] + 0.5, 2.3, WALLPOS[2] + 0.45], [0.03, 0.3, 0.08], 0.2);
      }
      break;
    }
    case "ruins": { // the wall is gone; the poem flies up into the sunset sky
      glyphs(out, f, 2556, 20, 7, [0.5, 2.6, -2], [0.35, 1.25, -0.35], 0.75);
      card(out, "ruinGlow", 256, 256, (p) => fxGlow(p, "#ffd98a"), 0.5, 2.6, -2, 2.4, 2.4, { soft: true, glow: 0.7 });
      break;
    }
    case "shrine": { // today: visitors at Rabia's tomb in Balkh
      const pz = TOMB.z + TOMB.r + 4.5;
      WOMEN.forEach((o, i) => who(cam, out, 71 + i, o, SX - 2.6 + i * 1.9, D0, pz + (i % 2) * 0.8, { mode: "stand", expr: i === 1 ? "smile_closed" : "smile", prop: i === 2 ? "book" : null, blink: lidAt(t, 71 + i), facing: i === 2 ? -1 : 1, ...life(t, 71 + i, 0) }, 1, i === 2));
      for (let i = 0; i < 3; i++) {
        const w = walk(t, 91.8 + i * 0.4, 96.0 + i * 0.4, [SX + 7 - i * 1.2, pz + 3.5 + i * 0.6], [SX + 2.5 - i * 1.2, pz + 2.2 + i * 0.6]);
        who(cam, out, 75 + i, i === 1 ? SCHOLARS[0] : GIRL(i), w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: "smile", prop: i === 1 ? null : "book", blink: lidAt(t, 75 + i), facing: -1, look: -1 }, 1, true);
      }
      break;
    }
    case "kabul": { // today: schoolgirls walking to school in Kabul
      for (let i = 0; i < 5; i++) {
        const w = walk(t, 95.7 + i * 0.25, 99.5 + i * 0.25, [1000 - 6.5 + i * 1.3, 3.2 + (i % 2) * 0.9], [1000 + 1.2 + i * 1.3, 3.2 + (i % 2) * 0.9]);
        who(cam, out, 81 + i, GIRL(i), w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: i % 2 ? "grin" : "smile", prop: i % 3 === 0 ? "book" : i % 3 === 1 ? "bag" : null, blink: lidAt(t, 81 + i), facing: 1, look: 1, headTilt: q2(2 * Math.sin(t * 3 + i)) });
      }
      who(cam, out, 86, WOMEN[0], 1000 + 3.5, D0, 1.2, { mode: "stand", expr: "smile", prop: "book", blink: lidAt(t, 86), facing: -1, ...life(t, 86, 0) }, 1, true);
      break;
    }
  }
  return out;
};
export { FPS, bodySide };
