import { getQrDataUrl } from "./qr-cache";

export interface ExportQrOptions {
  token: string;
  label: string; // e.g. "Time In" or "Time Out"
  eventName?: string;
  attendeeName?: string;
  maskedStudentId?: string;
  section?: string;
  referenceCode?: string;
  expiresAt?: string | null;
}

export type ExportResult =
  | { success: true; method: "share" | "download" }
  | { success: false; method: "cancelled" }
  | { success: false; error: string };

/**
 * Generates a high-resolution, beautifully formatted pass card PNG with the QR code,
 * event details, and attendee reference, and exports/saves it to the device's Photos or Downloads.
 */
export async function exportQrToPhotos(options: ExportQrOptions): Promise<ExportResult> {
  if (typeof window === "undefined") {
    return { success: false, error: "Cannot export on server." };
  }

  const {
    token,
    label,
    eventName = "AttendSure Event",
    attendeeName,
    maskedStudentId,
    section,
    referenceCode,
    expiresAt,
  } = options;

  try {
    // 1. Generate high-resolution QR matrix
    const qrDataUrl = await getQrDataUrl(token, {
      width: 640,
      margin: 2,
      errorCorrectionLevel: "M",
      darkColor: "#0b2e2f",
      lightColor: "#ffffff",
    });

    // 2. Load the QR image for drawing onto the composite card canvas
    const qrImage = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load QR image."));
      img.src = qrDataUrl;
    });

    // 3. Set up canvas dimensions (Crisp 2x Retina scale: 800 x 1060)
    const canvas = document.createElement("canvas");
    const width = 800;
    const height = 1060;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D canvas context.");

    // Fill background
    ctx.fillStyle = "#f3f7f6";
    ctx.fillRect(0, 0, width, height);

    // Card background with rounded corners
    const cardX = 40;
    const cardY = 40;
    const cardW = width - 80;
    const cardH = height - 80;
    const cardRadius = 32;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(11, 46, 47, 0.12)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fill();
    ctx.restore();

    // Top Brand Accent Header
    const isTimeIn = label.toLowerCase().includes("in");
    const headerColor = isTimeIn ? "#0f766e" : "#059669"; // Teal vs Emerald

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, 110, [cardRadius, cardRadius, 0, 0]);
    ctx.fillStyle = headerColor;
    ctx.fill();

    // Brand text in header
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("ATTENDSURE · CON PASS", cardX + 32, cardY + 50);

    ctx.fillStyle = isTimeIn ? "#ccfbf1" : "#d1fae5";
    ctx.font = "600 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("College of Nursing Attendance", cardX + 32, cardY + 80);

    // Action Badge on right of header
    const badgeText = isTimeIn ? "TIME IN" : "TIME OUT";
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.beginPath();
    ctx.roundRect(cardX + cardW - 170, cardY + 36, 138, 40, 20);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(badgeText, cardX + cardW - 101, cardY + 62);
    ctx.restore();

    // Event Name
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#0b2e2f";
    ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    // Truncate event name if too long
    let truncatedEvent = eventName;
    if (ctx.measureText(truncatedEvent).width > cardW - 64) {
      while (truncatedEvent.length > 3 && ctx.measureText(truncatedEvent + "…").width > cardW - 64) {
        truncatedEvent = truncatedEvent.slice(0, -1);
      }
      truncatedEvent += "…";
    }
    ctx.fillText(truncatedEvent, width / 2, cardY + 160);

    // Participant Details
    if (attendeeName) {
      ctx.fillStyle = "#23403f";
      ctx.font = "600 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(attendeeName, width / 2, cardY + 195);
    }

    const subDetails = [
      maskedStudentId ? `ID: ${maskedStudentId}` : null,
      section ? `Sec: ${section}` : null,
      referenceCode ? `Ref: ${referenceCode}` : null,
    ].filter(Boolean).join("  ·  ");

    if (subDetails) {
      ctx.fillStyle = "#4b6362";
      ctx.font = "500 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace";
      ctx.fillText(subDetails, width / 2, cardY + 225);
    }
    ctx.restore();

    // Draw QR Image in center with rounded white frame and border
    const qrSize = 520;
    const qrX = (width - qrSize) / 2;
    const qrY = cardY + 250;

    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = isTimeIn ? "#0f766e" : "#059669";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 24);
    ctx.fill();
    ctx.stroke();

    // Draw the QR
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
    ctx.restore();

    // Footer info
    ctx.save();
    ctx.textAlign = "center";

    // Ready to scan note
    ctx.fillStyle = isTimeIn ? "#0f766e" : "#059669";
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("READY TO SCAN · TURN UP BRIGHTNESS", width / 2, qrY + qrSize + 48);

    // Expiry or instruction note
    ctx.fillStyle = "#64748b";
    ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    if (expiresAt) {
      const expDate = new Date(expiresAt);
      ctx.fillText(`Expires: ${expDate.toLocaleTimeString()} (${expDate.toLocaleDateString()})`, width / 2, qrY + qrSize + 76);
    } else {
      ctx.fillText("Official digital pass. Keep this photo ready at the entrance.", width / 2, qrY + qrSize + 76);
    }
    ctx.restore();

    // 4. Convert canvas to Blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });

    if (!blob) throw new Error("Could not create image blob from canvas.");

    const sanitizedLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const sanitizedRef = (referenceCode || "pass").replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `attendsure-${sanitizedLabel}-${sanitizedRef}.png`;

    // 5. Directly trigger download/save
    const objectUrl = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = objectUrl;
    downloadAnchor.download = fileName;
    downloadAnchor.rel = "noopener";
    downloadAnchor.style.display = "none";
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();

    setTimeout(() => {
      if (document.body.contains(downloadAnchor)) {
        document.body.removeChild(downloadAnchor);
      }
      URL.revokeObjectURL(objectUrl);
    }, 2000);

    return { success: true, method: "download" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to export QR pass.";
    return { success: false, error: errorMsg };
  }
}
