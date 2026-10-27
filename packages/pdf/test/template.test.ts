import { describe, expect, it } from "vitest";
import { renderDocumentHtml } from "../src/template";
import { sampleDoc } from "./sample";

describe("renderDocumentHtml", () => {
  it("escapes user content", async () => {
    const html = await renderDocumentHtml({ ...sampleDoc(), parties: [{ label: { ar: "العميل", en: "Customer" }, lines: ['<script>alert("x")</script>'] }] }, "ar");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("sets direction and language per mode", async () => {
    expect(await renderDocumentHtml(sampleDoc(), "ar")).toContain('<html lang="ar" dir="rtl">');
    expect(await renderDocumentHtml(sampleDoc(), "en")).toContain('<html lang="en" dir="ltr">');
    const bi = await renderDocumentHtml(sampleDoc(), "bi");
    expect(bi).toContain('dir="rtl"');
    expect(bi).toContain("فاتورة ضريبية");
    expect(bi).toContain("Tax invoice");
  });

  it("repeats the table header and keeps rows together", async () => {
    const html = await renderDocumentHtml(sampleDoc(), "ar");
    expect(html).toContain("thead { display: table-header-group; }");
    expect(html).toContain("break-inside: avoid");
    expect(html).toContain("size: A4 portrait");
  });
});
