// Effect and prop cards of the gold short, drawn in the same flat-ink style as the cast (toon.ts Pen).
// Every drawing is text-free (no captions or labels in the video): the museum motto is carved squiggles, the
// gossip is a pictogram bubble.
import { Pen, INK, GOLD, GOLD_D, GOLD_L, crownArt, drawKey, ellPts, rrect, mix, shade } from "./toon";

type P2 = [number, number];
const rad = (d: number) => (d * Math.PI) / 180;
const rnd = (seed: number, k: number) => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

/** four-point sparkle on a 200 x 200 canvas; t 0..1 pulses it */
export const fxGlint = (p: Pen, t = 0.5) => {
  const c = 100, k = 0.55 + 0.45 * Math.sin(t * Math.PI), L = 92 * k, w = 13 * k;
  const pts: P2[] = [];
  for (let i = 0; i < 8; i++) { const a = rad(i * 45 - 90), r = i % 2 ? w : L; pts.push([c + r * Math.cos(a), c + r * Math.sin(a)]); }
  p.poly(pts, "#fffbe6", 0);
  p.ell(c, c, 14 * k, 14 * k, "#ffffff", 0);
};

/** the crown alone on a 600 x 420 canvas */
export const fxCrown = (p: Pen) => crownArt(p, 300, 300, 2.1);

/** gold belt (row of medallions on a chain) on a 700 x 220 canvas */
export const fxBelt = (p: Pen) => {
  p.line([[30, 110], [670, 110]], GOLD_D, 10);
  for (let i = 0; i < 9; i++) {
    const x = 60 + i * 72;
    p.ell(x, 110, 30, 30, GOLD, 6);
    p.ell(x, 110, 15, 15, GOLD_L, 4);
    p.dot(x, 110, 5, GOLD_D);
  }
};

/** small gold ram (ibex-like, big curled horns) on a 420 x 360 canvas */
export const fxRam = (p: Pen) => {
  p.poly(rrect(70, 300, 350, 330, 8), GOLD_D, 7); // little plinth
  for (const x of [130, 165, 255, 290]) p.band([[x, 230], [x - 4, 302]], GOLD, 16, 5, "round");
  p.poly(ellPts(210, 205, 105, 52), GOLD, 8); // body
  p.poly([[285, 175], [330, 110], [365, 120], [350, 170], [310, 200]], GOLD, 8); // neck + head
  const horn: P2[] = [];
  for (let i = 0; i <= 26; i++) { const a = rad(-60 + i * 14), r = 46 - i * 1.3; horn.push([318 + r * Math.cos(a) - 10, 100 + r * Math.sin(a) - 8]); }
  p.line(horn, GOLD_L, 14);
  p.dot(345, 128, 6, INK);
  p.band([[110, 195], [80, 170]], GOLD, 12, 4, "round"); // tail
};

/** a single grave seen from above (open pit, gold specks) on a 300 x 520 canvas */
export const fxGrave = (p: Pen, seed: number) => {
  p.poly(rrect(20, 20, 280, 500, 40), "#8a6a4e", 10);
  p.poly(rrect(52, 52, 248, 468, 30), "#6e523c", 0);
  for (let i = 0; i < 22; i++) {
    const x = 70 + rnd(seed, i) * 160, y = 80 + rnd(seed, i + 40) * 360, r = 6 + rnd(seed, i + 80) * 9;
    p.ell(x, y, r, r, i % 4 ? GOLD : GOLD_L, 3);
  }
};

