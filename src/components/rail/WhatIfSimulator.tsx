import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FlaskConical, RotateCcw, Save, Sparkles } from "lucide-react";
import { SECTIONS, WEATHER_PRESETS, type Train } from "@/lib/rail/data";
import { predictEta, type EtaContext } from "@/lib/rail/eta";
import { buildPropagation } from "@/lib/rail/propagation";
import { signedMin } from "@/lib/rail/format";
import { useRail } from "@/lib/rail/store";
import { cn } from "@/lib/utils";

interface Scenario {
  trainId: string;
  addedDelay: number;
  holdMinutes: number;
  weatherLabel: string;
  blocked: string[];
  priorityBoost: boolean;
}

export function WhatIfSimulator({ initialTrain }: { initialTrain?: string }) {
  const { state, ctx, predictions, dispatch } = useRail();

  const defaultTrain =
    state.trains.find((t) => t.number === initialTrain)?.id ?? state.trains[0]?.id ?? "";

  const [scenario, setScenario] = React.useState<Scenario>({
    trainId: defaultTrain,
    addedDelay: 15,
    holdMinutes: 0,
    weatherLabel: state.weather.label,
    blocked: [],
    priorityBoost: false,
  });

  const set = <K extends keyof Scenario>(key: K, value: Scenario[K]) =>
    setScenario((s) => ({ ...s, [key]: value }));

  const target = state.trains.find((t) => t.id === scenario.trainId);

  const scenarioCtx: EtaContext = React.useMemo(() => {
    const weather = WEATHER_PRESETS.find((w) => w.label === scenario.weatherLabel) ?? state.weather;
    const trains: Train[] = state.trains.map((t) => {
      if (t.id !== scenario.trainId) return t;
      return {
        ...t,
        delayMin: t.delayMin + scenario.addedDelay,
        priority: scenario.priorityBoost ? Math.max(1, t.priority - 3) : t.priority,
      };
    });
    return {
      ...ctx,
      trains,
      weather,
      blockedSections: [...(ctx.blockedSections ?? []), ...scenario.blocked],
      holds: { ...(ctx.holds ?? {}), ...(scenario.holdMinutes ? { [scenario.trainId]: scenario.holdMinutes } : {}) },
    };
  }, [ctx, scenario, state.trains, state.weather]);

  const comparison = React.useMemo(() => {
    return scenarioCtx.trains
      .map((t) => {
        const base = predictions[t.id]?.predictedDelayMin ?? 0;
        const next = predictEta(t, scenarioCtx).predictedDelayMin;
        return { number: t.number, base, next, delta: Math.round((next - base) * 10) / 10 };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [scenarioCtx, predictions]);

  const totals = React.useMemo(() => {
    const base = comparison.reduce((s, c) => s + c.base, 0);
    const next = comparison.reduce((s, c) => s + c.next, 0);
    const worse = comparison.filter((c) => c.delta > 0.5).length;
    const better = comparison.filter((c) => c.delta < -0.5).length;
    return { base, next, delta: next - base, worse, better };
  }, [comparison]);

  const cascade = React.useMemo(() => {
    const t = scenarioCtx.trains.find((x) => x.id === scenario.trainId);
    return t ? buildPropagation(t, scenarioCtx, scenario.addedDelay || 6) : null;
  }, [scenarioCtx, scenario.trainId, scenario.addedDelay]);

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="panel-surface rounded-xl p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          <FlaskConical className="size-4 text-primary" /> Scenario Controls
        </h2>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Every change re-runs the ETA engine across all {state.trains.length} services instantly —
          nothing is applied to the live corridor until you commit it.
        </p>

        <label className="mt-4 block text-[11px] uppercase tracking-wider text-muted-foreground">
          Subject train
        </label>
        <select
          value={scenario.trainId}
          onChange={(e) => set("trainId", e.target.value)}
          className="mt-1.5 w-full rounded-md border border-border bg-panel px-2.5 py-2 text-xs outline-none focus:ring-1 focus:ring-ring"
        >
          {state.trains.map((t) => (
            <option key={t.id} value={t.id}>
              {t.number} · {t.name}
            </option>
          ))}
        </select>

        <label className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          Injected delay <span className="mono-num text-primary">+{scenario.addedDelay} min</span>
        </label>
        <input
          type="range"
          min={0}
          max={90}
          step={1}
          value={scenario.addedDelay}
          onChange={(e) => set("addedDelay", Number(e.target.value))}
          className="mt-2 w-full accent-[var(--primary)]"
        />

        <label className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          Controller hold <span className="mono-num text-signal-caution">{scenario.holdMinutes} min</span>
        </label>
        <input
          type="range"
          min={0}
          max={45}
          step={1}
          value={scenario.holdMinutes}
          onChange={(e) => set("holdMinutes", Number(e.target.value))}
          className="mt-2 w-full accent-[var(--signal-caution)]"
        />

        <label className="mt-4 block text-[11px] uppercase tracking-wider text-muted-foreground">
          Weather scenario
        </label>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {WEATHER_PRESETS.map((w) => (
            <button
              key={w.label}
              type="button"
              onClick={() => set("weatherLabel", w.label)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-[11px] transition-colors",
                scenario.weatherLabel === w.label
                  ? "border-primary/50 bg-primary/12 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {w.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-[11px] uppercase tracking-wider text-muted-foreground">
          Engineering blocks
        </label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => {
            const on = scenario.blocked.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  set(
                    "blocked",
                    on ? scenario.blocked.filter((b) => b !== s.id) : [...scenario.blocked, s.id],
                  )
                }
                className={cn(
                  "mono-num rounded border px-1.5 py-1 text-[10px] transition-colors",
                  on
                    ? "border-signal-stop/50 bg-signal-stop/12 text-signal-stop"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s.id}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => set("priorityBoost", !scenario.priorityBoost)}
          className={cn(
            "mt-4 flex w-full items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors",
            scenario.priorityBoost
              ? "border-signal-go/45 bg-signal-go/10 text-signal-go"
              : "border-border text-muted-foreground",
          )}
        >
          Grant absolute precedence to {target?.number ?? "subject"}
          <span className="mono-num">{scenario.priorityBoost ? "ON" : "OFF"}</span>
        </button>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              const w = WEATHER_PRESETS.find((x) => x.label === scenario.weatherLabel);
              if (w) dispatch({ type: "setWeather", weather: w });
              scenario.blocked
                .filter((b) => !state.blockedSections.includes(b))
                .forEach((b) => dispatch({ type: "toggleBlock", sectionId: b }));
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary/18 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/28"
          >
            <Save className="size-3.5" /> Commit to live corridor
          </button>
          <button
            type="button"
            onClick={() =>
              setScenario({
                trainId: defaultTrain,
                addedDelay: 15,
                holdMinutes: 0,
                weatherLabel: state.weather.label,
                blocked: [],
                priorityBoost: false,
              })
            }
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3.5" /> Reset
          </button>
        </div>
      </section>

      <div className="space-y-4">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            {
              label: "Baseline network delay",
              value: `${totals.base.toFixed(0)}m`,
              tone: "text-foreground",
            },
            {
              label: "Scenario network delay",
              value: `${totals.next.toFixed(0)}m`,
              tone: totals.delta > 0 ? "text-signal-stop" : "text-signal-go",
            },
            {
              label: "Net change",
              value: `${totals.delta > 0 ? "+" : ""}${totals.delta.toFixed(1)}m`,
              tone: totals.delta > 0 ? "text-signal-warn" : "text-signal-go",
            },
            {
              label: "Trains worse / better",
              value: `${totals.worse} / ${totals.better}`,
              tone: "text-primary",
            },
          ].map((k) => (
            <div key={k.label} className="panel-surface rounded-lg p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <p className={cn("mono-num mt-1 text-2xl font-semibold", k.tone)}>{k.value}</p>
            </div>
          ))}
        </section>

        <section className="panel-surface rounded-xl p-4">
          <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Per-service impact (Δ predicted delay)
          </h3>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison}>
                <CartesianGrid stroke="var(--grid-line)" vertical={false} />
                <XAxis
                  dataKey="number"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  unit="m"
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v} min`, "Δ delay"]}
                />
                <Bar dataKey="delta" radius={[3, 3, 0, 0]}>
                  {comparison.map((c) => (
                    <Cell
                      key={c.number}
                      fill={c.delta > 0.5 ? "var(--signal-stop)" : c.delta < -0.5 ? "var(--signal-go)" : "var(--muted-foreground)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {cascade && (
          <section className="panel-surface rounded-xl p-4">
            <h3 className="font-display text-sm font-semibold">
              Scenario cascade from {target?.number}
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {cascade.nodes.length} services inherit delay · {cascade.totalNetworkMin} network min ·{" "}
              {(cascade.passengersAffected / 1000).toFixed(1)}k passengers exposed
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="pb-2">Train</th>
                    <th className="pb-2">Wave</th>
                    <th className="pb-2">Inherited</th>
                    <th className="pb-2">Via</th>
                    <th className="pb-2">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cascade.nodes.slice(0, 8).map((n) => (
                    <tr key={n.trainId}>
                      <td className="mono-num py-2 text-primary">{n.number}</td>
                      <td className="mono-num py-2">{n.level}</td>
                      <td className="mono-num py-2 text-signal-warn">{signedMin(n.inheritedMin)}</td>
                      <td className="mono-num py-2 text-muted-foreground">{n.viaSection}</td>
                      <td className="py-2 text-muted-foreground">{n.reason}</td>
                    </tr>
                  ))}
                  {!cascade.nodes.length && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted-foreground">
                        This scenario stays contained — no downstream service inherits delay.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
