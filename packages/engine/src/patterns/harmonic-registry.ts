import type { UtcMs } from '../core/types';
import type { Swing } from '../features/types';
import {
  detectAbCd,
  detectAltBat,
  detectBat,
  detectButterfly,
  detectCrab,
  detectCypher,
  detectDeepCrab,
  detectGartley,
  detectShark,
} from './harmonic';
import type { HarmonicPattern } from './types';

/**
 * A single lookup for all 9 harmonic-pattern detectors (D58, 9/9 `IMPLEMENTED` as of D78's
 * Shark), mirroring `chart-registry.ts`'s `CHART_PATTERN_DETECTORS` - every detector shares the
 * exact same signature, `(swings) => HarmonicPattern[]` (no `Bars` parameter, unlike the
 * chart-pattern family: a harmonic pattern is pure XABCD ratio geometry).
 */
export const HARMONIC_PATTERN_DETECTORS: Record<
  string,
  (swings: readonly Swing[]) => HarmonicPattern[]
> = {
  gartley: detectGartley,
  butterfly: detectButterfly,
  bat: detectBat,
  alt_bat: detectAltBat,
  crab: detectCrab,
  deep_crab: detectDeepCrab,
  cypher: detectCypher,
  shark: detectShark,
  ab_cd: detectAbCd,
};

export const HARMONIC_PATTERN_IDS: readonly string[] = Object.keys(HARMONIC_PATTERN_DETECTORS);

/** Every harmonic-pattern detector run once on the same swings, concatenated. */
export function detectAllHarmonicPatterns(swings: readonly Swing[]): HarmonicPattern[] {
  return Object.values(HARMONIC_PATTERN_DETECTORS).flatMap((fn) => fn(swings));
}

/** The harmonic candidates known at `cutoff` (the replay cursor) - mirrors `smcAsOf`. */
export function harmonicsAsOf(hs: readonly HarmonicPattern[], cutoff: UtcMs): HarmonicPattern[] {
  return hs.filter((h) => h.confirmedAt <= cutoff);
}
