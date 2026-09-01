import * as React from "react";
import { AlertOctagon, GitFork, Users } from "lucide-react";
import type { Train } from "@/lib/rail/data";
import { TYPE_LABEL } from "@/lib/rail/data";
import { TYPE_COLOR } from "@/lib/rail/format";
import { buildPropagation } from "@/lib/rail/propagation";
import { useRail } from "@/lib/rail/store";
import { cn } from "@/lib/utils";

const LEVEL_TONE = ["bg-signal-stop", "bg-signal-warn", "bg-signal-caution", "bg-primary"];

export function PropagationView({ train }: { train: Train }) {
  const { ctx, predictions } = useRail();
  const trigger = Math.max(4, predictions[train.id]?.predictedDelayMin ?? train.delayMin);
  const result = React.useMemo(() => buildPropagation(train, ctx, trigger), [train, ctx, trigger]);
  const maxInherited = Math.max(...result.nodes.map((n) => n.inheritedMin), 1);

  const byLevel = [1, 2, 3].map((lvl) => ({
    level: lvl,
    nodes: result.nodes.filter((n) => n.level === lvl),
  }));

  return (
    <section className="panel-surface overflow-hidden rounded-xl">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <GitFork className="size-4 text-signal-warn" /> Delay Propagation Cascade
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Source {train.number} at +{trigger.toFixed(0)} min · critical path{" "}
            <span className="mono-num">{result.criticalPath.join(" → ")}</span>
          </p>
        </div>
        <div className="mono-num flex gap-4 text-[11px]">
          <span className="text-signal-stop">
            <AlertOctagon className="mr-1 inline size-3" />
            {result.totalNetworkMin} network min
          </span>
          <span className="text-track-suburban">
            <Users className="mr-1 inline size-3" />
            {(result.passengersAffected / 1000).toFixed(1)}k pax
          </span>
        </div>
      </header>

      <div className="grid gap-3 px-4 py-4 md:grid-cols-3">
        {byLevel.map((group) => (
          <div key={group.level} className="rounded-lg border border-border bg-panel p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Wave {group.level}
              </span>
              <span className="mono-num text-[11px] text-foreground">
                {group.nodes.reduce((s, n) => s + n.inheritedMin, 0).toFixed(1)} min
              </span>
            </div>
            <div className="mt-2.5 space-y-2.5">
              {group.nodes.map((n) => (
                <div key={n.trainId}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="mono-num text-xs text-primary">{n.number}</span>
                    <span className="mono-num text-xs text-signal-warn">+{n.inheritedMin}m</span>
                  </div>
                  <p className="truncate text-[11px] text-foreground">{n.name}</p>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        LEVEL_TONE[group.level - 1] ?? "bg-primary",
                      )}
                      style={{ width: `${(n.inheritedMin / maxInherited) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    <span className={cn("uppercase", TYPE_COLOR[n.type])}>{TYPE_LABEL[n.type]}</span>{" "}
                    · {n.reason}
                  </p>
                </div>
              ))}
              {!group.nodes.length && (
                <p className="text-[11px] text-muted-foreground">
                  No further inheritance at this wave — cascade is contained.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
