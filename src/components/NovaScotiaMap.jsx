import { useMemo, useState } from "react";
import geo from "../../data/ns-fsa-geo.json";
import {
  GAP_FILL,
  GAP_STYLES,
  NO_COMMUNITY_FILL,
  OUT_OF_FRAME_FILL,
  TierPill,
  NEED_TIER_STYLES,
  fmtNum,
} from "../lib/format.jsx";

const GAP_ORDER = ["Served", "Low", "Moderate", "High", "Severe"];

// The Saltbox analysis covers RURAL postal areas only. The workbook's Need Index
// methodology states the retrofit data was "filtered to rural Atlantic Canada
// FSAs (A0, B0, C0, E0)", which is the codes whose second character is 0.
// Nova Scotia has 77 postal areas and only 14 sit inside that frame, so the rest
// are drawn as out of study area rather than as absence of need. KJ 2026-09-08.
const inStudyFrame = (fsa) => /^[A-Z]0/.test(fsa);

// The map is drawn per postal area; the analysis is per community, and a postal
// area can hold several communities with different gaps. So each area is
// summarised from its communities and shaded by the LARGEST gap it contains,
// with the community count always shown so the grain is never implied to be 1:1.
function summarise(regions) {
  const byFsa = new Map();
  for (const r of regions) {
    if (r.province !== "Nova Scotia" || !r.fsa) continue;
    if (!byFsa.has(r.fsa)) byFsa.set(r.fsa, []);
    byFsa.get(r.fsa).push(r);
  }
  const out = new Map();
  for (const [fsa, list] of byFsa) {
    const gaps = list.map((r) => r.service_gap).filter((v) => v !== null);
    const bands = list.map((r) => r.gap_band?.label).filter(Boolean);
    const worstBand = GAP_ORDER.filter((b) => bands.includes(b)).pop() ?? null;
    out.set(fsa, {
      fsa,
      communities: list,
      topGap: gaps.length ? Math.max(...gaps) : null,
      worstBand,
      // Every community here lacks an activity record, so the area's gap is
      // genuinely unknown rather than zero.
      allUnknown: list.every((r) => r.activity === null),
      epHouseholds: list.reduce(
        (s, r) => s + (r.energy_poverty.households_energy_poverty ?? 0),
        0
      ),
      noneReached: list.filter((r) => r.activity?.label === "None documented").length,
      pilot: list.some((r) => r.saltbox_pilot),
    });
  }
  return out;
}

function Swatch({ color, hatched, children }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-3 w-3 rounded-sm border border-slate-300"
        style={
          hatched
            ? {
                backgroundImage:
                  "repeating-linear-gradient(45deg,#cbd5e1 0 2px,transparent 2px 4px)",
                backgroundColor: OUT_OF_FRAME_FILL,
              }
            : { backgroundColor: color }
        }
      />
      {children}
    </span>
  );
}