/** thought bubble with a pictogram: a melting pot over a fire and a money bag (on a 520 x 420 canvas) */
export const fxBubble = (p: Pen) => {
  p.ell(60, 390, 16, 14, "#ffffff", 6); p.ell(110, 345, 26, 22, "#ffffff", 7);
  const cloud: [number, number, number][] = [[160, 200, 90], [270, 140, 105], [380, 190, 95], [300, 250, 110], [190, 270, 80], [410, 270, 70]];
  for (const [x, y, r] of cloud) p.ell(x, y, r, r * 0.85, "#ffffff", 9);
  for (const [x, y, r] of cloud) p.ell(x, y, r - 5, r * 0.85 - 5, "#ffffff", 0);
  // pot on flames
  for (const [x, h] of [[170, 46], [195, 62], [220, 44]] as const) p.poly([[x - 16, 330], [x, 330 - h], [x + 16, 330]], "#ff8a2a", 5);
  p.poly([[132, 230], [258, 230], [246, 300], [144, 300]], "#5b5660", 7);
  p.ell(195, 230, 64, 14, GOLD, 6);
  p.line([[250, 236], [256, 266]], GOLD, 10);
  // arrow to a money bag
  p.line([[292, 250], [336, 250]], INK, 8); p.poly([[336, 234], [358, 250], [336, 266]], INK, 0);
  p.poly([[372, 300], [450, 300], [462, 250], [440, 214], [382, 214], [362, 250]], "#b8935a", 7);
  p.poly([[392, 214], [432, 214], [444, 190], [380, 190]], "#a37f4a", 6);
  p.ell(411, 260, 15, 15, GOLD, 4);
};

/** padlock on a 200 x 240 canvas; open = shackle lifted */
export const fxPadlock = (p: Pen, open = false) => {
  p.arc(100, open ? 74 : 98, 46, 52, 180, 360, 16, "#8d949c");
  p.arc(100, open ? 74 : 98, 46, 52, 180, 360, 4);
  p.poly(rrect(36, 96, 164, 220, 18), GOLD_D, 8);
  p.ell(100, 145, 12, 12, INK, 0); p.poly([[94, 148], [106, 148], [110, 184], [90, 184]], INK, 0);
};

/** the key alone on a 300 x 160 canvas */
export const fxKey = (p: Pen) => drawKey(p, 60, 80, 4.6, 0);

/** rocket streak (moving right) on a 600 x 160 canvas */
export const fxRocket = (p: Pen) => {
  const g = p.g, gr = g.createLinearGradient(0, 80, 440, 80);
  gr.addColorStop(0, "rgba(220,215,210,0)"); gr.addColorStop(1, "rgba(235,230,222,0.95)");
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 74); g.lineTo(440, 58); g.lineTo(440, 102); g.lineTo(0, 86); g.fill();
  p.poly([[430, 68], [470, 50], [470, 110], [430, 92]], "#ffb03a", 6);
  p.poly(rrect(460, 62, 560, 98, 14), "#6d7360", 7);
  p.poly([[556, 64], [596, 80], [556, 96]], "#c9373a", 7);
};

/** soft dark smoke puff on a 300 x 300 canvas (see-through card) */
export const fxSmoke = (p: Pen, seed: number, col = "#5a5560") => {
  for (let i = 0; i < 6; i++) {
    const a = rad(i * 60 + seed * 40), d = 50 + 25 * rnd(seed, i), r = 58 + 22 * rnd(seed, i + 9);
    p.ell(150 + d * Math.cos(a), 160 + d * 0.8 * Math.sin(a), r, r * 0.85, mix(col, "#ffffff", 0.1 * (i % 3)), 0);
  }
  p.ell(150, 160, 80, 70, col, 0);
};

/** flames on a 300 x 360 canvas; t animates */
export const fxFire = (p: Pen, t: number) => {
  const j = (k: number) => 14 * Math.sin(t * 9 + k * 2.1);
  p.poly([[40, 340], [70 + j(1), 170], [110, 240], [150 + j(2), 30], [190, 230], [230 + j(3), 140], [260, 340]], "#ff7a1f", 9);
  p.poly([[90, 340], [120 + j(4), 230], [150, 270], [170 + j(5), 160], [200, 340]], "#ffd34a", 0);
};

/** drill sparks on a 300 x 300 canvas; t animates */
export const fxSparks = (p: Pen, t: number) => {
  for (let i = 0; i < 11; i++) {
    const a = rad(-170 + 160 * rnd(i, Math.floor(t * 30))), L = 50 + 90 * rnd(i + 3, Math.floor(t * 30));
    p.stroke([[150 + 20 * Math.cos(a), 150 + 20 * Math.sin(a)], [150 + L * Math.cos(a), 150 + L * Math.sin(a)]], 7, i % 3 ? "#ffd65a" : "#fff7cf");
  }
  p.ell(150, 150, 22, 22, "#fffbe6", 0);
};

