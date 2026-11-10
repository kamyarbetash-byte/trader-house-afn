// The static sets of the gold short, each far from the others so fog and walls keep them apart:
//   dig site (0, 0)       the Hill of Gold: desert plateau mound with a trench, tents, finds table, Hindu Kush peaks
//   Kabul (1000, 0)       the national museum and its square, flat-roofed mud-brick houses, the teahouse, a courtyard
//   palace (1200, 0)      the Arg's crenellated wall and round towers
//   vault (-1000, 0)      underground room with the round door, the gold chamber behind it, the table, a lamp
//   gallery (-1000, 200)  museum room: the empty case, the crown's case, pedestals, pictures
// Everything is two-tone Lambert (shade.ts) with painted canvas textures; the world ink pass outlines it.
import * as THREE from "three";
import { Batch, boxGeo, quad, tri, V, lam, prop, Kit, Ray, setSight, inTheWay } from "./build";
import { ctex, rep, rng, stoneHD, facadeHD, planksHD } from "./paint";
import { DIG, TABLE_DIG, KX, MUSEUM, PALACE, TEA, YARD, VX, VDOOR, VTABLE, GAL, GCASE_EMPTY, PLAQUE } from "./story";
import { Pen } from "./toon";
import { fxPlaque } from "./fx";
import { NOINK } from "./ink";

type G = CanvasRenderingContext2D;
const blot = (g: G, x: number, y: number, r: number, rgb: string, a: number) => {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
};
/** dusty ground: base colour, soft light/dark blotches, pebbles (tileable enough at the repeat used) */
const dirtTex = (key: string, base: string, dark: string, light: string) => ctex(key, 1024, 1024, (g, r) => {
  g.fillStyle = base; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 70; i++) for (const ox of [-1024, 0, 1024]) blot(g, r() * 1024 + ox, r() * 1024, 40 + r() * 120, r() < 0.5 ? dark : light, 0.12);
  for (let i = 0; i < 260; i++) {
    const x = r() * 1024, y = r() * 1024, s = 2 + r() * 5;
    g.fillStyle = `rgba(${dark},0.35)`; g.beginPath(); g.ellipse(x, y + 1.5, s, s * 0.7, 0, 0, 7); g.fill();
    g.fillStyle = `rgba(${light},0.5)`; g.beginPath(); g.ellipse(x, y, s * 0.8, s * 0.55, 0, 0, 7); g.fill();
  }
});
const carpetTex = () => ctex("carpet", 512, 512, (g) => {
  g.fillStyle = "#9e2b2b"; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = "#e8c77a"; g.lineWidth = 14; g.strokeRect(24, 24, 464, 464);
  g.strokeStyle = "#1f2f5a"; g.lineWidth = 10; g.strokeRect(52, 52, 408, 408);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = 128 + i * 86, y = 128 + j * 86;
    g.fillStyle = (i + j) % 2 ? "#1f2f5a" : "#e8c77a";
    g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x + 30, y); g.lineTo(x, y + 30); g.lineTo(x - 30, y); g.closePath(); g.fill();
  }
});
const artTex = (k: number) => ctex("art" + k, 256, 320, (g) => {
  const cols = [["#e9b44c", "#3f6fb5", "#9e2b2b"], ["#59a65a", "#e8c77a", "#2f5f6a"], ["#c94f7c", "#f2eee4", "#3b3f52"]][k % 3];
  g.fillStyle = "#c9a25a"; g.fillRect(0, 0, 256, 320);
  g.fillStyle = "#f4efe2"; g.fillRect(20, 20, 216, 280);
  g.fillStyle = cols[0]; g.beginPath(); g.arc(128, 130, 70, 0, 7); g.fill();
  g.fillStyle = cols[1]; g.fillRect(40, 210, 176, 60);
  g.fillStyle = cols[2]; g.beginPath(); g.moveTo(60, 210); g.lineTo(128, 120); g.lineTo(196, 210); g.fill();
});

