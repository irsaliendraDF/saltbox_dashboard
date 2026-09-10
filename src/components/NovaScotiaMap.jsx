import { useMemo, useState } from "react";
import geo from "../../data/ns-fsa-geo.json";
import {
  GAP_FILL,
  GAP_STYLES,
  NO_COMMUNITY_FILL,
  OUT_OF_FRAME_FILL,
  TierPill,
  fmtNum,
} from "../lib/format.jsx";

const GAP_ORDER = ["Served", "Low", "Moderate", "High", "Severe"];
const pointByCommunity = new Map(geo.points.map((p) => [p.community, p]));
const featureByFsa = new Map(geo.features.map((f) => [f.fsa, f]));

// Where a community sits on the map: its own postal code where the Saltbox data
// records one, otherwise the postal area its official location falls inside.
// Only Richmond needs the second route.
const mapFsa = (r) => r.fsa ?? pointByCommunity.get(r.community)?.fsa ?? null;

// Region names come from the county boundaries themselves (see build-geo.py),
// not from the workbook region labels, several of which name the wrong
// counties. Feedback 2026-09-10 said the regions did not match the real map.
function describeCounties(list) {
  if (!list || list.length === 0) return null;
  const [top, ...rest] = list;
  const join = (xs) =>
    xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
  if (top.share >= 0.9 || rest.length === 0) return `${top.name} County`;
  if (top.share >= 0.5) {
    return `Mostly ${top.name} County, with ${rest.length === 1 ? "part" : "parts"} of ${join(
      rest.map((c) => c.name)
    )}`;
  }
  return `Spans ${join(list.map((c) => c.name))} counties`;
}

