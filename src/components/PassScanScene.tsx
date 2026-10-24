"use client";
import { useEffect, useRef } from "react";

const MINT = "#5EEAD4";
const INK = "#0B2E2F";
const GOLD = "#E3C98C";
const CARD_W = 2.2;
const CARD_H = 3.3;
const CYCLE = 5; // seconds per scan → verify loop

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** The nursing heart-and-cross mark, drawn at (x, y) with the given size. */
function drawMark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 24, s / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D("M19.5 12.6 12 20l-7.5-7.4A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 7.5 6Z"));
  ctx.stroke(new Path2D("M12 10v5M9.5 12.5h5"));
  ctx.restore();
}

// Canvas QR panel, in canvas pixels; reused to place the scan beam in card space.
const QR = { x: 80, y: 212, size: 480 };
const PX_W = 640;
const PX_H = 960;

function frontCanvas(modules: { size: number; data: Uint8Array | ArrayLike<number> }, font: string) {
  const c = document.createElement("canvas");
  c.width = PX_W;
  c.height = PX_H;
  const ctx = c.getContext("2d")!;

  // Hairline gold border just inside the card edge.
  ctx.strokeStyle = "rgba(227,201,140,0.55)";
  ctx.lineWidth = 3;
  roundRect(ctx, 18, 18, PX_W - 36, PX_H - 36, 34);
  ctx.stroke();

  drawMark(ctx, 64, 62, 56, MINT);
  ctx.font = `800 42px ${font}`;
  ctx.fillStyle = "#fff";
  ctx.fillText("Attend", 136, 104);
  ctx.fillStyle = MINT;
  ctx.fillText("Sure", 136 + ctx.measureText("Attend").width, 104);
  ctx.font = `700 20px ${font}`;
  ctx.fillStyle = "rgba(167,201,198,0.9)";
  ctx.letterSpacing = "4px";
  ctx.fillText("STUDENT PASS · NURSING", 66, 170);
  ctx.letterSpacing = "0px";

  // QR panel
  ctx.fillStyle = "#fff";
  roundRect(ctx, QR.x, QR.y, QR.size, QR.size, 30);
  ctx.fill();
  const pad = 34;
  const cell = (QR.size - pad * 2) / modules.size;
  ctx.fillStyle = INK;
  for (let r = 0; r < modules.size; r++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.data[r * modules.size + col]) {
        ctx.fillRect(QR.x + pad + col * cell, QR.y + pad + r * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
  }

  // Name placeholder lines and status row
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  roundRect(ctx, 80, 744, 300, 24, 12);
  ctx.fill();
  ctx.fillStyle = "rgba(167,201,198,0.45)";
  roundRect(ctx, 80, 786, 200, 18, 9);
  ctx.fill();
  ctx.fillStyle = GOLD;
  roundRect(ctx, 470, 742, 90, 64, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(11,46,47,0.35)";
  ctx.lineWidth = 2;
  for (const y of [762, 774, 786]) {
    ctx.beginPath();
    ctx.moveTo(482, y);
    ctx.lineTo(548, y);
    ctx.stroke();
  }
  ctx.font = `700 20px ${font}`;
  ctx.fillStyle = MINT;
  ctx.letterSpacing = "3px";
  ctx.fillText("● TIME-IN  ·  TIME-OUT", 80, 878);
  return c;
}

function backCanvas(font: string) {
  const c = document.createElement("canvas");
  c.width = PX_W;
  c.height = PX_H;
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = "rgba(227,201,140,0.55)";
  ctx.lineWidth = 3;
  roundRect(ctx, 18, 18, PX_W - 36, PX_H - 36, 34);
  ctx.stroke();
  const g = ctx.createRadialGradient(320, 420, 10, 320, 420, 260);
  g.addColorStop(0, "rgba(94,234,212,0.25)");
  g.addColorStop(1, "rgba(94,234,212,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PX_W, PX_H);
  drawMark(ctx, 190, 290, 260, MINT);
  ctx.font = `800 52px ${font}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.fillText("AttendSure", 320, 680);
  ctx.font = `600 22px ${font}`;
  ctx.fillStyle = "rgba(167,201,198,0.9)";
  ctx.fillText("College of Nursing", 320, 722);
  return c;
}

function badgeCanvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
  g.addColorStop(0, "rgba(94,234,212,0.55)");
  g.addColorStop(1, "rgba(94,234,212,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#2dd4bf";
  ctx.beginPath();
  ctx.arc(128, 128, 76, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(92, 130);
  ctx.lineTo(118, 156);
  ctx.lineTo(166, 104);
  ctx.stroke();
  return c;
}

function ringCanvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = MINT;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

function trailCanvas() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(94,234,212,0)");
  g.addColorStop(1, "rgba(94,234,212,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  return c;
}

/**
 * A 3D student QR pass being scanned and verified on a loop — the AttendSure check-in, in miniature.
 * three.js is loaded on demand so it never weighs down the sign-in page's first paint.
 */
export default function PassScanScene({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    Promise.all([
      import("three"),
      import("three/addons/environments/RoomEnvironment.js"),
      import("three/addons/geometries/RoundedBoxGeometry.js"),
      import("qrcode"),
      document.fonts.ready,
    ]).then(([THREE, { RoomEnvironment }, { RoundedBoxGeometry }, qrcode]) => {
      if (disposed) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch {
        return; // No WebGL: the panel keeps its CSS glow.
      }
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.NeutralToneMapping;
      const canvas = renderer.domElement;
      Object.assign(canvas.style, { width: "100%", height: "100%", display: "block", opacity: "0", transition: "opacity 1s ease-out" });
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      scene.environmentIntensity = 0.7;
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(3, 4, 6);
      const rim = new THREE.DirectionalLight(0x5eead4, 2.2);
      rim.position.set(-4, 1, -4);
      scene.add(key, rim);

      const disposables: { dispose(): void }[] = [envTex, pmrem];
      const keep = <T extends { dispose(): void }>(d: T) => (disposables.push(d), d);
      const tex = (c: HTMLCanvasElement) => {
        const t = keep(new THREE.CanvasTexture(c));
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
      };
      const font = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

      // ── The pass ──────────────────────────────────────────────
      const float = new THREE.Group();
      const card = new THREE.Group();
      float.add(card);
      scene.add(float);

      const body = new THREE.Mesh(
        keep(new RoundedBoxGeometry(CARD_W, CARD_H, 0.08, 6, 0.14)),
        keep(new THREE.MeshPhysicalMaterial({ color: 0x113d3e, roughness: 0.32, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.12 })),
      );
      card.add(body);

      const qrModules = qrcode.create("AttendSure · College of Nursing", { errorCorrectionLevel: "M" }).modules;
      const faceGeo = keep(new THREE.PlaneGeometry(CARD_W, CARD_H));
      const front = new THREE.Mesh(faceGeo, keep(new THREE.MeshBasicMaterial({ map: tex(frontCanvas(qrModules, font)), transparent: true, toneMapped: false })));
      front.position.z = 0.042;
      const back = new THREE.Mesh(faceGeo, keep(new THREE.MeshBasicMaterial({ map: tex(backCanvas(font)), transparent: true, toneMapped: false })));
      back.position.z = -0.042;
      back.rotation.y = Math.PI;
      card.add(front, back);

      // Canvas pixels → card units
      const toX = (px: number) => (px / PX_W - 0.5) * CARD_W;
      const toY = (py: number) => (0.5 - py / PX_H) * CARD_H;
      const qrTop = toY(QR.y + 20);
      const qrBottom = toY(QR.y + QR.size - 20);
      const qrW = (QR.size / PX_W) * CARD_W;
      const qrCx = toX(QR.x + QR.size / 2);
      const qrCy = (qrTop + qrBottom) / 2;

      // ── Scan beam with a fading trail ─────────────────────────
      const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false } as const;
      const beamMat = keep(new THREE.MeshBasicMaterial({ color: 0x8ff5e6, ...additive }));
      const beam = new THREE.Mesh(keep(new THREE.PlaneGeometry(qrW + 0.16, 0.028)), beamMat);
      const trailMat = keep(new THREE.MeshBasicMaterial({ map: tex(trailCanvas()), ...additive }));
      const trail = new THREE.Mesh(keep(new THREE.PlaneGeometry(qrW, 0.45)), trailMat);
      const scanner = new THREE.Group();
      scanner.add(trail, beam);
      trail.position.y = 0.225;
      scanner.position.set(qrCx, qrTop, 0.06);
      card.add(scanner);

      const flashMat = keep(new THREE.MeshBasicMaterial({ color: 0x5eead4, ...additive, opacity: 0 }));
      const flash = new THREE.Mesh(keep(new THREE.PlaneGeometry(qrW, qrW)), flashMat);
      flash.position.set(qrCx, qrCy, 0.05);
      card.add(flash);

      // ── Verified badge, ring pulse and spark burst ────────────
      const badgeMat = keep(new THREE.SpriteMaterial({ map: tex(badgeCanvas()), transparent: true, depthWrite: false, toneMapped: false }));
      const badge = new THREE.Sprite(badgeMat);
      badge.position.set(CARD_W / 2 - 0.05, CARD_H / 2 - 0.05, 0.2);
      badge.scale.setScalar(0.0001);
      const ringMat = keep(new THREE.SpriteMaterial({ map: tex(ringCanvas()), ...additive, opacity: 0 }));
      const ring = new THREE.Sprite(ringMat);
      ring.position.copy(badge.position);
      card.add(ring, badge);

      const SPARKS = 46;
      const sparkPos = new Float32Array(SPARKS * 3);
      const sparkVel = new Float32Array(SPARKS * 3);
      const sparkGeo = keep(new THREE.BufferGeometry());
      sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
      const dot = document.createElement("canvas");
      dot.width = dot.height = 64;
      const dctx = dot.getContext("2d")!;
      const dg = dctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      dg.addColorStop(0, "rgba(255,255,255,1)");
      dg.addColorStop(0.4, "rgba(255,255,255,0.5)");
      dg.addColorStop(1, "rgba(255,255,255,0)");
      dctx.fillStyle = dg;
      dctx.fillRect(0, 0, 64, 64);
      const sparkMat = keep(new THREE.PointsMaterial({ size: 0.09, map: tex(dot), color: 0x9ff3e4, ...additive, opacity: 0 }));
      const sparks = new THREE.Points(sparkGeo, sparkMat);
      card.add(sparks);
      function burst() {
        for (let i = 0; i < SPARKS; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 0.6 + Math.random() * 1.2;
          sparkPos.set([badge.position.x, badge.position.y, 0.15], i * 3);
          sparkVel.set([Math.cos(a) * sp, Math.sin(a) * sp, (Math.random() - 0.3) * 0.8], i * 3);
        }
      }

      // ── Floating nursing crosses ──────────────────────────────
      const cross = new THREE.Shape();
      const a = 0.09;
      const b = 0.27;
      cross.moveTo(-a, b);
      for (const [x, y] of [[a, b], [a, a], [b, a], [b, -a], [a, -a], [a, -b], [-a, -b], [-a, -a], [-b, -a], [-b, a], [-a, a]]) cross.lineTo(x, y);
      const crossGeo = keep(new THREE.ExtrudeGeometry(cross, { depth: 0.08, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3 }));
      crossGeo.center();
      const mintCross = keep(new THREE.MeshPhysicalMaterial({ color: 0x5eead4, roughness: 0.25, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 }));
      const goldCross = keep(new THREE.MeshPhysicalMaterial({ color: 0xe3c98c, roughness: 0.28, metalness: 1, clearcoat: 0.4 }));
      const floaters = [
        { p: [-2.05, 1.2, -0.6], s: 0.9, m: mintCross },
        { p: [2.1, -0.4, -0.4], s: 1.1, m: goldCross },
        { p: [-1.75, -1.35, 0.2], s: 0.7, m: goldCross },
        { p: [1.75, 1.55, -1.0], s: 0.6, m: mintCross },
        { p: [1.55, -1.75, 0.4], s: 0.5, m: mintCross },
        { p: [-2.3, 0.05, -1.2], s: 0.55, m: goldCross },
      ].map(({ p, s, m }, i) => {
        const mesh = new THREE.Mesh(crossGeo, m);
        mesh.position.set(p[0], p[1], p[2]);
        mesh.scale.setScalar(s);
        mesh.rotation.set(i * 0.7, i * 1.3, i * 0.4);
        scene.add(mesh);
        return { mesh, base: mesh.position.y, phase: i * 1.7 };
      });

      // ── Fit ───────────────────────────────────────────────────
      const VIEW_W = 5.4;
      const VIEW_H = 4.2;
      function resize() {
        const w = host!.clientWidth;
        const h = host!.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        camera.position.set(0, 0, Math.max(VIEW_H / 2 / tan, VIEW_W / 2 / (tan * camera.aspect)));
        camera.updateProjectionMatrix();
      }
      resize();
      const ro = new ResizeObserver(() => {
        resize();
        if (reduceMotion) renderer.render(scene, camera);
      });
      ro.observe(host);

      const pointer = { x: 0, y: 0 };
      const onPointer = (e: PointerEvent) => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      // ── Animation ─────────────────────────────────────────────
      const timer = new THREE.Timer();
      timer.connect(document);
      let lookX = 0;
      let lookY = 0;
      let badgeS = 0;
      let badgeV = 0;
      let lastCycle = -1;
      let verifiedAt = -10;

      function frame() {
        timer.update();
        const dt = Math.min(timer.getDelta(), 1 / 30);
        const t = timer.getElapsed();
        const cycle = Math.floor(t / CYCLE);
        const ct = t - cycle * CYCLE;

        lookX = THREE.MathUtils.damp(lookX, pointer.x, 2, dt);
        lookY = THREE.MathUtils.damp(lookY, pointer.y, 2, dt);
        card.rotation.y = Math.sin(t * 0.5) * 0.32 + lookX * 0.2;
        card.rotation.x = Math.sin(t * 0.37) * 0.07 - 0.04 + lookY * 0.1;
        card.rotation.z = Math.sin(t * 0.29) * 0.025;
        float.position.y = Math.sin(t * 0.9) * 0.06;

        // Scan sweep: 0.3 s → 2.3 s of each cycle.
        const p = THREE.MathUtils.clamp((ct - 0.3) / 2, 0, 1);
        scanner.position.y = THREE.MathUtils.lerp(qrTop, qrBottom, easeInOut(p));
        const beamAlpha = Math.min(THREE.MathUtils.smoothstep(ct, 0.2, 0.5), 1 - THREE.MathUtils.smoothstep(ct, 2.2, 2.5));
        beamMat.opacity = beamAlpha;
        trailMat.opacity = beamAlpha;

        if (ct >= 2.35 && cycle !== lastCycle) {
          lastCycle = cycle;
          verifiedAt = t;
          burst();
        }
        const since = t - verifiedAt;

        // Badge: a soft spring in, held, then eased out before the next scan.
        const target = since < CYCLE - 0.9 && ct > 2.3 && ct < 4.4 ? 0.62 : 0;
        badgeV += ((target - badgeS) * 140 - badgeV * 14) * dt;
        badgeS = Math.max(0, badgeS + badgeV * dt);
        badge.scale.setScalar(Math.max(badgeS, 0.0001));

        ring.scale.setScalar(0.5 + since * 1.6);
        ringMat.opacity = Math.max(0, 0.8 - since * 0.9);
        flashMat.opacity = Math.max(0, 0.22 - since * 0.4);

        sparkMat.opacity = Math.max(0, 1 - since / 1.3);
        if (since < 1.4) {
          for (let i = 0; i < SPARKS * 3; i++) {
            sparkPos[i] += sparkVel[i] * dt;
            sparkVel[i] *= 1 - 2.2 * dt;
          }
          sparkGeo.attributes.position.needsUpdate = true;
        }

        for (const f of floaters) {
          f.mesh.rotation.y += dt * 0.35;
          f.mesh.rotation.x += dt * 0.15;
          f.mesh.position.y = f.base + Math.sin(t * 0.7 + f.phase) * 0.12;
        }

        renderer.render(scene, camera);
      }

      if (reduceMotion) {
        // Still frame: the pass, already verified.
        badgeS = 0.62;
        badge.scale.setScalar(badgeS);
        beamMat.opacity = trailMat.opacity = 0;
        card.rotation.y = -0.18;
        renderer.render(scene, camera);
      } else {
        frame();
      }
      requestAnimationFrame(() => { canvas.style.opacity = "1"; });

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
        disposables.forEach((d) => d.dispose());
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
