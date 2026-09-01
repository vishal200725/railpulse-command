import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  SECTIONS,
  STATIONS,
  getSection,
  routeAt,
  station,
  type Train,
} from "@/lib/rail/data";
import { TYPE_STROKE, clockOf, delayTone, signedMin } from "@/lib/rail/format";
import { useRail } from "@/lib/rail/store";
import { cn } from "@/lib/utils";

const TONE_STROKE: Record<ReturnType<typeof delayTone>, string> = {
  ontime: "var(--signal-go)",
  watch: "var(--signal-caution)",
  risk: "var(--signal-warn)",
  critical: "var(--signal-stop)",
};

function congestionColor(v: number) {
  if (v > 0.62) return "var(--signal-stop)";
  if (v > 0.42) return "var(--signal-warn)";
  if (v > 0.26) return "var(--signal-caution)";
  return "var(--signal-go)";
}

function trainXY(train: Train) {
  const a = station(routeAt(train.route, train.legIndex));
  const b = station(routeAt(train.route, train.legIndex + 1));
  const t = Math.max(0, Math.min(1, train.legProgress));
  const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle, a, b };
}

export function NetworkMap({ className }: { className?: string }) {
  const { state, predictions, dispatch } = useRail();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [showFreight, setShowFreight] = React.useState(true);

  const visible = state.trains.filter((t) => showFreight || t.type !== "freight");
  const focus = state.trains.find((t) => t.id === (hovered ?? state.selectedTrainId));
  const focusPred = focus ? predictions[focus.id] : undefined;

  return (
    <section
      className={cn("panel-surface scan-line relative overflow-hidden rounded-xl", className)}
      aria-label="Live corridor digital twin"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold">Corridor Digital Twin</h2>
          <p className="text-[11px] text-muted-foreground">
            14 stations · {SECTIONS.length} block sections · axle-counter feed @ {clockOf(state.nowMin)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => setShowFreight((v) => !v)}
            className={cn(
              "rounded-md border px-2.5 py-1 transition-colors",
              showFreight
                ? "border-track-freight/45 bg-track-freight/12 text-track-freight"
                : "border-border text-muted-foreground",
            )}
          >
            Freight {showFreight ? "shown" : "hidden"}
          </button>
          <span className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
            <span className="inline-block h-1 w-5 rounded bg-signal-go" /> clear
            <span className="ml-1 inline-block h-1 w-5 rounded bg-signal-caution" /> busy
            <span className="ml-1 inline-block h-1 w-5 rounded bg-signal-stop" /> saturated
          </span>
        </div>
      </header>

      <div className="relative">
        <svg viewBox="0 0 1020 540" className="h-[380px] w-full sm:h-[460px]" role="img">
          <defs>
            <radialGradient id="stationGlow" cx="50%" cy="50%">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* block sections */}
          {SECTIONS.map((s) => {
            const a = station(s.from);
            const b = station(s.to);
            const occ = state.congestion[s.id] ?? 0.1;
            const blocked = state.blockedSections.includes(s.id);
            return (
              <g key={s.id}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={blocked ? "var(--signal-stop)" : congestionColor(occ)}
                  strokeWidth={s.tracks === 2 ? 5 : 2.5}
                  strokeOpacity={blocked ? 0.9 : 0.28 + occ * 0.5}
                  strokeLinecap="round"
                  strokeDasharray={s.tracks === 1 ? "10 7" : undefined}
                />
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={blocked ? "var(--signal-stop)" : "var(--primary)"}
                  strokeWidth={1.2}
                  strokeOpacity={0.5}
                  className="track-flow"
                />
                <title>{`${s.from}–${s.to} · ${s.km} km · ${s.tracks === 1 ? "single" : "double"} line · ${s.maxSpeed} km/h · occupancy ${(occ * 100).toFixed(0)}%${blocked ? " · BLOCKED" : ""}`}</title>
              </g>
            );
          })}

          {/* stations */}
          {STATIONS.map((st) => (
            <g key={st.id} className="cursor-default">
              {st.junction && <circle cx={st.x} cy={st.y} r={22} fill="url(#stationGlow)" />}
              <rect
                x={st.x - (st.junction ? 6 : 4)}
                y={st.y - (st.junction ? 6 : 4)}
                width={st.junction ? 12 : 8}
                height={st.junction ? 12 : 8}
                rx={2}
                fill="var(--background)"
                stroke={st.junction ? "var(--primary)" : "var(--muted-foreground)"}
                strokeWidth={st.junction ? 2 : 1.4}
              />
              <text
                x={st.x}
                y={st.y - 14}
                textAnchor="middle"
                className="mono-num"
                fontSize="11"
                fill={st.junction ? "var(--primary)" : "var(--muted-foreground)"}
              >
                {st.code}
              </text>
              <title>{`${st.name} · ${st.platforms} platforms${st.junction ? " · junction" : ""}`}</title>
            </g>
          ))}

          {/* trains */}
          {visible.map((t) => {
            const { x, y, angle } = trainXY(t);
            const pred = predictions[t.id];
            const tone = delayTone(pred?.predictedDelayMin ?? t.delayMin);
            const active = state.selectedTrainId === t.id || hovered === t.id;
            return (
              <g
                key={t.id}
                transform={`translate(${x} ${y})`}
                style={{ transition: "transform 700ms linear" }}
                onMouseEnter={() => setHovered(t.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => dispatch({ type: "select", trainId: t.id })}
                className="cursor-pointer"
              >
                {(tone === "critical" || tone === "risk") && (
                  <circle r={4} fill={TONE_STROKE[tone]} className="train-ping" opacity={0.6} />
                )}
                <g transform={`rotate(${angle})`}>
                  <rect
                    x={-9}
                    y={-4.5}
                    width={18}
                    height={9}
                    rx={2.5}
                    fill={TYPE_STROKE[t.type]}
                    stroke={active ? "var(--foreground)" : TONE_STROKE[tone]}
                    strokeWidth={active ? 2 : 1.4}
                  />
                  <polygon points="9,-4.5 14,0 9,4.5" fill={TONE_STROKE[tone]} />
                </g>
                {active && (
                  <text
                    y={-14}
                    textAnchor="middle"
                    className="mono-num"
                    fontSize="11"
                    fill="var(--foreground)"
                  >
                    {t.number}
                  </text>
                )}
                <title>{`${t.number} ${t.name} · ${signedMin(pred?.predictedDelayMin ?? 0)} · ${t.speedKph} km/h`}</title>
              </g>
            );
          })}
        </svg>

        {focus && focusPred && (
          <div className="pointer-events-auto absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80">
            <div className="panel-surface rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="mono-num text-xs text-primary">{focus.number}</p>
                  <p className="text-sm font-medium leading-tight">{focus.name}</p>
                </div>
                <span
                  className="mono-num rounded border px-2 py-0.5 text-xs"
                  style={{
                    color: TONE_STROKE[delayTone(focusPred.predictedDelayMin)],
                    borderColor: TONE_STROKE[delayTone(focusPred.predictedDelayMin)],
                  }}
                >
                  {signedMin(focusPred.predictedDelayMin)}
                </span>
              </div>
              <dl className="mono-num mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <div>
                  Next: <span className="text-foreground">{station(routeAt(focus.route, focus.legIndex + 1)).code}</span>
                </div>
                <div>
                  ETA: <span className="text-foreground">{clockOf(focusPred.etaMin)}</span>
                </div>
                <div>
                  Speed: <span className="text-foreground">{focus.speedKph} km/h</span>
                </div>
                <div>
                  Conf: <span className="text-foreground">{(focusPred.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="col-span-2">
                  Section:{" "}
                  <span className="text-foreground">
                    {getSection(routeAt(focus.route, focus.legIndex), routeAt(focus.route, focus.legIndex + 1)).id}
                  </span>{" "}
                  · {(focus.legProgress * 100).toFixed(0)}% traversed
                </div>
              </dl>
              <Link
                to="/trains/$trainId"
                params={{ trainId: focus.number }}
                className="mt-2.5 inline-flex w-full items-center justify-center rounded-md bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
              >
                Open train control · explainability
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
