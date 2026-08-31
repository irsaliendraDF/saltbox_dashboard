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
  // Community level, not area level. The area signal describes a whole postal
  // area, so a community with no retrofits of its own can sit inside a busy one.
  // This tile counts communities where nothing is documented as having reached
  // them, which is the delivery gap a funder is looking for.
  const noneDocumented = regions.filter(
    (r) => r.retrofit_activity.in_der_perf_map === false
  ).length;
  const critical = regions.filter((r) => r.need_tier?.label === "Critical").length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label="Communities shown" value={communities.toLocaleString("en-CA")} />
      <Tile label="Households in energy poverty" value={epHouseholds.toLocaleString("en-CA")} />
      <Tile
        label="No retrofits documented in the community"
        value={noneDocumented.toLocaleString("en-CA")}
        sub="2020–2023, whatever the surrounding area shows"
      />
      <Tile label="Communities in Critical need" value={critical.toLocaleString("en-CA")} />
    </div>
  );
}