/** carved marble plaque on a 640 x 420 canvas: two blocks of carved lines (one cursive, one block), no real text */
export const fxPlaque = (p: Pen) => {
  p.poly(rrect(10, 10, 630, 410, 16), "#ece6da", 9);
  p.poly(rrect(34, 34, 606, 386, 10), null, 4);
  const carve = "#8e8578";
  // a cursive-looking line block (right to left feel) and a short line block below
  for (let r = 0; r < 3; r++) {
    const y = 90 + r * 58, pts: P2[] = [];
    for (let x = 560; x >= 80 + r * 40; x -= 6) pts.push([x, y + 9 * Math.sin(x * 0.11 + r) * (0.5 + 0.5 * Math.sin(x * 0.031))]);
    p.stroke(pts, 7, carve);
    for (let k = 0; k < 6; k++) p.dot(120 + r * 30 + rnd(r, k) * 400, y - 18, 4, carve);
  }
  for (let r = 0; r < 2; r++) for (let w = 0; w < 6; w++) {
    const x0 = 80 + w * 82 + r * 20, y = 290 + r * 42;
    p.stroke([[x0, y], [x0 + 52 + 14 * rnd(w, r), y]], 9, carve);
  }
};

/** wooden chest with five padlocks hanging on the front, on a 700 x 460 canvas; locks = how many still on (0..5) */
export const fxChest = (p: Pen, locks: number) => {
  p.poly(rrect(40, 150, 660, 440, 20), "#a8683a", 9);
  p.poly([[40, 170], [70, 50], [630, 50], [660, 170]], "#b97a46", 9);
  for (const x of [120, 580]) p.poly(rrect(x - 22, 50, x + 22, 440, 6), "#6d4a2c", 6);
  p.stroke([[40, 170], [660, 170]], 9);
  for (let i = 0; i < 5; i++) {
    const x = 190 + i * 80;
    p.ell(x, 196, 14, 14, "#8d949c", 5);
    if (i >= 5 - locks) {
      p.arc(x, 222, 22, 26, 180, 360, 9, "#8d949c"); p.arc(x, 222, 22, 26, 180, 360, 3);
      p.poly(rrect(x - 30, 222, x + 30, 282, 9), GOLD_D, 5);
      p.ell(x, 246, 6, 6, INK, 0);
    }
  }
};

/** door-crack light glow (soft additive-looking card) on a 256 x 256 canvas */
export const fxGlow = (p: Pen, col = "#ffd98a") => {
  const g = p.g, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, col); gr.addColorStop(0.35, col + "aa"); gr.addColorStop(1, col + "00");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
};

/** spotlight beam (soft see-through card, top narrow) on a 256 x 512 canvas */
export const fxBeam = (p: Pen) => {
  const g = p.g, gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "rgba(255,244,214,0.75)"); gr.addColorStop(1, "rgba(255,236,190,0.12)");
  g.fillStyle = gr; g.beginPath(); g.moveTo(108, 0); g.lineTo(148, 0); g.lineTo(250, 512); g.lineTo(6, 512); g.closePath(); g.fill();
};

/** coins + small gold bits scattered on a shelf, on a 500 x 200 canvas */
export const fxHoard = (p: Pen, seed: number) => {
  for (let i = 0; i < 26; i++) {
    const x = 40 + rnd(seed, i) * 420, y = 120 + rnd(seed, i + 30) * 60, r = 12 + rnd(seed, i + 60) * 12;
    p.ell(x, y, r, r * 0.6, i % 3 ? GOLD : GOLD_L, 4);
  }
  p.ell(250, 150, 60, 20, GOLD_D, 5);
};

/** a strand of cobweb in a display-case corner, on a 300 x 300 canvas */
export const fxWeb = (p: Pen) => {
  for (let k = 0; k < 6; k++) { const a = rad(k * 18); p.stroke([[0, 0], [300 * Math.cos(a), 300 * Math.sin(a)]], 3, "#f2f2f2"); }
  for (let r = 1; r < 5; r++) {
    const pts: P2[] = [];
    for (let k = 0; k <= 5; k++) { const a = rad(k * 18), rr = r * 60 - 8 * Math.sin(k * 1.7); pts.push([rr * Math.cos(a), rr * Math.sin(a)]); }
    p.stroke(pts, 3, "#f2f2f2");
  }
};

