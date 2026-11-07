import { prisma } from "@sa/db";
import { readFile } from "@/server/adapters/storage";
import { notFound } from "@/server/errors";
import { errorResponse } from "@/server/http";

/** Öffentliche Bilder (Produktfotos, Startseiten-Bild), lange cachebar */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const file = await prisma.fileObject.findFirst({ where: { id, purpose: { in: ["product-image", "storefront-image"] } } });
    if (!file) throw notFound();
    const obj = await readFile(file.bucket, file.key);
    return new Response(obj.stream as ReadableStream, {
      headers: { "Content-Type": file.mimeType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
