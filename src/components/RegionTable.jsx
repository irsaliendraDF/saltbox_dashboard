import { useState } from "react";
import {
  Cell,
  TierPill,
  NEED_TIER_STYLES,
  SIGNAL_STYLES,
  PROVINCE_SHORT,
} from "../lib/format.jsx";

// Column definitions. `get` pulls the sortable value; nulls always sort last.
const COLUMNS = [
  { key: "community", label: "Community", get: (r) => r.community, numeric: false },
  { key: "province", label: "Prov.", get: (r) => r.province, numeric: false },
  { key: "fsa", label: "FSA", get: (r) => r.fsa, numeric: false },
  { key: "need_score", label: "Need score", get: (r) => r.need_score, numeric: true },
  { key: "need_tier", label: "Need tier", get: (r) => r.need_tier?.ordinal ?? null, numeric: true },
  { key: "ep_rate", label: "Energy poverty", get: (r) => r.energy_poverty.ep_rate_pct, numeric: true },
  { key: "total_households", label: "Households", get: (r) => r.energy_poverty.total_households, numeric: true },
  { key: "ep_households", label: "In energy poverty", get: (r) => r.energy_poverty.households_energy_poverty, numeric: true },
  { key: "major_repair_pct", label: "Major repair", get: (r) => r.energy_poverty.major_repair_pct, numeric: true },
  { key: "older_housing_pct", label: "Older housing", get: (r) => r.energy_poverty.older_housing_pct, numeric: true },
  // Community level. Distinct from the area signal below, and the distinction
  // matters: a community with nothing documented can sit inside a busy area.
  {
    key: "documented_here",
    label: "Documented here",
    get: (r) => {
      const v = r.retrofit_activity.in_der_perf_map;
      return v === null ? null : v ? 1 : 0;
    },
    numeric: true,
    // "None" is the interesting end of this column, so the first click surfaces
    // the gaps rather than burying them under 73 documented communities.
    initialDir: 1,
  },
  { key: "signal", label: "Activity signal", get: (r) => r.retrofit_activity.fsa_gap_flag?.ordinal ?? null, numeric: true },
];

// "None" is a finding, not a blank: it means no deep retrofit is recorded as
// having reached this community. Unknown stays a dash.
function DocumentedHere({ activity }) {
  if (activity.in_der_perf_map === null) {
    return (
      <span className="text-slate-400 cursor-help" title="not recorded">
        –
      </span>
    );
  }
  if (activity.in_der_perf_map === false) {
    return (
      <span className="inline-block rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 whitespace-nowrap">
        None
      </span>
    );
  }
  return (
    <span className="text-slate-700 whitespace-nowrap">
      {activity.best_performance_band ?? "Yes"}
    </span>
  );
}

export default function RegionTable({ regions, onSelect }) {
  const [sort, setSort] = useState({ key: "need_score", dir: -1 });

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
                <td className="px-3 py-2">
                  <DocumentedHere activity={r.retrofit_activity} />
                </td>
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
        Activity signal reads documented deep retrofit activity in the area. Red: very little is
        reaching it, a possible underserved market or delivery gap. Yellow: limited. Green:
        established. Blue: comparatively strong. A red signal does not automatically mean highest
        need. "Pilot" marks the Saltbox pilot geography: speak with Saltbox for more context.
      </div>
    </div>
  );
}
