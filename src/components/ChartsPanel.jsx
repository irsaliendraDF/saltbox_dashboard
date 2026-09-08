import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  ReferenceArea,
  Tooltip,
  ResponsiveContainer,
  Cell as ChartCell,
} from "recharts";
import { PROVINCE_COLORS, PROVINCE_SHORT, GAP_FILL, fmtPct } from "../lib/format.jsx";

// x axis: how much retrofit activity is documented as reaching the community.
// Bands are the Saltbox workbook's own (Need Index methodology, sub-score 2),
// so the axis is defensible from KJ's own source rather than invented here.
const ACTIVITY_STEPS = ["None documented", "Very low", "Low", "Active"];

function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-slate-900">
        {d.community} ({PROVINCE_SHORT[d.province]})
      </div>
      <div className="mt-0.5 text-slate-900">
        Service gap <span className="font-semibold">{d.gap}</span> · {d.band}
      </div>
      <div className="text-slate-600">Need without activity: {d.need}</div>
      <div className="text-slate-600">Retrofit activity here: {d.activityLabel}</div>
      <div className="text-slate-600">Energy poverty {fmtPct(d.ep) ?? "not recorded"}</div>
    </div>
  );
}

function BarTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-slate-900">
        {d.community} ({PROVINCE_SHORT[d.province]})
      </div>
      <div className="text-slate-600">Service gap {d.gap} · {d.band}</div>
      <div className="text-slate-600">Energy poverty {fmtPct(d.ep)}</div>
      <div className="text-slate-600">
        {d.epHouseholds?.toLocaleString("en-CA")} of {d.totalHouseholds?.toLocaleString("en-CA")}{" "}
        households
      </div>
    </div>
  );
}

export default function ChartsPanel({ regions }) {
  // A small deterministic jitter spreads communities sharing a coordinate.
  const scatterData = regions
    .filter((r) => r.underlying_need !== null && r.activity !== null)
    .map((r, i) => ({
      community: r.community,
      province: r.province,
      need: r.underlying_need,
      gap: r.service_gap,
      band: r.gap_band?.label ?? "–",
      activityLabel: r.activity.label,
      x: ACTIVITY_STEPS.indexOf(r.activity.label) + ((i % 7) - 3) * 0.045,
      ep: r.energy_poverty.ep_rate_pct,
    }));

  // Communities with no activity record cannot be placed on the activity axis
  // without implying a value they do not have, so they are counted, not plotted.
  const notPlotted = regions.filter(
    (r) => r.underlying_need !== null && r.activity === null
  ).length;

  const topGap = [...regions]
    .filter((r) => r.service_gap !== null)
    .sort((a, b) => b.service_gap - a.service_gap)
    .slice(0, 15)
    .map((r) => ({
      community: r.community,
      province: r.province,
      gap: r.service_gap,
      band: r.gap_band?.label ?? "–",
      ep: r.energy_poverty.ep_rate_pct,
      epHouseholds: r.energy_poverty.households_energy_poverty,
      totalHouseholds: r.energy_poverty.total_households,
    }));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Need against the retrofit activity reaching each community
        </h2>
        <p className="mb-2 text-xs text-slate-500">
          One point per community, coloured by service gap.{" "}
          <span className="font-medium text-slate-700">
            The shaded corner is the answer to the question: high need, and nothing documented as
            reaching them yet.
          </span>{" "}
          Points to the right are communities retrofit programmes are already serving.
        </p>
        {scatterData.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            No communities in this filter have activity data to chart.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <ScatterChart margin={{ top: 12, right: 24, bottom: 12, left: -4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              {/* The high-need, no-activity quadrant: the investment argument. */}
              <ReferenceArea
                x1={-0.5}
                x2={0.5}
                y1={5}
                y2={10}
                fill="#be123c"
                fillOpacity={0.07}
                stroke="#be123c"
                strokeOpacity={0.25}
                strokeDasharray="4 4"
              />
              <XAxis
                type="number"
                dataKey="x"
                domain={[-0.5, 3.5]}
                ticks={[0, 1, 2, 3]}
                tickFormatter={(v) => ACTIVITY_STEPS[v] ?? ""}
                tick={{ fontSize: 11 }}
                height={44}
                label={{
                  value: "Deep retrofit activity documented in the community (2020–2023)",
                  position: "insideBottom",
                  offset: -2,
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="need"
                domain={[0, 10]}
                tick={{ fontSize: 11 }}
                label={{
                  value: "Need without activity",
                  angle: -90,
                  position: "insideLeft",
                  offset: 16,
                  fontSize: 11,
                }}
              />
              <ZAxis range={[70, 70]} />
              <Tooltip content={<ScatterTip />} />
              <Scatter data={scatterData} isAnimationActive={false}>
                {scatterData.map((d, i) => (
                  <ChartCell
                    key={`${d.community}|${d.province}|${i}`}
                    fill={GAP_FILL[d.band] ?? "#94a3b8"}
                    fillOpacity={0.85}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
        {notPlotted > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            {notPlotted} {notPlotted === 1 ? "community is" : "communities are"} not plotted:
            retrofit activity is not recorded for them, which is not the same as none happening.
            They are in the table below.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Largest service gaps</h2>
        <p className="mb-2 text-xs text-slate-500">
          Top 15 of the current filter, highest gap first.
        </p>
        {topGap.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">No communities to chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={topGap} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="community"
                width={130}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <Tooltip content={<BarTip />} />
              <Bar dataKey="gap" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                {topGap.map((d) => (
                  <ChartCell
                    key={`${d.community}|${d.province}`}
                    fill={GAP_FILL[d.band] ?? PROVINCE_COLORS[d.province]}
                    fillOpacity={0.9}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
