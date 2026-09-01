import * as React from "react";
import {
  BASE_WEATHER,
  SECTIONS,
  WEATHER_PRESETS,
  baseCongestion,
  buildTrains,
  cruiseSpeed,
  getSection,
  mulberry32,
  routeAt,
  station,
  type Train,
  type Weather,
} from "./data";
import { predictEta, type EtaContext, type EtaPrediction } from "./eta";
import { generateRecommendations, type Recommendation } from "./recommendations";

export interface RailEvent {
  id: string;
  atMin: number;
  level: "info" | "success" | "warn" | "critical";
  channel: "movement" | "prediction" | "ai" | "infra" | "controller";
  title: string;
  detail: string;
  trainNumber?: string;
}

export interface KpiPoint {
  atMin: number;
  label: string;
  punctuality: number;
  avgDelay: number;
  throughput: number;
  conflicts: number;
}

interface RailState {
  tick: number;
  nowMin: number;
  trains: Train[];
  congestion: Record<string, number>;
  weather: Weather;
  live: boolean;
  speed: number;
  demoMode: boolean;
  blockedSections: string[];
  holds: Record<string, number>;
  events: RailEvent[];
  kpiHistory: KpiPoint[];
  appliedRecIds: string[];
  selectedTrainId: string | null;
}

type Action =
  | { type: "tick" }
  | { type: "toggleLive" }
  | { type: "setSpeed"; speed: number }
  | { type: "toggleDemo" }
  | { type: "setWeather"; weather: Weather }
  | { type: "select"; trainId: string | null }
  | { type: "applyRec"; rec: Recommendation }
  | { type: "toggleBlock"; sectionId: string }
  | { type: "injectIncident" }
  | { type: "reset" };

function seedKpiHistory(): KpiPoint[] {
  const rand = mulberry32(9091);
  const out: KpiPoint[] = [];
  for (let i = 23; i >= 0; i--) {
    const atMin = -i * 15;
    const wave = Math.sin(i / 3.2) * 6;
    out.push({
      atMin,
      label: `${String(Math.floor(((540 - i * 15) % 1440) / 60)).padStart(2, "0")}:${String((540 - i * 15) % 60).padStart(2, "0")}`,
      punctuality: Math.round(72 + wave + rand() * 9),
      avgDelay: Math.round((11 + wave * 0.5 + rand() * 6) * 10) / 10,
      throughput: Math.round(18 + rand() * 9 - wave * 0.3),
      conflicts: Math.round(2 + rand() * 5),
    });
  }
  return out;
}

function seedEvents(trains: Train[]): RailEvent[] {
  const picks = trains.slice(0, 6);
  return picks.map((t, i) => ({
    id: `seed-${t.id}`,
    atMin: -2 - i * 3,
    level: t.delayMin > 20 ? "warn" : t.delayMin > 8 ? "info" : "success",
    channel: i % 2 === 0 ? "movement" : "prediction",
    title:
      t.delayMin > 20
        ? `${t.number} slipped to +${t.delayMin} min`
        : `${t.number} reported at ${station(routeAt(t.route, t.legIndex)).code}`,
    detail:
      t.delayMin > 20
        ? `Sectional speed on ${getSection(routeAt(t.route, t.legIndex), routeAt(t.route, t.legIndex + 1)).id} below plan; propagation watch armed.`
        : `Axle-counter confirmation, running at ${t.speedKph} km/h towards ${station(routeAt(t.route, t.legIndex + 1)).code}.`,
    trainNumber: t.number,
  }));
}

export function initialState(): RailState {
  const trains = buildTrains();
  return {
    tick: 0,
    nowMin: 0,
    trains,
    congestion: baseCongestion(),
    weather: BASE_WEATHER,
    live: true,
    speed: 1,
    demoMode: false,
    blockedSections: [],
    holds: {},
    events: seedEvents(trains),
    kpiHistory: seedKpiHistory(),
    appliedRecIds: [],
    selectedTrainId: trains[0]?.id ?? null,
  };
}

function pushEvent(events: RailEvent[], ev: RailEvent) {
  return [ev, ...events].slice(0, 90);
}

