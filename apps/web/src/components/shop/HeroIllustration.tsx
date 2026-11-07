/** Gezeichnete Haushaltsprodukte (wenn noch keine Produktfotos vorhanden sind) – Logofarben */
export function HeroIllustration({ className }: { className?: string }) {
  const W = "#ffffff";
  const R = "#c1272d";
  return (
    <svg viewBox="0 0 420 320" className={className} aria-hidden="true" fill="none">
      {/* Regalbrett */}
      <rect x="20" y="268" width="380" height="10" rx="5" fill={W} fillOpacity=".12" />
      {/* Sprühflasche */}
      <g transform="translate(40 120)">
        <path d="M30 40h44l6 108a10 10 0 0 1-10 10H34a10 10 0 0 1-10-10z" fill={W} fillOpacity=".92" />
        <rect x="36" y="18" width="32" height="24" rx="4" fill={R} />
        <path d="M44 18V6h30l14 8-6 6H68v-2" stroke={R} strokeWidth="6" strokeLinejoin="round" />
        <rect x="34" y="78" width="38" height="40" rx="6" fill={R} fillOpacity=".18" />
        <path d="M44 92h18M44 104h12" stroke={R} strokeWidth="4" strokeLinecap="round" />
      </g>
      {/* Waschmittel-Kanister */}
      <g transform="translate(140 96)">
        <path d="M12 40c0-12 10-20 22-20h52c12 0 20 8 20 20v122a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10z" fill={W} fillOpacity=".95" />
        <path d="M70 20V8h22v12" stroke={W} strokeOpacity=".95" strokeWidth="8" />
        <rect x="64" y="0" width="34" height="12" rx="3" fill={R} />
        <path d="M30 32c0-8 6-14 14-14" stroke="#2f2f33" strokeOpacity=".25" strokeWidth="8" strokeLinecap="round" />
        <rect x="26" y="74" width="66" height="58" rx="10" fill={R} />
        <path d="M44 103c6-14 24-14 30 0" stroke={W} strokeWidth="5" strokeLinecap="round" />
        <circle cx="59" cy="92" r="5" fill={W} />
      </g>
      {/* Küchenrolle */}
      <g transform="translate(266 150)">
        <rect x="0" y="0" width="56" height="118" rx="8" fill={W} fillOpacity=".9" />
        <ellipse cx="28" cy="2" rx="28" ry="9" fill={W} />
        <ellipse cx="28" cy="2" rx="9" ry="3" fill="#2f2f33" fillOpacity=".35" />
        <path d="M0 40h56M0 80h56" stroke="#2f2f33" strokeOpacity=".12" strokeWidth="2" strokeDasharray="4 4" />
      </g>
      {/* Karton */}
      <g transform="translate(320 196)">
        <path d="M0 18 40 0l40 18v54H0z" fill="#d6b588" />
        <path d="M0 18 40 36l40-18" stroke="#b08d5f" strokeWidth="3" />
        <path d="M40 36v36" stroke="#b08d5f" strokeWidth="3" />
        <rect x="12" y="44" width="18" height="12" rx="2" fill={R} />
      </g>
      {/* drei rote Quadrate aus dem Logo */}
      <g transform="translate(372 40) rotate(12)">
        <rect x="0" y="0" width="16" height="16" rx="3" fill={R} />
        <rect x="20" y="6" width="16" height="16" rx="3" fill={R} />
        <rect x="6" y="20" width="16" height="16" rx="3" fill={R} />
      </g>
      {/* Funkeln */}
      <path d="M118 70l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill={W} fillOpacity=".7" />
      <path d="M252 60l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill={W} fillOpacity=".5" />
    </svg>
  );
}
