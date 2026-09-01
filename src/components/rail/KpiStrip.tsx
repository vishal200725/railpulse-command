import { AlertTriangle, CheckCircle2, Clock, Layers, TrainFront, Users } from "lucide-react";
import { useRail } from "@/lib/rail/store";
import { cn } from "@/lib/utils";

interface Kpi {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  fill: number;
}

export function KpiStrip() {
  const { kpis, state } = useRail();

  const items: Kpi[] = [
    {
      label: "Punctuality",
      value: `${kpis.punctuality.toFixed(0)}%`,
      sub: "services within +5 min",
      icon: CheckCircle2,
      tone: "text-signal-go",
      fill: kpis.punctuality / 100,
    },
    {
      label: "Predicted avg delay",
      value: `${kpis.avgDelay.toFixed(1)}m`,
      sub: "model horizon to destination",
      icon: Clock,
      tone: "text-signal-caution",
      fill: Math.min(1, kpis.avgDelay / 45),
    },
    {
      label: "Services live",
      value: String(kpis.active),
      sub: `${state.trains.filter((t) => t.status === "held" || t.status === "dwell").length} regulated / dwelling`,
      icon: TrainFront,
      tone: "text-primary",
      fill: kpis.active / state.trains.length,
    },
    {
      label: "At-risk trains",
      value: String(kpis.atRisk),
      sub: "delay > 15 min projected",
      icon: AlertTriangle,
      tone: "text-signal-warn",
      fill: kpis.atRisk / state.trains.length,
    },
    {
      label: "Conflict blocks",
      value: String(kpis.conflicts),
      sub: "sections above 55% occupancy",
      icon: Layers,
      tone: "text-signal-stop",
      fill: kpis.conflicts / 14,
    },
    {
      label: "Passengers in motion",
      value: `${(kpis.passengers / 1000).toFixed(1)}k`,
      sub: `${kpis.recovered} AI actions accepted`,
      icon: Users,
      tone: "text-track-suburban",
      fill: Math.min(1, kpis.passengers / 90000),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((k) => (
        <div key={k.label} className="panel-surface rounded-lg p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {k.label}
            </span>
            <k.icon className={cn("size-4", k.tone)} />
          </div>
          <p className={cn("mono-num mt-2 text-2xl font-semibold", k.tone)}>{k.value}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{k.sub}</p>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full bg-current transition-all duration-700", k.tone)}
              style={{ width: `${Math.max(4, Math.min(100, k.fill * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
