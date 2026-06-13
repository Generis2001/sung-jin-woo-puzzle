export const GRID = 8;
export const TILE_TYPES = 6;

export const TILES = [
  { emoji: '🌑', name: 'Shadow Soldier' },
  { emoji: '💎', name: 'Mana Crystal'   },
  { emoji: '🗡️', name: 'Shadow Dagger'  },
  { emoji: '🌀', name: 'Dungeon Gate'   },
  { emoji: '👁️', name: 'Shadow Beast'   },
  { emoji: '⭐', name: 'Rank Star'      },
];

const rnd = () => Math.floor(Math.random() * TILE_TYPES);

function wouldMatch(g: number[][], r: number, c: number, t: number): boolean {
  if (c >= 2 && g[r][c - 1] === t && g[r][c - 2] === t) return true;
  if (r >= 2 && g[r - 1]?.[c] === t && g[r - 2]?.[c] === t) return true;
  return false;
}

export function swapTiles(g: number[][], r1: number, c1: number, r2: number, c2: number) {
  const t = g[r1][c1]; g[r1][c1] = g[r2][c2]; g[r2][c2] = t;
}

export function findMatches(g: number[][]): Array<{ r: number; c: number }> {
  const hit = new Set<number>();
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID - 2; c++) {
      const t = g[r][c]; if (t < 0) continue;
      if (g[r][c + 1] === t && g[r][c + 2] === t) {
        let e = c + 2;
        while (e + 1 < GRID && g[r][e + 1] === t) e++;
        for (let i = c; i <= e; i++) hit.add(r * GRID + i);
      }
    }
  }
  for (let c = 0; c < GRID; c++) {
    for (let r = 0; r < GRID - 2; r++) {
      const t = g[r][c]; if (t < 0) continue;
      if (g[r + 1][c] === t && g[r + 2][c] === t) {
        let e = r + 2;
        while (e + 1 < GRID && g[e + 1][c] === t) e++;
        for (let i = r; i <= e; i++) hit.add(i * GRID + c);
      }
    }
  }
  return Array.from(hit).map(k => ({ r: Math.floor(k / GRID), c: k % GRID }));
}

export function hasMove(g: number[][]): boolean {
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (c + 1 < GRID) {
        swapTiles(g, r, c, r, c + 1);
        const m = findMatches(g).length;
        swapTiles(g, r, c, r, c + 1);
        if (m) return true;
      }
      if (r + 1 < GRID) {
        swapTiles(g, r, c, r + 1, c);
        const m = findMatches(g).length;
        swapTiles(g, r, c, r + 1, c);
        if (m) return true;
      }
    }
  }
  return false;
}

export function applyGravity(g: number[][]) {
  for (let c = 0; c < GRID; c++) {
    let w = GRID - 1;
    for (let r = GRID - 1; r >= 0; r--) {
      if (g[r][c] !== -1) {
        if (w !== r) { g[w][c] = g[r][c]; g[r][c] = -1; }
        w--;
      }
    }
  }
}

export function fillEmpty(g: number[][]) {
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (g[r][c] === -1) g[r][c] = rnd();
}

export function generateGrid(): number[][] {
  let g: number[][], tries = 0;
  do {
    g = [];
    for (let r = 0; r < GRID; r++) {
      g[r] = [];
      for (let c = 0; c < GRID; c++) {
        let t: number;
        do { t = rnd(); } while (wouldMatch(g, r, c, t));
        g[r][c] = t;
      }
    }
    tries++;
  } while (!hasMove(g) && tries < 40);
  return g;
}

export const ms = (t: number) => new Promise<void>(r => setTimeout(r, t));
