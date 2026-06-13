export interface LevelData {
  level: number;
  rank: string;
  title: string;
  avatar: string;
  targetScore: number;
  moves: number;
}

export const LEVEL_DATA: LevelData[] = Array.from({ length: 30 }, (_, i) => {
  const l = i + 1;
  const rank =
    l <= 5  ? 'E' : l <= 10 ? 'D' : l <= 15 ? 'C' :
    l <= 20 ? 'B' : l <= 25 ? 'A' : l <= 27 ? 'S' : 'SS';
  const title =
    l <= 5  ? 'Hunter'           : l <= 10 ? 'Awakened One'     :
    l <= 15 ? 'Shadow Wielder'   : l <= 20 ? 'Dungeon Walker'   :
    l <= 25 ? 'Shadow Commander' : l <= 27 ? 'Shadow Monarch'   :
    'Absolute Being';
  const avatar =
    l <= 5  ? '🧑' : l <= 10 ? '🗡️' : l <= 15 ? '⚔️' :
    l <= 20 ? '💜' : l <= 25 ? '👤' : l <= 27 ? '🌑' : '👑';
  return {
    level: l,
    rank,
    title,
    avatar,
    targetScore: 500 + (l - 1) * 650 + l * l * 4,
    moves: Math.max(15, 36 - Math.floor(l * 0.73)),
  };
});
