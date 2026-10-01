// Chart colours; keep in sync with theme/tokens.css. Green/red mean direction only (CLAUDE.md).
export const THEME = {
  bg: '#0e1116',
  text: '#8a94a3',
  grid: '#1c222b',
  border: '#2a313c',
  up: '#26a69a',
  down: '#ef5350',
  incomplete: '#5c6573',
  accent: '#5b9bd5',
};

/** Session colours avoid green/red; every box also carries a text label. */
export const SESSION_COLORS: Record<string, string> = {
  ASIA: '#9b8bd4',
  LONDON: '#5b9bd5',
  NEW_YORK: '#d0905e',
};

export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