void GOLD_L; void shade;

// ---------------- "Our ancestors" ep. 1 ----------------
/** camel walking to the right (side view) on an 800 x 640 canvas, feet at y 620; phase 0..1 swings the legs;
 *  blanket colour per caravan animal. The rider sits at about (420, 170). */
export const fxCamel = (p: Pen, phase: number, blanket = "#b8433a") => {
  const fur = "#c9a06a", furD = "#a87f4f", s = Math.sin(phase * Math.PI * 2);
  const leg = (x: number, sw: number, col: string) => {
    const kx = x + sw * 22, fx2 = x + sw * 40;
    p.band([[x, 380], [kx, 500], [fx2, 612]], col, 30, 5, "round");
    p.ell(fx2 + 8, 614, 24, 9, col, 5);
  };
  leg(300, -s, furD); leg(560, s, furD); // far legs
  p.band([[250, 330], [175, 420], [165, 470]], fur, 18, 5, "round"); // tail
  // body + hump
  p.poly([...ellPts(420, 330, 205, 85)], fur, 9);
  p.poly([[300, 270], [350, 165], [420, 140], [490, 165], [545, 270]], fur, 9);
  // neck + head
  p.band([[590, 320], [655, 250], [665, 160]], fur, 62, 9, "round");
  p.poly([[640, 135], [705, 118], [760, 140], [762, 170], [700, 182], [645, 178]], fur, 8);
  p.ell(690, 136, 9, 9, "#ffffff", 3); p.dot(692, 137, 4.5, INK);
  p.stroke([[748, 160], [760, 160]], 4); p.ell(650, 120, 12, 18, furD, 5); // nostril, ear
  // blanket + bags
  p.poly([[330, 250], [515, 250], [535, 345], [315, 345]], blanket, 7);
  for (let i = 0; i < 6; i++) p.dot(345 + i * 33, 330, 7, "#f2d36b");
  p.poly(rrect(300, 300, 360, 390, 10), "#7a5a3a", 6); p.poly(rrect(490, 300, 550, 390, 10), "#7a5a3a", 6);
  leg(330, s, fur); leg(530, -s, fur); // near legs
};

/** a reed flute (ney) lying diagonally on a 900 x 220 canvas, glowing faintly */
export const fxNey = (p: Pen) => {
  p.band([[70, 160], [830, 60]], "#dcb766", 34, 8, "round");
  for (const k of [0.18, 0.36, 0.54, 0.72]) { const x = 70 + 760 * k, y = 160 - 100 * k; p.stroke([[x - 3, y - 17], [x + 3, y + 17]], 6, "#8a6a30"); }
  for (const k of [0.62, 0.68, 0.74, 0.8, 0.86]) { const x = 70 + 760 * k, y = 160 - 100 * k; p.ell(x, y, 6, 6, "#4a3418", 0); }
  p.ell(830, 60, 16, 20, "#b8913e", 5);
};

/** a flowing golden calligraphy-like stroke (text-free) on a 360 x 200 canvas; k picks the shape */
export const fxGlyph = (p: Pen, k: number) => {
  const r = (i: number) => rnd(k + 3, i);
  const pts: [number, number][] = [];
  const n = 5 + Math.floor(r(1) * 3);
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, x = 30 + 300 * t;
    let y = 110 + 40 * Math.sin(t * Math.PI * n * 0.5 + r(2) * 6) * (0.5 + 0.5 * Math.sin(t * Math.PI));
    if (r(3) > 0.5) y += 18 * Math.sin(t * 25);
    pts.push([x, y]);
  }
  p.line(pts, GOLD, 13, true);
  for (let i = 0; i < 3; i++) p.dot(70 + r(10 + i) * 220, 40 + r(20 + i) * 30, 9, GOLD_L);
  p.ell(30 + 300 * r(30), 165, 10, 8, GOLD, 4);
};

