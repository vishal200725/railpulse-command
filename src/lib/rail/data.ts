/**
 * RailPulse AI — synthetic but realistic network model for the SIH028 demo.
 *
 * Everything here is deterministic (seeded PRNG, fixed epoch) so that SSR and
 * client hydration agree. Live motion is layered on top by the store.
 */

export type TrainType = "express" | "superfast" | "passenger" | "suburban" | "freight" | "special";

export interface Station {
  id: string;
  code: string;
  name: string;
  x: number;
  y: number;
  platforms: number;
  junction: boolean;
}

export interface Section {
  id: string;
  from: string;
  to: string;
  km: number;
  tracks: 1 | 2;
  maxSpeed: number;
  /** structural difficulty 0..1 (gradients, curves, level crossings) */
  difficulty: number;
}

export interface Train {
  id: string;
  number: string;
  name: string;
  type: TrainType;
  priority: number; // 1 = highest
  route: string[];
  legIndex: number;
  legProgress: number; // 0..1
  speedKph: number;
  delayMin: number;
  dwellRemaining: number; // minutes held at a station
  status: "running" | "dwell" | "held" | "arrived";
  load: number; // % occupancy / tonnage index
  crewFatigue: number; // 0..1
  departureMin: number; // minutes from epoch at origin
}

export interface Weather {
  label: string;
  severity: number; // 0..1
  visibilityKm: number;
  tempC: number;
}

export const EPOCH_MS = Date.UTC(2026, 8, 1, 3, 30, 0); // 09:00 IST

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STATIONS: Station[] = [
  { id: "NGP", code: "NGP", name: "Nagarpur Central", x: 70, y: 300, platforms: 8, junction: true },
  { id: "KHD", code: "KHD", name: "Khadki", x: 172, y: 300, platforms: 3, junction: false },
  { id: "BLP", code: "BLP", name: "Balpur Junction", x: 276, y: 300, platforms: 6, junction: true },
  { id: "SRT", code: "SRT", name: "Suratganj", x: 384, y: 262, platforms: 4, junction: false },
  { id: "DHN", code: "DHN", name: "Dhanwari", x: 492, y: 240, platforms: 3, junction: false },
  { id: "MTP", code: "MTP", name: "Motipur Junction", x: 604, y: 262, platforms: 7, junction: true },
  { id: "KLN", code: "KLN", name: "Kalyanpur", x: 712, y: 300, platforms: 4, junction: true },
  { id: "VRD", code: "VRD", name: "Verdanagar", x: 830, y: 322, platforms: 5, junction: false },
  { id: "EST", code: "EST", name: "Eastport Terminus", x: 948, y: 344, platforms: 9, junction: true },
  { id: "HRD", code: "HRD", name: "Haridham", x: 306, y: 182, platforms: 3, junction: false },
  { id: "CHT", code: "CHT", name: "Chitralay", x: 400, y: 112, platforms: 2, junction: false },
  { id: "NRK", code: "NRK", name: "Narikhera Junction", x: 528, y: 92, platforms: 4, junction: true },
  { id: "SHP", code: "SHP", name: "Shivpur", x: 724, y: 432, platforms: 3, junction: false },
  { id: "GMD", code: "GMD", name: "Gomadi Yard", x: 848, y: 474, platforms: 6, junction: true },
];

export const STATION_MAP: Record<string, Station> = Object.fromEntries(
  STATIONS.map((s) => [s.id, s]),
);

interface SectionSeed {
  from: string;
  to: string;
  km: number;
  tracks: 1 | 2;
  maxSpeed: number;
  difficulty: number;
}

