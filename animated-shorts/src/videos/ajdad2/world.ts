// The whole film as one three.js scene: sky, sun, the five sets (sets.ts), the moving vault door, the lamp, and
// the cast + effect cards (cast.ts). update(id, f, camera) poses everything for shot `id` at frame f (pure function of
// id + f): camera, camera-relative sun frozen per shot, sky/fog per light, door angle, cards.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { V, Kit, Ray, lam } from "./build";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { buildSets } from "./sets";
import { FPS, SHOTS, camAt, ShotDef, VX, VDOOR, doorAngle } from "./story";

// ---------------- assets ----------------
const KENNEY = ["plant_bush", "plant_bushLarge", "tree_fat", "tree_oak", "tree-high-round"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

/** sun disc (solid, soft rim) and the flat golden halo (lighting.md 6 / depth.md 6.4: r50 13-26 % of the frame width) */
const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});

/** every lens position of the film looking at its subject: centre, sides and top of frame (houses there are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(s.a, Math.min(s.b - 1, f))), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden" | "night", THREE.Texture[]>;
  private moon: THREE.Sprite; private moonHalo: THREE.Sprite; private stars: THREE.Points;
  private clouds: { m: THREE.Mesh; off: THREE.Vector3 }[] = [];
  private door = new THREE.Group();
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)), night: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.night.cloud)) };
    // night: moon disc + soft halo, and a dome of stars (all follow the camera, no ink, no fog)
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(2.6, 2.6, 2.4), fog: false, depthWrite: false }));
    this.moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(0.35, 0.4, 0.6), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    this.moon.renderOrder = -0.5; this.moonHalo.renderOrder = 5;
    {
      const n = 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      let seed = 11; const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let i = 0; i < n; i++) {
        const a = rr() * Math.PI * 2, y = 0.06 + 0.94 * Math.sqrt(rr()), h = Math.sqrt(1 - y * y);
        pos.set([Math.cos(a) * h * 950, y * 950, Math.sin(a) * h * 950], i * 3);
        const b = 0.55 + 0.9 * rr() ** 3; col.set([b, b, b * 1.08], i * 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
      this.stars.renderOrder = -0.8;
    }
    for (const m of [this.moon, this.moonHalo, this.stars]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.scale.set(w, w / 2, 1); m.layers.set(NOINK);
      this.clouds.push({ m, off: V(Math.cos(a) * d, 150 + (i % 4) * 38, Math.sin(a) * d) }); R.add(m);
    }
    buildSets(R, kit, sightLines());
    // ceilings of the vault and gallery: block the sky, cast no shadow (the "sun" is the room light)
    const ceil = (x0: number, x1: number, z0: number, z1: number, y: number, col: string) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), lam("ceil" + col, () => ({ color: col })));
      m.rotation.x = Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; m.castShadow = false;
      R.add(m);
    };
    ceil(VX - 8, VX + 8, -6, 7, 6.2, "#6f6a66");
    ceil(-1012, -988, 188, 212, 7, "#2a3350");
    // the round vault door (hinged on its left edge), wheel handle, five keyholes, lamp bulb
    const steel = lam("doorSteel", () => ({ color: "#a7adb5" })), dark = lam("doorDark", () => ({ color: "#3d424b" }));
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.42, 48), steel); body.rotation.x = Math.PI / 2; body.position.set(1.95, 0, 0);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.07, 8, 48), dark); rim.position.set(1.95, 0, 0.22);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 20), dark); hub.rotation.x = Math.PI / 2; hub.position.set(1.95, 0, 0.3);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 32), dark); wheel.position.set(1.95, 0, 0.42);
    this.door.add(body, rim, hub, wheel);
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.07, 0.07), dark); sp.position.set(1.95, 0, 0.42); sp.rotation.z = (k * Math.PI) / 3; this.door.add(sp); }
    for (let k = 0; k < 5; k++) {
      const a = Math.PI / 2 + (k - 2) * 0.5, kh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 16), lam("keyhole", () => ({ color: "#c9a24a" })));
      kh.rotation.x = Math.PI / 2; kh.position.set(1.95 + Math.cos(a) * 1.18, Math.sin(a) * 1.18, 0.23); this.door.add(kh);
    }
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 12), dark); hinge.position.set(0.05, 0, 0.05); this.door.add(hinge);
    this.door.position.set(VDOOR[0] - 1.95, VDOOR[1], VDOOR[2] + 0.02);
    this.door.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    R.add(this.door);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 1.8) }));
    bulb.position.set(VX, 4.2, 0.5); bulb.layers.set(NOINK); R.add(bulb);
    const shadeM = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.3, 24, 1, true), lam("lampShade", () => ({ color: "#2f5a46", side: THREE.DoubleSide })));
    shadeM.position.set(VX, 4.35, 0.5); R.add(shadeM);
  }

  /** camera-relative sun, frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.1; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    const inside = s.set === "library";
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden" && !inside) Rr = Math.max(Rr, 30);
    if (inside) Rr = 16;
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    if (!inside && s.light === "golden" && (s.sunEl ?? 7) > 15) { // late afternoon: warm, not sunset orange
      TONE.uLitCol.value.set(1.5, 1.18, 0.84); TONE.uShadeCol.value.set(0.26, 0.25, 0.38); TONE.uTerm.value = 0.15;
      CHAR.uCharTint.value.set(1.0, 0.92, 0.84);
    }
    if (inside && s.light === "golden") { // lamp light: warmer than daylight, much less orange than a sunset
      TONE.uLitCol.value.set(1.45, 1.08, 0.68); TONE.uShadeCol.value.set(0.22, 0.2, 0.3); TONE.uTerm.value = 0.15;
      CHAR.uCharTint.value.set(1.0, 0.88, 0.74);
    }
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(s.war ? "#c79482" : L.fog, this.fog.color);
    this.fog.near = s.war ? 30 : inside ? 60 : 60; this.fog.far = s.war ? 320 : inside ? 400 : s.light === "night" ? 560 : 640;
    const night = s.light === "night";
    this.moon.visible = this.moonHalo.visible = this.stars.visible = night;
    if (night) {
      const md = V(-0.32, 0.4, -1).normalize();
      this.moon.position.copy(cam.position).addScaledVector(md, 900); this.moon.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(2.2)));
      this.moonHalo.position.copy(this.moon.position); this.moonHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(16)));
      this.stars.position.copy(cam.position);
    }
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden" && !inside;
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const { m, off } = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.position.set(cam.position.x + off.x, off.y, cam.position.z + off.z);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
      m.visible = !inside;
    }
    this.door.rotation.y = -doorAngle(id, f);
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow && !inside;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      e.glow = p.glow ?? 1;
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}
