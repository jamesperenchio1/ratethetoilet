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

export function SavedIcon() {
  return (
    <svg {...COMMON}>
      <path d="M4.5 2.5h9a1 1 0 0 1 1 1v12l-5.5-3.4L3.5 15.5v-12a1 1 0 0 1 1-1Z" />
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