/** a big open book (the Masnavi) on a 700 x 420 canvas, text-free lines */
export const fxBookOpen = (p: Pen) => {
  p.poly([[40, 120], [350, 160], [660, 120], [660, 360], [350, 400], [40, 360]], "#7a2f2a", 10);
  p.poly([[60, 100], [350, 140], [640, 100], [640, 335], [350, 375], [60, 335]], "#f6efd9", 7);
  p.stroke([[350, 140], [350, 375]], 6);
  for (let i = 0; i < 7; i++) for (const sd of [-1, 1]) {
    const y = 160 + i * 27, w = i % 3 === 2 ? 140 : 230;
    p.stroke([[350 + sd * 30, y + 6], [350 + sd * (30 + w), y + 6 - (sd > 0 ? 18 : 18) * (w / 230)]], 5, i === 0 ? "#b0403a" : "#7a6248");
  }
  p.ell(350, 92, 40, 16, GOLD, 5);
};

/** a hanging oil lantern with a warm flame on a 200 x 320 canvas */
export const fxLamp = (p: Pen) => {
  p.stroke([[100, 0], [100, 60]], 6);
  p.poly([[60, 60], [140, 60], [100, 30]], "#4a3a2c", 6);
  p.poly(rrect(62, 60, 138, 230, 12), "#ffd77a", 7);
  p.ell(100, 150, 18, 34, "#fff6c8", 0);
  p.poly(rrect(55, 230, 145, 252, 6), "#4a3a2c", 6);
};

/** a glowing golden numeral / sign on a 256 x 256 canvas (Persian digits, + = and a tick) */
export const fxDigit = (p: Pen, ch: string, col = GOLD) => {
  const g = p.g;
  g.save();
  g.font = "bold 200px 'DejaVu Sans', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.lineJoin = "round"; g.lineWidth = 22; g.strokeStyle = "#3a2410"; g.strokeText(ch, 128, 140);
  g.fillStyle = col; g.fillText(ch, 128, 140);
  g.fillStyle = "rgba(255,255,255,0.55)"; g.font = "bold 200px 'DejaVu Sans', sans-serif";
  g.restore();
};
/** a step tile: round gold badge with a numeral (1, 2, 3 ...) and a green tick when done (256 x 256) */
export const fxStep = (p: Pen, ch: string, done: boolean) => {
  p.ell(128, 128, 104, 104, done ? "#5aa04a" : GOLD, 12);
  const g = p.g;
  g.save(); g.font = "bold 150px 'DejaVu Sans', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = done ? "#ffffff" : "#5a3410"; g.fillText(ch, 128, 140); g.restore();
};

