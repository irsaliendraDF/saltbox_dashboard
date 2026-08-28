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

function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-slate-900">
        {d.community} ({PROVINCE_SHORT[d.province]})
      </div>
      <div className="text-slate-600">Need score {d.need_score}</div>
      <div className="text-slate-600">Deep retrofits recorded: {d.ders}</div>
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
  const scatterData = regions
    .filter((r) => r.need_score !== null && r.retrofit_activity.der_records_here !== null)
    .map((r) => ({
      community: r.community,
      province: r.province,
      need_score: r.need_score,
      ders: r.retrofit_activity.der_records_here,
      ep: r.energy_poverty.ep_rate_pct,
    }));

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
        <h2 className="text-sm font-semibold text-slate-900">Need vs retrofit activity</h2>
        <p className="mb-2 text-xs text-slate-500">
          One point per community. Top left is the market validation story: high need, little activity yet.
        </p>
        {scatterData.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">No communities to chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                type="number"
                dataKey="ders"
                name="Deep retrofits recorded"
                tick={{ fontSize: 11 }}
                label={{ value: "Deep retrofits recorded (2020–2023)", position: "insideBottom", offset: -4, fontSize: 11 }}
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
                  fillOpacity={0.75}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
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
