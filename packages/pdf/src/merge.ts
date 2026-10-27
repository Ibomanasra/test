import { PDFDocument } from "pdf-lib";

/** Mehrere PDFs zu einem zusammenfügen (Sammeldruck, „Lieferschein + Rechnung“) */
export async function mergePdfs(files: Uint8Array[]): Promise<Buffer> {
  if (files.length === 1) return Buffer.from(files[0]!);
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(f);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return Buffer.from(await out.save());
}
