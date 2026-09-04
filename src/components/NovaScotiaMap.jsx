import { useMemo, useState } from "react";
import geo from "../../data/ns-fsa-geo.json";
import {
  NEED_TIER_FILL,
  NO_DATA_FILL,
  TierPill,
  NEED_TIER_STYLES,
  SIGNAL_STYLES,
  fmtNum,
} from "../lib/format.jsx";

const TIER_ORDER = ["Lower", "Moderate", "High", "Critical"];

// The map is drawn per postal area; the data is per community. So each area is
// summarised from the communities inside it, and shaded by the highest need tier
// it contains, because a funder is looking for where the worst need is rather
// than for an average that hides it. Areas with no community in the current
// filter are drawn as no data, never as zero.
function summarise(regions) {
  const byFsa = new Map();
  for (const r of regions) {
    if (r.province !== "Nova Scotia" || !r.fsa) continue;
    if (!byFsa.has(r.fsa)) byFsa.set(r.fsa, []);
    byFsa.get(r.fsa).push(r);
  }
  const out = new Map();
  for (const [fsa, list] of byFsa) {
    const tiers = list.map((r) => r.need_tier?.label).filter(Boolean);
    const worst = TIER_ORDER.filter((t) => tiers.includes(t)).pop() ?? null;
    const scores = list.map((r) => r.need_score).filter((v) => v !== null);
    out.set(fsa, {
      fsa,
      communities: list,
      worstTier: worst,
      topScore: scores.length ? Math.max(...scores) : null,
      epHouseholds: list.reduce(
        (s, r) => s + (r.energy_poverty.households_energy_poverty ?? 0),
        0
      ),
      noneDocumented: list.filter((r) => r.retrofit_activity.in_der_perf_map === false).length,
      signal: list[0]?.retrofit_activity.fsa_gap_flag ?? null,
      pilot: list.some((r) => r.saltbox_pilot),
    });
  }
  return out;
}

export default function NovaScotiaMap({ regions, onSelectCommunity }) {
  const summary = useMemo(() => summarise(regions), [regions]);
  const [hover, setHover] = useState(null);
  const [picked, setPicked] = useState(null);

  const withData = geo.features.filter((f) => summary.has(f.fsa)).length;
  const nsCount = regions.filter((r) => r.province === "Nova Scotia").length;
  const active = picked && summary.get(picked) ? summary.get(picked) : null;
  const shown = hover && summary.get(hover) ? summary.get(hover) : active;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Nova Scotia by postal area</h2>
          <span className="text-xs text-slate-500">
            {withData} of {geo.features.length} postal areas carry data in this filter
          </span>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Shaded by the highest need tier among the communities inside each area. Click an area to
          see them. Grey means no community in the current filter, which is not the same as no need.
        </p>

        <svg
          viewBox={geo.viewBox}
          className="h-auto w-full"
          role="img"
          aria-label="Map of Nova Scotia postal areas shaded by need tier"
        >
          {geo.features.map((f) => {
            const s = summary.get(f.fsa);
            const isActive = picked === f.fsa;
            const isHover = hover === f.fsa;
            return (
              <path
                key={f.fsa}
                d={f.d}
                fill={s?.worstTier ? NEED_TIER_FILL[s.worstTier] : NO_DATA_FILL}
                fillOpacity={s ? (isHover || isActive ? 1 : 0.85) : 0.55}
                stroke={isActive ? "#0f172a" : "#ffffff"}
                strokeWidth={isActive ? 3 : 1}
                className={s ? "cursor-pointer" : ""}
                onMouseEnter={() => s && setHover(f.fsa)}
                onMouseLeave={() => setHover(null)}
                onClick={() => s && setPicked(picked === f.fsa ? null : f.fsa)}
              >
                <title>
                  {s
                    ? `${f.fsa}: ${s.communities.length} ${
                        s.communities.length === 1 ? "community" : "communities"
                      }, worst need ${s.worstTier}`
                    : `${f.fsa}: no community in this filter`}
                </title>
              </path>
            );
          })}
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Highest need in area:</span>
          {TIER_ORDER.slice()
            .reverse()
            .map((t) => (
              <span key={t} className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: NEED_TIER_FILL[t] }}
                />
                {t}
              </span>
            ))}
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: NO_DATA_FILL }}
            />
            No community in filter
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {!shown ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
            <p className="text-sm text-slate-500">Hover or click a postal area.</p>
            <p className="mt-1 text-xs text-slate-400">
              Nova Scotia holds {nsCount} of the {regions.length} communities in this filter. The
              other Atlantic provinces are in the Data tab.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">{shown.fsa}</h3>
              {shown.pilot && (
                <span className="rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                  Saltbox pilot
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {shown.communities[0]?.region_county ?? "Nova Scotia"}
            </p>

            <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-slate-500">Highest need here</dt>
                <dd className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {shown.topScore ?? "–"}
                  </span>
                  <TierPill label={shown.worstTier} styles={NEED_TIER_STYLES} />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-slate-500">Households in energy poverty</dt>
                <dd className="text-sm font-medium tabular-nums">{fmtNum(shown.epHouseholds)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-slate-500">No retrofits documented</dt>
                <dd className="text-sm font-medium tabular-nums">
                  {shown.noneDocumented} of {shown.communities.length}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-slate-500">Activity signal</dt>
                <dd>
                  <TierPill label={shown.signal?.label ?? null} styles={SIGNAL_STYLES} />
                </dd>
              </div>
            </dl>

            <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Communities
            </h4>
            <ul className="mt-1 divide-y divide-slate-100">
              {[...shown.communities]
                .sort((a, b) => (b.need_score ?? -1) - (a.need_score ?? -1))
                .map((c) => (
                  <li key={`${c.community}|${c.province}`}>
                    <button
                      type="button"
                      onClick={() => onSelectCommunity(c)}
                      className="flex w-full items-center justify-between gap-2 py-1.5 text-left hover:text-slate-900"
                    >
                      <span className="text-sm text-slate-700">{c.community}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-sm tabular-nums text-slate-500">
                          {c.need_score ?? "–"}
                        </span>
                        <TierPill label={c.need_tier?.label ?? null} styles={NEED_TIER_STYLES} />
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
