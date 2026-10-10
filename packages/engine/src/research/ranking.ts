import { type Rng } from '../core/rng';
import { tradeStats, type TradeStats } from '../user/journal';

/**
 * "En iyi aday" sıralaması (`docs/AGENT-GOREV-M9-formasyonlar.md` Adım 8). Girdi her zaman gerçek,
 * daha önce çalıştırılmış bir backtest'in işlem başına R listesidir (rule 1: veri yoksa sonuç yok)
 * - bu modül hiçbir sayı üretmez, yalnızca var olan sonuçları karşılaştırıp sıralar.
 *
 * Adım 8'in 6 ölçütünden bu modülün kapsadıkları:
 *  - (1) "30'un altı hiç listelenmez" → `excludedLowSample`.
 *  - (2) "maliyetler düşüldükten sonra pozitif beklenen değer" → `positiveExpectancy` (R zaten net).
 *  - (3) "rastgele giriş tabanını yenmesi; fark ve bootstrap güven aralığıyla raporlanır" →
 *    `edgeR` + `edgeCI` (sabit tohumlu bootstrap, rule 5).
 * Bilerek KAPSANMAYAN ölçütler (ayrı iş; caller/UI sorumluluğu ya da başka bir araç gerekiyor):
 *  - (1)'in "out-of-sample'da en az 100 işlem" eşiği - bu, hangi backtest çalışmasının OOS olduğunu
 *    bilen çağıran tarafın (`BacktestRun.split.role`) filtresi; bu modül bir R listesinin kökenini
 *    bilmez.
 *  - (4) komşu parametre dayanıklılığı - M6.2'nin tarama aracı (`research/sweep.ts`) ile birlikte,
 *    ayrı bir karşılaştırma katmanı gerektirir.
 *  - (5) yıl/enstrüman tutarlılığı - `BacktestStats.monthly`/`bySession` zaten var, bunları bu
 *    ölçütle birleştirmek ayrı bir iş.
 *  - (6) deneme sayısı - zaten `ResearchExperiment.trialCount` ile izleniyor (M6.2), burada tekrar
 *    edilmedi.
 */

const LOW_SAMPLE = 30;

export interface RankCandidate {
  id: string;
  label: string;
  /** İşlem başına net R, sırayla; gerçek bir backtest sonucundan. */
  trades: readonly number[];
  /** Aynı aday için `randomEntryBaseline()`'ın (D61) işlem başına net R listesi. */
  randomTrades?: readonly number[];
}

export interface RankedCandidate {
  id: string;
  label: string;
  stats: TradeStats;
  randomStats?: TradeStats;
  /** stats.avgR - randomStats.avgR (taban çizgisi yoksa 0 kabul edilir); işlem yoksa null. */
  edgeR: number | null;
  /** %95 bootstrap güven aralığı, yalnızca her iki örnek de boş değilse. */
  edgeCI?: { low: number; high: number };
  hasRandomBaseline: boolean;
  positiveExpectancy: boolean;
  /** < 30 işlem: Adım 8 kriter 1 - sıralamaya değil listeye bile girmemeli. */
  excludedLowSample: boolean;
}

function bootstrapEdgeCI(
  a: readonly number[],
  b: readonly number[],
  rng: Rng,
  iterations: number,
): { low: number; high: number } {
  const mean = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const resample = (xs: readonly number[]) =>
    mean(Array.from({ length: xs.length }, () => xs[Math.floor(rng() * xs.length)]!));
  const diffs = Array.from({ length: iterations }, () => resample(a) - resample(b)).sort(
    (x, y) => x - y,
  );
  const at = (p: number) => diffs[Math.min(diffs.length - 1, Math.floor(p * diffs.length))]!;
  return { low: at(0.025), high: at(0.975) };
}

/**
 * Adayları `edgeR`'a göre büyükten küçüğe sıralar; `excludedLowSample` olanlar en sona (kendi
 * aralarında girdi sırasıyla, aralarında bir "daha iyi" iddiası yok). `rng` sabit tohumlu olmalı ve
 * tohum kaydedilmeli (rule 5).
 */
export function rankCandidates(
  candidates: readonly RankCandidate[],
  rng: Rng,
  bootstrapIterations = 2000,
): RankedCandidate[] {
  const ranked = candidates.map((c): RankedCandidate => {
    const stats = tradeStats(c.trades.map((r) => ({ r })));
    const randomStats = c.randomTrades ? tradeStats(c.randomTrades.map((r) => ({ r }))) : undefined;
    const avgR = stats.avgR;
    const randomAvgR = randomStats?.avgR ?? 0;
    const edgeR = avgR === null ? null : avgR - randomAvgR;
    const edgeCI =
      c.trades.length > 0 && c.randomTrades && c.randomTrades.length > 0
        ? bootstrapEdgeCI(c.trades, c.randomTrades, rng, bootstrapIterations)
        : undefined;
    return {
      id: c.id,
      label: c.label,
      stats,
      randomStats,
      edgeR,
      edgeCI,
      hasRandomBaseline: randomStats !== undefined,
      positiveExpectancy: avgR !== null && avgR > 0,
      excludedLowSample: c.trades.length < LOW_SAMPLE,
    };
  });
  return ranked.sort((a, b) => {
    if (a.excludedLowSample !== b.excludedLowSample) return a.excludedLowSample ? 1 : -1;
    if (a.edgeR === null && b.edgeR === null) return 0;
    if (a.edgeR === null) return 1;
    if (b.edgeR === null) return -1;
    return b.edgeR - a.edgeR;
  });
}
