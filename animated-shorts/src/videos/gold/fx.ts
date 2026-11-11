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
