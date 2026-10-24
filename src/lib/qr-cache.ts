import type QRCodeType from "qrcode";

let qrPromise: Promise<typeof QRCodeType> | null = null;

function getQrModule(): Promise<typeof QRCodeType> {
  if (!qrPromise) {
    qrPromise = import("qrcode");
  }
  return qrPromise;
}

// In-memory cache for data URLs to avoid re-generating the same QR matrix
const dataUrlCache = new Map<string, string>();

export interface QrOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  darkColor?: string;
  lightColor?: string;
}

/**
 * High-performance QR Data URL generator with in-memory caching.
 * Pre-warms the qrcode library to eliminate import latency on button taps.
 */
export async function getQrDataUrl(token: string, options: QrOptions = {}): Promise<string> {
  const width = options.width ?? 480;
  const margin = options.margin ?? 4;
  const errorCorrectionLevel = options.errorCorrectionLevel ?? "M";
  const dark = options.darkColor ?? "#0b2e2f";
  const light = options.lightColor ?? "#ffffff";

  const cacheKey = `${token}_${width}_${margin}_${errorCorrectionLevel}_${dark}_${light}`;
  const cached = dataUrlCache.get(cacheKey);
  if (cached) return cached;

  const QRCode = await getQrModule();
  const url = await QRCode.toDataURL(token, {
    width,
    margin,
    errorCorrectionLevel,
    color: { dark, light },
  });

  dataUrlCache.set(cacheKey, url);
  return url;
}

/** Preload the QR code library on idle so button clicks have 0ms import delay. */
export function preloadQrLibrary(): void {
  if (typeof window !== "undefined") {
    void getQrModule();
  }
}
