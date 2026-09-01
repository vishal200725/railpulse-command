import * as React from "react";
import { Radio } from "lucide-react";
import { clockOf } from "@/lib/rail/format";
import { useRail, type RailEvent } from "@/lib/rail/store";
import { cn } from "@/lib/utils";

const LEVEL: Record<RailEvent["level"], string> = {
  info: "border-primary/40 text-primary",
  success: "border-signal-go/45 text-signal-go",
  warn: "border-signal-caution/45 text-signal-caution",
  critical: "border-signal-stop/50 text-signal-stop",
};

const CHANNELS: Array<RailEvent["channel"] | "all"> = [
  "all",
  "movement",
  "prediction",
  "ai",
  "infra",
  "controller",
];

export function EventStream({ height = "max-h-[520px]" }: { height?: string }) {
  const { state } = useRail();
  const [channel, setChannel] = React.useState<RailEvent["channel"] | "all">("all");
  const events = state.events.filter((e) => channel === "all" || e.channel === channel);

  return (
    <section className="panel-surface flex flex-col overflow-hidden rounded-xl">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Radio className={cn("size-4", state.live ? "text-signal-go" : "text-muted-foreground")} />
            Live Event Stream
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {state.live ? "Streaming" : "Paused"} · {events.length} entries · corridor clock{" "}
            {clockOf(state.nowMin)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide transition-colors",
                channel === c
                  ? "border-primary/50 bg-primary/12 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      <ul className={cn("divide-y divide-border overflow-y-auto", height)}>
        {events.map((e) => (
          <li key={e.id} className="flex gap-3 px-4 py-2.5">
            <span className="mono-num pt-0.5 text-[11px] text-muted-foreground">
              {clockOf(e.atMin)}
            </span>
            <span
              className={cn(
                "mt-1 h-2 w-2 shrink-0 rounded-full border-2 bg-transparent",
                LEVEL[e.level],
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium leading-snug">{e.title}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                  {e.channel}
                </span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                {e.detail}
              </span>
            </span>
          </li>
        ))}
        {!events.length && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            No events on this channel yet — resume the feed or inject an incident.
          </li>
        )}
      </ul>
    </section>
  );
}
