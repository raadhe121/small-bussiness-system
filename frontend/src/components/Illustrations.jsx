export function ShopIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ill-awning" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="80" r="72" fill="#ffffff" opacity="0.12" />
      <rect x="45" y="70" width="110" height="62" rx="6" fill="#ffffff" />
      <rect x="45" y="70" width="110" height="62" rx="6" stroke="#c7d2fe" strokeWidth="2" />
      <path d="M38 44h124l8 20c0 8-7 14-15 14s-15-6-15-14c0 8-7 14-15 14s-15-6-15-14c0 8-7 14-15 14s-15-6-15-14c0 8-7 14-15 14s-15-6-15-14l8-20z" fill="url(#ill-awning)" />
      <path d="M38 44h124l8 20c0 8-7 14-15 14s-15-6-15-14c0 8-7 14-15 14s-15-6-15-14c0 8-7 14-15 14s-15-6-15-14c0 8-7 14-15 14s-15-6-15-14l8-20z" fill="#000" opacity="0.06" />
      <rect x="58" y="88" width="34" height="28" rx="3" fill="#e0e7ff" />
      <rect x="108" y="88" width="34" height="44" rx="3" fill="#4f46e5" opacity="0.85" />
      <rect x="113" y="94" width="24" height="3" rx="1.5" fill="#fff" opacity="0.9" />
      <rect x="113" y="101" width="24" height="3" rx="1.5" fill="#fff" opacity="0.7" />
      <rect x="113" y="108" width="16" height="3" rx="1.5" fill="#fff" opacity="0.5" />
      <rect x="52" y="26" width="10" height="18" rx="5" fill="#fbbf24" opacity="0.9" />
      <path d="M57 12v6M43 19l4 4M71 19l-4 4" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyBoxIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 140 120" fill="none" className={className} aria-hidden="true">
      <ellipse cx="70" cy="104" rx="46" ry="8" fill="#6366f1" opacity="0.08" />
      <path d="M35 48l35-16 35 16v40l-35 16-35-16V48z" fill="#ffffff" stroke="#c7d2fe" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M35 48l35 16 35-16M70 64v40" stroke="#c7d2fe" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M42 42l30-13 26 11-30 14-26-12z" fill="#e0e7ff" />
      <circle cx="112" cy="34" r="5" fill="#a5b4fc" opacity="0.7" />
      <circle cx="26" cy="60" r="4" fill="#c7d2fe" opacity="0.7" />
      <circle cx="118" cy="76" r="3" fill="#e0e7ff" />
    </svg>
  );
}

export function GrowthIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 180 120" fill="none" className={className} aria-hidden="true">
      <rect x="20" y="78" width="22" height="30" rx="4" fill="#c7d2fe" />
      <rect x="54" y="60" width="22" height="48" rx="4" fill="#a5b4fc" />
      <rect x="88" y="42" width="22" height="66" rx="4" fill="#818cf8" />
      <rect x="122" y="22" width="22" height="86" rx="4" fill="#4f46e5" />
      <path d="M24 56L60 38l30-10 32-16" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M116 8h10v10" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" transform="translate(2 4)" />
      <circle cx="152" cy="16" r="6" fill="#10b981" opacity="0.25" />
    </svg>
  );
}
