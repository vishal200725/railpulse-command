import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiStrip } from "@/components/rail/KpiStrip";
import { SECTIONS, TYPE_LABEL, type TrainType } from "@/lib/rail/data";
import { useRail } from "@/lib/rail/store";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Corridor Analytics — RailPulse AI" },
      {
        name: "description",
        content:
          "Punctuality, average delay, throughput and conflict trends across the RailPulse corridor, with per-section congestion and delay by service class.",
      },
      { property: "og:title", content: "Corridor Analytics — RailPulse AI" },
      {
        property: "og:description",
        content: "Rolling punctuality, throughput and congestion analytics for the live corridor.",
      },
    ],
  }),
  component: AnalyticsPage,
});

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

function AnalyticsPage() {
  const { state, predictions } = useRail();

  const byType = (["express", "superfast", "passenger", "freight", "suburban"] as TrainType[])
    .map((type) => {
      const trains = state.trains.filter((t) => t.type === type);
      if (!trains.length) return null;
      const avg =
        trains.reduce((s, t) => s + (predictions[t.id]?.predictedDelayMin ?? t.delayMin), 0) /
        trains.length;
      return { name: TYPE_LABEL[type], avg: Math.round(avg * 10) / 10, count: trains.length };
    })
    .filter((x): x is { name: string; avg: number; count: number } => x !== null);

  const congestion = SECTIONS.map((s) => ({
    id: s.id,
    load: Math.round((state.congestion[s.id] ?? 0) * 100),
  })).sort((a, b) => b.load - a.load);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Corridor Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rolling 4-hour window, recomputed each simulation tick from the same state the controller
          screens use.
        </p>
      </div>

      <KpiStrip />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel-surface rounded-xl p-4">
          <h2 className="font-display text-sm font-semibold">Punctuality vs average delay</h2>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={state.kpiHistory}>
                <defs>
                  <linearGradient id="punct" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--signal-go)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--signal-go)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--grid-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="punctuality"
                  name="Punctuality %"
                  stroke="var(--signal-go)"
                  fill="url(#punct)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="avgDelay"
                  name="Avg delay (min)"
                  stroke="var(--signal-warn)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel-surface rounded-xl p-4">
          <h2 className="font-display text-sm font-semibold">Throughput &amp; conflicts</h2>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={state.kpiHistory}>
                <CartesianGrid stroke="var(--grid-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="throughput"
                  name="Trains cleared"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="conflicts"
                  name="Conflicts"
                  stroke="var(--signal-stop)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel-surface rounded-xl p-4">
          <h2 className="font-display text-sm font-semibold">Predicted delay by service class</h2>
          <div className="mt-3 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType}>
                <CartesianGrid stroke="var(--grid-line)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" unit="m" />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="avg" name="Avg predicted delay" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel-surface rounded-xl p-4">
          <h2 className="font-display text-sm font-semibold">Section occupancy pressure</h2>
          <div className="mt-3 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={congestion} layout="vertical">
                <CartesianGrid stroke="var(--grid-line)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" unit="%" />
                <YAxis
                  type="category"
                  dataKey="id"
                  width={70}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="load" name="Occupancy" fill="var(--signal-caution)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
