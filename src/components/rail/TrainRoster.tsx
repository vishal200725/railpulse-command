import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Search } from "lucide-react";
import { TYPE_LABEL, routeAt, station, type TrainType } from "@/lib/rail/data";
import { TONE_BG, TYPE_COLOR, clockOf, delayTone, durationOf, signedMin } from "@/lib/rail/format";
import { useRail } from "@/lib/rail/store";
import { cn } from "@/lib/utils";

type RiskFilter = "all" | "at-risk" | "on-time";
type Sort = "risk" | "eta" | "number";

const TYPES: Array<TrainType | "all"> = [
  "all",
  "superfast",
  "express",
  "suburban",
  "passenger",
  "freight",
  "special",
];

export function TrainRoster({ limit }: { limit?: number }) {
  const { state, predictions, dispatch } = useRail();
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState<TrainType | "all">("all");
  const [risk, setRisk] = React.useState<RiskFilter>("all");
  const [sort, setSort] = React.useState<Sort>("risk");

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = state.trains.filter((t) => {
      const pred = predictions[t.id];
      if (type !== "all" && t.type !== type) return false;
      if (risk === "at-risk" && (pred?.predictedDelayMin ?? 0) <= 15) return false;
      if (risk === "on-time" && (pred?.predictedDelayMin ?? 0) > 5) return false;
      if (!q) return true;
      return (
        t.number.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.route.some((r) => r.toLowerCase().includes(q))
      );
    });
    list = list.slice().sort((a, b) => {
      if (sort === "number") return a.number.localeCompare(b.number);
      if (sort === "eta") return (predictions[a.id]?.etaMin ?? 0) - (predictions[b.id]?.etaMin ?? 0);
      return (predictions[b.id]?.predictedDelayMin ?? 0) - (predictions[a.id]?.predictedDelayMin ?? 0);
    });
    return limit ? list.slice(0, limit) : list;
  }, [state.trains, predictions, query, type, risk, sort, limit]);

  return (
    <section className="panel-surface flex min-h-0 flex-col overflow-hidden rounded-xl">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold">Service Roster</h2>
          <p className="text-[11px] text-muted-foreground">
            {rows.length} of {state.trains.length} services · sorted by{" "}
            {sort === "risk" ? "delay risk" : sort === "eta" ? "arrival time" : "train number"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 12951, Shatabdi, MTP…"
              className="w-48 rounded-md border border-border bg-panel py-1.5 pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground/70 focus:ring-1 focus:ring-ring"
            />
          </label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-md border border-border bg-panel px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
            aria-label="Sort roster"
          >
            <option value="risk">Delay risk</option>
            <option value="eta">Arrival time</option>
            <option value="number">Train number</option>
          </select>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
              type === t
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "all" ? "All types" : TYPE_LABEL[t]}
          </button>
        ))}
        <span className="mx-1 w-px bg-border" />
        {(["all", "at-risk", "on-time"] as RiskFilter[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRisk(r)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
              risk === r
                ? "border-signal-caution/50 bg-signal-caution/12 text-signal-caution"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {r === "all" ? "Any risk" : r === "at-risk" ? "At risk" : "Right time"}
          </button>
        ))}
      </div>

      <div className="max-h-[560px] divide-y divide-border overflow-y-auto">
        {rows.map((t) => {
          const pred = predictions[t.id];
          const tone = delayTone(pred?.predictedDelayMin ?? t.delayMin);
          const dest = station(routeAt(t.route, t.route.length - 1));
          const next = station(routeAt(t.route, t.legIndex + 1));
          const selected = state.selectedTrainId === t.id;
          return (
            <div
              key={t.id}
              onMouseEnter={() => dispatch({ type: "select", trainId: t.id })}
              className={cn(
                "group grid grid-cols-2 gap-2 px-4 py-3 transition-colors md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] md:items-center",
                selected ? "bg-primary/[0.07]" : "hover:bg-panel-raised/60",
              )}
            >
              <div className="col-span-2 min-w-0 md:col-span-1">
                <div className="flex items-center gap-2">
                  <span className="mono-num text-sm text-primary">{t.number}</span>
                  <span
                    className={cn(
                      "rounded border border-current/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                      TYPE_COLOR[t.type],
                    )}
                  >
                    {TYPE_LABEL[t.type]}
                  </span>
                  {t.status !== "running" && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {t.status}
                    </span>
                  )}
                </div>
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="mono-num text-[11px] text-muted-foreground">
                  {station(routeAt(t.route, 0)).code} → {dest.code} · next {next.code}
                </p>
              </div>

              <div className="mono-num text-[11px]">
                <span className="block text-muted-foreground">Delay</span>
                <span className={cn("text-sm", TONE_BG[tone].split(" ")[1])}>
                  {signedMin(pred?.predictedDelayMin ?? 0)}
                </span>
              </div>
              <div className="mono-num text-[11px]">
                <span className="block text-muted-foreground">ETA {dest.code}</span>
                <span className="text-sm text-foreground">{clockOf(pred?.etaMin ?? 0)}</span>
              </div>
              <div className="mono-num text-[11px]">
                <span className="block text-muted-foreground">Run left</span>
                <span className="text-sm text-foreground">{durationOf(pred?.runMinutes ?? 0)}</span>
              </div>
              <div className="text-[11px]">
                <span className="mono-num block text-muted-foreground">
                  Conf {(100 * (pred?.confidence ?? 0)).toFixed(0)}%
                </span>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${(pred?.confidence ?? 0) * 100}%` }}
                  />
                </div>
              </div>

              <Link
                to="/trains/$trainId"
                params={{ trainId: t.number }}
                className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary md:col-span-1"
              >
                Control <ArrowUpRight className="size-3" />
              </Link>
            </div>
          );
        })}
        {!rows.length && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No services match these filters. Clear the risk filter or search another train number.
          </p>
        )}
      </div>
    </section>
  );
}