/** a flat-roofed mud-brick / plaster house: painted facades (facadeHD), roof slab, parapet; left out if it blocks a shot */
const WALLS = ["#d9b98a", "#cfa877", "#e3c9a0", "#c99a6b", "#dcc7a6", "#bf9a72"];
const SHUT = ["#3f6fb5", "#2f6a43", "#2f5f6a", "#8c3b4a", "#5a3b2a"];
export const flatHouse = (b: Batch, x: number, z: number, yaw: number, w: number, d: number, h: number, si: number) => {
  const across = Math.abs(Math.sin(yaw)) > 0.5, hx = (across ? d : w) / 2 + 0.3, hz = (across ? w : d) / 2 + 0.3;
  if (inTheWay(x - hx, x + hx, 0, h + 0.8, z - hz, z + hz)) return;
  const wall = WALLS[si % WALLS.length], sh = SHUT[(si * 3) % SHUT.length];
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z);
  const front = lam(`kf${si % 6}_${w}_${h}`, () => ({ map: facadeHD(`kf${si % 6}_${w}_${h}`, w, h, { wall, shutter: sh, door: true }) }));
  const side = lam(`ks${si % 6}_${h}`, () => ({ map: facadeHD(`ks${si % 6}_${h}`, 8, h, { wall, shutter: sh }) }));
  const roofM = lam("roofMud", () => ({ map: rep(dirtTex("mudroof", "#b89670", "120,90,60", "235,215,180"), 2, 2) }));
  const hw = w / 2, hd = d / 2;
  b.add(quad(V(-hw, 0, hd), V(hw, 0, hd), V(hw, h, hd), V(-hw, h, hd)), front, m);
  b.add(quad(V(hw, 0, -hd), V(-hw, 0, -hd), V(-hw, h, -hd), V(hw, h, -hd)), side, m);
  b.add(quad(V(-hw, 0, -hd), V(-hw, 0, hd), V(-hw, h, hd), V(-hw, h, -hd)), side, m);
  b.add(quad(V(hw, 0, hd), V(hw, 0, -hd), V(hw, h, -hd), V(hw, h, hd)), side, m);
  b.add(quad(V(-hw, h, hd), V(hw, h, hd), V(hw, h, -hd), V(-hw, h, -hd), w / 4, d / 4), roofM, m);
  const par = lam("par" + wall, () => ({ color: wall }));
  for (const [x0, x1, z0, z1] of [[-hw, hw, hd - 0.25, hd], [-hw, hw, -hd, -hd + 0.25], [-hw, -hw + 0.25, -hd, hd], [hw - 0.25, hw, -hd, hd]])
    b.add(boxGeo(V(x0, h, z0), V(x1, h + 0.55, z1)), par, m);
  // wooden roof beams poking out of the front wall (vigas)
  const beam = lam("viga", () => ({ color: "#7a5a3c" }));
  for (let i = 0; i < Math.floor(w / 1.2); i++) { const bx = -hw + 0.6 + i * 1.2; b.add(boxGeo(V(bx - 0.08, h - 0.45, hd), V(bx + 0.08, h - 0.3, hd + 0.35)), beam, m); }
};

/** jagged mountain with a snow cap */
const mountain = (b: Batch, x: number, z: number, h: number, r: number, seed: number, snow: boolean) => {
  const rr = rng(seed), body = new THREE.ConeGeometry(r, h, 9, 3, false);
  const pos = body.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), k = (y + h / 2) / h;
    if (k > 0.02 && k < 0.98) { const s = 1 + (rr() - 0.5) * 0.35; pos.setX(i, pos.getX(i) * s); pos.setZ(i, pos.getZ(i) * s); pos.setY(i, y + (rr() - 0.5) * h * 0.06); }
  }
  body.computeVertexNormals();
  const rock = lam("rock" + (seed % 3), () => ({ color: ["#a8927a", "#9a8873", "#b39d82"][seed % 3] }));
  b.add(body, rock, new THREE.Matrix4().makeTranslation(x, h / 2 - 1, z));
  if (snow) {
    const cap = new THREE.ConeGeometry(r * 0.36, h * 0.36, 9, 1);
    b.add(cap, lam("snow", () => ({ color: "#f3f1ec" })), new THREE.Matrix4().makeTranslation(x, h - h * 0.18 - 0.6, z));
  }
};
/** set centres no mountain may stand near */
const KEEP: [number, number][] = [[0, 0], [KX, 0], [KX, 80], [KX, 150], [PALACE.x, PALACE.z]];
const range = (b: Batch, cx: number, cz: number, seed: number, near = 170) => {
  const r = rng(seed);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + r() * 0.2, d = near + r() * 230, h = 60 + r() * 130;
    if (KEEP.some(([kx, kz]) => Math.hypot(cx + Math.cos(a) * d - kx, cz + Math.sin(a) * d - kz) < 165)) continue;
    mountain(b, cx + Math.cos(a) * d, cz + Math.sin(a) * d, h, h * (1.0 + r() * 0.5), seed + i, h > 120);
  }
};

