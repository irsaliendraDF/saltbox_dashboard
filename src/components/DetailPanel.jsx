import { useEffect } from "react";
import homeownerProfiles from "../../data/homeowner-profile-province.json";
import geo from "../../data/ns-fsa-geo.json";
import {
  Cell,
  TierPill,
  NEED_TIER_STYLES,
  SIGNAL_STYLES,
  GAP_STYLES,
  fmtPct,
  fmtNum,
} from "../lib/format.jsx";

// Nova Scotia communities carry their official county (NRCan), which replaces the
// workbook's postal-area region label in the header. Several of those labels name
// the wrong counties; feedback 2026-09-10 said the regions did not match the real map.
const nsPoints = new Map(geo.points.map((p) => [p.community, p]));

function Row({ label, value, pct = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900 tabular-nums">
        <Cell value={value} pct={pct} />
      </span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="border-t border-slate-200 px-5 py-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

export default function DetailPanel({ region, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!region) return null;
  const ep = region.energy_poverty;
  const ra = region.retrofit_activity;
  const officialCounty =
    region.province === "Nova Scotia" ? nsPoints.get(region.community)?.county ?? null : null;
  // Group provincial profile rows by category for display.
  const byCategory = [];
  for (const p of homeownerProfiles) {
    let group = byCategory.find((g) => g.category === p.category);
    if (!group) {
      group = { category: p.category, rows: [] };
      byCategory.push(group);
    }
    group.rows.push(p);
  }

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{region.community}</h2>
            <p className="text-sm text-slate-500">
              {region.municipality && region.municipality !== region.community
                ? `${region.municipality}, `
                : ""}
              {region.province}
              {region.fsa ? ` · FSA ${region.fsa}` : " · postal area not recorded"}
              {region.fsa_catchment ? ` · rural catchment ${region.fsa_catchment}` : ""}
              {officialCounty
                ? ` · ${officialCounty} County`
                : region.region_county
                ? ` · ${region.region_county}`
                : ""}
            </p>
            {region.saltbox_pilot && (
              <p className="mt-1 rounded-md bg-violet-50 px-2 py-1 text-xs text-violet-800">
                Saltbox pilot geography. Speak with Saltbox for more context on this area.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
            aria-label="Close detail panel"
          >
            ✕
          </button>
        </header>

        <Section title="Service gap">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-3xl font-semibold text-slate-900 tabular-nums">
              <Cell value={region.service_gap} />
            </span>
            <TierPill label={region.gap_band?.label ?? null} styles={GAP_STYLES} />
          </div>
          <p className="text-xs text-slate-500">
            How much need is going unserved: underlying need scaled by how little retrofit activity
            is documented as reaching this community.
          </p>

          {region.components && region.activity && (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                What is driving it
              </h4>
              <div className="space-y-1">
                <Row
                  label={`Energy poverty (of ${region.components.max_energy_poverty})`}
                  value={region.components.energy_poverty}
                />
                <Row
                  label={`Major repair (of ${region.components.max_major_repair})`}
                  value={region.components.major_repair}
                />
                <Row
                  label={`Older housing (of ${region.components.max_older_housing})`}
                  value={region.components.older_housing}
                />
                <div className="flex items-baseline justify-between gap-4 border-t border-slate-200 pt-1">
                  <span className="text-sm font-medium text-slate-600">Need without activity</span>
                  <span className="text-sm font-semibold tabular-nums">
                    <Cell value={region.underlying_need} /> / 10
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm text-slate-500">Retrofit activity here</span>
                  <span className="text-sm font-medium text-slate-900">
                    {region.activity.label}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-slate-500">
                {region.activity.gap_points === 3
                  ? "Nothing is documented as reaching this community, so the whole of its need is unserved."
                  : region.activity.gap_points === 0
                  ? "Retrofit delivery is already active here, so the unserved share is small."
                  : `Some delivery is reaching it, so ${region.activity.gap_points} of 3 gap points remain.`}
              </p>
            </div>
          )}

          <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-slate-100 pt-2">
            <span className="text-xs text-slate-500">Saltbox workbook Need Index</span>
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium tabular-nums">
                <Cell value={region.need_score} />
              </span>
              <TierPill label={region.need_tier?.label ?? null} styles={NEED_TIER_STYLES} />
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            The workbook score already folds a retrofit gap into it, which is why it can differ from
            need without activity above.
          </p>
        </Section>

        <Section title="Retrofit activity">
          <div className="flex items-baseline justify-between gap-4 py-1">
            <span className="text-sm text-slate-500">
              {ra.context_is_catchment
                ? `Activity signal, surrounding rural area (${ra.context_fsa})`
                : "Activity signal"}
            </span>
            <TierPill label={ra.fsa_gap_flag?.label ?? null} styles={SIGNAL_STYLES} />
          </div>
          <Row
            label="Retrofits documented in this community"
            value={
              ra.in_der_perf_map === null
                ? null
                : ra.in_der_perf_map
                ? "Yes"
                : "None recorded"
            }
          />
          <Row label="Best performance band recorded here" value={ra.best_performance_band} />
          {ra.context_is_catchment && (
            <p className="mt-1 text-xs text-slate-400">
              Activity shown is for the surrounding rural area, not recorded for this community's
              own postal code ({region.fsa}).
            </p>
          )}
          {!region.fsa && (
            <p className="mt-1 text-xs text-slate-400">
              No postal area is recorded for this community, so area retrofit context is not
              available.
            </p>
          )}
        </Section>

        <Section title="Housing and energy poverty">
          <Row label="Total households" value={ep.total_households} />
          <Row label="Households in energy poverty" value={ep.households_energy_poverty} />
          <Row label="Energy poverty rate" value={ep.ep_rate_pct} pct />
          <Row label="Below poverty line" value={ep.below_poverty_line} />
          <Row label="In core housing need" value={ep.core_housing_need} />
          <Row label="Needing major repair" value={ep.major_repair} />
          <Row label="Major repair rate" value={ep.major_repair_pct} pct />
          <Row label="In older housing (pre-1991)" value={ep.older_housing} />
          <Row label="Older housing rate" value={ep.older_housing_pct} pct />
          <Row label="Households with renters" value={ep.renters} />
          <Row label="Households with seniors" value={ep.seniors} />
        </Section>

        <Section title={`Rural homeowner profile, ${region.province}`}>
          <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Age, income, tenure and period of construction are recorded at the provincial level
            only, not per community.
          </p>
          {byCategory.map((g) => (
            <div key={g.category} className="mb-3">
              <h4 className="mb-1 text-xs font-semibold text-slate-700">{g.category}</h4>
              {g.rows.map((p, i) => {
                const v = p.values[region.province];
                return (
                  <div key={i} className="flex items-baseline justify-between gap-4 py-0.5">
                    <span className="text-xs text-slate-500" title={p.indicator ?? undefined}>
                      {/* A bare "%" or "% of ..." sub-label says nothing; the indicator does. */}
                      {!p.sub_indicator || p.sub_indicator.startsWith("%")
                        ? p.indicator
                        : p.sub_indicator}
                    </span>
                    <span className="text-xs font-medium text-slate-900 tabular-nums">
                      {v === null ? (
                        <span className="text-slate-400 cursor-help" title="not recorded">–</span>
                      ) : p.unit === "percent" ? (
                        fmtPct(v)
                      ) : (
                        fmtNum(v)
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </Section>
      </aside>
    </div>
  );
}
