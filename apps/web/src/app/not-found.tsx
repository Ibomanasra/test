import Link from "next/link";

// Fallback für Pfade ohne Sprachpräfix, die nicht vom Proxy umgeleitet werden.
export default function RootNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "system-ui", textAlign: "center", padding: "4rem" }}>
        <h1>404</h1>
        <Link href="/ar">الصفحة الرئيسية</Link> · <Link href="/en">Home</Link>
      </body>
    </html>
  );
}
