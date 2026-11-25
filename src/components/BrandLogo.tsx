interface BrandLogoProps {
  className?: string;
}

/**
 * Architectural geometric monogram mark ("JB") for the unlocked executive CV header & footer.
 */
export function BrandLogo({ className = 'h-9 w-9' }: BrandLogoProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect width="40" height="40" rx="10" className="fill-slate-950 dark:fill-blue-600" />
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="8.5"
        className="stroke-slate-800 dark:stroke-blue-400/50"
        strokeWidth="1"
      />
      <path
        d="M15.2 11.5V22.4C15.2 25.1 13.3 27.2 10.8 27.2C9.6 27.2 8.6 26.75 7.9 26"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M20.4 11.5H25.9C28 11.5 29.6 12.9 29.6 14.8C29.6 16.25 28.65 17.4 27.1 17.9C29.05 18.4 30.3 19.75 30.3 21.65C30.3 23.9 28.55 25.5 26 25.5H20.4V11.5Z"
        stroke="#FFFFFF"
        strokeWidth="2.3"
        strokeLinejoin="round"
      />
      <path
        d="M20.4 18.05H26"
        className="stroke-blue-400 dark:stroke-slate-950"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="31.5" cy="9" r="2.4" className="fill-blue-500 dark:fill-white" />
    </svg>
  );
}

/**
 * Neutral PII-free architectural seal for the locked public invitation gate.
 */
export function PrivateSealLogo({ className = 'h-9 w-9' }: BrandLogoProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect width="40" height="40" rx="10" className="fill-slate-900 dark:fill-slate-800" />
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="8.5"
        className="stroke-slate-700 dark:stroke-slate-600"
        strokeWidth="1"
      />
      <rect
        x="12.5"
        y="18"
        width="15"
        height="11.5"
        rx="2.5"
        stroke="#F8FAFC"
        strokeWidth="2"
      />
      <path
        d="M15.5 18V14.5C15.5 12.0147 17.5147 10 20 10C22.4853 10 24.5 12.0147 24.5 14.5V18"
        stroke="#60A5FA"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="20" cy="23.8" r="1.6" fill="#60A5FA" />
    </svg>
  );
}
