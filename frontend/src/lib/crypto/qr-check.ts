/**
 * Issue-time scannability check.
 *
 * ZXing's QR locator fails on roughly 1 in 30 perfectly rendered codes, depending on the data.
 * Credential ids are random, so we simply re-roll until the pass renders (exactly as the
 * dashboard/pass page draw it: error correction "M", automatic mask) and decodes back.
 */
import QRCode from "qrcode";
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from "@zxing/library";

function decodesAt(token: string, scale: number): boolean {
  const qr = QRCode.create(token, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const margin = 4;
  const size = (n + margin * 2) * scale;
  const px = new Uint8ClampedArray(size * size).fill(255);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++) {
        const row = ((y + margin) * scale + dy) * size + (x + margin) * scale;
        px.fill(0, row, row + scale);
      }
    }
  }
  try {
    const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(px, size, size)));
    return new QRCodeReader().decode(bitmap).getText() === token;
  } catch {
    return false;
  }
}

/** True when the rendered pass decodes at several sizes (covers different screen densities). */
export function isReliablyScannable(token: string): boolean {
  return decodesAt(token, 4) && decodesAt(token, 6) && decodesAt(token, 8);
}