const ring = (r0: number, r1: number, y0: number, y1: number, n = 48) => {
  const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, n, 1, true);
  return g.translate(0, (y0 + y1) / 2, 0);
};

export const buildSets = (root: THREE.Object3D, kit: Kit, rays: Ray[]) => {
  setSight(rays);
  const b = new Batch(), r = rng(7);
  const sand = lam("sandHD", () => ({ map: rep(dirtTex("sand", "#dcc08f", "150,115,70", "250,235,200"), 1, 1) }));
  const earth = lam("earthHD", () => ({ map: rep(dirtTex("earth", "#c9a273", "120,85,50", "240,215,175"), 1, 1) }));
  const pit = lam("pitHD", () => ({ map: rep(dirtTex("pit", "#a27c55", "90,60,35", "200,170,130"), 1, 1) }));
  const canvasM = lam("tent", () => ({ color: "#e6dcc3", side: THREE.DoubleSide }));
  const wood = lam("woodPlain", () => ({ color: "#9a6a3e" }));
  const cloth = lam("cloth", () => ({ color: "#4f6f93" }));

  // ================= dig site =================
  const gq = (cx: number, cz: number, s: number, m: THREE.Material, y = 0, t = 8) => b.add(quad(V(cx - s, y, cz + s), V(cx + s, y, cz + s), V(cx + s, y, cz - s), V(cx - s, y, cz - s), (2 * s) / t, (2 * s) / t), m);
  gq(0, 0, 700, sand, 0, 10);
  // mound: sloped flank + plateau top with the trench cut out of it
  b.add(ring(DIG.rBase, DIG.rTop, 0, DIG.top), earth);
  const top = new THREE.Shape(); top.absarc(0, 0, DIG.rTop, 0, Math.PI * 2, false);
  const { x: tx, z: tz, floor } = DIG.trench;
  const hole = new THREE.Path(); hole.moveTo(-tx, -tz); hole.lineTo(tx, -tz); hole.lineTo(tx, tz); hole.lineTo(-tx, tz); hole.closePath();
  top.holes.push(hole);
  const tg = new THREE.ShapeGeometry(top, 48); tg.rotateX(-Math.PI / 2); tg.translate(0, DIG.top, 0);
  const uv = tg.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 6, uv.getY(i) / 6);
  b.add(tg, earth);
  // trench walls (facing in) and floor
  b.add(quad(V(-tx, floor, -tz), V(tx, floor, -tz), V(tx, DIG.top, -tz), V(-tx, DIG.top, -tz), 2, 0.5), pit);
  b.add(quad(V(tx, floor, tz), V(-tx, floor, tz), V(-tx, DIG.top, tz), V(tx, DIG.top, tz), 2, 0.5), pit);
  b.add(quad(V(-tx, floor, tz), V(-tx, floor, -tz), V(-tx, DIG.top, -tz), V(-tx, DIG.top, tz), 1.2, 0.5), pit);
  b.add(quad(V(tx, floor, -tz), V(tx, floor, tz), V(tx, DIG.top, tz), V(tx, DIG.top, -tz), 1.2, 0.5), pit);
  b.add(quad(V(-tx, floor, tz), V(tx, floor, tz), V(tx, floor, -tz), V(-tx, floor, -tz), 2, 1.2), pit);
  // spoil heaps, tents, finds table, sieve, ladder, rocks
  for (const [x, z, s] of [[-14, -6, 2.2], [13, -9, 1.8], [-9, 12, 1.5]] as const)
    b.add(new THREE.SphereGeometry(s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), pit, new THREE.Matrix4().compose(V(x, DIG.top - 0.05, z), new THREE.Quaternion(), V(1.6, 0.7, 1.2)));
  const tent = (x: number, z: number, yaw: number, w: number, d: number, h: number) => {
    const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, 0, z), hw = w / 2, hd = d / 2;
    b.add(quad(V(-hw, 0, hd), V(-hw, 0, -hd), V(0, h, -hd), V(0, h, hd)), canvasM, m);
    b.add(quad(V(hw, 0, -hd), V(hw, 0, hd), V(0, h, hd), V(0, h, -hd)), canvasM, m);
    b.add(tri(V(-hw, 0, hd), V(hw, 0, hd), V(0, h, hd)), lam("tentDoor", () => ({ color: "#5a4a3a", side: THREE.DoubleSide })), m);
    b.add(tri(V(hw, 0, -hd), V(-hw, 0, -hd), V(0, h, -hd)), canvasM, m);
  };
  tent(-26, -14, 0.4, 4.5, 6, 3.2); tent(-31, -4, 0.2, 4, 5, 2.9); tent(27, -18, -0.5, 5, 6.5, 3.4);
  { // finds table on the plateau
    const [x, y, z] = TABLE_DIG;
    b.add(boxGeo(V(x - 1.4, y + 0.76, z - 0.45), V(x + 1.4, y + 0.82, z + 0.45)), cloth);
    for (const [lx, lz] of [[-1.3, -0.38], [1.3, -0.38], [-1.3, 0.38], [1.3, 0.38]]) b.add(boxGeo(V(x + lx - 0.04, y, z + lz - 0.04), V(x + lx + 0.04, y + 0.76, z + lz + 0.04)), wood);
  }
  for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = 30 + r() * 200, s = 0.4 + r() * 1.6; b.add(new THREE.DodecahedronGeometry(s, 0), lam("rockS", () => ({ color: "#b9a68b" })), new THREE.Matrix4().compose(V(Math.cos(a) * d, s * 0.3, Math.sin(a) * d), new THREE.Quaternion().setFromEuler(new THREE.Euler(r(), r(), r())), V(1, 0.6, 1))); }
  for (let i = 0; i < 18; i++) { const a = r() * 6.28, d = 40 + r() * 160; prop(b, kit, "plant_bush", Math.cos(a) * d, 0, Math.sin(a) * d, 0.7 + r() * 0.6, r() * 6); }
  range(b, 0, 0, 101);

  // ================= Kabul: square, museum, houses, teahouse, courtyard =================
  const dust = lam("dustHD", () => ({ map: rep(dirtTex("dust", "#cdb894", "130,100,70", "245,230,200"), 1, 1) }));
  gq(KX + 100, 60, 420, dust, 0, 10);
  const paving = lam("paveHD", () => ({ map: rep(stoneHD("pave", ["#d8ccb4", "#cfc2a8", "#e0d5bf", "#c6b89c"], "#a3957e"), 1, 1) }));
  b.add(quad(V(KX - 16, 0.01, 6), V(KX + 16, 0.01, 6), V(KX + 16, 0.01, MUSEUM.z), V(KX - 16, 0.01, MUSEUM.z), 8, 6.5), paving);
  { // the museum: two storeys, cream plaster, portico with four columns, steps, flat roof with parapet
    const { x, z, w, d, h } = MUSEUM, hw = w / 2;
    const mf = lam("musF", () => ({ map: facadeHD("musF", w, h, { wall: "#ebe0c6", shutter: "#2f5f6a", door: true }) }));
    const ms = lam("musS", () => ({ map: facadeHD("musS", d, h, { wall: "#ebe0c6", shutter: "#2f5f6a" }) }));
    b.add(quad(V(x - hw, 0, z), V(x + hw, 0, z), V(x + hw, h, z), V(x - hw, h, z)), mf);
    b.add(quad(V(x + hw, 0, z - d), V(x - hw, 0, z - d), V(x - hw, h, z - d), V(x + hw, h, z - d)), mf);
    b.add(quad(V(x - hw, 0, z - d), V(x - hw, 0, z), V(x - hw, h, z), V(x - hw, h, z - d)), ms);
    b.add(quad(V(x + hw, 0, z), V(x + hw, 0, z - d), V(x + hw, h, z - d), V(x + hw, h, z)), ms);
    const trim = lam("musTrim", () => ({ color: "#f4ecda" }));
    b.add(quad(V(x - hw, h, z), V(x + hw, h, z), V(x + hw, h, z - d), V(x - hw, h, z - d), 6, 3), lam("musRoof", () => ({ color: "#b8a88c" })));
    b.add(boxGeo(V(x - hw - 0.2, h - 0.1, z - d - 0.2), V(x + hw + 0.2, h + 0.7, z + 0.25)), trim);
    b.add(boxGeo(V(x - hw - 0.1, 0, z - d - 0.1), V(x + hw + 0.1, 0.6, z + 0.12)), lam("musPlinth", () => ({ map: stoneHD("copeHD") })));
    b.add(boxGeo(V(x - hw - 0.12, 4.4, z), V(x + hw + 0.12, 4.65, z + 0.18)), trim); // string course
    // portico
    for (const cx of [-4.2, -1.4, 1.4, 4.2]) b.add(new THREE.CylinderGeometry(0.34, 0.4, 5.6, 16), trim, new THREE.Matrix4().makeTranslation(x + cx, 0.6 + 2.8, z + 3.0));
    b.add(boxGeo(V(x - 5.2, 6.2, z), V(x + 5.2, 7.0, z + 3.6)), trim);
    b.add(tri(V(x - 5.2, 7.0, z + 3.6), V(x + 5.2, 7.0, z + 3.6), V(x, 8.4, z + 3.6)), trim);
    b.add(quad(V(x - 5.2, 7.0, z + 3.6), V(x, 8.4, z + 3.6), V(x, 8.4, z), V(x - 5.2, 7.0, z)), lam("musRoof", () => ({ color: "#b8a88c" })));
    b.add(quad(V(x, 8.4, z + 3.6), V(x + 5.2, 7.0, z + 3.6), V(x + 5.2, 7.0, z), V(x, 8.4, z)), lam("musRoof", () => ({ color: "#b8a88c" })));
    for (let i = 0; i < 3; i++) b.add(boxGeo(V(x - 5.4 + i * 0.3, 0, z + 3.6 + 1.2 - i * 0.4), V(x + 5.4 - i * 0.3, 0.2 + i * 0.2, z)), lam("steps", () => ({ map: stoneHD("copeHD") })));
    b.add(boxGeo(V(x - 5.4, 0.6, z), V(x + 5.4, 0.62, z + 3.6)), lam("porchFloor", () => ({ color: "#d9cdb5" })));
    // a plaque by the door (marble post with the carved motto, text-free): its own unlit-ish painted face
    const plaqueM = new THREE.MeshBasicMaterial({ map: ctex("plaque", 640, 420, (g) => fxPlaque(new Pen(g))), color: new THREE.Color(0.86, 0.84, 0.8) });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.79), plaqueM); pl.position.set(PLAQUE[0], PLAQUE[1], PLAQUE[2] + 0.07); pl.layers.set(NOINK);
    root.add(pl);
    b.add(boxGeo(V(PLAQUE[0] - 0.68, PLAQUE[1] - 0.47, PLAQUE[2] - 0.02), V(PLAQUE[0] + 0.68, PLAQUE[1] + 0.47, PLAQUE[2] + 0.06)), lam("marble", () => ({ color: "#e9e4da" })));
  }
  // houses around the square and up the slopes behind the museum
  for (const sx of [-1, 1]) {
    let z = -12;
    while (z < 60) { const w = 6 + Math.floor(r() * 3) * 1.5, h = 4 + Math.floor(r() * 3) * 1.4; flatHouse(b, KX + sx * 22, z + w / 2, sx < 0 ? Math.PI / 2 : -Math.PI / 2, w, 7, h, Math.floor(r() * 12)); z += w + 0.4 + r() * 2; }
  }
  for (let row = 0; row < 7; row++) for (let i = 0; i < 14; i++) {
    const x = KX - 70 + i * 10.5 + r() * 3, z = MUSEUM.z - 26 - row * 13 - r() * 3, w = 7 + r() * 3, h = 4 + r() * 3;
    if (Math.abs(x - KX) < 18 && row === 0) continue;
    flatHouse(b, x, z, 0, w, 8, h + row * 0.15, Math.floor(r() * 12));
    // terraced up the hill: each row a bit higher via a terrace block
  }
  for (let i = 0; i < 30; i++) { const x = KX + (r() - 0.5) * 160, z = (r() - 0.6) * 160; if (Math.abs(x - KX) < 20 && z > -24 && z < 30) continue; prop(b, kit, r() < 0.5 ? "tree_fat" : "tree_oak", x, 0, z, 7 + r() * 4, r() * 6); }
  for (const [x, z] of [[KX - 13, 2], [KX + 13, 2], [KX - 13, -12], [KX + 13, -12]] as const) prop(b, kit, "tree-high-round", x, 0, z, 9.5, x);
  range(b, KX, -60, 202, 190);
  { // teahouse: mud wall behind, a takht platform with a carpet, an awning on poles, a samovar
    const [x, , z] = TEA;
    flatHouse(b, x, z - 5.5, 0, 9, 6, 4.2, 3);
    b.add(boxGeo(V(x - 1.6, 0, z - 1.1), V(x + 1.6, 0.48, z + 0.9)), wood);
    b.add(quad(V(x - 1.5, 0.49, z + 0.8), V(x + 1.5, 0.49, z + 0.8), V(x + 1.5, 0.49, z - 1.0), V(x - 1.5, 0.49, z - 1.0)), lam("carpet", () => ({ map: carpetTex() })));
    for (const [px, pz] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 1.6], [2.2, 1.6]]) b.add(boxGeo(V(x + px - 0.06, 0, z + pz - 0.06), V(x + px + 0.06, 2.9, z + pz + 0.06)), wood);
    b.add(quad(V(x - 2.6, 2.75, z + 1.9), V(x + 2.6, 2.75, z + 1.9), V(x + 2.6, 3.2, z - 2.5), V(x - 2.6, 3.2, z - 2.5)), lam("awning", () => ({ color: "#3f7f6a", side: THREE.DoubleSide })));
    b.add(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 14), lam("samovar", () => ({ color: "#c98f3a" })), new THREE.Matrix4().makeTranslation(x + 1.2, 0.76, z - 0.75));
    for (const [px, pz, s] of [[-4, 2, 1.1], [4.5, 1.5, 0.9]] as const) prop(b, kit, "plant_bushLarge", x + px, 0, z + pz, s);
    prop(b, kit, "tree_fat", x - 5.5, 0, z - 2.5, 8);
    for (const sx of [-1, 1]) flatHouse(b, x + sx * 13, z + 2, sx < 0 ? Math.PI / 2 : -Math.PI / 2, 9, 7, 4.5, 5 + sx);
  }
  { // courtyard: mud walls, a mulberry tree, a well-worn yard
    const [x, , z] = YARD, wallM = lam("yardWall", () => ({ map: rep(dirtTex("mudwall", "#c9a477", "120,90,60", "235,210,170"), 1, 1) }));
    b.add(quad(V(x - 10, 0.01, z + 10), V(x + 10, 0.01, z + 10), V(x + 10, 0.01, z - 10), V(x - 10, 0.01, z - 10), 3, 3), earth);
    for (const [x0, z0, x1, z1] of [[-10, -10, 10, -9.6], [-10, -10, -9.6, 10], [9.6, -10, 10, 10]] as const) b.add(boxGeo(V(x + x0, 0, z + z0), V(x + x1, 3.2, z + z1), 3), wallM);
    prop(b, kit, "tree_fat", x - 4.6, 0, z - 5.5, 7.5); prop(b, kit, "tree_oak", x + 5.5, 0, z - 6.5, 6.5);
    flatHouse(b, x, z - 15, 0, 14, 8, 5.5, 2);
  }

  // ================= palace (Arg) =================
  {
    const { x, z } = PALACE, stone = lam("argStone", () => ({ map: stoneHD("argHD", ["#cbb08a", "#c1a57e", "#d3ba95", "#b89c76"], "#8f7a5c") }));
    b.add(boxGeo(V(x - 40, 0, z - 3), V(x + 40, 10, z), 4), stone);
    for (let k = -40; k < 40; k += 1.6) b.add(boxGeo(V(x + k, 10, z - 1.2), V(x + k + 0.9, 11.1, z)), stone);
    for (const tx2 of [-22, 22]) {
      b.add(new THREE.CylinderGeometry(4.2, 4.6, 14, 24), stone, new THREE.Matrix4().makeTranslation(x + tx2, 7, z - 0.5));
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; b.add(boxGeo(V(-0.45, 0, -0.45), V(0.45, 1.1, 0.45)), stone, new THREE.Matrix4().makeTranslation(x + tx2 + Math.cos(a) * 3.9, 14, z - 0.5 + Math.sin(a) * 3.9)); }
    }
    b.add(quad(V(x - 2.2, 0, z + 0.02), V(x + 2.2, 0, z + 0.02), V(x + 2.2, 4.5, z + 0.02), V(x - 2.2, 4.5, z + 0.02)), lam("gate", () => ({ color: "#5a3e2a" })));
    b.add(boxGeo(V(x - 2.8, 4.5, z), V(x + 2.8, 5.2, z + 0.3)), stone);
    gq(x, z + 30, 70, dust, 0.005, 10);
    prop(b, kit, "tree-high-round", x - 9, 0, z + 4, 9); prop(b, kit, "tree-high-round", x + 10, 0, z + 5, 10);
    range(b, x, z - 40, 303, 190);
  }

  // ================= vault =================
  {
    const concrete = lam("vaultWall", () => ({ map: stoneHD("vaultHD", ["#8f8a86", "#87827e", "#97928d", "#7f7a76"], "#5f5a57") }));
    const floorM = lam("vaultFloor", () => ({ map: stoneHD("vfloorHD", ["#6f6a66", "#77726e", "#68635f", "#7c7773"], "#4e4a47") }));
    const H = 6.2, x0 = VX - 8, x1 = VX + 8, z0 = -6, z1 = 7;
    b.add(quad(V(x0, 0, z1), V(x1, 0, z1), V(x1, 0, z0), V(x0, 0, z0), 4, 3.2), floorM);
    b.add(quad(V(x0, 0, z1), V(x0, 0, z0), V(x0, H, z0), V(x0, H, z1), 3, 1.5), concrete);
    b.add(quad(V(x1, 0, z0), V(x1, 0, z1), V(x1, H, z1), V(x1, H, z0), 3, 1.5), concrete);
    b.add(quad(V(x1, 0, z1), V(x0, 0, z1), V(x0, H, z1), V(x1, H, z1), 3, 1.5), concrete);
    // back wall with the round doorway
    const bw = new THREE.Shape(); bw.moveTo(x0 - VX, 0); bw.lineTo(x1 - VX, 0); bw.lineTo(x1 - VX, H); bw.lineTo(x0 - VX, H); bw.closePath();
    const hl = new THREE.Path(); hl.absarc(0, VDOOR[1], 1.95, 0, Math.PI * 2, true); bw.holes.push(hl);
    const bwg = new THREE.ShapeGeometry(bw, 40); bwg.translate(VX, 0, z0);
    const buv = bwg.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < buv.count; i++) buv.setXY(i, buv.getX(i) / 4, buv.getY(i) / 4);
    b.add(bwg, concrete);
    const steel = lam("frameSteel", () => ({ color: "#9aa0a8" }));
    const frame = new THREE.TorusGeometry(2.02, 0.16, 10, 48); b.add(frame, steel, new THREE.Matrix4().makeTranslation(VX, VDOOR[1], z0 + 0.02));
    // tunnel through the wall into the chamber, chamber walls, shelves
    const tun = new THREE.CylinderGeometry(1.95, 1.95, 0.9, 40, 1, true); tun.rotateX(Math.PI / 2);
    b.add(tun, lam("tunnel", () => ({ color: "#7d7874", side: THREE.BackSide })), new THREE.Matrix4().makeTranslation(VX, VDOOR[1], z0 - 0.45));
    const c0 = z0 - 0.9, c1 = z0 - 7, cx0 = VX - 3, cx1 = VX + 3, CH = 4.6;
    const goldWall = lam("chamberWall", () => ({ color: "#8a7458" }));
    b.add(quad(V(cx0, 0, c0), V(cx1, 0, c0), V(cx1, 0, c1), V(cx0, 0, c1), 2, 2), floorM);
    b.add(quad(V(cx0, 0, c1), V(cx1, 0, c1), V(cx1, CH, c1), V(cx0, CH, c1), 2, 1), goldWall);
    b.add(quad(V(cx0, 0, c0), V(cx0, 0, c1), V(cx0, CH, c1), V(cx0, CH, c0), 2, 1), goldWall);
    b.add(quad(V(cx1, 0, c1), V(cx1, 0, c0), V(cx1, CH, c0), V(cx1, CH, c1), 2, 1), goldWall);
    b.add(quad(V(cx0, CH, c1), V(cx1, CH, c1), V(cx1, CH, c0), V(cx0, CH, c0)), goldWall);
    const shelfM = lam("shelf", () => ({ color: "#6d4a2c" }));
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) b.add(boxGeo(V(VX + sx * 1.55 - 0.55, 0.62 + k * 0.72, c1 + 0.6), V(VX + sx * 1.55 + 0.55, 0.68 + k * 0.72, c0 - 0.4)), shelfM);
    // side shelves with crates and ledgers in the room
    const crate = lam("crate", () => ({ color: "#a8743f" }));
    for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) {
      const cz = -4 + k * 2.6;
      b.add(boxGeo(V(VX + sx * 7.95 - (sx > 0 ? 0.6 : 0), 0, cz - 0.9), V(VX + sx * 7.95 + (sx < 0 ? 0.6 : 0), 2.4, cz + 0.9)), shelfM);
      for (let j = 0; j < 3; j++) b.add(boxGeo(V(VX + sx * 7.4 - 0.32, 0.05 + j * 0.62, cz - 0.4), V(VX + sx * 7.4 + 0.32, 0.55 + j * 0.62, cz + 0.4)), crate);
    }
    // the table
    const [vx, , vz] = VTABLE;
    b.add(boxGeo(V(vx - 1.1, 0.84, vz - 0.5), V(vx + 1.1, 0.9, vz + 0.5)), lam("baize", () => ({ color: "#2f5a46" })));
    for (const [lx, lz] of [[-1.0, -0.42], [1.0, -0.42], [-1.0, 0.42], [1.0, 0.42]]) b.add(boxGeo(V(vx + lx - 0.05, 0, vz + lz - 0.05), V(vx + lx + 0.05, 0.84, vz + lz + 0.05)), shelfM);
    // lamp cord
    b.add(boxGeo(V(VX - 0.015, 4.3, 0.485), V(VX + 0.015, H, 0.515)), lam("cord", () => ({ color: "#222" })));
  }

  // ================= gallery =================
  {
    const [gx, , gz] = GAL, H = 7, x0 = gx - 12, x1 = gx + 12, z0 = gz - 12, z1 = gz + 12;
    const wallM = lam("galWall", () => ({ color: "#34405f" })), dado = lam("galDado", () => ({ color: "#26304a" }));
    const fl = lam("galFloor", () => ({ map: planksHD() }));
    b.add(quad(V(x0, 0, z1), V(x1, 0, z1), V(x1, 0, z0), V(x0, 0, z0), 6, 6), fl);
    for (const [a, c] of [[V(x0, 0, z0), V(x1, 0, z0)], [V(x1, 0, z0), V(x1, 0, z1)], [V(x1, 0, z1), V(x0, 0, z1)], [V(x0, 0, z1), V(x0, 0, z0)]]) {
      // walls face inward: quads ordered so the front faces the room
      b.add(quad(a.clone(), c.clone(), c.clone().setY(H), a.clone().setY(H)), wallM);
      const n = c.clone().sub(a).cross(V(0, 1, 0)).normalize().multiplyScalar(0.03);
      b.add(quad(a.clone().add(n), c.clone().add(n), c.clone().add(n).setY(1.0), a.clone().add(n).setY(1.0)), dado);
    }
    const ped = lam("pedestal", () => ({ color: "#ece6da" })), glassEdge = lam("caseEdge", () => ({ color: "#3a3a40" }));
    const glass = new THREE.MeshBasicMaterial({ color: "#cfe3ec", transparent: true, opacity: 0.1, depthWrite: false });
    const caseAt = (cx: number, cz: number) => {
      b.add(boxGeo(V(cx - 0.42, 0, cz - 0.42), V(cx + 0.42, 1.0, cz + 0.42)), ped);
      const gm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.66, 0.8), glass); gm.position.set(cx, 1.33, cz); gm.layers.set(NOINK); gm.renderOrder = 2; root.add(gm);
      for (const [ex, ez] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) b.add(boxGeo(V(cx + ex - 0.012, 1.0, cz + ez - 0.012), V(cx + ex + 0.012, 1.66, cz + ez + 0.012)), glassEdge);
      b.add(boxGeo(V(cx - 0.41, 1.655, cz - 0.41), V(cx + 0.41, 1.675, cz + 0.41)), glassEdge);
    };
    caseAt(gx, gz); caseAt(GCASE_EMPTY[0], GCASE_EMPTY[2]);
    for (const [cx, cz] of [[gx + 6, gz - 5], [gx - 6, gz - 6], [gx + 7, gz + 4]] as const) {
      b.add(boxGeo(V(cx - 0.35, 0, cz - 0.35), V(cx + 0.35, 1.1, cz + 0.35)), ped);
      b.add(new THREE.CylinderGeometry(0.16, 0.24, 0.55, 16).translate(0, 0.27, 0), lam("vaseG", () => ({ color: "#3f7fae" })), new THREE.Matrix4().makeTranslation(cx, 1.1, cz));
    }
    for (let k = 0; k < 5; k++) {
      const x = x0 + 3 + k * 4.6, art = lam("art" + k, () => ({ map: artTex(k) }));
      b.add(quad(V(x - 0.8, 2.2, z0 + 0.03), V(x + 0.8, 2.2, z0 + 0.03), V(x + 0.8, 4.2, z0 + 0.03), V(x - 0.8, 4.2, z0 + 0.03)), art);
    }
    // the spotlight beam over the crown (soft additive cone, no ink)
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.85, H - 1.7, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.47, 0.32), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    beam.position.set(gx, 1.7 + (H - 1.7) / 2, gz); beam.layers.set(NOINK); beam.renderOrder = 3; root.add(beam);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.28, 0.16), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(gx, 0.02, gz); pool.layers.set(NOINK); root.add(pool);
  }
  b.build(root);
  setSight([]);
};
