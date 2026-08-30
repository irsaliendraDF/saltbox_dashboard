// Shared formatting. The rule that matters: null is "not recorded", never zero.

export function fmtNum(v) {
  if (v === null || v === undefined) return null;
  return v.toLocaleString("en-CA");
}

export function fmtPct(v) {
  if (v === null || v === undefined) return null;
  return `${v.toLocaleString("en-CA")}%`;
}

// Renders a value, or a dash with a "not recorded" tooltip when null.
export function Cell({ value, pct = false }) {
  const text = pct ? fmtPct(value) : fmtNum(value);
  if (text === null) {
    return (
      <span className="text-slate-400 cursor-help" title="not recorded">
        –
      </span>
    );
  }
  return <>{text}</>;
}

export const NEED_TIER_STYLES = {
  Critical: "bg-red-100 text-red-800 border-red-200",
  High: "bg-orange-100 text-orange-800 border-orange-200",
  Moderate: "bg-amber-100 text-amber-800 border-amber-200",
  Lower: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export const ACTIVITY_TIER_STYLES = {
  "0": "bg-slate-100 text-slate-600 border-slate-200",
  "1–4": "bg-sky-50 text-sky-700 border-sky-200",
  "5–9": "bg-sky-100 text-sky-800 border-sky-200",
  "10–24": "bg-blue-100 text-blue-800 border-blue-200",
  "25–49": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "50–99": "bg-violet-100 text-violet-800 border-violet-200",
  "100+": "bg-purple-100 text-purple-800 border-purple-200",
};

// KJ's Q10 reading, 2026-08-30: the signal grades documented retrofit activity.
// Red is very little activity reaching the area, yellow limited, green
// established, blue comparatively strong. Red does not mean highest need.
export const SIGNAL_STYLES = {
  "Zero activity": "bg-red-100 text-red-800 border-red-200",
  "Very low": "bg-red-50 text-red-700 border-red-200",
  Low: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Moderate: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  High: "bg-blue-100 text-blue-800 border-blue-200",
};

export function TierPill({ label, styles }) {
  if (label === null || label === undefined) {
    return (
      <span className="text-slate-400 cursor-help" title="not recorded">
        –
      </span>
    );
  }
  const cls = styles[label] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

export const PROVINCES = [
  "Nova Scotia",
  "New Brunswick",
  "Prince Edward Island",
  "Newfoundland & Labrador",
];

export const PROVINCE_SHORT = {
  "Nova Scotia": "NS",
  "New Brunswick": "NB",
  "Prince Edward Island": "PEI",
  "Newfoundland & Labrador": "NL",
};

export const PROVINCE_COLORS = {
  "Nova Scotia": "#2563eb",
  "New Brunswick": "#d97706",
  "Prince Edward Island": "#dc2626",
  "Newfoundland & Labrador": "#059669",
};
