// Our cast as lit flat sprites in the 3D world (gold short). Each frame every character asks for a drawing (a key +
// a draw call); the pool keeps one canvas per distinct drawing. Characters are yaw-only billboards shaded by
// cardShade(); standing ones get a contact blob. Effects (gold, glints, smoke, fire, the chest) are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, fxPuff, Outfit, Expr, FrontOpts, SideOpts, Prop, SKINS, KID } from "./toon";
import { fxGlint, fxGlow, fxGlyph, fxBookOpen, fxLamp, fxKey } from "./fx";
import { FPS, D0, SHOTS, smooth, clamp01, KX, TEA, YARD, GAL, KR, RX, FSEAT, BSEAT } from "./story";
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

// ---------------- our cast ("Our ancestors" ep. 2: Ibn Sina) ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };
const SK = SKINS;
const FARID: Outfit = { jacket: "#3b5f8f", pants: "#2f3542", boots: "#e8e4dc", hat: "hair", hair: "#1c1714", skin: SK[2] };
const BABA: Outfit = { jacket: "#55604a", pants: "#e6e0d2", boots: "#4a3426", long: "#ece6d8", hat: "karakul", cap: "#7a7680", beard: "#f0ede6", beardLen: 12, skin: SK[3] };
const HUSAYN_KID: Outfit = { ...KID, jacket: "#2f6a5a", pants: "#e6dcc6", boots: "#4a3426", long: "#efe7d2", hat: "turban", cap: "#f4efe2", skin: SK[1] };
const HUSAYN: Outfit = { jacket: "#2f6a5a", pants: "#e6dcc6", boots: "#4a3426", long: "#ece4d0", hat: "turban", cap: "#f6f2e6", moustache: "#2e221c", skin: SK[1] };
const TEACHER: Outfit = { jacket: "#6d5a45", pants: "#e8e2d4", boots: "#3b2a22", long: "#efe9dc", hat: "turban", cap: "#e8dcc0", beard: "#d9d4cc", beardLen: 14, skin: SK[2] };
const SELLER: Outfit = { jacket: "#8a6d3a", pants: "#e8e2d4", boots: "#3b2a22", long: "#efe9dc", hat: "turban", cap: "#e8dcc0", beard: "#f2efe8", beardLen: 16, skin: SK[3] };
const POOR: Outfit = { jacket: "#7a6a58", pants: "#b8a88a", boots: "#4a3426", long: "#a8987a", hat: "pakol", cap: "#8a7a62", beard: "#5a4a3a", beardLen: 6, skin: SK[3] };
const KING: Outfit = { jacket: "#9a2f3a", pants: "#efe2c0", boots: "#4a3426", long: "#e8c33a", hat: "turban", cap: "#f2d36a", beard: "#3a2c24", beardLen: 10, skin: SK[1] };
const DOCS: Outfit[] = [
  { jacket: "#4e5a7a", pants: "#d8c9a8", boots: "#4a3426", long: "#d8d0bc", hat: "turban", cap: "#ece4d0", beard: "#e6e2da", beardLen: 14, skin: SK[2] },
  { jacket: "#5a4a6a", pants: "#c4cfd6", boots: "#4a3426", long: "#c9c2d6", hat: "turban", cap: "#f1ece0", beard: "#3a2c24", beardLen: 10, skin: SK[3] },
  { jacket: "#6a5a3a", pants: "#dcd2bd", boots: "#4a3426", long: "#e6dcc6", hat: "turban", cap: "#efe6d4", beard: "#9a9088", beardLen: 12, skin: SK[1] },
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
/** one standing / walking / sitting character, front view, with its contact blob */
const who = (cam: CamInfo, out: Stage, i: number, o: Outfit, x: number, y: number, z: number, fo: FrontOpts, scale = 1, mirror = false, noBlob = false) => {
  const pl = person(cam, { i, o, okey: okey(o) }, x, y, z, { side: false, mirror: false }, fo, {} as SideOpts, scale);
  out.places.push(mirror ? { ...pl, mirror: true } : pl);
  if (!noBlob) blob(out, x, y, z, scale);
};
const at = (t: number, a: number) => t >= a - LEAD;
/** walking from p0 to p1 between t0 and t1 (stroll phase from the distance walked; 0.7 m per step) */
const walk = (t: number, t0: number, t1: number, p0: [number, number], p1: [number, number]) => {
  const u = clamp01((t - t0) / (t1 - t0)), d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const moving = t > t0 && t < t1;
  return { x: p0[0] + (p1[0] - p0[0]) * u, z: p0[1] + (p1[1] - p0[1]) * u, phase: q(((u * d) / 1.4) % 1, 60), mode: (moving ? "stroll" : "stand") as FrontOpts["mode"] };
};
/** an unlit card (gold, effects); y = card centre */
const card = (out: Stage, key: string, cw: number, ch: number, draw: (p: Pen) => void, x: number, y: number, z: number, w: number, h: number, extra: Partial<FxPlace> = {}) =>
  out.fx.push({ key, cw, ch, draw, x, y, z, w, h, ...extra });
const glint = (out: Stage, t: number, x: number, y: number, z: number, s: number, ph: number) => {
  const u = ((t * 0.9 + ph) % 1.6) / 1.6;
  if (u > 0.5) return;
  const k = q(u * 2, 12);
  card(out, `glint${k}`, 200, 200, (p) => fxGlint(p, k), x, y, z, s, s, { glow: 1.6 });
};
/** golden glyphs flying from (x0,y0,z0) along d (m/s), one every `gap` frames from f0 */
const glyphs = (out: Stage, f: number, f0: number, n: number, gap: number, o: [number, number, number], d: [number, number, number], w: number) => {
  for (let k = 0; k < n; k++) {
    const age = (f - (f0 + k * gap)) / FPS;
    if (age < 0) continue;
    const wob = Math.sin(age * 2.2 + k) * 0.25 * w;
    card(out, `glyph${k % 6}`, 360, 200, (p) => fxGlyph(p, k % 6), o[0] + d[0] * age + wob, o[1] + d[1] * age, o[2] + d[2] * age, w, w * 0.556, { glow: 1.35, rot: Math.sin(age + k) * 0.2 });
  }
};
const lampAndGlow = (out: Stage) => {
  card(out, "lamp", 200, 320, fxLamp, RX + 1.85, 0.2, -2.25, 0.22, 0.35, { glow: 1.25 });
  card(out, "lampGlow", 256, 256, (p) => fxGlow(p, "#ffcf7a"), RX + 1.85, 0.3, -2.2, 2.2, 2.2, { soft: true, glow: 0.8 });
};
const farid = (cam: CamInfo, out: Stage, t: number, fo: FrontOpts) => who(cam, out, 1, FARID, FSEAT[0], FSEAT[1], FSEAT[2], { mode: "sit", blink: lidAt(t, 1), ...fo });
const baba = (cam: CamInfo, out: Stage, t: number, fo: FrontOpts) => who(cam, out, 2, BABA, BSEAT[0], BSEAT[1], BSEAT[2], { mode: "sit", blink: lidAt(t, 2), facing: -1, ...fo });

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], f = Math.round(t * FPS);
  LNAME = s.light;
  findSun(cam, SUN);
  switch (s.set) {
    case "roof": {
      lampAndGlow(out);
      // Farid: still on his phone, curious; laughs at "forty times"; swaps the phone for a book; the teaser makes him look at it
      const fe: Record<number, FrontOpts> = {
        1: { expr: "smile", prop: "phone", look: 1, facing: 1 }, 2: { expr: "neutral", prop: "phone", look: 1, facing: 1 },
        3: { expr: "stern", prop: "phone", look: 1, facing: 1, headTilt: -5 }, 4: { expr: "neutral", prop: "phone", look: 1, facing: 1 },
        7: { expr: at(t, 34.6) ? "grin" : "laugh", prop: "phone", look: 1, facing: 1 }, 8: { expr: "neutral", prop: "phone", look: 1, facing: 1 },
        13: { expr: "grin", prop: "phone", look: 1, facing: 1 }, 14: { expr: at(t, 71.2) ? "shock" : "neutral", prop: "phone", look: 1, facing: 1 },
        17: { expr: at(t, 89.5) ? "relief" : "neutral", prop: "phone", look: 1, facing: 1 },
        18: { expr: at(t, 92.4) ? "smile_closed" : "stern", prop: at(t, 92.2) ? "book" : "phone", look: at(t, 92.4) ? 0 : 1, facing: 1 },
        19: { expr: at(t, 101.2) ? "grin" : at(t, 99.6) ? "shock" : "smile", prop: at(t, 99.6) ? "phone" : "book", look: at(t, 99.6) && !at(t, 101.2) ? 0 : 1, facing: 1 },
      };
      farid(cam, out, t, fe[id]);
      const be: Record<number, FrontOpts> = {
        1: { expr: "smile_closed", prop: "tea" }, 2: { expr: at(t, 7.5) ? "smile_closed" : "smile", prop: "gesture" },
        3: { expr: "smile_closed", prop: "tea" }, 4: { expr: at(t, 18.0) ? "smile_closed" : "smile", prop: at(t, 18.5) ? "gesture" : "point" },
        7: { expr: "grin", prop: "tea" }, 8: { expr: "smile_closed", prop: "point" },
        13: { expr: "smile_closed", prop: "tea" }, 14: { expr: at(t, 70.6) ? "smile" : "smile_closed", prop: at(t, 70.6) ? "point" : "gesture" },
        17: { expr: at(t, 89.2) ? "relief" : "smile_closed", prop: "gesture" }, 18: { expr: "smile_closed", prop: "tea" },
        19: { expr: at(t, 98.5) ? "grin" : "smile", prop: at(t, 98.8) ? "point" : "gesture" },
      };
      baba(cam, out, t, be[id]);
      if (id === 14 && f >= 2118) { // a golden key appears between them
        const k = smooth((f - 2118) / 24), y = 1.35 + 0.08 * Math.sin(t * 2.2);
        card(out, "keyGlow", 256, 256, (p) => fxGlow(p, "#ffd98a"), RX + 0.05, y, -1.75, 0.9 * k, 0.9 * k, { soft: true, glow: 0.9 });
        card(out, "key", 280, 160, fxKey, RX + 0.05, y, -1.7, 0.42 * k, 0.24 * k, { glow: 1.3, rot: 0.15 * Math.sin(t * 1.3) });
        glint(out, t, RX + 0.2, y + 0.06, -1.65, 0.14, 0.2);
      }
      if (id === 19 && f >= 3040) glyphs(out, f, 3045, 6, 8, [RX - 0.4, 1.6, -2.3], [-0.8, 3.0, -6.0], 0.9);
      break;
    }
    case "yard": {
      const [x, , z] = YARD;
      if (id === 5) { // the boy with his teacher: the Quran by heart at ten
        who(cam, out, 61, TEACHER, x - 0.45, D0, z - 1.1, { mode: "sit", expr: at(t, 25.8) ? "smile" : "smile_closed", prop: "gesture", blink: lidAt(t, 61), facing: 1, look: 1 });
        who(cam, out, 62, HUSAYN_KID, x + 0.38, D0, z - 0.6, { mode: "sit", expr: at(t, 25.6) ? "grin" : "smile_closed", prop: "book", blink: lidAt(t, 62), facing: -1, look: -1 }, 0.78);
        if (f >= 770) { const k = smooth((f - 770) / 30); card(out, "kidGlow", 256, 256, (p) => fxGlow(p, "#ffd98a"), x + 0.38, 0.45, z - 0.45, 0.8 * k, 0.5 * k, { soft: true, glow: 0.7 }); }
      } else if (id === 6) { // night: the same book, forty times, and still nothing
        who(cam, out, 63, HUSAYN, x, D0, z - 1.0, { mode: "sit", expr: at(t, 31.4) ? "sad" : at(t, 29.6) ? "dazed" : "stern", prop: "book", blink: lidAt(t, 63) });
        card(out, "lampY", 200, 320, fxLamp, x + 0.75, 0.2, z - 0.9, 0.22, 0.35, { glow: 1.25 });
        card(out, "lampYGlow", 256, 256, (p) => fxGlow(p, "#ffcf7a"), x + 0.75, 0.32, z - 0.85, 2.0, 2.0, { soft: true, glow: 0.8 });
      } else { // the lock opens: golden words fly out of the old book; alms for the poor
        who(cam, out, 64, HUSAYN, x, D0, z - 1.0, { mode: "sit", expr: at(t, 48.2) ? "smile" : "grin", prop: at(t, 48.2) ? "gesture" : "book", blink: lidAt(t, 64), facing: 1, look: at(t, 48.2) ? 1 : 0 });
        const k = smooth((f - 1365) / 35);
        card(out, "bookGlowY", 256, 256, (p) => fxGlow(p, "#ffd98a"), x + 0.05, 0.62, z - 0.7, 0.9 * k, 0.6 * k, { soft: true, glow: 0.75 });
        glyphs(out, f, 1370, 9, 14, [x + 0.5, 0.9, z - 0.45], [0.3, 0.55, 0.12], 0.4);
        const w = walk(t, 46.8, 48.0, [x + 2.2, z - 0.2], [x + 0.95, z - 0.6]);
        who(cam, out, 65, POOR, w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: at(t, 49.0) ? "grin" : "neutral", blink: lidAt(t, 65), facing: -1, look: -1 }, 1, true);
        if (f >= 1455) for (let i = 0; i < 3; i++) glint(out, t, x + 0.75 + i * 0.12, 0.95 + i * 0.1, z - 0.55, 0.14, i * 0.5);
      }
      break;
    }
    case "attar": { // the bazaar: an old bookseller sells him a worn book for three dirhams
      const [x, , z] = TEA, sold = f >= 1290;
      who(cam, out, 41, SELLER, x - 0.35, 0.5, z - 0.3, { mode: "sit", expr: sold ? "smile" : "smile_closed", prop: sold ? "gesture" : "book", blink: lidAt(t, 41), facing: 1 });
      who(cam, out, 42, HUSAYN, x + 0.55, D0, z + 0.4, { mode: "stand", expr: f >= 1320 ? "grin" : sold ? "shock" : "stern", prop: sold ? "book" : null, blink: lidAt(t, 42), facing: -1 }, 1, true);
      if (f >= 1300) {
        const k = smooth((f - 1300) / 30);
        card(out, "sellGlow", 256, 256, (p) => fxGlow(p, "#ffd98a"), x + 0.45, 0.75, z + 0.5, 0.8 * k, 0.55 * k, { soft: true, glow: 0.9 });
        for (let i = 0; i < 3; i++) glint(out, t, x + 0.5 + (i % 2) * 0.3, 1.0 + i * 0.15, z + 0.5, 0.16, i * 0.37);
      }
      break;
    }
    case "konya": {
      if (id === 11) { // the palace: the court physicians walk out, shaking their heads
        DOCS.forEach((o, i) => {
          const v = walk(t, 51.6 + i * 0.35, 56.8 + i * 0.35, [KX - 1.4 + i * 1.4, -17.5 - (i % 2) * 0.8], [KX - 1.0 + i * 1.3, -10.5 - (i % 2) * 0.6]);
          const shake = Math.sin(t * 7 + i) > 0.3 ? -6 : 6;
          who(cam, out, 51 + i, o, v.x, D0, v.z, { mode: v.mode, phase: v.phase, expr: i === 1 ? "sad" : "nervous", headTilt: shake, blink: lidAt(t, 51 + i) });
        });
      } else { // Europe: students come out of the university with the Canon
        for (let i = 0; i < 4; i++) {
          const v = walk(t, 80.1 + i * 0.3, 84.4 + i * 0.3, [KX - 2.0 + i * 1.3, -17.6 - (i % 2) * 0.7], [KX - 1.7 + i * 1.25, -11.2 - (i % 2) * 0.5]);
          who(cam, out, 55 + i, READERS[i], v.x, D0, v.z, { mode: v.mode, phase: v.phase, expr: i % 2 ? "smile" : "smile_closed", prop: "book", blink: lidAt(t, 55 + i) }, i === 4 ? 0.78 : 1);
        }
      }
      break;
    }
    case "library": {
      const [x, , z] = GAL;
      if (id === 12) { // the palace room: the sick king, the young doctor; the king gets well
        const well = f >= 1935, [kx, , kz] = KR;
        who(cam, out, 71, KING, kx - 0.45, 0.42, kz - 0.3, { mode: "sit", expr: well ? "grin" : f >= 1900 ? "relief" : "pained", prop: well ? "gesture" : null, blink: lidAt(t, 71, [1900 / FPS, 1935 / FPS]), facing: 1, look: 1 });
        who(cam, out, 72, HUSAYN, kx + 0.75, D0, kz - 0.05, { mode: "stand", expr: well ? "smile" : "smile_closed", prop: "gesture", blink: lidAt(t, 72), facing: -1, look: -1 }, 1, true);
        if (f >= 1880) {
          const k = smooth((f - 1880) / 50);
          card(out, "cureGlow", 256, 256, (p) => fxGlow(p, "#ffe9a8"), kx - 0.4, 0.55, kz - 0.15, 1.0 * k, 0.5 * k, { soft: true, glow: 0.75 });
          if (well) for (let i = 0; i < 4; i++) glint(out, t, kx - 0.7 + (i % 2) * 0.55, 0.9 + i * 0.2, kz - 0.1, 0.17, i * 0.4);
        }
      } else { // the Canon under the spotlight, readers of the world all around, golden words in the air
        card(out, "bookOpen", 700, 420, fxBookOpen, x, 1.32, z, 0.66, 0.4, { glow: 1.2 });
        glint(out, t, x - 0.15, 1.45, z + 0.02, 0.15, 0); glint(out, t, x + 0.2, 1.4, z + 0.02, 0.12, 0.8);
        const ring: [number, number, number][] = [[x - 1.3, z - 0.9, 1], [x + 1.3, z - 0.8, 1], [x - 0.45, z - 1.7, 1], [x + 0.55, z - 1.8, 0.78], [x - 1.8, z + 1.1, 1], [x + 1.9, z + 1.0, 1]];
        ring.forEach(([px, pz, sc], i) => who(cam, out, 73 + i, READERS[i], px, D0, pz, { mode: "stand", expr: i % 3 === 0 ? "smile" : i % 3 === 1 ? "smile_closed" : "grin", prop: "book", blink: lidAt(t, 73 + i), facing: px < x ? 1 : -1 }, sc));
        glyphs(out, f, 2220, 10, 18, [x - 1.5, 1.6, z - 1.0], [0.25, 0.4, 0.05], 0.55);
      }
      break;
    }
  }
  return out;
};
export { FPS, bodySide };
