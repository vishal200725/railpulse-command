/** Delay-propagation model: how one train's slip cascades across the corridor. */
import { getSection, routeAt, type Train } from "./data";
import type { EtaContext } from "./eta";

export interface PropagationNode {
  trainId: string;
  number: string;
  name: string;
  type: Train["type"];
  level: number;
  inheritedMin: number;
  viaSection: string;
  reason: string;
  passengers: number;
}

export interface PropagationResult {
  sourceId: string;
  triggerMin: number;
  nodes: PropagationNode[];
  totalNetworkMin: number;
  passengersAffected: number;
  criticalPath: string[];
}

function remainingSectionIds(train: Train) {
  const ids: string[] = [];
  for (let i = train.legIndex; i < train.route.length - 1; i++) {
    ids.push(getSection(routeAt(train.route, i), routeAt(train.route, i + 1)).id);
  }
  return ids;
}

function paxOf(train: Train) {
  if (train.type === "freight") return 0;
  const perCoach = train.type === "suburban" ? 280 : 72;
  const coaches = train.type === "suburban" ? 12 : 20;
  return Math.round(perCoach * coaches * (train.load / 100));
}

export function buildPropagation(
  source: Train,
  ctx: EtaContext,
  triggerMin: number,
): PropagationResult {
  const nodes: PropagationNode[] = [];
  const seen = new Set([source.id]);
  let frontier: Array<{ train: Train; inherited: number; level: number }> = [
    { train: source, inherited: triggerMin, level: 0 },
  ];

  for (let level = 1; level <= 3 && frontier.length; level++) {
    const next: typeof frontier = [];
    for (const cur of frontier) {
      const curSections = new Set(remainingSectionIds(cur.train));
      for (const other of ctx.trains) {
        if (seen.has(other.id) || other.status === "arrived") continue;
        const shared = remainingSectionIds(other).filter((id) => curSections.has(id));
        if (!shared.length) continue;

        const sectionId = shared[0]!;
        const section = ctx.trains.length ? getSection(sectionId.split("-")[0]!, sectionId.split("-")[1]!) : undefined;
        const singleLine = section?.tracks === 1;
        const priorityGap = other.priority - cur.train.priority;

        let factor = 0.18 + shared.length * 0.06;
        if (singleLine) factor += 0.22;
        if (priorityGap > 0) factor += Math.min(0.3, priorityGap * 0.07);
        if (priorityGap < 0) factor *= 0.45;
        factor /= level;

        const inherited = Math.round(cur.inherited * factor * 10) / 10;
        if (inherited < 0.6) continue;

        seen.add(other.id);
        nodes.push({
          trainId: other.id,
          number: other.number,
          name: other.name,
          type: other.type,
          level,
          inheritedMin: inherited,
          viaSection: sectionId,
          reason:
            priorityGap > 0
              ? `Yields precedence to ${cur.train.number} on ${sectionId}${singleLine ? " (single line)" : ""}`
              : `Shares ${shared.length} block section(s) with ${cur.train.number}${singleLine ? " on single line" : ""}`,
          passengers: paxOf(other),
        });
        next.push({ train: other, inherited, level });
      }
    }
    frontier = next;
  }

  const totalNetworkMin =
    triggerMin + nodes.reduce((sum, n) => sum + n.inheritedMin, 0);
  const passengersAffected =
    paxOf(source) + nodes.reduce((s, n) => s + n.passengers, 0);
  const criticalPath = [source.number, ...nodes
    .slice()
    .sort((a, b) => b.inheritedMin - a.inheritedMin)
    .slice(0, 3)
    .map((n) => n.number)];

  return {
    sourceId: source.id,
    triggerMin,
    nodes: nodes.sort((a, b) => a.level - b.level || b.inheritedMin - a.inheritedMin),
    totalNetworkMin: Math.round(totalNetworkMin * 10) / 10,
    passengersAffected,
    criticalPath,
  };
}
