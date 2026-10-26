import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "next-env.d.ts"] },
  {
    rules: {
      // Rechte- und Preislogik gehört auf den Server; Client-Komponenten dürfen @sa/db nicht importieren.
      "no-restricted-imports": ["error", { paths: [{ name: "@sa/db", message: "Nur in src/server/** verwenden." }] }],
    },
  },
  {
    files: ["src/server/**", "src/app/**/page.tsx", "src/app/**/layout.tsx", "src/app/**/route.ts"],
    rules: { "no-restricted-imports": "off" },
  },
];

export default config;
