import { describe, it, expect } from "vitest";
import QRCode from "qrcode";
import { BinaryBitmap, HybridBinarizer, QRCodeReader, RGBLuminanceSource } from "@zxing/library";
import { newQrCredential, hashScannedToken } from "@/lib/crypto/tokens";

/** Render a token the way the pass page does, rasterize it, and decode it with ZXing like the scanner. */
function renderAndDecode(token: string, scale = 6): string {
  const qr = QRCode.create(token, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const margin = 4;
  const size = (n + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size); // luminance: 255 = white, 0 = black
  pixels.fill(255);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          pixels[((y + margin) * scale + dy) * size + (x + margin) * scale + dx] = 0;
        }
      }
    }
  }
  const source = new RGBLuminanceSource(pixels, size, size);
  return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(source))).getText();
}

describe("QR pass → scanner round trip", () => {
  it("a generated pass decodes to the exact token and hashes to the stored credential", () => {
    // newQrCredential() re-rolls unreadable ids, so every issued pass must decode.
    for (let i = 0; i < 150; i++) {
      const { token, tokenHash } = newQrCredential();
      const decoded = renderAndDecode(token);
      expect(decoded).toBe(token);
      expect(hashScannedToken(decoded)).toBe(tokenHash);
    }
  });

  it("tolerates whitespace a scanner may add", () => {
    const { token, tokenHash } = newQrCredential();
    expect(hashScannedToken(`  ${token}\n`)).toBe(tokenHash);
  });

  it("rejects codes that aren't AttendSure passes", () => {
    expect(hashScannedToken("https://example.com")).toBeNull();
    expect(hashScannedToken("SA1.short")).toBeNull();
  });
});
