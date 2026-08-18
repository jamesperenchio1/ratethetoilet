const COMMON = {
  width: 18,
  height: 18,
  viewBox: "0 0 18 18",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function NearbyIcon() {
  return (
    <svg {...COMMON}>
      <path d="M9 16.5s6-5.2 6-9.9A6 6 0 0 0 3 6.6c0 4.7 6 9.9 6 9.9Z" />
      <circle cx="9" cy="6.6" r="2.1" />
    </svg>
  );
}

export function AddIcon() {
  return (
    <svg {...COMMON}>
      <circle cx="9" cy="9" r="6.5" />
      <path d="M9 6.2v5.6M6.2 9h5.6" />
    </svg>
  );
}

export function YouIcon() {
  return (
    <svg {...COMMON}>
      <circle cx="9" cy="5.8" r="2.8" />
      <path d="M3.2 15.3c.9-3 3-4.6 5.8-4.6s4.9 1.6 5.8 4.6" />
    </svg>
  );
}

export function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M9 3v12M3 9h12" />
    </svg>
  );
}

export function ExternalIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 3H3v12h12v-4" />
      <path d="M10 3h5v5M15 3 8 10" />
    </svg>
  );
}