const SECTION_SEEDS: SectionSeed[] = [
  { from: "NGP", to: "KHD", km: 28, tracks: 2, maxSpeed: 110, difficulty: 0.2 },
  { from: "KHD", to: "BLP", km: 31, tracks: 2, maxSpeed: 120, difficulty: 0.25 },
  { from: "BLP", to: "SRT", km: 42, tracks: 2, maxSpeed: 130, difficulty: 0.3 },
  { from: "SRT", to: "DHN", km: 37, tracks: 2, maxSpeed: 130, difficulty: 0.22 },
  { from: "DHN", to: "MTP", km: 45, tracks: 2, maxSpeed: 120, difficulty: 0.35 },
  { from: "MTP", to: "KLN", km: 39, tracks: 2, maxSpeed: 110, difficulty: 0.4 },
  { from: "KLN", to: "VRD", km: 34, tracks: 2, maxSpeed: 100, difficulty: 0.45 },
  { from: "VRD", to: "EST", km: 26, tracks: 2, maxSpeed: 90, difficulty: 0.5 },
  { from: "BLP", to: "HRD", km: 24, tracks: 1, maxSpeed: 90, difficulty: 0.55 },
  { from: "HRD", to: "CHT", km: 29, tracks: 1, maxSpeed: 80, difficulty: 0.65 },
  { from: "CHT", to: "NRK", km: 33, tracks: 1, maxSpeed: 85, difficulty: 0.6 },
  { from: "NRK", to: "MTP", km: 41, tracks: 2, maxSpeed: 100, difficulty: 0.4 },
  { from: "KLN", to: "SHP", km: 22, tracks: 1, maxSpeed: 75, difficulty: 0.6 },
  { from: "SHP", to: "GMD", km: 19, tracks: 1, maxSpeed: 60, difficulty: 0.7 },
];

export const sectionId = (a: string, b: string) => [a, b].sort().join("-");

export const SECTIONS: Section[] = SECTION_SEEDS.map((s) => ({
  id: sectionId(s.from, s.to),
  ...s,
}));

export const SECTION_MAP: Record<string, Section> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s]),
);

export function getSection(a: string, b: string): Section {
  return SECTION_MAP[sectionId(a, b)] ?? (SECTIONS[0] as Section);
}

export function station(id: string): Station {
  return STATION_MAP[id] ?? (STATIONS[0] as Station);
}

export function routeAt(route: string[], i: number): string {
  return route[Math.max(0, Math.min(i, route.length - 1))] ?? route[0]!;
}

const MAIN = ["NGP", "KHD", "BLP", "SRT", "DHN", "MTP", "KLN", "VRD", "EST"];
const NORTH = ["BLP", "HRD", "CHT", "NRK", "MTP", "KLN", "VRD", "EST"];
const SOUTH = ["EST", "VRD", "KLN", "SHP", "GMD"];

interface TrainSeed {
  number: string;
  name: string;
  type: TrainType;
  route: string[];
  leg: number;
  progress: number;
  delay: number;
  load: number;
  departureMin: number;
}

const TRAIN_SEEDS: TrainSeed[] = [
  { number: "12951", name: "Nagarpur Rajpath Exp", type: "superfast", route: MAIN, leg: 3, progress: 0.42, delay: 4, load: 94, departureMin: -96 },
  { number: "12009", name: "Eastport Shatabdi", type: "superfast", route: [...MAIN].reverse(), leg: 2, progress: 0.71, delay: 0, load: 88, departureMin: -78 },
  { number: "22119", name: "Motipur Tejas Exp", type: "express", route: NORTH, leg: 1, progress: 0.33, delay: 17, load: 79, departureMin: -54 },
  { number: "12123", name: "Chitralay Deccan Exp", type: "express", route: [...NORTH].reverse(), leg: 4, progress: 0.55, delay: 9, load: 82, departureMin: -110 },
  { number: "11029", name: "Verdanagar Intercity", type: "express", route: MAIN.slice(2), leg: 2, progress: 0.18, delay: 26, load: 91, departureMin: -42 },
  { number: "51188", name: "Khadki Passenger", type: "passenger", route: MAIN.slice(0, 6), leg: 1, progress: 0.62, delay: 12, load: 64, departureMin: -66 },
  { number: "56501", name: "Haridham Passenger", type: "passenger", route: ["BLP", "HRD", "CHT", "NRK"], leg: 0, progress: 0.48, delay: 7, load: 58, departureMin: -30 },
  { number: "90112", name: "Suburban Line A", type: "suburban", route: ["NGP", "KHD", "BLP", "SRT"], leg: 2, progress: 0.27, delay: 3, load: 118, departureMin: -22 },
  { number: "90238", name: "Suburban Line C", type: "suburban", route: ["EST", "VRD", "KLN", "SHP"], leg: 1, progress: 0.81, delay: 5, load: 126, departureMin: -26 },
  { number: "90341", name: "Suburban Line D", type: "suburban", route: ["SRT", "BLP", "KHD", "NGP"], leg: 0, progress: 0.35, delay: 1, load: 104, departureMin: -14 },
  { number: "GD417", name: "Gomadi Steel Rake", type: "freight", route: SOUTH, leg: 2, progress: 0.44, delay: 38, load: 3860, departureMin: -142 },
  { number: "GD622", name: "Coal Load Northbound", type: "freight", route: ["MTP", "NRK", "CHT", "HRD", "BLP"], leg: 0, progress: 0.66, delay: 21, load: 4120, departureMin: -88 },
  { number: "GD905", name: "Container Link Exp", type: "freight", route: ["NGP", "KHD", "BLP", "SRT", "DHN", "MTP"], leg: 3, progress: 0.12, delay: 14, load: 3240, departureMin: -120 },
  { number: "05077", name: "Festival Special", type: "special", route: ["NGP", "KHD", "BLP", "HRD", "CHT", "NRK", "MTP"], leg: 2, progress: 0.58, delay: 6, load: 97, departureMin: -58 },
];