function advance(state: RailState): RailState {
  const rand = mulberry32(1000 + state.tick * 37);
  const step = 1; // network minute
  const nowMin = state.nowMin + step;
  let events = state.events;

  const congestion: Record<string, number> = { ...state.congestion };
  for (const s of SECTIONS) {
    const drift = (rand() - 0.48) * 0.06;
    const blockPush = state.blockedSections.includes(s.id) ? 0.05 : 0;
    congestion[s.id] = Math.max(0.04, Math.min(0.95, (congestion[s.id] ?? 0.1) + drift + blockPush));
  }

  const trains = state.trains.map((train) => {
    const t: Train = { ...train };
    const section = getSection(routeAt(t.route, t.legIndex), routeAt(t.route, t.legIndex + 1));
    const occ = congestion[section.id] ?? 0.1;

    if (t.dwellRemaining > 0) {
      t.dwellRemaining = Math.max(0, t.dwellRemaining - step);
      t.status = t.dwellRemaining > 0 ? "dwell" : "running";
      return t;
    }

    const hold = state.holds[t.id] ?? 0;
    if (hold > 0) {
      t.status = "held";
      return t;
    }

    const drag = 1 - Math.min(0.55, occ * 0.5 + state.weather.severity * 0.28 + (state.blockedSections.includes(section.id) ? 0.35 : 0));
    const effSpeed = Math.max(12, t.speedKph * drag);
    t.legProgress += (effSpeed * (step / 60)) / section.km;
    t.status = "running";

    // delay dynamics
    const plannedShare = (cruiseSpeed(t.type, section.maxSpeed) * (step / 60)) / section.km;
    const slip = (plannedShare - (effSpeed * (step / 60)) / section.km) * section.km * 0.9;
    t.delayMin = Math.max(0, Math.round((t.delayMin + slip * 1.4 - (occ < 0.2 ? 0.35 : 0)) * 10) / 10);

    if (t.legProgress >= 1) {
      t.legProgress = 0;
      t.legIndex += 1;
      const arrived = t.legIndex >= t.route.length - 1;
      const st = station(routeAt(t.route, t.legIndex));
      if (arrived) {
        events = pushEvent(events, {
          id: `arr-${t.id}-${state.tick}`,
          atMin: nowMin,
          level: t.delayMin <= 5 ? "success" : "warn",
          channel: "movement",
          title: `${t.number} terminated at ${st.code} (${t.delayMin.toFixed(0)} min late)`,
          detail: `${t.name} cleared the corridor. Rake released for turnaround at ${st.name}.`,
          trainNumber: t.number,
        });
        // recycle the service from its origin to keep the corridor alive
        t.legIndex = 0;
        t.legProgress = 0;
        t.delayMin = Math.round(rand() * 9);
        t.dwellRemaining = 3;
        t.status = "dwell";
      } else {
        t.dwellRemaining = t.type === "freight" ? 3 : 1.5;
        t.status = "dwell";
        const next = getSection(routeAt(t.route, t.legIndex), routeAt(t.route, t.legIndex + 1));
        t.speedKph = cruiseSpeed(t.type, next.maxSpeed) - Math.round(rand() * 6);
        if (st.junction) {
          events = pushEvent(events, {
            id: `jn-${t.id}-${state.tick}`,
            atMin: nowMin,
            level: t.delayMin > 20 ? "warn" : "info",
            channel: "movement",
            title: `${t.number} through ${st.code} junction`,
            detail: `Interlocking route set for ${next.id}; running ${t.delayMin.toFixed(0)} min late at ${t.speedKph} km/h.`,
            trainNumber: t.number,
          });
        }
      }
    }
    return t;
  });

  // decay controller holds
  const holds: Record<string, number> = {};
  for (const [id, mins] of Object.entries(state.holds)) {
    const left = mins - step;
    if (left > 0) holds[id] = left;
    else
      events = pushEvent(events, {
        id: `hold-end-${id}-${state.tick}`,
        atMin: nowMin,
        level: "success",
        channel: "controller",
        title: `Hold released on ${state.trains.find((t) => t.id === id)?.number ?? id}`,
        detail: "Controller hold expired; train restarted on cleared path.",
      });
  }

  let weather = state.weather;
  if (state.tick > 0 && state.tick % 45 === 0) {
    const next = WEATHER_PRESETS[Math.floor(rand() * WEATHER_PRESETS.length)] ?? BASE_WEATHER;
    if (next.label !== weather.label) {
      weather = next;
      events = pushEvent(events, {
        id: `wx-${state.tick}`,
        atMin: nowMin,
        level: next.severity > 0.5 ? "critical" : "info",
        channel: "infra",
        title: `Weather update: ${next.label}`,
        detail: `Visibility ${next.visibilityKm.toFixed(1)} km, severity ${(next.severity * 100).toFixed(0)}%. ETA model re-weighted for all ${state.trains.length} services.`,
      });
    }
  }

  const avgDelay = trains.reduce((s, t) => s + t.delayMin, 0) / trains.length;
  const punctuality = (trains.filter((t) => t.delayMin <= 5).length / trains.length) * 100;
  let kpiHistory = state.kpiHistory;
  if (state.tick % 5 === 0) {
    kpiHistory = [
      ...state.kpiHistory.slice(-47),
      {
        atMin: nowMin,
        label: new Date(Date.UTC(2026, 8, 1, 3, 30) + nowMin * 60_000).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Kolkata",
        }),
        punctuality: Math.round(punctuality),
        avgDelay: Math.round(avgDelay * 10) / 10,
        throughput: trains.filter((t) => t.status === "running").length * 2,
        conflicts: Object.values(congestion).filter((c) => c > 0.55).length,
      },
    ];
  }

  if (state.tick % 7 === 3) {
    const worst = trains.slice().sort((a, b) => b.delayMin - a.delayMin)[0];
    if (worst) {
      events = pushEvent(events, {
        id: `pred-${state.tick}`,
        atMin: nowMin,
        level: worst.delayMin > 30 ? "critical" : "info",
        channel: "prediction",
        title: `ETA re-forecast: ${worst.number} now +${worst.delayMin.toFixed(0)} min`,
        detail: `Model re-ran on ${trains.length} live services; ${worst.name} is the top propagation source this cycle.`,
        trainNumber: worst.number,
      });
    }
  }

  return { ...state, tick: state.tick + 1, nowMin, trains, congestion, weather, events, kpiHistory, holds };
}

