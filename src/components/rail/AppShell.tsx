import { Link } from "@tanstack/react-router";
import {
  Activity,
  AudioWaveform,
  BrainCircuit,
  FlaskConical,
  Gauge,
  Pause,
  Play,
  Radar,
  RadioTower,
  TrainFront,
  Zap,
} from "lucide-react";
import { WEATHER_PRESETS } from "@/lib/rail/data";
import { clockOf } from "@/lib/rail/format";
import { useRail } from "@/lib/rail/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Command Center", icon: Radar, hint: "Live corridor" },
  { to: "/trains", label: "Train Control", icon: TrainFront, hint: "Roster & ETA" },
  { to: "/simulator", label: "What-If Lab", icon: FlaskConical, hint: "Scenario runs" },
  { to: "/analytics", label: "Analytics", icon: Gauge, hint: "Corridor KPIs" },
  { to: "/events", label: "Event Stream", icon: AudioWaveform, hint: "Audit log" },
] as const;

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3 group">
      <span className="relative grid size-10 place-items-center rounded-lg bg-primary/12 border border-primary/35">
        <RadioTower className="size-5 text-primary" />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-signal-go animate-pulse" />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-semibold tracking-tight">
          Rail<span className="text-primary">Pulse</span> AI
        </span>
        <span className="mono-num block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          SIH028 · Corridor NGP–EST
        </span>
      </span>
    </Link>
  );
}

function LiveControls() {
  const { state, dispatch } = useRail();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="panel-surface flex items-center gap-2 rounded-md px-2.5 py-1.5">
        <span
          className={cn(
            "size-2 rounded-full",
            state.live ? "bg-signal-go animate-pulse" : "bg-signal-caution",
          )}
        />
        <span className="mono-num text-xs text-muted-foreground">
          {state.live ? "LIVE" : "PAUSED"} · {clockOf(state.nowMin)} IST
        </span>
      </div>

      <button
        type="button"
        onClick={() => dispatch({ type: "toggleLive" })}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
          state.live
            ? "border-signal-caution/40 bg-signal-caution/10 text-signal-caution hover:bg-signal-caution/20"
            : "border-signal-go/40 bg-signal-go/10 text-signal-go hover:bg-signal-go/20",
        )}
      >
        {state.live ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        {state.live ? "Pause feed" : "Resume feed"}
      </button>

      <div className="panel-surface flex items-center rounded-md p-0.5">
        {[1, 2, 4, 8].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => dispatch({ type: "setSpeed", speed: s })}
            className={cn(
              "mono-num rounded px-2 py-1 text-xs transition-colors",
              state.speed === s
                ? "bg-primary/18 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s}x
          </button>
        ))}
      </div>

      <select
        value={state.weather.label}
        onChange={(e) => {
          const w = WEATHER_PRESETS.find((p) => p.label === e.target.value);
          if (w) dispatch({ type: "setWeather", weather: w });
        }}
        className="panel-surface rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
        aria-label="Corridor weather"
      >
        {WEATHER_PRESETS.map((w) => (
          <option key={w.label} value={w.label} className="bg-popover">
            {w.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => dispatch({ type: "injectIncident" })}
        className="inline-flex items-center gap-1.5 rounded-md border border-signal-stop/40 bg-signal-stop/10 px-3 py-1.5 text-xs font-medium text-signal-stop transition-colors hover:bg-signal-stop/20"
      >
        <Zap className="size-3.5" /> Inject incident
      </button>

      <button
        type="button"
        onClick={() => dispatch({ type: "toggleDemo" })}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
          state.demoMode
            ? "border-primary/50 bg-primary/18 text-primary glow-primary"
            : "border-border bg-panel text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={state.demoMode}
      >
        <BrainCircuit className="size-3.5" />
        Demo mode {state.demoMode ? "ON" : "OFF"}
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { kpis, state } = useRail();

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 control-grid opacity-[0.35]" aria-hidden />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)]"
        aria-hidden
      />

      <div className="relative flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar/80 px-4 py-5 backdrop-blur lg:flex">
          <Brand />
          <nav className="mt-8 flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-primary/12 data-[status=active]:text-primary"
              >
                <item.icon className="size-4" />
                <span className="flex-1 leading-tight">
                  {item.label}
                  <span className="block text-[10px] uppercase tracking-wider opacity-60">
                    {item.hint}
                  </span>
                </span>
              </Link>
            ))}
          </nav>

          <div className="panel-surface mt-auto rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="size-3.5 text-primary" /> Section health
            </div>
            <dl className="mono-num mt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Punctuality</dt>
                <dd className="text-signal-go">{kpis.punctuality.toFixed(0)}%</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Avg. delay</dt>
                <dd className="text-signal-caution">{kpis.avgDelay.toFixed(1)} min</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Conflict blocks</dt>
                <dd className="text-signal-warn">{kpis.conflicts}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Actions accepted</dt>
                <dd className="text-primary">{kpis.recovered}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              Engine: RailPulse Heuristic v3 · tick {state.tick} · {state.trains.length} services
              under control.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
              <div className="lg:hidden">
                <Brand />
              </div>
              <LiveControls />
            </div>
            <nav className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 lg:hidden">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.to === "/" }}
                  className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground data-[status=active]:bg-primary/12 data-[status=active]:text-primary"
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <main className="min-w-0 flex-1 px-4 py-5 lg:px-6 lg:py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
