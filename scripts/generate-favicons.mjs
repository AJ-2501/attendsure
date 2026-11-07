/**
 * Builds every app icon from the official UA College of Nursing and Pharmacy seal.
 * Source: assets/brand/ua-conp-seal.png (transparent PNG). Run: node scripts/generate-favicons.mjs
 *
 * - Tab sizes (16–48px) use only the inner caduceus disc: the seal's ring text is
 *   illegible that small, and the simpler mark stays recognisable.
 * - apple-icon / maskable icons sit on a white background: iOS paints transparency
 *   black, and Android masks crop to a circle/squircle (80% safe zone).
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("assets/brand/ua-conp-seal.png");
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// Multi-resolution ICO with embedded PNGs (supported by all current browsers).
function createIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, buffer }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buffer.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buffer.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.buffer)]);
}

const write = (file, buf) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.log(`${file} (${buf.length} bytes)`);
};

async function run() {
  // Square, tightly-cropped master.
  const trimmed = await sharp(SRC).trim().png().toBuffer();
  const { width, height } = await sharp(trimmed).metadata();
  const side = Math.max(width, height);
  const master = await sharp(trimmed)
    .extend({ top: Math.floor((side - height) / 2), bottom: Math.ceil((side - height) / 2), left: Math.floor((side - width) / 2), right: Math.ceil((side - width) / 2), background: CLEAR })
    .png()
    .toBuffer();

  const seal = (size) => sharp(master).resize(size, size).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
  const onWhite = (size, scale) =>
    sharp(master)
      .resize(Math.round(size * scale), Math.round(size * scale))
      .extend({ top: 0, bottom: 0, left: 0, right: 0, background: CLEAR })
      .toBuffer()
      .then((inner) =>
        sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
          .composite([{ input: inner, gravity: "centre" }])
          .png({ compressionLevel: 9 })
          .toBuffer(),
      );

  // Inner disc (caduceus on gradient) for tiny sizes, masked to a circle.
  const discRatio = 0.74; // inner disc diameter / seal diameter
  const discSide = Math.round(side * discRatio);
  const disc = await sharp(master)
    .extract({ left: Math.round((side - discSide) / 2), top: Math.round((side - discSide) / 2), width: discSide, height: discSide })
    .composite([{ input: Buffer.from(`<svg width="${discSide}" height="${discSide}"><circle cx="${discSide / 2}" cy="${discSide / 2}" r="${discSide / 2}"/></svg>`), blend: "dest-in" }])
    .png()
    .toBuffer();
  const tiny = (size) => sharp(disc).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

  // UI logo (rendered through next/image, which serves resized WebP/AVIF).
  write("public/images/conp-seal.png", await seal(512));
  // Face texture for the 3D hero medallion: large enough for crisp lettering on 2x screens.
  write("public/images/conp-seal-1024.webp", await sharp(master).resize(1024, 1024).webp({ quality: 90, alphaQuality: 100 }).toBuffer());

  // Browser tab
  const ico = createIco(await Promise.all([16, 32, 48].map(async (size) => ({ size, buffer: await tiny(size) }))));
  write("src/app/favicon.ico", ico);
  write("public/favicon.ico", ico);
  write("src/app/icon.png", await seal(192));

  // Home screen / PWA
  const apple = await onWhite(180, 0.9);
  write("src/app/apple-icon.png", apple);
  write("public/apple-touch-icon.png", apple);
  write("public/icons/icon-192.png", await seal(192));
  write("public/icons/icon-512.png", await seal(512));
  write("public/icons/icon-maskable-512.png", await onWhite(512, 0.8));

  // Previews for checking the tiny sizes by eye.
  if (process.argv.includes("--preview")) write(path.resolve(process.env.PREVIEW_DIR ?? ".", "favicon-32-preview.png"), await sharp(await tiny(32)).resize(256, 256, { kernel: "nearest" }).png().toBuffer());
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
