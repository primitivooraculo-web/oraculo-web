export type RconPlayerLocation = {
  x: number;
  y: number;
  z: number;
};

export type RconPlayerData = {
  name: string | null;
  steam_id: string | null;
  gender: string | null;
  location: RconPlayerLocation | null;
  class: string | null;
  growth: number | null;
  health: number | null;
  stamina: number | null;
  hunger: number | null;
  thirst: number | null;
  diet: {
    carbs: number | null;
    protein: number | null;
    lipid: number | null;
    vitamins: {
      A: number | null;
      B: number | null;
      Y: number | null;
      G: number | null;
    };
  } | null;
  vitamins: {
    A: number | null;
    B: number | null;
    Y: number | null;
    G: number | null;
  } | null;
  mutations: {
    slots: Record<string, string> | null;
    parent: Record<string, string> | null;
    elderA: Record<string, string> | null;
    elderB: Record<string, string> | null;
  };
  prime_elder: boolean;
};

export type ParsedPlayerListEntry = {
  line: string;
  steamId: string | null;
  name: string | null;
};

export type AdminAction =
  | "announce"
  | "direct-message"
  | "kick"
  | "save-server"
  | "console-command"
  | "player-list"
  | "player-data";
