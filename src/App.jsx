import { useMemo, useState } from "react";
import regions from "../data/regions.json";
import FilterBar from "./components/FilterBar.jsx";
import SummaryTiles from "./components/SummaryTiles.jsx";
import RegionTable from "./components/RegionTable.jsx";
import ChartsPanel from "./components/ChartsPanel.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import NovaScotiaMap from "./components/NovaScotiaMap.jsx";

// Bounds for the energy poverty slider, from the data itself.
const epValues = regions.map((r) => r.energy_poverty.ep_rate_pct).filter((v) => v !== null);
const EP_BOUNDS = [Math.floor(Math.min(...epValues)), Math.ceil(Math.max(...epValues))];

// Activity signal options in ordinal order, plus "none" for communities whose
// postal area has no recorded activity data (unknown, distinct from zero).
const ACTIVITY_TIER_OPTIONS = [
  ...[...new Map(
    regions
      .filter((r) => r.retrofit_activity.fsa_gap_flag)
      .map((r) => [r.retrofit_activity.fsa_gap_flag.ordinal, r.retrofit_activity.fsa_gap_flag.label])
  ).entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, label]) => label),
  "none",
];

const INITIAL_FILTERS = {
  provinces: new Set(),
  needTiers: new Set(),
  activityTiers: new Set(),
  epMin: EP_BOUNDS[0],
  epMax: EP_BOUNDS[1],
  search: "",
};

export default function App() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [selected, setSelected] = useState(null);
  // Map first, per KJ 2026-09-04: he wanted to see the geography before the
  // numbers, with the hard-coded stats a tab behind it.
  const [tab, setTab] = useState("map");

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return regions.filter((r) => {
      if (filters.provinces.size && !filters.provinces.has(r.province)) return false;
      if (filters.needTiers.size && !filters.needTiers.has(r.need_tier?.label)) return false;
      if (filters.activityTiers.size) {
        const tier = r.retrofit_activity.fsa_gap_flag?.label ?? "none";
        if (!filters.activityTiers.has(tier)) return false;
      }
      const ep = r.energy_poverty.ep_rate_pct;
      // The slider only excludes on a recorded rate; unknown is not zero.
      if (ep !== null && (ep < filters.epMin || ep > filters.epMax)) return false;
      if (q) {
        const hay = `${r.community} ${r.fsa ?? ""} ${r.municipality ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [filters]);

  const resetAll = () => setFilters(INITIAL_FILTERS);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        activityTiers={ACTIVITY_TIER_OPTIONS}
        shown={filtered.length}
        total={regions.length}
        epBounds={EP_BOUNDS}
      />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        <header className="pt-1">
          <h1 className="text-xl font-semibold">Saltbox Fund · Rural Retrofit Dashboard</h1>
          <p className="text-sm text-slate-500">
            Community energy poverty and deep energy retrofit activity across Atlantic Canada.
            2021 census and 2020–2023 retrofit records.
          </p>
        </header>

        <div className="flex gap-1 border-b border-slate-200">
          {[
            ["map", "Map"],
            ["data", "Data"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-slate-800 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-slate-600">No communities match the current filters.</p>
            <button
              type="button"
              onClick={resetAll}
              className="mt-3 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Reset filters
            </button>
          </div>
        ) : tab === "map" ? (
          <>
            <SummaryTiles regions={filtered} />
            <NovaScotiaMap regions={filtered} onSelectCommunity={setSelected} />
          </>
        ) : (
          <>
            <SummaryTiles regions={filtered} />
            <RegionTable regions={filtered} onSelect={setSelected} />
            <ChartsPanel regions={filtered} />
          </>
        )}

        <footer className="pb-6 pt-2 text-xs text-slate-400">
          Sources: Efficiency Canada Community-Level Energy Poverty Map · NRCan EnerGuide / Green
          Communities Canada 2020–2023 · Statistics Canada 2021 census. Postal area boundaries:
          Statistics Canada 2021 Census. A dash means not recorded, which is not the same as zero.
        </footer>
      </main>

      {selected && <DetailPanel region={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