function reducer(state: RailState, action: Action): RailState {
  switch (action.type) {
    case "tick":
      return advance(state);
    case "toggleLive":
      return { ...state, live: !state.live };
    case "setSpeed":
      return { ...state, speed: action.speed };
    case "toggleDemo": {
      const demoMode = !state.demoMode;
      return {
        ...state,
        demoMode,
        live: demoMode ? true : state.live,
        speed: demoMode ? 4 : 1,
        events: pushEvent(state.events, {
          id: `demo-${state.tick}`,
          atMin: state.nowMin,
          level: "info",
          channel: "controller",
          title: demoMode ? "Demo mode engaged" : "Demo mode disengaged",
          detail: demoMode
            ? "Accelerated corridor clock at 4x with scripted disruption injection for jury walkthrough."
            : "Returned to real-time 1x simulation with organic disruption only.",
        }),
      };
    }
    case "setWeather":
      return {
        ...state,
        weather: action.weather,
        events: pushEvent(state.events, {
          id: `wxset-${state.tick}-${action.weather.label}`,
          atMin: state.nowMin,
          level: action.weather.severity > 0.5 ? "warn" : "info",
          channel: "infra",
          title: `Controller set weather: ${action.weather.label}`,
          detail: `All ETA forecasts re-weighted (visibility ${action.weather.visibilityKm.toFixed(1)} km).`,
        }),
      };
    case "select":
      return { ...state, selectedTrainId: action.trainId };
    case "applyRec": {
      const { rec } = action;
      const holds = { ...state.holds };
      if (rec.effect.holdTrainId && rec.effect.holdMinutes) {
        holds[rec.effect.holdTrainId] = rec.effect.holdMinutes;
      }
      const trains = state.trains.map((t) =>
        t.id === rec.effect.relieveTrainId
          ? { ...t, delayMin: Math.max(0, Math.round((t.delayMin - (rec.effect.relieveMinutes ?? 0)) * 10) / 10) }
          : t,
      );
      return {
        ...state,
        holds,
        trains,
        appliedRecIds: [...state.appliedRecIds, rec.id],
        events: pushEvent(state.events, {
          id: `rec-${rec.id}-${state.tick}`,
          atMin: state.nowMin,
          level: "success",
          channel: "ai",
          title: `Accepted: ${rec.title}`,
          detail: `${rec.rationale.slice(0, 140)}… Projected network saving ${rec.savedMinutes} min.`,
          trainNumber: rec.trainNumber,
        }),
      };
    }
    case "toggleBlock": {
      const active = state.blockedSections.includes(action.sectionId);
      return {
        ...state,
        blockedSections: active
          ? state.blockedSections.filter((s) => s !== action.sectionId)
          : [...state.blockedSections, action.sectionId],
        events: pushEvent(state.events, {
          id: `blk-${action.sectionId}-${state.tick}`,
          atMin: state.nowMin,
          level: active ? "success" : "critical",
          channel: "infra",
          title: active ? `Block lifted on ${action.sectionId}` : `Engineering block imposed on ${action.sectionId}`,
          detail: active
            ? "Section restored to normal working; caution order withdrawn."
            : "Section unavailable — model is re-pathing all affected services and recomputing propagation.",
        }),
      };
    }
    case "injectIncident": {
      const rand = mulberry32(7000 + state.tick);
      const section = SECTIONS[Math.floor(rand() * SECTIONS.length)];
      const victim = state.trains[Math.floor(rand() * state.trains.length)];
      if (!section || !victim) return state;
      return {
        ...state,
        congestion: { ...state.congestion, [section.id]: Math.min(0.95, (state.congestion[section.id] ?? 0.2) + 0.4) },
        trains: state.trains.map((t) => (t.id === victim.id ? { ...t, delayMin: t.delayMin + 18 } : t)),
        events: pushEvent(state.events, {
          id: `inc-${state.tick}`,
          atMin: state.nowMin,
          level: "critical",
          channel: "infra",
          title: `Incident: signal failure at ${section.to} affecting ${victim.number}`,
          detail: `Automatic block on ${section.id} degraded to absolute block working. ${victim.name} took +18 min; cascade forecast updated.`,
          trainNumber: victim.number,
        }),
      };
    }
    case "reset":
      return initialState();
    default:
      return state;
  }
}

