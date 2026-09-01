import { CircleDot, Info, MapPin } from "lucide-react";
import type { EtaPrediction } from "@/lib/rail/eta";
import { getEtaEngine } from "@/lib/rail/eta";
import type { Train } from "@/lib/rail/data";
import { TONE_BG, clockOf, delayTone, durationOf, signedMin } from "@/lib/rail/format";
import { cn } from "@/lib/utils";

const FEATURE_TONE: Record<string, string> = {
  base: "bg-primary",
  inherited: "bg-signal-stop",
  congestion: "bg-signal-warn",
  conflict: "bg-track-special",
  weather: "bg-track-freight",
  singletrack: "bg-signal-caution",
  dwell: "bg-track-suburban",
  block: "bg-destructive",
  fatigue: "bg-muted-foreground",
};

export function EtaExplain({ train, prediction }: { train: Train; prediction: EtaPrediction }) {
  const engine = getEtaEngine();
  const tone = delayTone(prediction.predictedDelayMin);
  const max = Math.max(...prediction.features.map((f) => Math.abs(f.minutes)), 1);

  return (
    <section className="panel-surface overflow-hidden rounded-xl">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold">ETA Prediction & Explainability</h2>
          <p className="text-[11px] text-muted-foreground">
            {engine.label} · model id <span className="mono-num">{prediction.modelId}</span>
          </p>
        </div>
        <span className={cn("mono-num rounded border px-2.5 py-1 text-xs", TONE_BG[tone])}>
          {signedMin(prediction.predictedDelayMin)} · {prediction.riskLabel}
        </span>
      </header>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-panel px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Predicted arrival
              </p>
              <p className="mono-num text-xl font-semibold text-primary">
                {clockOf(prediction.etaMin)}
              </p>
              <p className="mono-num text-[11px] text-muted-foreground">
                band {clockOf(prediction.bandMin[0])}–{clockOf(prediction.bandMin[1])}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-panel px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Scheduled arrival
              </p>
              <p className="mono-num text-xl font-semibold">{clockOf(prediction.scheduledEtaMin)}</p>
              <p className="mono-num text-[11px] text-muted-foreground">
                remaining run {durationOf(prediction.runMinutes)}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-border bg-panel px-3 py-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Model confidence</span>
              <span className="mono-num text-primary">
                {(prediction.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/50 to-primary transition-all duration-700"
                style={{ width: `${prediction.confidence * 100}%` }}
              />
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3 shrink-0" />
              {engine.description}
            </p>
          </div>

          <ul className="mt-3 space-y-2.5">
            {prediction.features.map((f) => (
              <li key={f.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium">{f.label}</span>
                  <span className="mono-num text-xs text-muted-foreground">
                    {f.minutes >= 0 ? "+" : ""}
                    {f.minutes.toFixed(1)} min
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      FEATURE_TONE[f.key] ?? "bg-primary",
                    )}
                    style={{ width: `${(Math.abs(f.minutes) / max) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{f.detail}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Predicted run — {train.route.length} halts
          </p>
          <ol className="mt-2 space-y-0">
            {prediction.stops.map((s, i) => {
              const stTone = delayTone(s.delayMin);
              return (
                <li key={`${s.stationId}-${i}`} className="relative flex gap-3 pb-3.5 last:pb-0">
                  <span className="relative flex flex-col items-center">
                    {s.passed ? (
                      <CircleDot className="size-4 text-muted-foreground" />
                    ) : (
                      <MapPin className={cn("size-4", TONE_BG[stTone].split(" ")[1])} />
                    )}
                    {i < prediction.stops.length - 1 && (
                      <span
                        className={cn(
                          "mt-0.5 w-px flex-1",
                          s.passed ? "bg-border" : "bg-primary/40",
                        )}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("text-xs font-medium", s.passed && "text-muted-foreground")}>
                        <span className="mono-num text-primary/80">{s.code}</span> {s.name}
                      </span>
                      <span className="mono-num text-xs">{clockOf(s.arrivalMin)}</span>
                    </span>
                    <span className="mono-num mt-0.5 flex gap-3 text-[10px] text-muted-foreground">
                      <span className={s.passed ? "" : TONE_BG[stTone].split(" ")[1]}>
                        {s.passed ? "actual" : "forecast"} {signedMin(s.delayMin)}
                      </span>
                      <span>dwell {s.dwellMin}m</span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
