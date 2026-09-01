import { EPOCH_MS, type TrainType } from "./data";

export function clockOf(minutesFromEpoch: number) {
  return new Date(EPOCH_MS + minutesFromEpoch * 60_000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function signedMin(min: number) {
  const r = Math.round(min);
  return r > 0 ? `+${r}m` : r < 0 ? `${r}m` : "on time";
}

export function durationOf(min: number) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

export function delayTone(delay: number) {
  if (delay <= 5) return "ontime" as const;
  if (delay <= 15) return "watch" as const;
  if (delay <= 35) return "risk" as const;
  return "critical" as const;
}

export const TONE_TEXT: Record<ReturnType<typeof delayTone>, string> = {
  ontime: "text-signal-go",
  watch: "text-signal-caution",
  risk: "text-signal-warn",
  critical: "text-signal-stop",
};

export const TONE_BG: Record<ReturnType<typeof delayTone>, string> = {
  ontime: "bg-signal-go/12 text-signal-go border-signal-go/35",
  watch: "bg-signal-caution/12 text-signal-caution border-signal-caution/35",
  risk: "bg-signal-warn/12 text-signal-warn border-signal-warn/35",
  critical: "bg-signal-stop/14 text-signal-stop border-signal-stop/40",
};

export const TYPE_COLOR: Record<TrainType, string> = {
  superfast: "text-track-express",
  express: "text-track-express",
  special: "text-track-special",
  suburban: "text-track-suburban",
  passenger: "text-track-passenger",
  freight: "text-track-freight",
};

export const TYPE_STROKE: Record<TrainType, string> = {
  superfast: "var(--track-express)",
  express: "var(--track-express)",
  special: "var(--track-special)",
  suburban: "var(--track-suburban)",
  passenger: "var(--track-passenger)",
  freight: "var(--track-freight)",
};

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