// ---------------- ep. 4 (al-Biruni): chalk-gold diagrams, a satellite, kites ----------------
const DG = "#ffd25a", DGK = "#5a3410";
/** a glowing gold line drawn up to fraction k (0..1) of its length, dashed or solid, with a dark rim */
const gline = (p: Pen, a: P2, b: P2, k: number, w = 9, dash = false) => {
  if (k <= 0) return;
  const e: P2 = [a[0] + (b[0] - a[0]) * Math.min(1, k), a[1] + (b[1] - a[1]) * Math.min(1, k)];
  const g = p.g; g.save(); g.lineCap = "round"; if (dash) g.setLineDash([w * 2.2, w * 1.6]);
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(e[0], e[1]); g.strokeStyle = DGK; g.lineWidth = w + 7; g.stroke();
  g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(e[0], e[1]); g.strokeStyle = DG; g.lineWidth = w; g.stroke(); g.restore();
};
const garc = (p: Pen, c: P2, r: number, a0: number, a1: number, k: number, w = 8) => {
  if (k <= 0) return;
  const g = p.g; g.save(); g.lineCap = "round";
  const e = a0 + (a1 - a0) * Math.min(1, k);
  g.beginPath(); g.arc(c[0], c[1], r, a0, e, a1 < a0); g.strokeStyle = DGK; g.lineWidth = w + 7; g.stroke();
  g.beginPath(); g.arc(c[0], c[1], r, a0, e, a1 < a0); g.strokeStyle = DG; g.lineWidth = w; g.stroke(); g.restore();
};
const gdot = (p: Pen, c: P2, r: number) => p.ell(c[0], c[1], r, r, DG, 5);
const seg = (k: number, a: number, b: number) => Math.max(0, Math.min(1, (k - a) / (b - a)));
/** measuring the mountain (512 x 512): observer A at (40, 470), foot C at (440, 470), summit T at (440, 50) */
export const fxTri = (p: Pen, k: number) => {
  const A: P2 = [40, 470], C: P2 = [440, 470], T: P2 = [440, 50];
  gline(p, A, C, seg(k, 0, 0.3), 9, true);
  gline(p, C, T, seg(k, 0.3, 0.6), 9, true);
  gline(p, A, T, seg(k, 0.6, 0.85), 10);
  if (k > 0.85) { garc(p, A, 70, 0, -0.81, seg(k, 0.85, 1)); p.g.save(); p.g.strokeStyle = DG; p.g.lineWidth = 6; p.g.strokeRect(C[0] - 34, C[1] - 34, 34, 34); p.g.restore(); }
  gdot(p, A, 12); if (k > 0.6) gdot(p, T, 12);
};
/** the dip of the horizon (512 x 256): eye E at (30, 60), level line to the right, sight line down to H (500, 200) */
export const fxDip = (p: Pen, k: number) => {
  const E: P2 = [30, 60], L: P2 = [500, 60], H: P2 = [500, 200];
  gline(p, E, L, seg(k, 0, 0.4), 8, true);
  gline(p, E, H, seg(k, 0.4, 0.8), 9);
  garc(p, E, 150, 0, 0.29, seg(k, 0.8, 1), 7);
  gdot(p, E, 11);
};
/** the whole earth (512 x 512): the globe, a mountain on top, the tangent sight line to the horizon, two radii, the angle */
export const fxEarth = (p: Pen, k: number) => {
  const C: P2 = [256, 300], r = 170, M: P2 = [256, 72];
  const th = Math.acos(r / (C[1] - M[1])), P: P2 = [C[0] + r * Math.sin(th), C[1] - r * Math.cos(th)];
  const s = Math.min(1, seg(k, 0, 0.25) * 1.2);
  if (s > 0) {
    p.g.save(); p.g.globalAlpha = s;
    p.ell(C[0], C[1], r, r, "#3f7fae", 8);
    for (const [x, y, rx, ry, a] of [[200, 260, 60, 40, 0.4], [320, 340, 45, 60, -0.3], [230, 380, 35, 22, 0.2], [330, 220, 30, 18, 0.5]] as const) p.ell(x, y, rx, ry, "#5d9a4a", 0, 0, 360, a);
    p.ell(C[0], C[1], r, r, null, 8);
    p.poly([[226, 133], [256, M[1]], [286, 133]], "#a8927a", 6);
    p.g.restore();
  }
  gline(p, M, P, seg(k, 0.25, 0.45), 8);
  gline(p, C, M, seg(k, 0.45, 0.65), 7, true);
  gline(p, C, P, seg(k, 0.65, 0.85), 7, true);
  if (k > 0.85) garc(p, C, 46, -Math.PI / 2, -Math.PI / 2 + th, seg(k, 0.85, 1), 7);
  if (k > 0.25) gdot(p, M, 10);
  if (k > 0.45) gdot(p, P, 9);
};
/** a satellite (512 x 256): gold body, two blue panels, a dish; blink 0/1 */
export const fxSat = (p: Pen, blink: number) => {
  for (const sx of [-1, 1]) {
    const x0 = 256 + sx * 60, x1 = 256 + sx * 236;
    p.poly([[x0, 100], [x1, 100], [x1, 156], [x0, 156]], "#2f5fa8", 6);
    for (let i = 1; i < 4; i++) { const xx = x0 + ((x1 - x0) * i) / 4; p.stroke([[xx, 102], [xx, 154]], 3, "#9fc4ff"); }
    p.stroke([[x0, 128], [x1, 128]], 3, "#9fc4ff");
    p.stroke([[256 + sx * 40, 128], [x0, 128]], 6);
  }
  p.poly(rrect(206, 88, 306, 168, 10), GOLD, 7);
  p.stroke([[220, 110], [292, 110]], 3, GOLD_D); p.stroke([[220, 140], [292, 140]], 3, GOLD_D);
  p.arc(256, 70, 28, 14, 0, 180, 6); p.stroke([[256, 84], [256, 88]], 6);
  if (blink) { p.ell(256, 190, 12, 12, "#ff5a4a", 4); }
};
/** a paper kite with a bowed tail (256 x 512); col = paper colour, ph = tail wiggle phase */
export const fxKite = (p: Pen, col: string, ph: number) => {
  const tail: P2[] = []; for (let i = 0; i <= 10; i++) tail.push([128 + Math.sin(ph * 6.283 + i * 0.7) * 26 * (i / 10), 250 + i * 24]);
  p.stroke(tail, 4, "#3a2a20");
  for (let i = 2; i <= 10; i += 2) { const [x, y] = tail[i]; p.poly([[x - 14, y - 7], [x, y], [x - 14, y + 7]], "#c0353a", 3); p.poly([[x + 14, y - 7], [x, y], [x + 14, y + 7]], "#c0353a", 3); }
  p.poly([[128, 20], [222, 120], [128, 250], [34, 120]], col, 7);
  p.poly([[128, 20], [222, 120], [128, 120]], mix(col, "#ffffff", 0.35), 0);
  p.stroke([[128, 20], [128, 250]], 4); p.stroke([[34, 120], [222, 120]], 4);
  p.poly([[128, 20], [222, 120], [128, 250], [34, 120]], null, 7);
};

