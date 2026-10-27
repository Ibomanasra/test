import QRCode from "qrcode";

/** QR-Code als SVG (Dokumentnummer + Link) */
export async function qrSvg(text: string, sizeMm = 22): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  return svg.replace("<svg ", `<svg width="${sizeMm}mm" height="${sizeMm}mm" class="qr" `);
}
