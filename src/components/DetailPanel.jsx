import { useEffect } from "react";
import homeownerProfiles from "../../data/homeowner-profile-province.json";
import {
  Cell,
  TierPill,
  NEED_TIER_STYLES,
  SIGNAL_STYLES,
  fmtPct,
  fmtNum,
} from "../lib/format.jsx";

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
              {region.region_county ? ` · ${region.region_county}` : ""}
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

        <Section title="Need">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-3xl font-semibold text-slate-900 tabular-nums">
              <Cell value={region.need_score} />
            </span>
            <TierPill label={region.need_tier?.label ?? null} styles={NEED_TIER_STYLES} />
          </div>
          <p className="text-xs text-slate-500">
            Need score out of 10: energy poverty rate, retrofit gap, major repair rate and older
            housing rate combined. Methodology lives in the Saltbox workbook.
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
