import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Generate SVG string
function getSvg(size = 512) {
  // Proportions:
  // Badge size: size x size
  // Icon size: size * 0.58
  // Corner radius: size * 0.28
  const radius = Math.round(size * 0.28);
  const iconSize = size * 0.58;
  const offset = (size - iconSize) / 2;
  const strokeWidth = 2.25;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="brandGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#148b83"/>
      <stop offset="100%" stop-color="#0b5f58"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#brandGradient)"/>
  <g transform="translate(${offset}, ${offset}) scale(${iconSize / 24})" fill="none" stroke="#ffffff" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M19.5 12.6 12 20l-7.5-7.4A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 7.5 6Z" />
    <path d="M12 10v5M9.5 12.5h5" />
  </g>
</svg>`;
}

// Simple ICO builder from PNG buffers
function createIco(pngBuffers) {
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + numImages * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(numImages, 4); // Number of images

  const entries = [];
  for (const img of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Image data size
    entry.writeUInt32LE(offset, 12); // Image data offset
    entries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map(img => img.buffer)]);
}

async function run() {
  const svgContent = getSvg(512);

  // 1. Write src/app/icon.svg and public/icon.svg (standard Next.js SVG icon)
  fs.writeFileSync(path.resolve('src/app/icon.svg'), svgContent, 'utf-8');
  fs.writeFileSync(path.resolve('public/icon.svg'), svgContent, 'utf-8');
  console.log('Created src/app/icon.svg & public/icon.svg');

  // Also create public/icons directory
  const publicIconsDir = path.resolve('public/icons');
  if (!fs.existsSync(publicIconsDir)) {
    fs.mkdirSync(publicIconsDir, { recursive: true });
  }

  // 2. Generate PNGs
  const sizes = [16, 32, 48, 180, 192, 512];
  const pngs = {};

  for (const s of sizes) {
    const buf = await sharp(Buffer.from(svgContent))
      .resize(s, s)
      .png()
      .toBuffer();
    pngs[s] = buf;
    console.log(`Generated ${s}x${s} PNG (${buf.length} bytes)`);
  }

  // 3. Apple Touch Icon (180x180) -> src/app/apple-icon.png and public/apple-touch-icon.png
  fs.writeFileSync(path.resolve('src/app/apple-icon.png'), pngs[180]);
  fs.writeFileSync(path.resolve('public/apple-touch-icon.png'), pngs[180]);
  console.log('Created apple-touch-icon.png');

  // 4. PWA Icons -> public/icons/icon-192.png and public/icons/icon-512.png
  fs.writeFileSync(path.resolve('public/icons/icon-192.png'), pngs[192]);
  fs.writeFileSync(path.resolve('public/icons/icon-512.png'), pngs[512]);
  console.log('Created public/icons/icon-192.png & icon-512.png');

  // 5. Multi-resolution ICO (16, 32, 48) -> src/app/favicon.ico and public/favicon.ico
  const icoBuffer = createIco([
    { width: 16, height: 16, buffer: pngs[16] },
    { width: 32, height: 32, buffer: pngs[32] },
    { width: 48, height: 48, buffer: pngs[48] },
  ]);

  fs.writeFileSync(path.resolve('src/app/favicon.ico'), icoBuffer);
  fs.writeFileSync(path.resolve('public/favicon.ico'), icoBuffer);
  console.log(`Created favicon.ico in src/app and public (${icoBuffer.length} bytes)`);
}

run().catch(console.error);
