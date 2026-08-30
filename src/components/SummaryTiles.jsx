function Tile({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-2xl font-semibold text-slate-900 tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function SummaryTiles({ regions }) {
  const communities = regions.length;
  const epHouseholds = regions.reduce(
    (sum, r) => sum + (r.energy_poverty.households_energy_poverty ?? 0),
    0
  );
  // Actual retrofit counts are internal; the public tile reads the signal.
  const lowActivity = regions.filter((r) => {
    const label = r.retrofit_activity.fsa_gap_flag?.label;
    return label === "Zero activity" || label === "Very low";
  }).length;
  const critical = regions.filter((r) => r.need_tier?.label === "Critical").length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label="Communities shown" value={communities.toLocaleString("en-CA")} />
      <Tile label="Households in energy poverty" value={epHouseholds.toLocaleString("en-CA")} />
      <Tile
        label="Little or no documented retrofit activity"
        value={lowActivity.toLocaleString("en-CA")}
        sub="2020–2023 activity signal"
      />
      <Tile label="Communities in Critical need" value={critical.toLocaleString("en-CA")} />
    </div>
  );
}
