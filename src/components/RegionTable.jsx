import { useState } from "react";
import {
  Cell,
  TierPill,
  NEED_TIER_STYLES,
  SIGNAL_STYLES,
  GAP_STYLES,
  PROVINCE_SHORT,
} from "../lib/format.jsx";

// Column definitions. `get` pulls the sortable value; nulls always sort last.
const COLUMNS = [
  { key: "community", label: "Community", get: (r) => r.community, numeric: false },
  { key: "province", label: "Prov.", get: (r) => r.province, numeric: false },
  { key: "fsa", label: "FSA", get: (r) => r.fsa, numeric: false },
  // Service Gap leads: need relative to activity reaching the community.
  { key: "service_gap", label: "Service gap", get: (r) => r.service_gap, numeric: true },
  { key: "gap_band", label: "Gap band", get: (r) => r.gap_band?.ordinal ?? null, numeric: true },
  { key: "underlying_need", label: "Need (no activity)", get: (r) => r.underlying_need, numeric: true },
  { key: "activity", label: "Activity here", get: (r) => (r.activity ? 3 - r.activity.gap_points : null), numeric: true },
  { key: "need_score", label: "Workbook score", get: (r) => r.need_score, numeric: true },
  { key: "need_tier", label: "Need tier", get: (r) => r.need_tier?.ordinal ?? null, numeric: true },
  { key: "ep_rate", label: "Energy poverty", get: (r) => r.energy_poverty.ep_rate_pct, numeric: true },
  { key: "total_households", label: "Households", get: (r) => r.energy_poverty.total_households, numeric: true },
  { key: "ep_households", label: "In energy poverty", get: (r) => r.energy_poverty.households_energy_poverty, numeric: true },
  { key: "major_repair_pct", label: "Major repair", get: (r) => r.energy_poverty.major_repair_pct, numeric: true },
  { key: "older_housing_pct", label: "Older housing", get: (r) => r.energy_poverty.older_housing_pct, numeric: true },
  { key: "signal", label: "Activity signal", get: (r) => r.retrofit_activity.fsa_gap_flag?.ordinal ?? null, numeric: true },
];

export default function RegionTable({ regions, onSelect }) {
  const [sort, setSort] = useState({ key: "service_gap", dir: -1 });

  const col = COLUMNS.find((c) => c.key === sort.key);
  const sorted = [...regions].sort((a, b) => {
    const va = col.get(a);
    const vb = col.get(b);
    if (va === null && vb === null) return 0;
    if (va === null) return 1; // nulls last regardless of direction
    if (vb === null) return -1;
    const cmp = col.numeric ? va - vb : String(va).localeCompare(String(vb));
    return cmp * sort.dir;
  });

  const clickHeader = (key) =>
    setSort((s) => {
      if (s.key === key) return { key, dir: -s.dir };
      const c = COLUMNS.find((x) => x.key === key);
      return { key, dir: c.initialDir ?? (c.numeric ? -1 : 1) };
    });

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => clickHeader(c.key)}
                  className="cursor-pointer select-none px-3 py-2.5 font-semibold hover:text-slate-800 whitespace-nowrap"
                >
                  {c.label}
                  {sort.key === c.key && <span className="ml-1">{sort.dir === -1 ? "▾" : "▴"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={`${r.community}|${r.province}`}
                onClick={() => onSelect(r)}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                  {r.community}
                  {r.saltbox_pilot && (
                    <span
                      className="ml-1.5 inline-block rounded-full border border-violet-200 bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 align-middle"
                      title="Saltbox pilot geography. Speak with Saltbox for more context on this area."
                    >
                      Pilot
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-500">{PROVINCE_SHORT[r.province]}</td>
                <td className="px-3 py-2 text-slate-500">
                  <Cell value={r.fsa} pct={false} />
                </td>
                <td className="px-3 py-2 tabular-nums font-semibold text-slate-900">
                  <Cell value={r.service_gap} />
                </td>
                <td className="px-3 py-2">
                  <TierPill label={r.gap_band?.label ?? null} styles={GAP_STYLES} />
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-700">
                  <Cell value={r.underlying_need} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                  {r.activity ? r.activity.label : (
                    <span className="text-slate-400 cursor-help" title="not recorded">–</span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-500">
                  <Cell value={r.need_score} />
                </td>
                <td className="px-3 py-2">
                  <TierPill label={r.need_tier?.label ?? null} styles={NEED_TIER_STYLES} />
                </td>
                <td className="px-3 py-2 tabular-nums"><Cell value={r.energy_poverty.ep_rate_pct} pct /></td>
                <td className="px-3 py-2 tabular-nums"><Cell value={r.energy_poverty.total_households} /></td>
                <td className="px-3 py-2 tabular-nums"><Cell value={r.energy_poverty.households_energy_poverty} /></td>
                <td className="px-3 py-2 tabular-nums"><Cell value={r.energy_poverty.major_repair_pct} pct /></td>
                <td className="px-3 py-2 tabular-nums"><Cell value={r.energy_poverty.older_housing_pct} pct /></td>
                <td
                  className="px-3 py-2"
                  title={
                    r.retrofit_activity.context_is_catchment
                      ? `Signal for the surrounding rural area (${r.retrofit_activity.context_fsa})`
                      : undefined
                  }
                >
                  <TierPill
                    label={r.retrofit_activity.fsa_gap_flag?.label ?? null}
                    styles={SIGNAL_STYLES}
                  />
                  {r.retrofit_activity.context_is_catchment && (
                    <span className="ml-1 text-xs text-slate-400">area</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
        <strong className="font-semibold text-slate-700">Service gap</strong> is underlying need
        scaled by how little retrofit activity is documented as reaching the community, so
        high-need communities that nothing has reached rank highest. <strong className="font-semibold text-slate-700">Need
        (no activity)</strong> is energy poverty, major repair and older housing only.{" "}
        <strong className="font-semibold text-slate-700">Workbook score</strong> is the Saltbox Need
        Index as published, which already folds a retrofit gap into it.
        Activity signal reads documented deep retrofit activity in the area. Red: very little is
        reaching it, a possible underserved market or delivery gap. Yellow: limited. Green:
        established. Blue: comparatively strong. A red signal does not automatically mean highest
        need. "Pilot" marks the Saltbox pilot geography: speak with Saltbox for more context.
      </div>
    </div>
  );
}
