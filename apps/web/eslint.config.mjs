import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "next-env.d.ts"] },
  {
    rules: {
      // Gilt für das alte pages/-Routing; hier verlinken <a> bewusst auf Downloads unter /api
      "@next/next/no-html-link-for-pages": "off",
      // "_x" = bewusst verworfen (z. B. Felder aus API-Antworten entfernen)
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      // Rechte- und Preislogik gehört auf den Server; Client-Komponenten dürfen @sa/db nicht importieren.
      "no-restricted-imports": ["error", { paths: [{ name: "@sa/db", message: "Nur in src/server/** verwenden." }] }],
    },
  },
  {
    files: ["src/server/**", "scripts/**", "src/app/**/page.tsx", "src/app/**/layout.tsx", "src/app/**/route.ts"],
    rules: { "no-restricted-imports": "off" },
  },
];

export default config;
