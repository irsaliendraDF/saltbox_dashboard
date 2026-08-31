import {
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell as ChartCell,
} from "recharts";
import { PROVINCES, PROVINCE_COLORS, PROVINCE_SHORT, fmtPct } from "../lib/format.jsx";

const SIGNAL_ORDER = ["Zero activity", "Very low", "Low", "Moderate", "Active", "High"];

// A filled dot means retrofits are documented in the community itself. A hollow
// ring means none are, whatever the surrounding area shows. Hollow rings high on
// the need axis are the investment argument, and they would be invisible if the
// x position (an area-level signal) were the only thing drawn.
function DotShape(props) {
  const { cx, cy, fill, payload } = props;
  if (cx === null || cy === null || cx === undefined || cy === undefined) return null;
  if (payload.documented === true) {
    return <circle cx={cx} cy={cy} r={5} fill={fill} fillOpacity={0.75} />;
  }
  return (
    <circle cx={cx} cy={cy} r={5} fill="#fff" stroke={fill} strokeWidth={2} />
  );
}

function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-slate-900">
        {d.community} ({PROVINCE_SHORT[d.province]})
      </div>
      <div className="text-slate-600">Need score {d.need_score}</div>
      <div className="text-slate-600">
        {d.documented === true
          ? "Retrofits documented in this community"
          : d.documented === false
          ? "No retrofits documented in this community"
          : "Community activity not recorded"}
      </div>
      <div className="text-slate-600">Surrounding area signal: {d.signalLabel}</div>
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
      <div className="text-slate-600">Energy poverty {fmtPct(d.ep)}</div>
      <div className="text-slate-600">
        {d.epHouseholds?.toLocaleString("en-CA")} of {d.totalHouseholds?.toLocaleString("en-CA")} households
      </div>
    </div>
  );
}

export default function ChartsPanel({ regions }) {
  // Actual retrofit counts are internal, so the x-axis is the activity signal.
  // A small deterministic jitter spreads communities sharing a (signal, score) spot.
  const scatterData = regions
    .filter((r) => r.need_score !== null && r.retrofit_activity.fsa_gap_flag !== null)
    .map((r, i) => ({
      community: r.community,
      province: r.province,
      need_score: r.need_score,
      signal: r.retrofit_activity.fsa_gap_flag.ordinal + ((i % 7) - 3) * 0.06,
      signalLabel: r.retrofit_activity.fsa_gap_flag.label,
      documented: r.retrofit_activity.in_der_perf_map,
      ep: r.energy_poverty.ep_rate_pct,
    }));

  // Communities whose area has no activity data cannot be placed on this axis
  // without implying a value they do not have. They are named below the chart
  // rather than dropped silently, and they are all still in the table.
  const notPlotted = regions.filter(
    (r) => r.need_score !== null && r.retrofit_activity.fsa_gap_flag === null
  ).length;

  const barData = regions
    .filter((r) => r.energy_poverty.ep_rate_pct !== null)
    .sort((a, b) => b.energy_poverty.ep_rate_pct - a.energy_poverty.ep_rate_pct)
    .slice(0, 15)
    .map((r) => ({
      community: r.community,
      province: r.province,
      ep: r.energy_poverty.ep_rate_pct,
      epHouseholds: r.energy_poverty.households_energy_poverty,
      totalHouseholds: r.energy_poverty.total_households,
    }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Need vs activity signal</h2>
        <p className="mb-2 text-xs text-slate-500">
          One point per community, placed by the activity signal for its surrounding area.
          <span className="font-medium text-slate-700"> Hollow rings have no retrofits documented
          in the community itself</span>, so a high ring on the right means the work is happening
          nearby but not reaching that community. That is the investment argument.
        </p>
        {scatterData.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            No communities in this filter have area activity data to chart.
            {notPlotted > 0 && ` ${notPlotted} are listed in the table above.`}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="signal"
                name="Activity signal"
                domain={[-0.5, 5.5]}
                ticks={[0, 1, 2, 3, 4, 5]}
                tickFormatter={(v) => SIGNAL_ORDER[v] ?? ""}
                tick={{ fontSize: 10 }}
                label={{ value: "Documented retrofit activity in the surrounding area (2020–2023)", position: "insideBottom", offset: -4, fontSize: 10 }}
                height={40}
              />
              <YAxis
                type="number"
                dataKey="need_score"
                name="Need score"
                domain={[0, 10]}
                tick={{ fontSize: 11 }}
                label={{ value: "Need score", angle: -90, position: "insideLeft", offset: 16, fontSize: 11 }}
              />
              <ZAxis range={[45, 45]} />
              <Tooltip content={<ScatterTip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {PROVINCES.map((p) => (
                <Scatter
                  key={p}
                  name={PROVINCE_SHORT[p]}
                  data={scatterData.filter((d) => d.province === p)}
                  fill={PROVINCE_COLORS[p]}
                  shape={DotShape}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        )}
        {notPlotted > 0 && (
          <p className="mt-1 text-xs text-slate-400">
            {notPlotted} {notPlotted === 1 ? "community is" : "communities are"} not plotted: no
            retrofit activity data exists for their postal area, which is not the same as none
            happening. They are in the table above.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Energy poverty rate, highest first</h2>
        <p className="mb-2 text-xs text-slate-500">Top 15 of the current filter.</p>
        {barData.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">No communities to chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
              <YAxis
                type="category"
                dataKey="community"
                width={110}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <Tooltip content={<BarTip />} />
              <Bar dataKey="ep" radius={[0, 3, 3, 0]}>
                {barData.map((d) => (
                  <ChartCell key={`${d.community}|${d.province}`} fill={PROVINCE_COLORS[d.province]} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