interface RailContextValue {
  state: RailState;
  ctx: EtaContext;
  predictions: Record<string, EtaPrediction>;
  recommendations: Recommendation[];
  kpis: {
    punctuality: number;
    avgDelay: number;
    active: number;
    atRisk: number;
    conflicts: number;
    recovered: number;
    passengers: number;
  };
  dispatch: React.Dispatch<Action>;
}

const RailContext = React.createContext<RailContextValue | null>(null);

export function RailProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, undefined, initialState);

  React.useEffect(() => {
    if (!state.live) return;
    const ms = Math.max(180, 1400 / state.speed);
    const id = window.setInterval(() => dispatch({ type: "tick" }), ms);
    return () => window.clearInterval(id);
  }, [state.live, state.speed]);

  // Demo mode: scripted disruption injection so the walkthrough always has drama.
  React.useEffect(() => {
    if (!state.demoMode || !state.live) return;
    const id = window.setInterval(() => dispatch({ type: "injectIncident" }), 22000);
    return () => window.clearInterval(id);
  }, [state.demoMode, state.live]);

  const ctx: EtaContext = React.useMemo(
    () => ({
      nowMin: state.nowMin,
      trains: state.trains,
      weather: state.weather,
      congestion: state.congestion,
      blockedSections: state.blockedSections,
      holds: state.holds,
    }),
    [state.nowMin, state.trains, state.weather, state.congestion, state.blockedSections, state.holds],
  );

  const predictions = React.useMemo(() => {
    const out: Record<string, EtaPrediction> = {};
    for (const t of state.trains) out[t.id] = predictEta(t, ctx);
    return out;
  }, [state.trains, ctx]);

  const recommendations = React.useMemo(
    () => generateRecommendations(ctx, predictions).filter((r) => !state.appliedRecIds.includes(r.id)),
    [ctx, predictions, state.appliedRecIds],
  );

  const kpis = React.useMemo(() => {
    const preds = Object.values(predictions);
    const avgDelay = preds.reduce((s, p) => s + Math.max(0, p.predictedDelayMin), 0) / (preds.length || 1);
    const passengers = state.trains.reduce(
      (s, t) => s + (t.type === "freight" ? 0 : Math.round((t.type === "suburban" ? 3360 : 1440) * (t.load / 100))),
      0,
    );
    return {
      punctuality: (state.trains.filter((t) => t.delayMin <= 5).length / (state.trains.length || 1)) * 100,
      avgDelay,
      active: state.trains.filter((t) => t.status !== "arrived").length,
      atRisk: preds.filter((p) => p.riskLabel === "at-risk" || p.riskLabel === "critical").length,
      conflicts: Object.values(state.congestion).filter((c) => c > 0.55).length,
      recovered: state.appliedRecIds.length,
      passengers,
    };
  }, [predictions, state.trains, state.congestion, state.appliedRecIds]);

  const value = React.useMemo(
    () => ({ state, ctx, predictions, recommendations, kpis, dispatch }),
    [state, ctx, predictions, recommendations, kpis],
  );

  return <RailContext.Provider value={value}>{children}</RailContext.Provider>;
}

export function useRail() {
  const v = React.useContext(RailContext);
  if (!v) throw new Error("useRail must be used inside <RailProvider>");
  return v;
}

export function useTrain(trainId: string | undefined) {
  const { state, predictions } = useRail();
  const train = state.trains.find((t) => t.id === trainId || t.number === trainId);
  return { train, prediction: train ? predictions[train.id] : undefined };
}
