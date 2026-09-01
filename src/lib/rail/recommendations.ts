/** AI recommendation generator for the controller action queue. */
import { getSection, routeAt, station, type Train } from "./data";
import type { EtaContext, EtaPrediction } from "./eta";

export type RecKind = "precedence" | "hold" | "reroute" | "platform" | "pathing" | "regulate";

export interface Recommendation {
  id: string;
  kind: RecKind;
  title: string;
  trainId: string;
  trainNumber: string;
  rationale: string;
  savedMinutes: number;
  costMinutes: number;
  confidence: number;
  severity: "high" | "medium" | "low";
  actionLabel: string;
  affects: string[];
  /** applied to the what-if / live model when accepted */
  effect: { holdTrainId?: string; holdMinutes?: number; relieveTrainId?: string; relieveMinutes?: number };
}

const KIND_LABEL: Record<RecKind, string> = {
  precedence: "Precedence change",
  hold: "Controlled hold",
  reroute: "Reroute",
  platform: "Platform reassign",
  pathing: "Path clearance",
  regulate: "Freight regulation",
};

export function kindLabel(kind: RecKind) {
  return KIND_LABEL[kind];
}

export function generateRecommendations(
  ctx: EtaContext,
  predictions: Record<string, EtaPrediction>,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const byDelay = ctx.trains
    .filter((t) => t.status !== "arrived")
    .slice()
    .sort((a, b) => (predictions[b.id]?.predictedDelayMin ?? 0) - (predictions[a.id]?.predictedDelayMin ?? 0));

  for (const train of byDelay) {
    const pred = predictions[train.id];
    if (!pred) continue;
    const nextStation = station(routeAt(train.route, train.legIndex + 1));
    const section = getSection(routeAt(train.route, train.legIndex), routeAt(train.route, train.legIndex + 1));

    // 1. Precedence: a delayed high-priority train stuck behind a slower low-priority one.
    const blocker = ctx.trains.find(
      (t) =>
        t.id !== train.id &&
        t.priority > train.priority + 1 &&
        getSection(routeAt(t.route, t.legIndex), routeAt(t.route, t.legIndex + 1)).id === section.id,
    );
    if (blocker && pred.predictedDelayMin > 6) {
      recs.push({
        id: `prec-${train.id}-${blocker.id}`,
        kind: "precedence",
        title: `Give ${train.number} precedence over ${blocker.number} at ${nextStation.code}`,
        trainId: train.id,
        trainNumber: train.number,
        rationale: `${train.name} is running ${pred.predictedDelayMin} min late behind ${blocker.name} on ${section.id} (${section.km} km, ${section.tracks === 1 ? "single" : "double"} line). Looping the ${blocker.type} at ${nextStation.name} (${nextStation.platforms} platforms) recovers the express path before the ${section.to} conflict window.`,
        savedMinutes: Math.round(Math.min(18, pred.predictedDelayMin * 0.42) * 10) / 10,
        costMinutes: Math.round(Math.min(11, 4 + blocker.priority) * 10) / 10,
        confidence: 0.78 + Math.min(0.16, pred.predictedDelayMin / 300),
        severity: pred.predictedDelayMin > 20 ? "high" : "medium",
        actionLabel: "Apply precedence",
        affects: [train.number, blocker.number],
        effect: { holdTrainId: blocker.id, holdMinutes: 6, relieveTrainId: train.id, relieveMinutes: Math.min(14, pred.predictedDelayMin * 0.4) },
      });
    }

    // 2. Reroute a northbound service via the branch when the main is congested.
    const congested = (ctx.congestion[section.id] ?? 0) > 0.42;
    if (congested && train.route.includes("MTP") && !train.route.includes("NRK") && train.type !== "freight") {
      recs.push({
        id: `reroute-${train.id}`,
        kind: "reroute",
        title: `Divert ${train.number} via Narikhera branch`,
        trainId: train.id,
        trainNumber: train.number,
        rationale: `Main line occupancy on ${section.id} is at ${((ctx.congestion[section.id] ?? 0) * 100).toFixed(0)}%. The NRK–MTP double-line path is clear; the +${(section.km * 0.2).toFixed(0)} km detour is cheaper than the projected ${pred.predictedDelayMin} min queue at ${nextStation.code}.`,
        savedMinutes: Math.round(Math.min(15, pred.predictedDelayMin * 0.3) * 10) / 10,
        costMinutes: 5.5,
        confidence: 0.71,
        severity: "medium",
        actionLabel: "Approve reroute",
        affects: [train.number, "BLP", "NRK"],
        effect: { relieveTrainId: train.id, relieveMinutes: Math.min(10, pred.predictedDelayMin * 0.28) },
      });
    }

    // 3. Freight regulation into the yard to protect passenger paths.
    if (train.type === "freight" && pred.predictedDelayMin > 12) {
      recs.push({
        id: `reg-${train.id}`,
        kind: "regulate",
        title: `Regulate ${train.number} at ${nextStation.code} for 12 min`,
        trainId: train.id,
        trainNumber: train.number,
        rationale: `${train.name} (load index ${train.load}) is already ${pred.predictedDelayMin} min late and cannot recover on ${section.tracks === 1 ? "single-line" : "graded"} sections. Stabling it at ${nextStation.name} protects three passenger paths in the next 40 min window at no passenger cost.`,
        savedMinutes: 9.5,
        costMinutes: 12,
        confidence: 0.83,
        severity: "low",
        actionLabel: "Regulate freight",
        affects: [train.number, nextStation.code],
        effect: { holdTrainId: train.id, holdMinutes: 12 },
      });
    }

    // 4. Platform reassignment at junctions.
    if (nextStation.junction && pred.predictedDelayMin > 9 && train.type !== "freight") {
      recs.push({
        id: `plat-${train.id}`,
        kind: "platform",
        title: `Reassign ${train.number} to PF ${1 + (train.number.charCodeAt(3) % nextStation.platforms)} at ${nextStation.code}`,
        trainId: train.id,
        trainNumber: train.number,
        rationale: `Booked platform at ${nextStation.name} is occupied beyond ${train.number}'s predicted arrival. A loop-side platform removes the home-signal wait and cuts dwell for ${Math.round(train.load * 14)} passengers.`,
        savedMinutes: 4.5,
        costMinutes: 1,
        confidence: 0.88,
        severity: "medium",
        actionLabel: "Reassign platform",
        affects: [train.number, nextStation.code],
        effect: { relieveTrainId: train.id, relieveMinutes: 4 },
      });
    }

    // 5. Path clearance for a recoverable service.
    if (pred.predictedDelayMin > 4 && pred.predictedDelayMin <= 12 && train.priority <= 3) {
      recs.push({
        id: `path-${train.id}`,
        kind: "pathing",
        title: `Clear green path for ${train.number} to ${station(routeAt(train.route, train.route.length - 1)).code}`,
        trainId: train.id,
        trainNumber: train.number,
        rationale: `${train.number} can recover ${Math.round(pred.predictedDelayMin * 0.6)} min if signals are pre-cleared through ${section.to} and the ${train.speedKph} km/h envelope is held. Confidence ${(pred.confidence * 100).toFixed(0)}%.`,
        savedMinutes: Math.round(pred.predictedDelayMin * 0.6 * 10) / 10,
        costMinutes: 2,
        confidence: pred.confidence,
        severity: "low",
        actionLabel: "Pre-clear path",
        affects: [train.number, section.to],
        effect: { relieveTrainId: train.id, relieveMinutes: pred.predictedDelayMin * 0.55 },
      });
    }
  }

  return recs
    .map((r) => ({ ...r, netMinutes: r.savedMinutes - r.costMinutes * 0.35 }))
    .sort((a, b) => b.netMinutes - a.netMinutes)
    .slice(0, 9);
}
