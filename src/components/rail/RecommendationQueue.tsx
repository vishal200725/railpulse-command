import { Link } from "@tanstack/react-router";
import { BrainCircuit, Check, GitBranch, Timer } from "lucide-react";
import { kindLabel, type Recommendation } from "@/lib/rail/recommendations";
import { useRail } from "@/lib/rail/store";
import { cn } from "@/lib/utils";

const SEV: Record<Recommendation["severity"], string> = {
  high: "border-signal-stop/40 bg-signal-stop/10 text-signal-stop",
  medium: "border-signal-caution/40 bg-signal-caution/10 text-signal-caution",
  low: "border-signal-go/40 bg-signal-go/10 text-signal-go",
};

export function RecommendationQueue({ compact = false }: { compact?: boolean }) {
  const { recommendations, dispatch, state } = useRail();
  const list = compact ? recommendations.slice(0, 4) : recommendations;

  return (
    <section className="panel-surface flex flex-col overflow-hidden rounded-xl">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <BrainCircuit className="size-4 text-primary" /> AI Recommendations
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {recommendations.length} open actions · {state.appliedRecIds.length} accepted this shift
          </p>
        </div>
        <span className="mono-num rounded border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
          net −
          {recommendations
            .reduce((s, r) => s + r.savedMinutes - r.costMinutes * 0.35, 0)
            .toFixed(0)}{" "}
          min
        </span>
      </header>

      <div className="max-h-[600px] divide-y divide-border overflow-y-auto">
        {list.map((rec) => (
          <article key={rec.id} className="px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide", SEV[rec.severity])}>
                {kindLabel(rec.kind)}
              </span>
              <span className="mono-num text-[11px] text-muted-foreground">
                conf {(rec.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <h3 className="mt-1.5 text-sm font-medium leading-snug">{rec.title}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{rec.rationale}</p>

            <div className="mono-num mt-2.5 flex flex-wrap items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-signal-go">
                <Timer className="size-3" /> saves {rec.savedMinutes} min
              </span>
              <span className="flex items-center gap-1 text-signal-caution">
                <GitBranch className="size-3" /> costs {rec.costMinutes} min
              </span>
              <span className="text-muted-foreground">affects {rec.affects.join(", ")}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => dispatch({ type: "applyRec", rec })}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary/18 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/28"
              >
                <Check className="size-3.5" /> {rec.actionLabel}
              </button>
              <Link
                to="/simulator"
                search={{ train: rec.trainNumber }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                Test in what-if lab
              </Link>
              <Link
                to="/trains/$trainId"
                params={{ trainId: rec.trainNumber }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                Inspect {rec.trainNumber}
              </Link>
            </div>
          </article>
        ))}
        {!list.length && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Corridor is conflict-free — no interventions recommended. The model keeps re-scoring
            every simulated minute.
          </p>
        )}
      </div>
    </section>
  );
}
