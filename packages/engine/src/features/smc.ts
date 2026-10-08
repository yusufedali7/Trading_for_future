import type { UtcMs } from '../core/types';
import type { Instrument } from '../instruments/registry';
import type { Bars } from './bars';
import { detectBreakers } from './breaker';
import { CANDIDATE_SR_DEFAULTS, detectCandidateSr } from './candidate-sr';
import { DISPLACEMENT_DEFAULTS, detectDisplacement } from './displacement';
import { EQUAL_LEVELS_DEFAULTS, detectEqualLevels } from './equal-levels';
import { FVG_DEFAULTS, detectFvgs } from './fvg';
import { detectIfvg } from './ifvg';
import { ORDER_BLOCK_DEFAULTS, detectOrderBlocks } from './order-block';
import { OTE_DEFAULTS, detectOte } from './ote';
import { detectPremiumDiscount } from './premium-discount';
import { STRUCTURE_DEFAULTS, detectStructureBreaks } from './structure';
import { SWING_DEFAULTS, detectSwings } from './swing';
import type {
  Breaker,
  CandidateSr,
  CandidateSrParams,
  Displacement,
  DisplacementParams,
  EqualLevels,
  EqualLevelsParams,
  FvgParams,
  Ifvg,
  OrderBlock,
  OrderBlockParams,
  OteParams,
  OteZone,
  PremiumDiscountZone,
  StructureBreakParams,
  SwingParams,
} from './types';

export interface SmcParams {
  swing: SwingParams;
  structure: StructureBreakParams;
  fvg: FvgParams;
  displacement: DisplacementParams;
  orderBlock: OrderBlockParams;
  equalLevels: EqualLevelsParams;
  ote: OteParams;
  candidateSr: CandidateSrParams;
}

export const SMC_DEFAULTS: SmcParams = {
  swing: SWING_DEFAULTS,
  structure: STRUCTURE_DEFAULTS,
  fvg: FVG_DEFAULTS,
  displacement: DISPLACEMENT_DEFAULTS,
  orderBlock: ORDER_BLOCK_DEFAULTS,
  equalLevels: EQUAL_LEVELS_DEFAULTS,
  ote: OTE_DEFAULTS,
  candidateSr: CANDIDATE_SR_DEFAULTS,
};

export interface SmcSet {
  displacements: Displacement[];
  orderBlocks: OrderBlock[];
  ifvgs: Ifvg[];
  breakers: Breaker[];
  equalLevels: EqualLevels[];
  premiumDiscount: PremiumDiscountZone[];
  ote: OteZone[];
  candidateSr: CandidateSr[];
}

/**
 * All 8 of the catalog's SMC sub-concepts added in M9 2.–3. dilim (D49–D50), composed from one
 * set of `Bars`. Independent of `features/compute.ts`'s `FeatureSet` - it recomputes its own
 * swings/structure breaks/FVGs internally rather than reusing a caller's, the same deliberate
 * decoupling M8's indicators already use (bars in, candidates out; no shared pipeline yet). This
 * keeps today's chart wiring from having to touch `FeatureSet` and its many existing call sites;
 * revisit when these are wired into the strategy schema, where sharing one computation will
 * matter for determinism.
 */
export function computeSmc(b: Bars, inst: Instrument, p: SmcParams = SMC_DEFAULTS): SmcSet {
  const swings = detectSwings(b, p.swing);
  const breaks = detectStructureBreaks(b, swings, p.structure);
  const fvgs = detectFvgs(b, inst, p.fvg);
  const displacements = detectDisplacement(b, p.displacement);
  const orderBlocks = detectOrderBlocks(b, breaks, displacements, p.orderBlock);
  return {
    displacements,
    orderBlocks,
    ifvgs: detectIfvg(b, fvgs),
    breakers: detectBreakers(b, orderBlocks),
    equalLevels: detectEqualLevels(b, swings, p.equalLevels),
    premiumDiscount: detectPremiumDiscount(swings),
    ote: detectOte(swings, p.ote),
    candidateSr: detectCandidateSr(b, swings, p.candidateSr),
  };
}

const known = <T extends { confirmedAt: UtcMs }>(xs: readonly T[], cutoff: UtcMs) =>
  xs.filter((x) => x.confirmedAt <= cutoff);

/** The SMC candidates as known at `cutoff` (the replay cursor) - mirrors `featuresAsOf`. */
export function smcAsOf(s: SmcSet, cutoff: UtcMs): SmcSet {
  return {
    displacements: known(s.displacements, cutoff),
    orderBlocks: known(s.orderBlocks, cutoff),
    ifvgs: known(s.ifvgs, cutoff),
    breakers: known(s.breakers, cutoff),
    equalLevels: known(s.equalLevels, cutoff),
    premiumDiscount: known(s.premiumDiscount, cutoff),
    ote: known(s.ote, cutoff),
    candidateSr: known(s.candidateSr, cutoff),
  };
}