export default function NovaScotiaMap({ regions, onSelectCommunity }) {
  const summary = useMemo(() => summarise(regions), [regions]);
  const [hover, setHover] = useState(null);
  const [picked, setPicked] = useState(null);

  const framed = geo.features.filter((f) => inStudyFrame(f.fsa));
  const withData = framed.filter((f) => summary.has(f.fsa)).length;
  const outsideWithData = geo.features.filter(
    (f) => !inStudyFrame(f.fsa) && summary.has(f.fsa)
  ).length;
  const nsCount = regions.filter((r) => r.province === "Nova Scotia").length;
  const active = picked && summary.get(picked) ? summary.get(picked) : null;
  const shown = hover && summary.get(hover) ? summary.get(hover) : active;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Nova Scotia service gap by postal area
          </h2>
          <span className="text-xs text-slate-500">
            {withData + outsideWithData} postal areas hold the {nsCount} communities in this filter
          </span>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Shaded by the <span className="font-medium text-slate-700">largest service gap</span>{" "}
          among the communities inside each area, so the deepest colour is the biggest underserved
          opportunity. A postal area is not a community: several communities can share one, and the
          panel lists them.
        </p>

        <svg
          viewBox={geo.viewBox}
          className="h-auto w-full"
          role="img"
          aria-label="Map of Nova Scotia postal areas shaded by service gap"
        >
          {geo.features.map((f) => {
            const s = summary.get(f.fsa);
            const framedArea = inStudyFrame(f.fsa);
            const isActive = picked === f.fsa;
            const isHover = hover === f.fsa;

            let fill = OUT_OF_FRAME_FILL;
            if (s && s.allUnknown) fill = "url(#unknownHatch)";
            else if (s) fill = GAP_FILL[s.worstBand] ?? NO_COMMUNITY_FILL;
            else if (framedArea) fill = NO_COMMUNITY_FILL;

            let label;
            if (s && s.allUnknown) {
              label = `${f.fsa}: ${s.communities.length} community, retrofit activity not recorded`;
            } else if (s) {
              label = `${f.fsa}: ${s.communities.length} ${
                s.communities.length === 1 ? "community" : "communities"
              }, largest service gap ${s.topGap} (${s.worstBand})`;
            } else if (framedArea) {
              label = `${f.fsa}: rural study area, no community in this filter`;
            } else {
              label = `${f.fsa}: outside the rural study area, not assessed`;
            }

            return (
              <path
                key={f.fsa}
                d={f.d}
                fill={fill}
                fillOpacity={s ? (isHover || isActive ? 1 : 0.9) : framedArea ? 0.7 : 0.5}
                stroke={isActive ? "#0f172a" : "#ffffff"}
                strokeWidth={isActive ? 3 : framedArea ? 1 : 0.5}
                className={s ? "cursor-pointer" : ""}
                onMouseEnter={() => s && setHover(f.fsa)}
                onMouseLeave={() => setHover(null)}
                onClick={() => s && setPicked(picked === f.fsa ? null : f.fsa)}
              >
                <title>{label}</title>
              </path>
            );
          })}
          <defs>
            <pattern id="unknownHatch" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="#ffffff" />
              <path d="M0,6 l6,-6" stroke="#94a3b8" strokeWidth="1.5" />
            </pattern>
          </defs>
        </svg>

        <div className="mt-2 space-y-1 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-slate-600">Largest service gap in area:</span>
            {GAP_ORDER.slice().reverse().map((b) => (
              <Swatch key={b} color={GAP_FILL[b]}>
                {b}
              </Swatch>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Swatch hatched>Activity not recorded, so the gap is unknown, not zero</Swatch>
            <Swatch color={NO_COMMUNITY_FILL}>Rural study area, no community in this filter</Swatch>
            <Swatch color={OUT_OF_FRAME_FILL}>Outside the rural study area, not assessed</Swatch>
          </div>
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
              {shown.communities[0]?.region_county ?? "Nova Scotia"} ·{" "}
              {shown.communities.length}{" "}
              {shown.communities.length === 1 ? "community" : "communities"}
            </p>

            <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-slate-500">Largest service gap</dt>
                <dd className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {shown.topGap ?? "–"}
                  </span>
                  <TierPill label={shown.worstBand} styles={GAP_STYLES} />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-slate-500">Households in energy poverty</dt>
                <dd className="text-sm font-medium tabular-nums">{fmtNum(shown.epHouseholds)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-slate-500">Nothing documented reaching them</dt>
                <dd className="text-sm font-medium tabular-nums">
                  {shown.noneReached} of {shown.communities.length}
                </dd>
              </div>
            </dl>

            <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Communities, largest gap first
            </h4>
            <ul className="mt-1 divide-y divide-slate-100">
              {[...shown.communities]
                .sort((a, b) => (b.service_gap ?? -1) - (a.service_gap ?? -1))
                .map((c) => (
                  <li key={`${c.community}|${c.province}`}>
                    <button
                      type="button"
                      onClick={() => onSelectCommunity(c)}
                      className="flex w-full items-center justify-between gap-2 py-1.5 text-left hover:text-slate-900"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-slate-700">{c.community}</span>
                        <span className="block text-[11px] text-slate-400">
                          need {c.underlying_need ?? "–"} · {c.activity?.label ?? "activity not recorded"}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-slate-700">
                          {c.service_gap ?? "–"}
                        </span>
                        <TierPill label={c.gap_band?.label ?? null} styles={GAP_STYLES} />
                      </span>
                    </button>
                  </li>
                ))}
            </ul>

            <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
              Need tier shown elsewhere is the Saltbox workbook score, which already folds a
              retrofit gap into it. Service gap here keeps the two apart.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
