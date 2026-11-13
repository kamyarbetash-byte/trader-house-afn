// Our cast as lit flat sprites in the 3D world (gold short). Each frame every character asks for a drawing (a key +
// a draw call); the pool keeps one canvas per distinct drawing. Characters are yaw-only billboards shaded by
// cardShade(); standing ones get a contact blob. Effects (gold, glints, smoke, fire, the chest) are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, fxPuff, Outfit, Expr, FrontOpts, SideOpts, Prop, SKINS, KID } from "./toon";
import { fxGlint, fxGlow, fxGlyph, fxDigit, fxStep, fxCamel, fxTri, fxDip, fxEarth, fxSat, fxKite } from "./fx";
import MOUTHS from "./mouth.json";
import { FPS, D0, SHOTS, smooth, clamp01, BT, FT, FE, HX, NX, NM, SUM, ROPE, CREW as CW, GW, NW, PALACE, RX, camAt, V3 } from "./story";
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
const BIR: Outfit = { jacket: "#3f5a7a", pants: "#e6dcc6", boots: "#4a3426", long: "#e8dcc0", hat: "turban", cap: "#f6f2e6", beard: "#5a4a40", beardLen: 12, skin: SK[1] };
const SCHOLARS: Outfit[] = [
  { jacket: "#4e5a7a", pants: "#d8c9a8", boots: "#4a3426", long: "#d8d0bc", hat: "turban", cap: "#ece4d0", beard: "#e6e2da", beardLen: 14, skin: SK[2] },
  { jacket: "#6a5a3a", pants: "#dcd2bd", boots: "#4a3426", long: "#e6dcc6", hat: "turban", cap: "#efe6d4", beard: "#9a9088", beardLen: 12, skin: SK[1] },
  { jacket: "#5a4a6a", pants: "#c4cfd6", boots: "#4a3426", long: "#c9c2d6", hat: "turban", cap: "#f1ece0", beard: "#3a2c24", beardLen: 10, skin: SK[3] },
];
const CREW: Outfit[] = [
  { jacket: "#8c3b4a", pants: "#d8c9a8", boots: "#4a3426", long: "#c9b48a", hat: "turban", cap: "#e8dcc0", beard: "#3a2c24", beardLen: 8, skin: SK[3] },
  { jacket: "#5d7a3a", pants: "#e6dcc6", boots: "#3b2a22", long: "#d9cdb0", hat: "turban", cap: "#d9c9a8", moustache: "#3a2c24", skin: SK[2] },
  { jacket: "#b5653f", pants: "#d8c9a8", boots: "#4a3426", long: "#e0d2b4", hat: "turban", cap: "#f1ece0", beard: "#6a5a4a", beardLen: 10, skin: SK[1] },
  { jacket: "#3f6fb5", pants: "#e6dcc6", boots: "#3b2a22", long: "#d9cdb0", hat: "turban", cap: "#ece4d0", beard: "#2e221c", beardLen: 6, skin: SK[3] },
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

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], f = Math.round(t * FPS);
  LNAME = s.light;
  findSun(cam, SUN);
  switch (s.set) {
    case "hill": { // the hill above Kabul at sunset
      kites(out, t);
      if (id === 1) { // Farid at the edge, phone in hand: the contest; Baba on the bench behind him
        const talk = talkOf("F", f);
        who(cam, out, 1, FARID, FE[0], D0, FE[2], { mode: "stand", expr: pick(t, [[0, "sad"], [3.6, "stern"], [5.6, "sad"]]), prop: "phone", blink: lidAt(t, 1, [3.6]), facing: -1, look: pick(t, [[0, 0], [2.0, -1]]),
          ...life(t, 1, talk), talk });
        baba(cam, out, t, f, { expr: "worried", prop: null });
      } else if (id === 2) { // Baba: nothing? come, sit. Farid walks over and sits down
        baba(cam, out, t, f, { expr: pick(t, [[0, "smile"], [9.2, "smile_closed"], [10.6, "smile"]]), prop: pick<Prop>(t, [[0, "gesture"], [9.4, "point"], [11.2, "gesture"]]) });
        if (t < 11.9) {
          const w = walk(t, 9.7, 11.9, [FE[0], FE[2]], [FT[0] + 0.05, FT[2] + 0.35]);
          who(cam, out, 1, FARID, w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: "sad", prop: "phone", blink: lidAt(t, 1), facing: -1, look: -1, headTilt: w.mode === "stroll" ? -3 : 0 });
        } else farid(cam, out, t, f, { expr: "sad", prop: "phone" });
      } else {
        const fe: Record<number, FrontOpts> = {
          3: { expr: "angry", prop: "gesture" },
          4: { expr: pick(t, [[0, "stern"], [19.0, "neutral"], [24.5, "shock"]]), prop: pick<Prop>(t, [[0, "phone"], [19.5, null]]) },
          10: { expr: pick(t, [[0, "neutral"], [66.5, "smile"]]), prop: null, look: -1, headTilt: 3 },
          11: { expr: pick(t, [[0, "smile"], [73.0, "shock"]]), prop: null },
          14: { expr: "excited", prop: null },
          15: { expr: pick(t, [[0, "shock"], [97.0, "smile"]]), prop: null },
          16: { expr: pick(t, [[0, "smile"], [104.5, "grin"]]), prop: pick<Prop>(t, [[0, null], [104.0, "list"]]) },
          18: { expr: pick(t, [[0, "grin"], [118.0, "shock"], [121.0, "grin"]]), prop: "list", look: pick(t, [[0, 0], [118.0, -1]]) },
        };
        if (id === 17) { // Farid jumps up: the project! a triangle drawn over the hill beside him
          const talk = talkOf("F", f), up = at(t, 108.3);
          who(cam, out, 1, FARID, FT[0] + (up ? 0.15 : 0), up ? D0 : FT[1], FT[2] + (up ? 0.25 : 0), { mode: up ? "stand" : "sit", expr: pick(t, [[0, "smile"], [108.3, "excited"]]), prop: pick<Prop>(t, [[0, "list"], [110.5, "point"], [112.6, "list"]]),
            blink: lidAt(t, 1, [108.3]), facing: -1, look: -1, ...life(t, 1, talk, 1.4), talk });
          baba(cam, out, t, f, { expr: pick(t, [[0, "smile"], [109.0, "grin"]]), prop: "tea" });
          if (t > 110.4) overlay(out, id, f, `tri${prog(t, 110.4, 113.0)}`, 512, 512, (p) => fxTri(p, prog(t, 110.4, 113.0)), [0.05, -0.62], [40 / 512, 470 / 512], [0.85, 0.12], [440 / 512, 50 / 512], 3.0);
        } else farid(cam, out, t, f, fe[id]);
        const be: Record<number, FrontOpts> = {
          3: { expr: "worried", prop: null },
          4: { expr: pick(t, [[0, "smile"], [18.5, "smile_closed"], [21.0, "grin"], [26.0, "relief"]]), prop: pick<Prop>(t, [[0, "gesture"], [21.0, "point"], [24.5, "gesture"]]) },
          10: { expr: "smile_closed", prop: null },
          11: { expr: pick(t, [[0, "grin"], [73.5, "laugh"]]), prop: pick<Prop>(t, [[0, "point"], [72.0, "gesture"]]) },
          14: { expr: "smile_closed", prop: null },
          15: { expr: pick(t, [[0, "smile"], [95.5, "grin"], [97.5, "smile_closed"]]), prop: pick<Prop>(t, [[0, "point"], [95.5, "gesture"]]) },
          16: { expr: pick(t, [[0, "smile"], [105.0, "grin"]]), prop: pick<Prop>(t, [[0, "gesture"], [102.8, "point"], [105.0, "gesture"]]) },
          18: { expr: pick(t, [[0, "laugh"], [115.2, "grin"], [117.0, "smile"]]), prop: pick<Prop>(t, [[0, "gesture"], [117.0, "point"]]) },
        };
        if (id !== 17) baba(cam, out, t, f, be[id]);
        if (id === 4 && f >= 790) { // the story begins: a warm glow and golden words rise between them
          const k = smooth((f - 790) / 30);
          card(out, "storyGlow", 256, 256, (p) => fxGlow(p, "#ffd98a"), HX, 1.5, BT[2] - 0.1, 1.1 * k, 1.1 * k, { soft: true, glow: 0.8 });
          glyphs(out, f, 795, 5, 9, [HX, 1.3, BT[2] - 0.1], [0.05, 0.5, 0.05], 0.3);
        }
        if (id === 11 && t > 69.9) overlayC(out, id, f, `earth${prog(t, 69.9, 75.6)}`, 512, 512, (p) => fxEarth(p, prog(t, 69.9, 75.6)), [0, 0.5], 0.4, 3.6);
      }
      break;
    }
    case "ghazni": { // Ghazni: Biruni walks past the citadel gate with his book; two courtiers
      const w = walk(t, 28.9, 33.6, [GW.x0, GW.z], [GW.x1, GW.z]);
      who(cam, out, 51, BIR, w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: pick(t, [[0, "smile_closed"], [33.8, "smile"]]), prop: "book", blink: lidAt(t, 51), facing: 1, look: pick(t, [[0, 1], [33.8, 0]]) });
      who(cam, out, 52, SCHOLARS[0], PALACE.x - 2.6, D0, PALACE.z + 1.6, { mode: "stand", expr: "smile", prop: "book", blink: lidAt(t, 52), facing: 1, ...life(t, 52, 0) });
      who(cam, out, 53, SCHOLARS[2], PALACE.x + 2.3, D0, PALACE.z + 1.8, { mode: "stand", expr: "smile_closed", prop: "list", blink: lidAt(t, 53), facing: -1, ...life(t, 53, 0) }, 1, true);
      break;
    }
    case "desert": { // the caliph's party: men walking the rope across the desert, camels behind
      const props: Prop[] = ["list", "bag", "shovel", "book"];
      for (let i = 0; i < 4; i++) {
        const v = walk(t, CW.t0, CW.t1, [CW.x0 - i * 1.5, ROPE.z + 0.75 + (i % 2) * 0.3], [CW.x1 - i * 1.5, ROPE.z + 0.75 + (i % 2) * 0.3]);
        who(cam, out, 61 + i, CREW[i], v.x, D0, v.z, { mode: v.mode, phase: v.phase, expr: i % 2 ? "nervous" : "stern", prop: props[i], blink: lidAt(t, 61 + i), facing: 1, headTilt: q2(2 * Math.sin(t * 3 + i)) });
      }
      for (let i = 0; i < 2; i++) {
        const v = walk(t, CW.t0, CW.t1, [CW.x0 - 1.5 - i * 3.2, ROPE.z - 1.6], [CW.x1 - 1.5 - i * 3.2, ROPE.z - 1.6]);
        camel(out, v.x, D0, v.z, Math.hypot(v.x - 50, 0), i ? "#2f6a8a" : "#b8433a");
      }
      break;
    }
    case "nandana": {
      if (id === 7) { // alone across the plain, astrolabe in hand: "I'll do it alone, from a mountain"
        const w = walk(t, 44.3, 48.6, [NW.x0, NW.z], [NW.x1, NW.z]);
        who(cam, out, 51, BIR, w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: pick(t, [[0, "smile_closed"], [48.6, "smile"], [49.6, "grin"]]), prop: "astrolabe", blink: lidAt(t, 51, [49.6]),
          facing: 1, look: pick(t, [[0, 1], [48.8, 0]]), headTilt: at(t, 49.6) ? q2(2 * Math.sin(t * 3)) : 0 });
      } else if (id === 8) { // at the foot: sighting the summit; the triangle is drawn over the picture
        const B: V3 = [NX - 21.5, 0, 21.5];
        who(cam, out, 51, BIR, B[0], D0, B[2], { mode: "stand", expr: "smile", prop: "astrolabe", blink: lidAt(t, 51), facing: 1, look: 1, headTilt: -4 });
        const k = prog(t, 53.0, 57.2);
        if (k > 0) overlay(out, id, f, `tri${k}`, 512, 512, (p) => fxTri(p, k), ndcOf(id, f, [B[0] + 0.35, 1.45, B[2]]), [40 / 512, 470 / 512], ndcOf(id, f, NM), [440 / 512, 50 / 512], 6);
      } else if (id === 9) { // on the summit: the horizon lies lower than his eye
        who(cam, out, 51, BIR, SUM[0], SUM[1], SUM[2], { mode: "stand", expr: pick(t, [[0, "smile_closed"], [61.0, "shock"], [63.5, "smile"]]), prop: "astrolabe", blink: lidAt(t, 51, [61.0]), facing: 1, look: 1, ...life(t, 51, 0) });
        const k = prog(t, 61.0, 64.5);
        if (f >= 1830 && k > 0) { const E = ndcOf(id, f, [SUM[0] + 0.25, SUM[1] + 1.5, SUM[2]]); overlay(out, id, f, `dip${k}`, 512, 256, (p) => fxDip(p, k), E, [30 / 512, 60 / 256], [0.9, E[1] - 0.22], [500 / 512, 200 / 256], 4); }
      } else { // he writes the result in his book: 6340
        who(cam, out, 51, BIR, SUM[0], SUM[1], SUM[2], { mode: "sit", expr: pick(t, [[0, "smile_closed"], [80.5, "grin"]]), prop: "book", blink: lidAt(t, 51), facing: 1, look: 0, ...life(t, 51, 0) });
        numRow(out, t, 79.3, "۶۳۴۰", [SUM[0], SUM[1] + 1.78, SUM[2] + 0.45], 0.17, 0.17);
        if (t > 79.0) glyphs(out, f, 2380, 4, 12, [SUM[0] + 0.55, SUM[1] + 0.9, SUM[2] + 0.3], [0.08, 0.3, 0.05], 0.18);
      }
      break;
    }
    case "roof": { // today: a satellite crossing the night sky above Kabul
      const u = clamp01((t - 82.6) / 7.2), blink = Math.floor(t * 2) % 2;
      card(out, `sat${blink}`, 512, 256, (p) => fxSat(p, blink), RX - 26 + 52 * u, 30 + 9 * u, -62 - 6 * u, 11, 5.5, { glow: 1.25, rot: -0.12 });
      break;
    }
  }
  return out;
};
export { FPS, bodySide };
