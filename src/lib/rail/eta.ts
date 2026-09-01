/**
 * Client-side ETA prediction engine.
 *
 * The `EtaEngine` interface is the replacement seam: swap `setEtaEngine(...)`
 * for an ONNX / server-backed model later without touching any UI code.
 */
import {
  getSection,
  routeAt,
  station,
  type Section,
  type Train,
  type Weather,
} from "./data";

export interface EtaFeature {
  key: string;
  label: string;
  minutes: number;
  detail: string;
}

export interface EtaStop {
  stationId: string;
  code: string;
  name: string;
  arrivalMin: number;
  delayMin: number;
  dwellMin: number;
  passed: boolean;
}

export interface EtaPrediction {
  modelId: string;
  trainId: string;
  nowMin: number;
  runMinutes: number;
  etaMin: number;
  scheduledEtaMin: number;
  predictedDelayMin: number;
  confidence: number;
  bandMin: [number, number];
  features: EtaFeature[];
  stops: EtaStop[];
  riskLabel: "on-time" | "watch" | "at-risk" | "critical";
}

export interface EtaContext {
  nowMin: number;
  trains: Train[];
  weather: Weather;
  congestion: Record<string, number>;
  /** section ids taken out of service (engineering block / accident) */
  blockedSections?: string[];
  /** extra minutes of controller-imposed hold per train id */
  holds?: Record<string, number>;
}

export interface EtaEngine {
  id: string;
  label: string;
  description: string;
  predict(train: Train, ctx: EtaContext): EtaPrediction;
}

const DWELL: Record<Train["type"], number> = {
  superfast: 1.5,
  express: 2,
  special: 2.5,
  suburban: 0.8,
  passenger: 3,
  freight: 4.5,
};

function sectionOccupancy(section: Section, ctx: EtaContext, exclude: string) {
  let n = 0;
  for (const t of ctx.trains) {
    if (t.id === exclude || t.status === "arrived") continue;
    const s = getSection(routeAt(t.route, t.legIndex), routeAt(t.route, t.legIndex + 1));
    if (s.id === section.id) n += 1;
  }
  return n;
}

function conflictPressure(train: Train, section: Section, ctx: EtaContext) {
  let wait = 0;
  for (const t of ctx.trains) {
    if (t.id === train.id || t.status === "arrived") continue;
    if (!t.route.includes(section.from) || !t.route.includes(section.to)) continue;
    if (t.priority < train.priority) {
      wait += section.tracks === 1 ? 2.4 : 0.9;
    }
  }
  return Math.min(wait, 22);
}