// ---------------- ep5: Rabia Balkhi ----------------
/** four lines of flowing gold "calligraphy" on a 1024 x 512 canvas, written right to left; k 0..1 = how much is written */
export const fxScript = (p: Pen, k: number, col = GOLD) => {
  const total = 4, per = 1 / total;
  for (let j = 0; j < total; j++) {
    const u = Math.max(0, Math.min(1, (k - j * per) / per));
    if (u <= 0) continue;
    const r = (i: number) => rnd(j + 11, i), y0 = 80 + j * 112, x1 = 980, x0 = j % 2 ? 120 : 60;
    const n = Math.max(2, Math.round(80 * u)), pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / 80), x = x1 - (x1 - x0) * t;
      const y = y0 + 22 * Math.sin(t * 31 + r(1) * 6) * Math.abs(Math.sin(t * 7 + r(2) * 3)) - 14 * Math.max(0, Math.sin(t * 13 + r(3) * 5)) ** 6 * 3;
      pts.push([x, y]);
    }
    p.line(pts, col, 9, false);
    for (let i = 0; i < 9; i++) { const t = r(20 + i); if (t < u) p.dot(x1 - (x1 - x0) * t, y0 - 34 - 10 * r(40 + i), 5.5, col); }
    for (let i = 0; i < 5; i++) { const t = r(60 + i); if (t < u) p.stroke([[x1 - (x1 - x0) * t, y0 - 10], [x1 - (x1 - x0) * t + 6, y0 - 62]], 7, col); }
  }
};
/** torn pieces of a written page, on a 512 x 256 canvas */
export const fxScraps = (p: Pen) => {
  const bits: [number, number, number, number][] = [[80, 120, 0.3, 70], [200, 80, -0.5, 60], [320, 150, 0.9, 75], [430, 95, -0.2, 55], [150, 200, 1.4, 50], [380, 210, -1.1, 48]];
  bits.forEach(([x, y, a, s], i) => {
    const pts: [number, number][] = [];
    for (let k = 0; k < 7; k++) { const t = (k / 7) * Math.PI * 2 + a, rr = s * (0.6 + 0.4 * rnd(i + 3, k)); pts.push([x + Math.cos(t) * rr, y + Math.sin(t) * rr * 0.7]); }
    p.poly(pts, "#f4efe2", 4);
    for (let l = 0; l < 3; l++) p.stroke([[x - s * 0.45, y - 14 + l * 14], [x + s * 0.4, y - 16 + l * 14]], 3, "#5a6a8a");
  });
};
/** a soft shaft of light from a star hole in the dome, on a 256 x 512 canvas */
export const fxShaft = (p: Pen) => {
  const g = p.g, gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "rgba(255,240,205,0.65)"); gr.addColorStop(1, "rgba(255,232,180,0.0)");
  g.fillStyle = gr; g.beginPath(); g.moveTo(110, 0); g.lineTo(146, 0); g.lineTo(200, 512); g.lineTo(56, 512); g.closePath(); g.fill();
};