// A postal area is not a community: it can hold several with different gaps.
// Each area is shaded by the LARGEST gap it contains, the count always shows,
// and the communities themselves are drawn as dots at their official locations.
function summarise(regions) {
  const byFsa = new Map();
  for (const r of regions) {
    if (r.province !== "Nova Scotia") continue;
    const fsa = mapFsa(r);
    if (!fsa) continue;
    if (!byFsa.has(fsa)) byFsa.set(fsa, []);
    byFsa.get(fsa).push(r);
  }
  const out = new Map();
  for (const [fsa, list] of byFsa) {
    const gaps = list.map((r) => r.service_gap).filter((v) => v !== null);
    const bands = list.map((r) => r.gap_band?.label).filter(Boolean);
    out.set(fsa, {
      fsa,
      communities: list,
      topGap: gaps.length ? Math.max(...gaps) : null,
      worstBand: GAP_ORDER.filter((b) => bands.includes(b)).pop() ?? null,
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
                  "repeating-linear-gradient(45deg,#94a3b8 0 1.5px,transparent 1.5px 4px)",
                backgroundColor: "#ffffff",
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

  const nsRegions = regions.filter((r) => r.province === "Nova Scotia");
  const areasWithData = geo.features.filter((f) => summary.has(f.fsa)).length;
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
            {nsRegions.length} communities in {areasWithData} postal areas
          </span>
        </div>
        <p className="mb-2 text-xs text-slate-500">
          Areas are shaded by the{" "}
          <span className="font-medium text-slate-700">largest service gap</span> among the
          communities inside them. Dots mark each community at its official location. Dark lines
          are county boundaries.
        </p>

        <svg
          viewBox={geo.viewBox}
          className="h-auto w-full"
          role="img"
          aria-label="Map of Nova Scotia postal areas shaded by service gap, with county boundaries and community locations"
        >
          <defs>
            <pattern id="unknownHatch" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="#ffffff" />
              <path d="M0,6 l6,-6" stroke="#94a3b8" strokeWidth="1.5" />
            </pattern>
          </defs>

          <g>
            {geo.features.map((f) => {
              const s = summary.get(f.fsa);
              const isActive = picked === f.fsa;
              const isHover = hover === f.fsa;

              let fill = OUT_OF_FRAME_FILL;
              if (s && s.allUnknown) fill = "url(#unknownHatch)";
              else if (s) fill = GAP_FILL[s.worstBand] ?? NO_COMMUNITY_FILL;
              else if (f.in_frame) fill = NO_COMMUNITY_FILL;

              const where = describeCounties(f.counties);
              let label;
              if (s && s.allUnknown) {
                label = `${f.fsa}: retrofit activity not recorded`;
              } else if (s) {
                label = `${f.fsa}: ${s.communities.length} ${
                  s.communities.length === 1 ? "community" : "communities"
                }, largest service gap ${s.topGap} (${s.worstBand})`;
              } else if (f.in_frame) {
                label = `${f.fsa}: rural study area, no community in this filter`;
              } else {
                label = `${f.fsa}: outside the rural study area, not assessed`;
              }

              return (
                <path
                  key={f.fsa}
                  d={f.d}
                  fillRule="evenodd"
                  fill={fill}
                  fillOpacity={s ? (isHover || isActive ? 1 : 0.88) : f.in_frame ? 0.8 : 1}
                  stroke={isActive ? "#0f172a" : "#ffffff"}
                  strokeWidth={isActive ? 3 : f.in_frame ? 0.9 : 0.4}
                  className={s ? "cursor-pointer" : ""}
                  onMouseEnter={() => s && setHover(f.fsa)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => s && setPicked(picked === f.fsa ? null : f.fsa)}
                >
                  <title>{where ? `${label}. ${where}.` : label}</title>
                </path>
              );
            })}
          </g>

          <g pointerEvents="none">
            {geo.county_lines.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="#334155"
                strokeWidth={1.3}
                strokeOpacity={0.6}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </g>

          <g pointerEvents="none">
            {geo.county_labels.map((c) => (
              <text
                key={c.name}
                x={c.x}
                y={c.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={14}
                fontWeight={600}
                letterSpacing={0.6}
                fill="#334155"
                stroke="#ffffff"
                strokeWidth={3.5}
                paintOrder="stroke"
                style={{ textTransform: "uppercase" }}
              >
                {c.name}
              </text>
            ))}
          </g>

          <g>
            {nsRegions.map((r) => {
              const p = pointByCommunity.get(r.community);
              if (!p) return null;
              const fsa = mapFsa(r);
              return (
                <circle
                  key={r.community}
                  cx={p.x}
                  cy={p.y}
                  r={7.5}
                  fill={r.gap_band ? GAP_FILL[r.gap_band.label] : "#ffffff"}
                  stroke="#0f172a"
                  strokeWidth={1.6}
                  className="cursor-pointer"
                  onMouseEnter={() => fsa && setHover(fsa)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onSelectCommunity(r)}
                >
                  <title>
                    {`${r.community}, ${p.county} County: service gap ${
                      r.service_gap ?? "not recorded"
                    }${r.gap_band ? ` (${r.gap_band.label})` : ""}`}
                  </title>
                </circle>
              );
            })}
          </g>
        </svg>

        <div className="mt-2 space-y-1 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-slate-600">Largest service gap in area:</span>
            {GAP_ORDER.slice()
              .reverse()
              .map((b) => (
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
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-slate-900 bg-white" />
              Community, at its official location
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0.5 w-4 bg-slate-600" />
              County boundary
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {!shown ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
            <p className="text-sm text-slate-500">Hover or click a postal area or community.</p>
            <p className="mt-1 text-xs text-slate-400">
              Nova Scotia holds {nsRegions.length} of the {regions.length} communities in this
              filter. The other Atlantic provinces are in the Data tab.
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
              {describeCounties(featureByFsa.get(shown.fsa)?.counties) ?? "Nova Scotia"} ·{" "}
              {shown.communities.length}{" "}
              {shown.communities.length === 1 ? "community" : "communities"}
            </p>

            <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-slate-500">Largest service gap</dt>
                <dd className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{shown.topGap ?? "–"}</span>
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
                .map((c) => {
                  const p = pointByCommunity.get(c.community);
                  return (
                    <li key={`${c.community}|${c.province}`}>
                      <button
                        type="button"
                        onClick={() => onSelectCommunity(c)}
                        className="flex w-full items-center justify-between gap-2 py-1.5 text-left hover:text-slate-900"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-slate-700">
                            {c.community}
                            {p && <span className="text-slate-400"> · {p.county} County</span>}
                          </span>
                          <span className="block text-[11px] text-slate-400">
                            need {c.underlying_need ?? "–"} ·{" "}
                            {c.activity?.label ?? "activity not recorded"}
                            {!c.fsa && " · postal code not recorded, placed by official location"}
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
                  );
                })}
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
