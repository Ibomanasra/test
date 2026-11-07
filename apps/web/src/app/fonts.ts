import localFont from "next/font/local";

/** IBM Plex Sans Arabic, lokal eingebunden (kein Google-Fonts-Request), OFL-Lizenz in src/fonts. */
export const plexArabic = localFont({
  variable: "--font-plex-arabic",
  display: "swap",
  src: [
    { path: "../fonts/ibm-plex-sans-arabic-arabic-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic-arabic-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic-arabic-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic-arabic-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/ibm-plex-sans-arabic-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
});

/** IBM Plex Sans Hebrew (nur hebräische Zeichen), lokal eingebunden, OFL-Lizenz. Lateinisch/Arabisch kommen aus Plex Arabic. */
export const plexHebrew = localFont({
  variable: "--font-plex-hebrew",
  display: "swap",
  src: [
    { path: "../fonts/ibm-plex-sans-hebrew-hebrew-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/ibm-plex-sans-hebrew-hebrew-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/ibm-plex-sans-hebrew-hebrew-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/ibm-plex-sans-hebrew-hebrew-700-normal.woff2", weight: "700", style: "normal" },
  ],
});