export const PRIORITY: Record<TrainType, number> = {
  superfast: 1,
  express: 2,
  special: 3,
  suburban: 4,
  passenger: 5,
  freight: 7,
};

export const TYPE_LABEL: Record<TrainType, string> = {
  superfast: "Superfast",
  express: "Express",
  special: "Special",
  suburban: "Suburban",
  passenger: "Passenger",
  freight: "Freight",
};

export function cruiseSpeed(type: TrainType, maxSpeed: number) {
  const factor: Record<TrainType, number> = {
    superfast: 0.94,
    express: 0.86,
    special: 0.82,
    suburban: 0.72,
    passenger: 0.66,
    freight: 0.52,
  };
  return Math.round(maxSpeed * factor[type]);
}

export function buildTrains(): Train[] {
  const rand = mulberry32(28028);
  return TRAIN_SEEDS.map((seed, i) => {
    const section = getSection(routeAt(seed.route, seed.leg), routeAt(seed.route, seed.leg + 1));
    return {
      id: `T${seed.number}`,
      number: seed.number,
      name: seed.name,
      type: seed.type,
      priority: PRIORITY[seed.type],
      route: seed.route,
      legIndex: seed.leg,
      legProgress: seed.progress,
      speedKph: cruiseSpeed(seed.type, section.maxSpeed) - Math.round(rand() * 8),
      delayMin: seed.delay,
      dwellRemaining: 0,
      status: "running" as const,
      load: seed.load,
      crewFatigue: 0.18 + rand() * 0.5,
      departureMin: seed.departureMin,
      _i: i,
    } as Train;
  });
}

/** Deterministic baseline occupancy pressure per section (yard moves, MEMU shuttles, engineering blocks). */
export function baseCongestion(): Record<string, number> {
  const rand = mulberry32(4102);
  return Object.fromEntries(SECTIONS.map((s) => [s.id, 0.08 + rand() * 0.24]));
}

export const BASE_WEATHER: Weather = {
  label: "Light monsoon showers",
  severity: 0.32,
  visibilityKm: 4.2,
  tempC: 27,
};

export const WEATHER_PRESETS: Weather[] = [
  { label: "Clear", severity: 0.05, visibilityKm: 10, tempC: 31 },
  { label: "Light monsoon showers", severity: 0.32, visibilityKm: 4.2, tempC: 27 },
  { label: "Heavy rain", severity: 0.62, visibilityKm: 1.8, tempC: 24 },
  { label: "Dense fog", severity: 0.85, visibilityKm: 0.3, tempC: 18 },
];

export function stationPoint(id: string) {
  const s = station(id);
  return { x: s.x, y: s.y };
}

export function trainPoint(train: Train) {
  const a = station(routeAt(train.route, train.legIndex));
  const b = station(routeAt(train.route, train.legIndex + 1));
  const t = train.legProgress;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, from: a, to: b };
}

export function remainingLegs(train: Train) {
  const legs: Section[] = [];
  for (let i = train.legIndex; i < train.route.length - 1; i++) {
    legs.push(getSection(routeAt(train.route, i), routeAt(train.route, i + 1)));
  }
  return legs;
}

export function minutesToClock(minutesFromEpoch: number) {
  const d = new Date(EPOCH_MS + minutesFromEpoch * 60_000);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}