export const heuristicEtaEngine: EtaEngine = {
  id: "railpulse-heuristic-v3",
  label: "RailPulse Heuristic v3",
  description:
    "Gradient-free physics + congestion blend: sectional run time, priority conflict waits, weather-adjusted braking envelopes, dwell learning and crew-fatigue drag.",
  predict(train, ctx) {
    const wx = ctx.weather;
    const hold = ctx.holds?.[train.id] ?? 0;

    let base = 0;
    let weatherCost = 0;
    let congestionCost = 0;
    let singleTrackCost = 0;
    let dwellCost = 0;
    let conflictCost = 0;
    let blockCost = 0;

    const stops: EtaStop[] = [];
    let cursor = ctx.nowMin;
    let delayCursor = train.delayMin + hold;

    // stations already passed
    for (let i = 0; i <= train.legIndex; i++) {
      const st = station(routeAt(train.route, i));
      stops.push({
        stationId: st.id,
        code: st.code,
        name: st.name,
        arrivalMin: ctx.nowMin - (train.legIndex - i) * 18,
        delayMin: Math.max(0, train.delayMin - (train.legIndex - i) * 2),
        dwellMin: DWELL[train.type],
        passed: true,
      });
    }

    for (let i = train.legIndex; i < train.route.length - 1; i++) {
      const section = getSection(routeAt(train.route, i), routeAt(train.route, i + 1));
      const share = i === train.legIndex ? 1 - train.legProgress : 1;
      const km = section.km * share;

      const cruise = Math.max(28, Math.min(train.speedKph, section.maxSpeed));
      const pureRun = (km / cruise) * 60;
      base += pureRun;

      const wxDrag = pureRun * (wx.severity * (0.16 + section.difficulty * 0.22));
      weatherCost += wxDrag;

      const occ = (ctx.congestion[section.id] ?? 0.1) + sectionOccupancy(section, ctx, train.id) * 0.14;
      const congDrag = pureRun * Math.min(0.8, occ) * 0.62;
      congestionCost += congDrag;

      const stDrag = section.tracks === 1 ? pureRun * 0.18 + 3.2 : 0;
      singleTrackCost += stDrag;

      const cfl = conflictPressure(train, section, ctx) * share;
      conflictCost += cfl;

      const blocked = ctx.blockedSections?.includes(section.id) ? 14 + section.km * 0.35 : 0;
      blockCost += blocked;

      const dwell = i === train.route.length - 2 ? 0 : DWELL[train.type] * (1 + occ * 0.5);
      dwellCost += dwell;

      const legTotal = pureRun + wxDrag + congDrag + stDrag + cfl + blocked + dwell;
      cursor += legTotal;
      delayCursor += legTotal - pureRun - DWELL[train.type] * share;

      const st = station(routeAt(train.route, i + 1));
      stops.push({
        stationId: st.id,
        code: st.code,
        name: st.name,
        arrivalMin: cursor,
        delayMin: Math.max(0, Math.round(delayCursor)),
        dwellMin: Math.round(dwell * 10) / 10,
        passed: false,
      });
    }

    const fatigueCost = base * train.crewFatigue * 0.05;
    const inherited = train.delayMin + hold;

    const runMinutes = base + weatherCost + congestionCost + singleTrackCost + dwellCost + conflictCost + blockCost + fatigueCost;
    const etaMin = ctx.nowMin + runMinutes;
    const scheduledEtaMin = ctx.nowMin + base + dwellCost - inherited;
    const predictedDelay = Math.round(etaMin - scheduledEtaMin);

    const uncertainty =
      2 + runMinutes * 0.05 + wx.severity * 6 + (singleTrackCost > 0 ? 3 : 0) + conflictCost * 0.12;
    const confidence = Math.max(0.42, Math.min(0.97, 0.95 - uncertainty / 46));

    const features: EtaFeature[] = [
      {
        key: "inherited",
        label: "Inherited delay",
        minutes: inherited,
        detail: `${train.number} entered the corridor ${inherited.toFixed(0)} min late (upstream carry-over${hold ? ` incl. ${hold} min controller hold` : ""}).`,
      },
      {
        key: "base",
        label: "Sectional run time",
        minutes: base,
        detail: `${(base / 60).toFixed(2)} h of pure running at ${train.speedKph} km/h across ${train.route.length - 1 - train.legIndex} remaining sections.`,
      },
      {
        key: "congestion",
        label: "Section congestion",
        minutes: congestionCost,
        detail: "Live occupancy from adjacent movements, yard shunting and block-section headway.",
      },
      {
        key: "conflict",
        label: "Priority conflicts",
        minutes: conflictCost,
        detail: `Crossings / precedence given to ${train.priority > 3 ? "higher-priority mail & express" : "conflicting paths"} on shared sections.`,
      },
      {
        key: "weather",
        label: `Weather (${wx.label})`,
        minutes: weatherCost,
        detail: `Severity ${(wx.severity * 100).toFixed(0)}%, visibility ${wx.visibilityKm.toFixed(1)} km — speed restrictions on graded sections.`,
      },
      {
        key: "singletrack",
        label: "Single-line working",
        minutes: singleTrackCost,
        detail: singleTrackCost ? "Token exchange and crossing waits on single-line branch sections." : "Route is fully double-line.",
      },
      {
        key: "dwell",
        label: "Station dwell",
        minutes: dwellCost,
        detail: `Learned dwell profile for ${train.type} services incl. platform congestion factor.`,
      },
      {
        key: "block",
        label: "Blocks & restrictions",
        minutes: blockCost,
        detail: blockCost ? "Engineering block / disruption detour penalty applied." : "No active blocks on the remaining path.",
      },
      {
        key: "fatigue",
        label: "Crew & rake drag",
        minutes: fatigueCost,
        detail: `Crew fatigue index ${(train.crewFatigue * 100).toFixed(0)}%, load index ${train.load}.`,
      },
    ].filter((f) => f.minutes !== 0 || f.key === "base" || f.key === "inherited");

    const riskLabel: EtaPrediction["riskLabel"] =
      predictedDelay <= 5 ? "on-time" : predictedDelay <= 15 ? "watch" : predictedDelay <= 35 ? "at-risk" : "critical";

    return {
      modelId: heuristicEtaEngine.id,
      trainId: train.id,
      nowMin: ctx.nowMin,
      runMinutes,
      etaMin,
      scheduledEtaMin,
      predictedDelayMin: predictedDelay,
      confidence,
      bandMin: [etaMin - uncertainty * 0.6, etaMin + uncertainty],
      features,
      stops,
      riskLabel,
    };
  },
};

let activeEngine: EtaEngine = heuristicEtaEngine;

export function setEtaEngine(engine: EtaEngine) {
  activeEngine = engine;
}

export function getEtaEngine() {
  return activeEngine;
}

export function predictEta(train: Train, ctx: EtaContext) {
  return activeEngine.predict(train, ctx);
}
