"use client";
import { useEffect, useRef } from "react";

// Antique golds: warm but muted, so they sit calmly on the ink/teal hero.
const GOLD = { staff: 0xd2aa55, snake: 0xdcb562, wing: 0xe3c98c, dust: 0xf3d58f };
const FEATHER = 0xecebe6;
const SLANT = -0.23; // ~13° lean to the right
const HALO_R = 2.45;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function radialTexture(stops: [number, string][]) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

/** Overlapping round scales, used as a bump map along the serpents. */
function scaleCanvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#555";
  ctx.fillRect(0, 0, 128, 128);
  for (let row = -1; row < 6; row++) {
    for (let col = -1; col < 6; col++) {
      const x = col * 32 + (row % 2 ? 16 : 0);
      const y = row * 24;
      const g = ctx.createRadialGradient(x, y - 6, 2, x, y, 20);
      g.addColorStop(0, "#fff");
      g.addColorStop(0.75, "#999");
      g.addColorStop(1, "#333");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 19, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

/** Fine diagonal barbs, used as a bump map on the feathers (feather UVs are in world units). */
function barbCanvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#d8d8d8";
  ctx.lineWidth = 2;
  for (let i = -256; i < 512; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();
  }
  return c;
}

/**
 * Gold caduceus — winged staff with two entwined serpents — slanted and slowly spinning.
 * three.js is loaded on demand so it never weighs down the initial page bundle.
 */
export default function CaduceusScene({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    Promise.all([import("three"), import("three/addons/environments/RoomEnvironment.js")]).then(([THREE, { RoomEnvironment }]) => {
      if (disposed) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch {
        return; // No WebGL: the hero keeps its CSS glow behind the empty frame.
      }
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.NeutralToneMapping; // keeps the gold's hue instead of washing it out
      const canvas = renderer.domElement;
      Object.assign(canvas.style, { width: "100%", height: "100%", display: "block", opacity: "0", transition: "opacity 1.2s ease-out" });
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex; // metals need something to reflect
      scene.environmentIntensity = 0.9;

      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

      const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
      key.position.set(3, 5, 6);
      const rim = new THREE.DirectionalLight(0x5eead4, 2.8); // teal edge light ties the gold to the page
      rim.position.set(-4, 2, -5);
      const glint = new THREE.PointLight(0xffe2a8, 7, 4.5, 2);
      scene.add(key, rim, glint);

      const geometries: InstanceType<typeof THREE.BufferGeometry>[] = [];
      const track = <G extends InstanceType<typeof THREE.BufferGeometry>>(g: G) => (geometries.push(g), g);

      const textures: InstanceType<typeof THREE.Texture>[] = [];
      const canvasTex = (c: HTMLCanvasElement) => {
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        textures.push(t);
        return t;
      };

      const scaleTex = new THREE.CanvasTexture(scaleCanvas());
      scaleTex.wrapS = scaleTex.wrapT = THREE.RepeatWrapping;
      scaleTex.repeat.set(130, 3);
      const barbTex = new THREE.CanvasTexture(barbCanvas());
      barbTex.wrapS = barbTex.wrapT = THREE.RepeatWrapping;
      textures.push(scaleTex, barbTex);

      const mat = (color: number, roughness: number, metalness = 1) =>
        new THREE.MeshPhysicalMaterial({ color, roughness, metalness, clearcoat: 0.5, clearcoatRoughness: 0.2 });
      const staffMat = mat(GOLD.staff, 0.24);
      const snakeMat = mat(GOLD.snake, 0.22);
      snakeMat.bumpMap = scaleTex;
      snakeMat.bumpScale = 0.8; // a hint of scales; the reference reads as polished gold
      const trimMat = mat(GOLD.snake, 0.22);
      // Pearl-white feathers with fine barbs, as in the classic gold-and-white caduceus.
      const featherMat = new THREE.MeshPhysicalMaterial({
        color: FEATHER,
        roughness: 0.5,
        metalness: 0.05,
        clearcoat: 0.3,
        sheen: 0.6,
        sheenColor: new THREE.Color(0xffffff),
        bumpMap: barbTex,
        bumpScale: 1.2,
        vertexColors: true, // per-feather shading, see featherGeo
      });
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1408, roughness: 0.15, metalness: 0.2 });
      const haloMat = new THREE.MeshStandardMaterial({ color: GOLD.wing, metalness: 1, roughness: 0.35, transparent: true, opacity: 0.4 });
      // Each feather row a shade apart so the layers read like the reference: pale coverts over silvery primaries.
      const rowMats = [0xd9dad5, 0xe4e4df, FEATHER].map((color) => {
        const m = featherMat.clone();
        m.color.setHex(color);
        return m;
      });
      const materials: InstanceType<typeof THREE.Material>[] = [staffMat, snakeMat, trimMat, featherMat, ...rowMats, eyeMat, haloMat];

      // float: bob + parallax · tilt: fixed slant · spin: turns about the staff · model: the caduceus
      const float = new THREE.Group();
      const tilt = new THREE.Group();
      tilt.rotation.z = SLANT;
      const spin = new THREE.Group();
      const model = new THREE.Group();
      spin.add(model);
      tilt.add(spin);
      float.add(tilt);
      scene.add(float);

      // Tube along a curve whose radius is scaled by profile(u) — used for the serpents and the wing trim.
      function taperedTube(curve: InstanceType<typeof THREE.CatmullRomCurve3>, radius: number, profile: (u: number) => number, segments = 260) {
        const RADIAL = 16;
        const geo = track(new THREE.TubeGeometry(curve, segments, radius, RADIAL, false));
        const pos = geo.attributes.position;
        const p = new THREE.Vector3();
        const v = new THREE.Vector3();
        for (let i = 0; i <= segments; i++) {
          const u = i / segments;
          curve.getPointAt(u, p);
          const s = profile(u);
          for (let k = 0; k <= RADIAL; k++) {
            const idx = i * (RADIAL + 1) + k;
            v.fromBufferAttribute(pos, idx).sub(p).multiplyScalar(s).add(p);
            pos.setXYZ(idx, v.x, v.y, v.z);
          }
        }
        return geo;
      }

      // ── Staff: slender shaft, stacked collar rings, orb ───────
      const shaft = new THREE.Mesh(track(new THREE.CylinderGeometry(0.075, 0.07, 6.85, 40)), staffMat);
      shaft.position.y = -0.4;
      const foot = new THREE.Mesh(track(new THREE.SphereGeometry(0.07, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), staffMat);
      foot.position.y = -3.825;
      model.add(shaft, foot);
      const collar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 40)), staffMat);
      collar.position.y = 2.86;
      model.add(collar);
      const ringGeo = track(new THREE.TorusGeometry(0.105, 0.032, 14, 48));
      for (const y of [2.68, 2.8, 2.92, 3.04]) {
        const ring = new THREE.Mesh(ringGeo, staffMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        model.add(ring);
      }
      const orb = new THREE.Mesh(track(new THREE.SphereGeometry(0.26, 48, 32)), staffMat);
      orb.position.y = 3.33;
      model.add(orb);

      // ── Serpents: tight coils widening upward, heads facing each other under the wings ──
      const TURNS = 3.25; // θ ends at 6.5π, so each body finishes on its own side, ready to rise into the neck
      for (const side of [1, -1]) {
        const phase = side === 1 ? 0 : Math.PI;
        const pts: InstanceType<typeof THREE.Vector3>[] = [];
        for (let i = 0; i <= 90; i++) {
          const s = i / 90;
          const theta = TURNS * Math.PI * 2 * Math.pow(s, 0.82) + phase; // coils tighter near the foot
          const r = 0.3 + 0.45 * Math.pow(s, 1.2); // widest at the top, but not flared
          pts.push(new THREE.Vector3(Math.sin(theta) * r, -3.47 + s * 4.87, Math.cos(theta) * r * 0.8)); // coils reach up toward the wings
        }
        // A short hooked neck curls up and over, so the heads meet close to the staff and fill the middle.
        pts.push(
          new THREE.Vector3(side * 0.84, 1.62, 0.06),
          new THREE.Vector3(side * 0.74, 1.82, 0.13),
          new THREE.Vector3(side * 0.54, 1.9, 0.18),
          new THREE.Vector3(side * 0.36, 1.84, 0.2),
        );
        const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
        const body = taperedTube(curve, 0.1, (u) => 0.12 + 0.88 * smoothstep(0, 0.14, u) - 0.18 * smoothstep(0.85, 0.97, u));
        model.add(new THREE.Mesh(body, snakeMat));

        const end = curve.getPointAt(1);
        const dir = curve.getTangentAt(1);
        const headGroup = new THREE.Group();
        headGroup.position.copy(end).addScaledVector(dir, 0.09);
        headGroup.lookAt(headGroup.position.clone().add(dir));
        const head = new THREE.Mesh(track(new THREE.SphereGeometry(1, 32, 24)), snakeMat);
        head.scale.set(0.14, 0.1, 0.24);
        const snout = new THREE.Mesh(track(new THREE.SphereGeometry(1, 24, 16)), snakeMat);
        snout.scale.set(0.09, 0.07, 0.12);
        snout.position.z = 0.16;
        headGroup.add(head, snout);
        const eyeGeo = track(new THREE.SphereGeometry(0.02, 12, 10));
        for (const ex of [-1, 1]) {
          const eye = new THREE.Mesh(eyeGeo, eyeMat);
          eye.position.set(ex * 0.09, 0.055, 0.08);
          headGroup.add(eye);
        }
        model.add(headGroup);
      }

      // ── Wings: long white feathered wings with a gold leading edge ──
      // Leading edge of the right wing: rises off the collar, then slopes gently down to the tip.
      // Gold leading edge of the right wing: a small scroll curl at the collar, a rise, a dip,
      // then an upswept sharp tip — the swirl of the reference.
      const edge = new THREE.CatmullRomCurve3(
        [
          [0.3, 2.66], [0.21, 2.6], [0.13, 2.68], [0.15, 2.84], [0.3, 3.0], [0.55, 3.08],
          [0.9, 3.02], [1.3, 2.9], [1.7, 2.88], [2.05, 2.98], [2.32, 3.13], [2.5, 3.3],
        ].map(([x, y]) => new THREE.Vector3(x, y, -0.04 - x * 0.1)),
        false,
        "centripetal",
      );
      /** Narrow feather with a long, sharp point. */
      function featherGeo(length: number, width: number) {
        const shape = new THREE.Shape();
        shape.moveTo(0, -width * 0.3);
        shape.bezierCurveTo(length * 0.18, width * 0.55, length * 0.6, width * 0.45, length, width * 0.12);
        shape.bezierCurveTo(length * 0.7, -width * 0.2, length * 0.3, -width * 0.55, 0, -width * 0.3);
        const g = new THREE.ExtrudeGeometry(shape, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 16 });
        g.translate(0, 0, -0.009);
        // Grey along each feather's lower edge and base, white toward the top and tip,
        // so overlapping feathers read as separate layers like the reference.
        const pos = g.attributes.position;
        const colors = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
          const across = THREE.MathUtils.clamp((pos.getY(i) + width * 0.55) / (width * 1.1), 0, 1);
          const along = THREE.MathUtils.clamp(pos.getX(i) / length, 0, 1);
          const shade = 0.64 + 0.3 * smoothstep(0.05, 0.75, across) + 0.06 * along;
          colors.set([shade, shade, shade * 0.985], i * 3);
        }
        g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        return track(g);
      }
      // Feathers hang off the edge and follow its curve: steep by the staff, sweeping up with the tip.
      const rows = [
        { n: 18, len: [1.25, 0.66], width: 0.21, drop: 0.32, hang: [56, 20], z: 0, from: 0.2 }, // primaries: reach lowest
        { n: 20, len: [0.9, 0.5], width: 0.18, drop: 0.18, hang: [50, 16], z: 0.025, from: 0.15 },
        { n: 22, len: [0.5, 0.32], width: 0.15, drop: 0.05, hang: [42, 11], z: 0.05, from: 0.1 }, // coverts
      ];
      const flaps: InstanceType<typeof THREE.Group>[] = [];
      const base = new THREE.Vector3();
      const tangent = new THREE.Vector3();
      for (const side of [1, -1]) {
        const mirror = new THREE.Group();
        mirror.scale.x = side; // the renderer flips face winding for the mirrored wing
        // Hinge at the wing root so the flap pivots where the wing meets the collar.
        const hinge = new THREE.Group();
        hinge.position.set(0.18, 2.8, -0.05);
        // Undo the staff's slant at the wing root so both wing tips sit level.
        const level = -SLANT * side; // the left wing is mirrored, so its correction flips sign
        hinge.userData.level = level;
        hinge.rotation.z = level;
        const wing = new THREE.Group();
        wing.position.set(-0.18, -2.8, 0.05);
        hinge.add(wing);
        rows.forEach((row, k) => {
          for (let i = 0; i < row.n; i++) {
            const t = i / (row.n - 1);
            const u = row.from + t * (0.96 - row.from); // starts under the scroll curl, so no gap by the collar
            edge.getPointAt(u, base);
            edge.getTangentAt(u, tangent);
            // Along the curl the edge turns back on itself, so root feathers use a fixed out-and-down
            // angle and hand over to following the edge once it straightens out.
            const follow = Math.atan2(tangent.y, tangent.x) - THREE.MathUtils.degToRad(row.hang[0] + (row.hang[1] - row.hang[0]) * t);
            const blend = smoothstep(0.24, 0.4, u);
            const angle = THREE.MathUtils.lerp(THREE.MathUtils.degToRad(-58 + k * 6), follow, blend); // root feathers drop down to fill the wing
            const len = (row.len[0] + (row.len[1] - row.len[0]) * t) * (0.85 + 0.15 * blend);
            const f = new THREE.Mesh(featherGeo(len, row.width), rowMats[k]);
            f.position.set(base.x, base.y - row.drop * (1 - t * 0.5), base.z + row.z + i * 0.0015);
            f.rotation.set(0.06 + (i % 2) * 0.05, -0.1, angle); // alternate tilt catches the light per feather
            wing.add(f);
          }
        });
        const trimProfile = (u: number) => (0.45 + 0.55 * smoothstep(0, 0.12, u)) * (1 - 0.88 * smoothstep(0.6, 1, u));
        wing.add(new THREE.Mesh(taperedTube(edge, 0.04, trimProfile, 200), trimMat));
        mirror.add(hinge);
        model.add(mirror);
        flaps.push(hinge);
      }

      // Centre the model on its staff so it turns in place.
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      model.position.y = -box.getCenter(new THREE.Vector3()).y;

      // ── Halo ring with drifting beads, behind the caduceus ────
      const halo = new THREE.Group();
      halo.position.z = -1.2;
      halo.add(new THREE.Mesh(track(new THREE.TorusGeometry(HALO_R, 0.012, 8, 160)), haloMat));
      const BEADS = 40;
      const beads = new THREE.InstancedMesh(track(new THREE.SphereGeometry(0.028, 12, 10)), haloMat, BEADS);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < BEADS; i++) {
        const a = (i / BEADS) * Math.PI * 2;
        m4.makeTranslation(Math.cos(a) * (HALO_R + 0.16), Math.sin(a) * (HALO_R + 0.16), 0);
        beads.setMatrixAt(i, m4);
      }
      halo.add(beads);
      float.add(halo);

      // ── Gold dust ─────────────────────────────────────────────
      const DUST = 70;
      const dustPos = new Float32Array(DUST * 3);
      const dustSpeed = new Float32Array(DUST);
      for (let i = 0; i < DUST; i++) {
        dustPos[i * 3] = (Math.random() - 0.5) * 7;
        dustPos[i * 3 + 1] = (Math.random() - 0.5) * 9;
        dustPos[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
        dustSpeed[i] = 0.06 + Math.random() * 0.14;
      }
      const dustGeo = track(new THREE.BufferGeometry());
      dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
      const dustMat = new THREE.PointsMaterial({
        size: 0.12,
        map: canvasTex(radialTexture([[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,255,255,0.45)"], [1, "rgba(255,255,255,0)"]])),
        color: GOLD.dust,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      });
      materials.push(dustMat);
      scene.add(new THREE.Points(dustGeo, dustMat));

      // ── Fit the slanted, spinning caduceus (and halo) to its frame ──
      const span = Math.max(size.x, size.z); // widest it gets during a turn
      const projH = Math.max(size.y * Math.cos(SLANT) + span * Math.abs(Math.sin(SLANT)), (HALO_R + 0.2) * 2);
      const projW = Math.max(size.y * Math.abs(Math.sin(SLANT)) + span * Math.cos(SLANT), (HALO_R + 0.2) * 2);
      function resize() {
        const w = host!.clientWidth;
        const h = host!.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const fitH = (projH / 2) * 1.06 / tan;
        const fitW = (projW / 2) * 1.08 / (tan * camera.aspect);
        camera.position.set(0, 0, Math.max(fitH, fitW) + span / 2);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      }
      resize();
      const ro = new ResizeObserver(() => {
        resize();
        if (reduceMotion) renderer.render(scene, camera);
      });
      ro.observe(host);

      // ── Pointer parallax ──────────────────────────────────────
      const pointer = { x: 0, y: 0 };
      const onPointer = (e: PointerEvent) => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      // ── Animation: continuous spin, sines and damping only, so nothing ever snaps ──
      const timer = new THREE.Timer();
      timer.connect(document);
      let intro = reduceMotion ? 1 : 0;
      let lookX = 0;
      let lookY = 0;
      spin.rotation.y = reduceMotion ? -0.3 : 0; // a flattering three-quarter view when still

      function frame() {
        timer.update();
        const delta = Math.min(timer.getDelta(), 1 / 30);
        const t = timer.getElapsed();

        intro = THREE.MathUtils.damp(intro, 1, 2.2, delta);
        lookX = THREE.MathUtils.damp(lookX, pointer.x, 1.8, delta);
        lookY = THREE.MathUtils.damp(lookY, pointer.y, 1.8, delta);

        // Slow, gentle turn (±20°): smooth, and both wings stay nearly the same size on screen.
        spin.rotation.y = Math.sin(t * 0.42) * 0.35 * intro;
        for (const wing of flaps) wing.rotation.z = wing.userData.level + Math.sin(t * 1.15) * 0.035;
        float.rotation.y = lookX * 0.16;
        float.rotation.x = lookY * 0.08;
        float.position.y = Math.sin(t * 0.8) * 0.07 - (1 - intro) * 0.35;
        float.scale.setScalar(0.94 + intro * 0.06);

        halo.rotation.z = -t * 0.05;
        // A warm glint glides up and down the staff.
        glint.position.set(0.9, Math.sin(t * 0.45) * size.y * 0.4, 1.6);

        for (let i = 0; i < DUST; i++) {
          const yi = i * 3 + 1;
          dustPos[yi] += dustSpeed[i] * delta;
          if (dustPos[yi] > 4.5) dustPos[yi] = -4.5;
        }
        dustGeo.attributes.position.needsUpdate = true;

        renderer.render(scene, camera);
      }

      frame();
      requestAnimationFrame(() => { canvas.style.opacity = "1"; });

      // Only animate while the hero is on screen.
      const io = new IntersectionObserver(([entry]) => {
        renderer.setAnimationLoop(entry.isIntersecting && !reduceMotion ? frame : null);
      });
      io.observe(host);

      cleanup = () => {
        renderer.setAnimationLoop(null);
        io.disconnect();
        ro.disconnect();
        window.removeEventListener("pointermove", onPointer);
        timer.dispose();
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        textures.forEach((tx) => tx.dispose());
        beads.dispose();
        envTex.dispose();
        pmrem.dispose();
        renderer.dispose();
        canvas.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={hostRef} aria-hidden="true" className={className} />;
}
