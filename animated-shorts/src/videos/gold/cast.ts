// Our cast as lit flat sprites in the 3D world (gold short). Each frame every character asks for a drawing (a key +
// a draw call); the pool keeps one canvas per distinct drawing. Characters are yaw-only billboards shaded by
// cardShade(); standing ones get a contact blob. Effects (gold, glints, smoke, fire, the chest) are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, fxPuff, Outfit, Expr, FrontOpts, SideOpts, Prop, SKINS, KID } from "./toon";
import { fxGlint, fxCrown, fxBelt, fxRam, fxGrave, fxBubble, fxRocket, fxSmoke, fxFire, fxSparks, fxChest, fxGlow, fxHoard, fxWeb, fxPadlock } from "./fx";
import {
  FPS, D0, SHOTS, V3, smooth, clamp01, VX, VTABLE, KX, MUSEUM, TEA, YARD, PALACE, GAL, GCASE_EMPTY, TABLE_DIG, DIG, ROCKET_HIT, ROOF_HIT, locksAt, glowAt, VDOOR,
} from "./story";
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
let LNAME: "day" | "golden" = "day";
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
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
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

// ---------------- our cast (gold short) ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };
const SK = SKINS;
const KEYHOLDERS: Outfit[] = [
  { jacket: "#4a4f63", pants: "#d9d2c2", boots: "#3b2a22", long: "#ece6d8", hat: "karakul", cap: "#4f4a55", moustache: "#3a2a20", skin: SK[1] },
  { jacket: "#5b4636", pants: "#ddd5c4", boots: "#3b2a22", long: "#e2dac6", hat: "pakol", cap: "#cdb38a", beard: "#4f3f33", skin: SK[2] },
  { jacket: "#2f3a4f", pants: "#2f3a4f", boots: "#241f1f", hat: "hair", hair: "#241c18", moustache: "#241c18", skin: SK[3] },
  { jacket: "#3d5a4a", pants: "#e0d8c6", boots: "#3b2a22", long: "#ebe3d0", hat: "turban", cap: "#f1ece0", beard: "#8d8a86", skin: SK[1] },
  { jacket: "#6b5a48", pants: "#4a4239", boots: "#241f1f", hat: "karakul", cap: "#6a6370", glasses: true, moustache: "#4a3426", skin: SK[2] },
];
const ARCH: Outfit = { jacket: "#b49a6a", pants: "#6b5a44", boots: "#4a3426", hat: "bushhat", glasses: true, moustache: "#6a5040", skin: SK[0] };
const DIGGERS: Outfit[] = [
  { jacket: "#6d5a45", pants: "#d8c9a8", boots: "#4a3426", long: "#d8c9a8", hat: "pakol", cap: "#c9b28a", beard: "#3a2c24", skin: SK[3] },
  { jacket: "#4e6a7a", pants: "#c4cfd6", boots: "#4a3426", long: "#9fb5c4", hat: "turban", cap: "#e6ddc8", moustache: "#2e221c", skin: SK[2] },
  { jacket: "#7a5a3a", pants: "#d6c39d", boots: "#4a3426", long: "#c9b28a", hat: "pakol", cap: "#b8a07a", skin: SK[1] },
];
const ELDER: Outfit = { jacket: "#5f4b7a", pants: "#e8e2d4", boots: "#3b2a22", long: "#efe9dc", hat: "turban", cap: "#ffffff", beard: "#ebe7df", beardLen: 14, skin: SK[3] };
const WORKERS: Outfit[] = [
  { jacket: "#56708a", pants: "#3f4f61", boots: "#2b2622", hat: "pakol", cap: "#b9a27e", moustache: "#2e221c", skin: SK[2] },
  { jacket: "#5d6b4f", pants: "#3f4636", boots: "#2b2622", hat: "cap", cap: "#4f5d70", skin: SK[3] },
  { jacket: "#6a5f8a", pants: "#3b3a52", boots: "#2b2622", hat: "pakol", cap: "#d2c19d", beard: "#352a22", skin: SK[1] },
];
const THIEVES: Outfit[] = [
  { jacket: "#3b3f52", pants: "#2b2e3b", boots: "#1f1d22", hat: "scarfwrap", scarf: "#4a4d60", skin: SK[2] },
  { jacket: "#4c4237", pants: "#2f2a24", boots: "#1f1d22", hat: "scarfwrap", scarf: "#6a3f3f", skin: SK[3] },
  { jacket: "#3e4a3e", pants: "#262c26", boots: "#1f1d22", hat: "scarfwrap", scarf: "#3f5a52", skin: SK[1] },
];
const OFFICIALS: Outfit[] = [
  { jacket: "#2e3446", pants: "#2e3446", boots: "#1d1b20", hat: "hair", hair: "#2a221d", moustache: "#2a221d", skin: SK[1] },
  { jacket: "#4b4f57", pants: "#3a3d44", boots: "#1d1b20", hat: "karakul", cap: "#45404b", beard: "#3c3832", skin: SK[2] },
  { jacket: "#3e6b4f", pants: "#e3dccb", boots: "#3b2a22", long: "#ece6d8", hat: "karakul", cap: "#5b5660", beard: "#7d7873", skin: SK[3] },
];
const SAFECRACKER: Outfit = { jacket: "#d9822b", pants: "#3b4a5e", boots: "#2b2622", hat: "cap", cap: "#3a5f8a", moustache: "#3a2a20", skin: SK[2], build: "stout" };
const GOSSIP: Outfit[] = [
  { jacket: "#8a6d4a", pants: "#e2d9c4", boots: "#4a3426", long: "#e2d9c4", hat: "pakol", cap: "#bfa47c", beard: "#3a2c24", skin: SK[3] },
  { jacket: "#3f6f8a", pants: "#d5dde0", boots: "#4a3426", long: "#c9d6dc", hat: "turban", cap: "#f2eee4", moustache: "#2e221c", skin: SK[1] },
  { jacket: "#7a3f4a", pants: "#dcd2bd", boots: "#4a3426", long: "#e6dcc6", hat: "karakul", cap: "#55505b", beard: "#8d8a86", beardLen: 6, skin: SK[2] },
  { jacket: "#56704a", pants: "#d9d2bd", boots: "#4a3426", long: "#d9d2bd", hat: "pakol", cap: "#cbb895", skin: SK[0] },
];
const FRIENDS: Outfit[] = [
  { ...KID, jacket: "#f08a2c", pants: "#3b5b9a", hat: "cap", cap: "#e2453c", skin: SK[2] },
  { ...KID, jacket: "#3f8fc9", pants: "#4a4239", hat: "hair", hair: "#2a1f1a", skin: SK[3] },
  { ...KID, jacket: "#59a65a", pants: "#3b3f52", hat: "pakol", cap: "#e6d3a8", skin: SK[1] },
  { ...KID, jacket: "#c94f7c", pants: "#3b5b9a", hat: "hair", hair: "#3a2a20", dress: "#c94f7c", skin: SK[2] },
  { ...KID, jacket: "#e8c33a", pants: "#4a3f5e", hat: "cap", cap: "#4a6fd0", skin: SK[0] },
];
const BULLY: Outfit = { jacket: "#8c3b4a", pants: "#3b3a44", boots: "#2b2622", hat: "hair", hair: "#1f1a18", skin: SK[2], build: "stout" };
const PUSHY: Outfit = { jacket: "#4a4f63", pants: "#2f3340", boots: "#1d1b20", hat: "hair", hair: "#2a221d", moustache: "#2a221d", skin: SK[1] };
const VISITORS: Outfit[] = [
  { jacket: "#3f6fb5", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#c9a25a", skin: SK[0] },
  { jacket: "#c25a7a", pants: "#3b3f52", boots: "#4a3426", hat: "bonnet", dress: "#5a8fc2", skin: SK[3] },
  { jacket: "#5d7a3a", pants: "#4a4239", boots: "#4a3426", hat: "karakul", cap: "#5b5660", beard: "#3a2c24", skin: SK[2] },
  { jacket: "#b5653f", pants: "#2f3340", boots: "#241f1f", hat: "hair", hair: "#141010", skin: SK[3] },
  { jacket: "#2f5f6a", pants: "#3b3f52", boots: "#4a3426", hat: "cap", cap: "#e2453c", skin: SK[1] },
  { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#6a4a30", dress: "#d9a441", skin: SK[0] },
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
/** the treasure on the vault table (shots 1 and 13) */
const vaultTable = (t: number, out: Stage) => {
  const [x, , z] = VTABLE;
  card(out, "crown", 600, 420, fxCrown, x, 1.22, z, 0.62, 0.434, { glow: 1.12 });
  card(out, "hoardA", 500, 200, (p) => fxHoard(p, 1), x - 0.5, 1.0, z + 0.12, 0.5, 0.2, { glow: 1.08 });
  card(out, "hoardB", 500, 200, (p) => fxHoard(p, 2), x + 0.52, 1.0, z - 0.1, 0.5, 0.2, { glow: 1.08 });
  card(out, "ram", 420, 360, fxRam, x + 0.42, 1.06, z + 0.18, 0.21, 0.18, { glow: 1.1 });
  card(out, "belt", 700, 220, fxBelt, x - 0.36, 1.0, z + 0.25, 0.36, 0.113, { glow: 1.1 });
  glint(out, t, x - 0.1, 1.38, z + 0.02, 0.16, 0); glint(out, t, x + 0.2, 1.3, z + 0.02, 0.12, 0.7); glint(out, t, x - 0.45, 1.06, z + 0.15, 0.1, 1.1);
};
/** the gold on the shelves of the chamber behind the vault door */
const chamberGold = (t: number, out: Stage, k: number) => {
  if (k <= 0) return;
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1, x = VX + side * 1.55, y = 0.95 + Math.floor(i / 2) * 0.72, z = VDOOR[2] - 3.4 - (i % 3) * 0.4;
    card(out, `hoard${i % 3}`, 500, 200, (p) => fxHoard(p, i % 3 + 3), x, y, z, 0.9, 0.36, { glow: 1.08 });
  }
  card(out, "crownC", 600, 420, fxCrown, VX, 1.45, VDOOR[2] - 4.6, 0.7, 0.49, { glow: 1.15 });
  card(out, "glowC", 256, 256, (p) => fxGlow(p), VX, 1.9, VDOOR[2] - 5.4, 6 * k, 5 * k, { soft: true, glow: 1.3 });
  for (let i = 0; i < 5; i++) glint(out, t, VX + (i - 2) * 0.55, 1.2 + (i % 3) * 0.55, VDOOR[2] - 3.6, 0.22, i * 0.31);
};
/** smoke columns over the city at war (shots 8-10) */
const warSmoke = (t: number, out: Stage) => {
  for (const [x, z, s] of [[KX - 45, -95, 1.4], [KX + 60, -70, 1.0], [KX - 95, -30, 1.2], [KX + 25, -140, 1.6]] as const)
    for (let k = 0; k < 5; k++) {
      const u = (t * 0.07 + k / 5) % 1, sz = (8 + 14 * u) * s;
      card(out, `smoke${k % 3}`, 300, 300, (p) => fxSmoke(p, k % 3), x - u * 10 * s, 6 + u * 40 * s, z, sz, sz, { soft: true });
    }
};
const roofFire = (t: number, out: Stage) => {
  for (const [dx, dz, s] of [[-1.2, 0, 1], [1.5, 1.2, 0.8], [-3.5, -1, 0.7]] as const) {
    const k = q((t * 2 + dx) % 1, 12);
    card(out, `fire${k}`, 300, 360, (p) => fxFire(p, k), ROOF_HIT[0] + dx, ROOF_HIT[1] + 1.4 * s, ROOF_HIT[2] + dz, 2.6 * s, 3.1 * s);
  }
  for (let k = 0; k < 4; k++) {
    const u = (t * 0.25 + k / 4) % 1, sz = 3 + 7 * u;
    card(out, `rsmoke${k % 3}`, 300, 300, (p) => fxSmoke(p, k % 3, "#4a4550"), ROOF_HIT[0] - u * 3, ROOF_HIT[1] + 3 + u * 9, ROOF_HIT[2] - 1, sz, sz, { soft: true });
  }
};
/** five keyholders in two rows before the vault door; keyUp(i) = holds the key up */
const keyholders = (cam: CamInfo, t: number, out: Stage, expr: (i: number) => Expr, prop: (i: number) => Prop) => {
  const spots: [number, number][] = [[VX - 0.95, -2.3], [VX - 0.47, -2.95], [VX, -2.3], [VX + 0.47, -2.95], [VX + 0.95, -2.3]];
  spots.forEach(([x, z], i) => who(cam, out, i + 10, KEYHOLDERS[i], x, D0, z, { mode: "stand", expr: expr(i), prop: prop(i), blink: lidAt(t, i + 10), facing: x < VX - 0.1 ? 1 : x > VX + 0.1 ? -1 : 0 }));
};

export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1], f = Math.round(t * FPS);
  LNAME = s.light;
  findSun(cam, SUN);
  switch (id) {
    case 1: {
      vaultTable(t, out);
      chamberGold(t, out, glowAt(1, f));
      if (f >= 98) keyholders(cam, t, out, (i) => (at(t, 4.52) ? (i === 2 ? "smile_closed" : i % 2 ? "stern" : "neutral") : "neutral"), (i) => (i === 2 && at(t, 4.52) ? "hush" : null));
      break;
    }
    case 2: case 3: case 4: case 5: case 6: {
      const ds: [number, number][] = [[-1.6, 3.7], [1.3, 3.45], [-0.15, 4.7]];
      ds.forEach(([x, z], i) => {
        const dig = Math.sin(t * 5 + i * 2) > 0;
        const exprD: Expr = id === 4 && i === 1 ? (at(t, 12.74) ? (at(t, 13.05) ? "grin" : "shock") : "neutral") : (["neutral", "smile_closed", "stern"] as Expr[])[i];
        who(cam, out, 30 + i, DIGGERS[i], x, DIG.top, z, { mode: "stand", expr: exprD, prop: i === 2 ? "brush" : "shovel", tilt: dig ? 6 : 0, blink: lidAt(t, 30 + i), facing: x < 0 ? 1 : -1 });
      });
      who(cam, out, 34, ELDER, 3.0, DIG.top, 5.7, { mode: "stand", expr: at(t, 10.62) ? "smile_closed" : "neutral", prop: at(t, 10.62) ? "point" : null, blink: lidAt(t, 34), facing: -1 }, 1, true);
      who(cam, out, 35, ARCH, -3.4, DIG.top, 4.6, { mode: "stand", expr: "smile", prop: "list", blink: lidAt(t, 35), facing: 1 });
      if (id === 4 && f >= 378 && f < 392) { const u = q((f - 378) / 14, 30); card(out, `burstG${u}`, 500, 500, (p) => fxBurst(p, u, "#fff1a8"), 0.1, 1.6, 2.8, 1.3, 1.3, { glow: 1.4 }); }
      if (id >= 4) { glint(out, t, 0.2, 1.4, 2.85, 0.35, 0); glint(out, t, -0.4, 1.1, 2.9, 0.25, 0.6); }
      if (id === 5 || id === 6 || id === 2 || id === 3) {
        let n = 0;
        for (const gx of [-3.2, 0, 3.2]) for (const gz of [-1.45, 1.45]) {
          const pop = id === 5 ? smooth((f - (402 + n * 5)) / 6) : 1;
          if (pop > 0) card(out, `grave${n}`, 300, 520, (p) => fxGrave(p, n + 1), gx, DIG.trench.floor + 0.02, gz, 1.15 * pop, 2.0 * pop, { flat: true, rot: Math.PI / 2 });
          if (id === 5 && pop > 0.9) glint(out, t, gx, DIG.trench.floor + 0.3, gz, 0.6, n * 0.27);
          n++;
        }
      }
      if (id === 6 || id === 5) {
        const [x, y, z] = TABLE_DIG, top = y + 0.82;
        card(out, "crown", 600, 420, fxCrown, x - 0.8, top + 0.22, z, 0.62, 0.434, { glow: 1.1 });
        card(out, "belt", 700, 220, fxBelt, x, top + 0.1, z, 0.66, 0.207, { glow: 1.1 });
        card(out, "ram", 420, 360, fxRam, x + 0.82, top + 0.13, z, 0.3, 0.257, { glow: 1.1 });
        if (id === 6) for (let i = 0; i < 3; i++) glint(out, t, x - 0.8 + i * 0.82 + 0.1, top + 0.2, z + 0.05, 0.14, i * 0.4);
      }
      break;
    }
    case 7: {
      for (let i = 0; i < 3; i++) {
        const w = walk(t, 18.0 + i * 0.35, 20.6 + i * 0.35, [KX + 3.2 + i * 1.1, -7 + i * 1.6], [KX + 0.6 + i * 0.5, -15.5 + i * 1.2]);
        who(cam, out, 40 + i, WORKERS[i], w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: "smile_closed", prop: "crate", blink: lidAt(t, 40 + i) });
      }
      for (let i = 0; i < 3; i++) who(cam, out, 45 + i, GOSSIP[i], KX - 4.5 - i * 1.4, D0, -6 + i * 2.2, { mode: "stand", expr: "smile", blink: lidAt(t, 45 + i), facing: 1 });
      break;
    }
    case 8: case 9: case 10: {
      warSmoke(t, out);
      if (id === 9 && f < ROCKET_HIT) {
        const u = clamp01((f - 649) / (ROCKET_HIT - 649)), sx = KX - 30, sy = 24, sz = MUSEUM.z + 6;
        card(out, "rocket", 600, 160, fxRocket, sx + (ROOF_HIT[0] - sx) * u, sy + (ROOF_HIT[1] - sy) * u, sz + (ROOF_HIT[2] - sz) * u, 5, 1.33, { rot: -0.42, glow: 1.1 });
      }
      if (f >= ROCKET_HIT && f < ROCKET_HIT + 14) { const u = q((f - ROCKET_HIT) / 14, 30); card(out, `burstR${u}`, 500, 500, (p) => fxBurst(p, u, "#ffcf6a", 12), ROOF_HIT[0], ROOF_HIT[1] + 1, ROOF_HIT[2] + 3, 9, 9, { glow: 1.5 }); }
      if (f >= ROCKET_HIT + 4) roofFire(t, out);
      if (id === 10) {
        const props: Prop[] = ["vase", "statue", "crate"];
        for (let i = 0; i < 3; i++) {
          const w = walk(t, 22.8 + i * 0.45, 25.4 + i * 0.45, [KX - 0.2 + i * 0.3, -18.6], [KX + 3.6 + i * 0.4, -12.6 + i * 0.6]);
          if (t > 22.8 + i * 0.45 - 0.1) who(cam, out, 50 + i, THIEVES[i], w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: "smile", look: 1, prop: props[i], blink: lidAt(t, 50 + i) });
        }
      }
      break;
    }
    case 11: {
      const [x, , z] = GCASE_EMPTY;
      card(out, "web", 300, 300, fxWeb, x + 0.24, 1.48, z + 0.24, 0.3, 0.3, { soft: true });
      if (f >= 781 && f < 800) { const u = q((f - 781) / 19, 30); card(out, `puff${u}`, 300, 300, (p) => fxPuff(p, u), x, 1.12, z + 0.1, 0.7, 0.7, { soft: true }); }
      break;
    }
    case 12: case 22: {
      const [x, , z] = TEA;
      if (id === 12) {
        who(cam, out, 60, GOSSIP[0], x - 0.75, 0.5, z - 0.2, { mode: "sit", expr: at(t, 27.72) ? "nervous" : "smile", prop: "tea", blink: lidAt(t, 60), facing: 1 });
        who(cam, out, 61, GOSSIP[1], x + 0.95, D0, z + 0.55, { mode: "stand", expr: "grin", prop: "gesture", blink: lidAt(t, 61), facing: -1 }, 1, true);
        who(cam, out, 62, GOSSIP[2], x - 1.65, D0, z + 0.9, { mode: "stand", expr: at(t, 28.43) ? "shock" : "smile_closed", blink: lidAt(t, 62), facing: 1 });
        who(cam, out, 63, GOSSIP[3], x + 0.15, 0.5, z - 0.45, { mode: "sit", expr: at(t, 28.43) ? "grin" : "smile", prop: "tea", blink: lidAt(t, 63) });
        const pop = smooth((t - 27.0) / 0.2);
        if (pop > 0) card(out, "bubble", 520, 420, fxBubble, x + 0.55, 2.85, z + 0.35, 1.5 * pop, 1.21 * pop);
      } else {
        const grow = q(clamp01((t - 49.0) / 2.5), 8);
        who(cam, out, 64, { ...KEYHOLDERS[1], beardLen: 2 + 34 * grow, beard: grow > 0.6 ? "#8d8a86" : "#4f3f33" }, x - 0.3, 0.5, z - 0.1, { mode: "sit", expr: "smile_closed", prop: "tea", blink: lidAt(t, 64), facing: 1 });
        who(cam, out, 65, PUSHY, x + 0.85, D0, z + 0.5, { mode: "stand", expr: at(t, 50.4) ? "nervous" : "stern", prop: "point", blink: lidAt(t, 65), facing: -1 }, 1, true);
      }
      break;
    }
    case 13: vaultTable(t, out); if (f >= 886 && f < 900) { const u = q((f - 886) / 14, 30); card(out, `burstC${u}`, 500, 500, (p) => fxBurst(p, u, "#fff3c0"), VX + 0.05, 1.3, VTABLE[2] + 0.05, 0.8, 0.8, { glow: 1.5 }); } break;
    case 14: case 15: {
      chamberGold(t, out, glowAt(id, f));
      if (id === 14) {
        for (let i = 0; i < 3; i++) {
          const w = walk(t, 30.2 + i * 0.6, 34.0 + i * 0.6, [VX + 1.4 - i * 0.2, 1.6 + i * 0.9], [VX + 0.25 - i * 0.15, -4.0 + i * 0.85]);
          who(cam, out, 70 + i, WORKERS[i], w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: i === 1 ? "stern" : "neutral", prop: "crate", blink: lidAt(t, 70 + i) });
        }
        who(cam, out, 74, KEYHOLDERS[0], VX - 1.9, D0, -1.8, { mode: "stand", expr: "neutral", prop: "list", blink: lidAt(t, 74), facing: 1 });
        who(cam, out, 75, KEYHOLDERS[3], VX + 2.3, D0, -2.6, { mode: "stand", expr: "stern", blink: lidAt(t, 75), facing: -1 });
      }
      break;
    }
    case 17: keyholders(cam, t, out, (i) => (at(t, 35.62 + i * 0.16) ? "smile_closed" : "neutral"), (i) => (at(t, 35.62 + i * 0.16) ? "key" : null)); break;
    case 18: case 19: {
      const o = id === 18 ? THIEVES : OFFICIALS;
      who(cam, out, 80 + id, o[0], PALACE.x - 0.55, D0, -4.25, { mode: "stand", expr: "nervous", prop: id === 18 ? "lantern" : "list", look: -1, blink: lidAt(t, 80 + id), facing: 1 });
      who(cam, out, 82 + id, o[id === 18 ? 1 : 2], PALACE.x + 0.95, D0, -3.85, { mode: "stand", expr: at(t, id === 18 ? 38.43 : 40.87) ? "dazed" : "nervous", prop: "scratch", blink: lidAt(t, 82 + id), facing: -1 });
      break;
    }
    case 20: case 21: {
      const [x, , z] = YARD, locks = locksAt(id, f);
      card(out, `chest${locks}`, 700, 460, (p) => fxChest(p, locks), x, 0.43, z, 1.3, 0.854);
      if (id === 21 && f >= 1432 && f < 1444) { const u = q((f - 1432) / 12, 30); card(out, `burstL${u}`, 500, 500, (p) => fxBurst(p, u), x - 0.37, 0.46, z + 0.05, 0.45, 0.45); }
      if (id === 21 && f >= 1432) card(out, "lockOpen", 200, 240, (p) => fxPadlock(p, true), x - 0.42, 0.12, z + 0.25, 0.12, 0.144);
      const spots: [number, number][] = [[x - 1.5, z + 0.2], [x - 0.85, z - 0.75], [x, z - 1.05], [x + 0.85, z - 0.75], [x + 1.5, z + 0.2]];
      spots.forEach(([px, pz], i) => {
        const grabbed = id === 21 && i === 4 && f >= 1392;
        const up = id === 21 ? !grabbed : at(t, 42.83 + i * 0.12);
        const e: Expr = grabbed ? (at(t, 46.66) ? "shock" : "nervous") : id === 21 ? (at(t, 47.4) ? "smile_closed" : "nervous") : at(t, 45.51) ? "grin" : "smile";
        who(cam, out, 90 + i, FRIENDS[i], px, D0, pz, { mode: "stand", expr: e, prop: up ? "key" : null, blink: lidAt(t, 90 + i), facing: px < x ? 1 : px > x ? -1 : 0 }, 0.78);
      });
      if (id === 21) {
        const w = walk(t, 46.0, 46.5, [x + 3.0, z + 1.0], [x + 2.05, z + 0.55]);
        const w2 = walk(t, 47.0, 47.6, [x + 2.05, z + 0.55], [x + 0.95, z + 0.55]);
        const p = t < 47.0 ? w : w2;
        const e: Expr = at(t, 47.71) ? "dazed" : f >= 1392 ? "grin" : "stern";
        who(cam, out, 96, BULLY, p.x, D0, p.z, { mode: p.mode, phase: p.phase, expr: e, prop: f >= 1392 ? "key" : null, blink: lidAt(t, 96), facing: -1 }, 1.05, true);
        if (f >= 1392 && f < 1402) { const u = q((f - 1392) / 10, 30); card(out, `burstK${u}`, 500, 500, (p2) => fxBurst(p2, u), x + 1.75, 1.35, z + 0.5, 0.6, 0.6); }
      }
      break;
    }
    case 23: case 24: {
      chamberGold(t, out, glowAt(id, f));
      const ofs: [number, number][] = [[VX - 0.95, -2.55], [VX + 0.05, -2.95], [VX + 0.95, -2.5]];
      const happy = id === 24 && at(t, 57.18);
      ofs.forEach(([x, z], i) => who(cam, out, 100 + i, OFFICIALS[i], x, D0, z, {
        mode: "stand", expr: happy ? (i === 1 ? "relief_open" : "relief") : id === 24 ? "shock" : i === 0 ? "nervous" : "stern",
        prop: happy ? null : i === 0 ? "list" : i === 1 && at(t, 53.95) ? "scratch" : null, blink: lidAt(t, 100 + i), facing: x < VX ? 1 : -1,
      }));
      if (f >= 1640 || id === 24) {
        const drill = id === 23 && f >= 1660;
        who(cam, out, 104, SAFECRACKER, VX + 1.5, D0, -4.55, { mode: "stand", expr: id === 24 ? (happy ? "grin" : "shock") : "stern", prop: id === 23 ? (drill ? "drill" : "bag") : null, blink: lidAt(t, 104), facing: -1 }, 1, true);
        if (drill) { const k = q((f % 9) / 9, 9); card(out, `sparks${k}`, 300, 300, (p) => fxSparks(p, k), VX + 0.92, 1.3, -5.3, 0.55, 0.55, { glow: 1.6 }); }
      }
      break;
    }
    case 25: {
      const fam: [number, Outfit, number][] = [[0, VISITORS[2], 1], [1, VISITORS[1], 1], [2, FRIENDS[0], 0.78], [3, FRIENDS[3], 0.78], [4, VISITORS[0], 1]];
      for (const [i, o, sc] of fam) {
        const w = walk(t, 58.4 + i * 0.3, 63.0 + i * 0.3, [KX + 4.5 + i * 0.6, -5.5 + (i % 2) * 1.2], [KX + 0.4 + (i - 2) * 0.5, -17.4 + (i % 2) * 0.6]);
        who(cam, out, 110 + i, o, w.x, D0, w.z, { mode: w.mode, phase: w.phase, expr: sc < 1 ? "grin" : "smile", blink: lidAt(t, 110 + i), look: -1 }, sc);
      }
      break;
    }
    case 26: {
      const [x, , z] = GAL;
      card(out, "crownG", 600, 420, fxCrown, x, 1.32, z, 0.52, 0.364, { glow: 1.25 });
      glint(out, t, x - 0.1, 1.45, z + 0.02, 0.16, 0); glint(out, t, x + 0.15, 1.38, z + 0.02, 0.12, 0.8);
      const crowd: [number, number, Expr, number][] = [[x - 1.25, z - 0.95, "shock", 1], [x + 1.25, z - 0.8, "smile", 1], [x - 0.42, z - 1.6, "grin", 0.78], [x + 0.5, z - 1.75, "smile_closed", 1],
        [x - 1.75, z + 1.15, "smile", 1], [x + 1.85, z + 1.05, "grin", 0.78]];
      crowd.forEach(([px, pz, e, sc], i) => who(cam, out, 120 + i, sc < 1 ? FRIENDS[i % 5] : VISITORS[i % 6], px, D0, pz, { mode: "stand", expr: e, blink: lidAt(t, 120 + i), facing: px < x ? 1 : -1, look: px < x ? 1 : -1 }, sc));
      break;
    }
  }
  return out;
};
export { FPS, bodySide };
