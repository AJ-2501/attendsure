"use client";
import { useEffect, useRef } from "react";

// The face is the official seal artwork itself (never redrawn), so it always matches the logo exactly.
const SEAL_SRC = "/images/conp-seal-1024.webp";
const GOLD = { rim: 0xd9be86, dust: 0xf3d58f };
const SEAL_PURPLE = 0xb48ce6;
const SEAL_GREEN = 0x7fdcab;
const R = 2; // rim radius
const RIM_T = 0.11; // rope rim thickness (tube radius)
const FACE_R = R - RIM_T * 0.35; // face tucks just under the rope rim, over the artwork's own rope border
const FACE_Z = RIM_T * 0.55;

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

/** Diagonal strands, used as a bump map so the rim reads as twisted rope like the seal's border. */
function ropeCanvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 64, 64);
  for (let i = 0; i <= 4; i++) {
    g.addColorStop(i / 4, i % 2 ? "#202020" : "#f0f0f0");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

/**
 * UA College of Nursing and Pharmacy seal as a glossy 3D medallion with a gold rope rim,
 * gently swinging amid drifting gold dust.
 * three.js is loaded on demand so it never weighs down the initial page bundle.
 */
export default function SealScene({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    Promise.all([import("three"), import("three/addons/environments/RoomEnvironment.js")]).then(async ([THREE, { RoomEnvironment }]) => {
      if (disposed) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch {
        return; // No WebGL: the hero keeps its CSS glow behind the empty frame.
      }
      let faceTex: InstanceType<typeof THREE.Texture>;
      try {
        faceTex = await new THREE.TextureLoader().loadAsync(SEAL_SRC);
      } catch {
        renderer.dispose();
        return;
      }
      if (disposed) {
        faceTex.dispose();
        renderer.dispose();
        return;
      }
      faceTex.colorSpace = THREE.SRGBColorSpace;
      faceTex.anisotropy = renderer.capabilities.getMaxAnisotropy(); // keeps lettering sharp while the seal turns

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.NeutralToneMapping; // keeps the artwork's hues true
      const canvas = renderer.domElement;
      Object.assign(canvas.style, { width: "100%", height: "100%", display: "block", opacity: "0", transition: "opacity 1.2s ease-out" });
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex; // the gold rim needs something to reflect
      scene.environmentIntensity = 0.9;

      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

      const key = new THREE.DirectionalLight(0xfff1d6, 2.0);
      key.position.set(3, 5, 6);
      const rimLight = new THREE.DirectionalLight(SEAL_PURPLE, 3); // seal-purple edge light from behind
      rimLight.position.set(-4, 2, -5);
      const fill = new THREE.DirectionalLight(SEAL_GREEN, 1.2); // seal-green kick from the lower right
      fill.position.set(4, -3, 2);
      scene.add(key, rimLight, fill);

      const geometries: InstanceType<typeof THREE.BufferGeometry>[] = [];
      const track = <G extends InstanceType<typeof THREE.BufferGeometry>>(g: G) => (geometries.push(g), g);

      const ropeTex = new THREE.CanvasTexture(ropeCanvas());
      ropeTex.wrapS = ropeTex.wrapT = THREE.RepeatWrapping;
      ropeTex.repeat.set(110, 1); // ~110 twists around the rim, like the seal's rope border
      const textures: InstanceType<typeof THREE.Texture>[] = [faceTex, ropeTex];

      // Enamel face: the artwork lit softly, plus a little self-illumination so its colours
      // never sink into shadow, and a soft clear coat.
      const faceMat = new THREE.MeshPhysicalMaterial({
        map: faceTex,
        emissive: 0xffffff,
        emissiveMap: faceTex,
        emissiveIntensity: 0.32,
        roughness: 0.42,
        metalness: 0,
        clearcoat: 0.35,
        clearcoatRoughness: 0.45, // broad, soft sheen: no hard highlight spot while it swings
        envMap: envTex,
        envMapIntensity: 0.3, // just a sheen; a full-strength room reflection would wash out the artwork
      });
      const rimMat = new THREE.MeshPhysicalMaterial({
        color: GOLD.rim,
        metalness: 1,
        roughness: 0.28,
        clearcoat: 0.5,
        clearcoatRoughness: 0.2,
        bumpMap: ropeTex,
        bumpScale: 2.2,
      });
      const materials: InstanceType<typeof THREE.Material>[] = [faceMat, rimMat];

      // float: bob + parallax · spin: gentle swing · model: the medallion
      const float = new THREE.Group();
      const spin = new THREE.Group();
      const model = new THREE.Group();
      spin.add(model);
      float.add(spin);
      scene.add(float);

      // ── Medallion: artwork on both faces, rope rim around the edge ──
      const faceGeo = track(new THREE.CircleGeometry(FACE_R, 160)); // circle UVs map the square artwork edge-to-edge
      const front = new THREE.Mesh(faceGeo, faceMat);
      front.position.z = FACE_Z;
      const back = new THREE.Mesh(faceGeo, faceMat);
      back.position.z = -FACE_Z;
      back.rotation.y = Math.PI; // reads correctly (not mirrored) from behind
      const rim = new THREE.Mesh(track(new THREE.TorusGeometry(R, RIM_T, 28, 260)), rimMat);
      // Closes the gap between the two faces behind the rope.
      const edge = new THREE.Mesh(track(new THREE.CylinderGeometry(FACE_R, FACE_R, FACE_Z * 2, 160, 1, true)), rimMat);
      edge.rotation.x = Math.PI / 2;
      model.add(front, back, rim, edge);

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
      const dustSprite = new THREE.CanvasTexture(radialTexture([[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,255,255,0.45)"], [1, "rgba(255,255,255,0)"]]));
      dustSprite.colorSpace = THREE.SRGBColorSpace;
      textures.push(dustSprite);
      const dustMat = new THREE.PointsMaterial({ size: 0.12, map: dustSprite, color: GOLD.dust, transparent: true, opacity: 0.4, depthWrite: false });
      materials.push(dustMat);
      scene.add(new THREE.Points(dustGeo, dustMat));

      // ── Fit the seal to ~64% of the frame: room for the swing, the float and the
      //    corner chips (QR ready / Checked in) without them covering the artwork ──
      const extent = (R + RIM_T) * 2 * 1.5;
      function resize() {
        const w = host!.clientWidth;
        const h = host!.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const fitH = (extent / 2) * 1.04 / tan;
        const fitW = (extent / 2) * 1.06 / (tan * camera.aspect);
        camera.position.set(0, 0, Math.max(fitH, fitW) + RIM_T);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
      }
      resize();
      const ro = new ResizeObserver(() => {
        resize();
        if (reduceMotion) renderer.render(scene, camera);
      });
      ro.observe(host);

      // ── Pointer parallax (throttled to RAF to avoid main thread event flooding) ──
      const pointer = { x: 0, y: 0 };
      let pRaf: number | null = null;
      const onPointer = (e: PointerEvent) => {
        if (pRaf !== null) return;
        pRaf = requestAnimationFrame(() => {
          pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
          pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
          pRaf = null;
        });
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      // ── Animation: continuous swing, sines and damping only, so nothing ever snaps ──
      const timer = new THREE.Timer();
      timer.connect(document);
      let intro = reduceMotion ? 1 : 0;
      let lookX = 0;
      let lookY = 0;
      spin.rotation.y = reduceMotion ? -0.25 : 0; // a flattering three-quarter view when still

      function frame() {
        timer.update();
        const delta = Math.min(timer.getDelta(), 1 / 30);
        const t = timer.getElapsed();

        intro = THREE.MathUtils.damp(intro, 1, 2.2, delta);
        lookX = THREE.MathUtils.damp(lookX, pointer.x, 1.8, delta);
        lookY = THREE.MathUtils.damp(lookY, pointer.y, 1.8, delta);

        // Slow, gentle swing (±20°): the lettering stays readable at every point of the turn.
        spin.rotation.y = Math.sin(t * 0.42) * 0.35 * intro;
        spin.rotation.x = Math.sin(t * 0.31) * 0.05 * intro;
        float.rotation.y = lookX * 0.16;
        float.rotation.x = lookY * 0.08;
        float.position.y = Math.sin(t * 0.8) * 0.07 - (1 - intro) * 0.35;
        float.scale.setScalar(0.94 + intro * 0.06);


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

      // Only animate while the hero is on screen and the tab is visible.
      let onScreen = false;
      const syncLoop = () => renderer.setAnimationLoop(onScreen && !document.hidden && !reduceMotion ? frame : null);
      const io = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
        syncLoop();
      });
      io.observe(host);
      document.addEventListener("visibilitychange", syncLoop);

      cleanup = () => {
        renderer.setAnimationLoop(null);
        io.disconnect();
        document.removeEventListener("visibilitychange", syncLoop);
        ro.disconnect();
        if (pRaf !== null) cancelAnimationFrame(pRaf);
        window.removeEventListener("pointermove", onPointer);
        timer.dispose();
        geometries.forEach((g) => g.dispose());
        materials.forEach((m) => m.dispose());
        textures.forEach((tx) => tx.dispose());
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
