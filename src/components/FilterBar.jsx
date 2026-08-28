import { PROVINCES, PROVINCE_SHORT } from "../lib/format.jsx";

const NEED_TIERS = ["Critical", "High", "Moderate", "Lower"];

function ToggleChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? "border-slate-700 bg-slate-800 text-white"
          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
      }`}
    >
      {children}
    </button>
  );
}

export default function FilterBar({ filters, setFilters, activityTiers, shown, total, epBounds }) {
  const toggle = (key, value) =>
    setFilters((f) => {
      const next = new Set(f[key]);
      next.has(value) ? next.delete(value) : next.add(value);
      return { ...f, [key]: next };
    });

  const reset = () =>
    setFilters({
      provinces: new Set(),
      needTiers: new Set(),
      activityTiers: new Set(),
      epMin: epBounds[0],
      epMax: epBounds[1],
      search: "",
    });

  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-sm">
      <div className="mx-auto max-w-7xl flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 mr-1">Province</span>
          {PROVINCES.map((p) => (
            <ToggleChip key={p} active={filters.provinces.has(p)} onClick={() => toggle("provinces", p)}>
              {PROVINCE_SHORT[p]}
            </ToggleChip>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 mr-1">Need</span>
          {NEED_TIERS.map((t) => (
            <ToggleChip key={t} active={filters.needTiers.has(t)} onClick={() => toggle("needTiers", t)}>
              {t}
            </ToggleChip>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 mr-1">Retrofit activity</span>
          {activityTiers.map((t) => (
            <ToggleChip key={t} active={filters.activityTiers.has(t)} onClick={() => toggle("activityTiers", t)}>
              {t === "none" ? "Not recorded" : t}
            </ToggleChip>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Energy poverty {filters.epMin}%–{filters.epMax}%
          </span>
          <input
            type="range"
            min={epBounds[0]}
            max={epBounds[1]}
            value={filters.epMin}
            onChange={(e) =>
              setFilters((f) => ({ ...f, epMin: Math.min(Number(e.target.value), f.epMax) }))
            }
            className="w-24 accent-slate-700"
            aria-label="Minimum energy poverty rate"
          />
          <input
            type="range"
            min={epBounds[0]}
            max={epBounds[1]}
            value={filters.epMax}
            onChange={(e) =>
              setFilters((f) => ({ ...f, epMax: Math.max(Number(e.target.value), f.epMin) }))
            }
            className="w-24 accent-slate-700"
            aria-label="Maximum energy poverty rate"
          />
        </div>

        <input
          type="search"
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search community or FSA"
          className="w-48 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
        />

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-slate-600">
            showing <span className="font-semibold text-slate-900">{shown}</span> of {total} communities
          </span>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
