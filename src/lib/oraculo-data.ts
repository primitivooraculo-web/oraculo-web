export type OraculoPlayer = {
  id: string;
  name: string;
  species: string;
  growth: number;
  health: number;
  stamina: number;
  hunger: number;
  thirst: number;
  x: number;
  y: number;
  z: number;
  status: "online" | "offline" | "pending";
  relation: "self" | "friend" | "hidden";
  confidence?: "live" | "partial" | string;
};

export type HeatZone = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  intensity: "low" | "medium" | "high";
};

export type OraculoSnapshot = {
  generatedAt: string;
  viewer: {
    steamId: string | null;
    linked: boolean;
  };
  server: {
    name: string;
    linked: boolean;
    map: string;
    onlinePlayers: number;
    maxPlayers: number;
    positionMode: "private" | "admin";
  };
  activePlayer: OraculoPlayer;
  mapPlayers: OraculoPlayer[];
  friends: OraculoPlayer[];
  heatZones: HeatZone[];
};

export const initialSnapshot: OraculoSnapshot = {
  generatedAt: new Date().toISOString(),
  viewer: {
    steamId: null,
    linked: false,
  },
  server: {
    name: "Refugio Primitivo",
    linked: false,
    map: "Gateway",
    onlinePlayers: 0,
    maxPlayers: 200,
    positionMode: "private",
  },
  activePlayer: {
    id: "demo-self",
    name: "Dino no detectado",
    species: "Sin especie vinculada",
    growth: 0,
    health: 0,
    stamina: 0,
    hunger: 0,
    thirst: 0,
    x: 466878,
    y: -106057,
    z: 26215,
    status: "pending",
    relation: "self",
  },
  mapPlayers: [],
  friends: [],
  heatZones: [
    { id: "west-rail", label: "West Rail", x: 33, y: 28, size: 19, intensity: "medium" },
    { id: "swamps", label: "Swamps", x: 31, y: 72, size: 18, intensity: "low" },
    { id: "north-plains", label: "North Plains", x: 76, y: 44, size: 17, intensity: "high" },
    { id: "delta", label: "Delta", x: 55, y: 66, size: 13, intensity: "medium" },
    { id: "east-coast", label: "East Coast", x: 82, y: 75, size: 15, intensity: "low" },
  ],
};
