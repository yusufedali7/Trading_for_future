// Public API of the engine. The web app imports only from here.
export { ENGINE_VERSION } from './version';
export type { IanaTz, LocalTime, UtcMs } from './core/types';
export { TIMEFRAMES, compareTimeframes, isTimeframe, timeframeMs } from './core/timeframe';
export type { Timeframe } from './core/timeframe';
export { isValidTimeZone, localToUtc, offsetMinutes, utcToLocal } from './core/tz';
export type { LocalDateTime, LocalParts, LocalToUtcResult } from './core/tz';
export {
  getInstrument,
  listInstruments,
  pipsToPrice,
  priceToPips,
  roundToTick,
  withOverrides,
} from './instruments/registry';
export type {
  AssetClass,
  Instrument,
  InstrumentOverrides,
  TradingHours,
} from './instruments/registry';
export { marketState } from './instruments/hours';
export type { MarketState } from './instruments/hours';
export { KNOWN_DATE_FORMATS, guessMapping, parseCsvRows, parseDate } from './data/csv-rows';
export type {
  CsvMapping,
  DateFormat,
  ParseError,
  ParseErrorReason,
  RawRecord,
  RecordTime,
  TimeColumns,
} from './data/csv-rows';
export { resolveTimes, validateRecords } from './data/validate';
export type { DstIssue, TimedRecord, ValidationReport } from './data/validate';
export { hashColumns, seriesFromRows } from './data/columnar';
export type { CandleRow, CandleSeries } from './data/columnar';
export { FIXES, analyzeImport, normalize, requiredFixes } from './data/normalize';
export type { Blocker, Fix, ImportAnalysis } from './data/normalize';
export { bucketStart, resample } from './data/resample';
export type { ResampledCandle } from './data/resample';
export type { DataSetMeta, PriceType } from './data/dataset';
export {
  BUILTIN_SESSIONS,
  SESSION_ID_RE,
  allSessionDefs,
  getBuiltinSession,
  sessionInstances,
  validateSessionDefinition,
} from './session/sessions';
export type { SessionDefinition, SessionInstance, SessionProblem } from './session/sessions';
export { sessionLevels } from './session/levels';
export type { SessionLevels } from './session/levels';
export {
  ANCHOR_COUNT,
  FIB_EXTENSION_LEVELS,
  FIB_RETRACEMENT_LEVELS,
  defaultPosition,
  fibLevels,
  positionStats,
  priceRangeStats,
  setLevelStatus,
  validateDrawing,
} from './user/drawings';
export type {
  Anchor,
  Drawing,
  DrawingKind,
  DrawingProblem,
  LevelKind,
  LevelStatus,
  SupportResistanceLevel,
} from './user/drawings';
export { replayCandles, seriesUpTo } from './replay/view';
export { orderProblem, simulateTrade } from './execution/trade-sim';
export type {
  AmbiguityRule,
  CostModel,
  Direction,
  ExitReason,
  OrderProblem,
  OrderType,
  SimOptions,
  SimResult,
  TradeOrder,
  TradeStatus,
} from './execution/trade-sim';
export {
  buildOrder,
  DEFAULT_EXPIRE_BARS,
  DEFAULT_STOP_PIPS,
  DEFAULT_TARGET_PIPS,
  defaultDraft,
} from './execution/order-builder';
export type { DraftProblem, OrderContext, OrderDraft, PriceUnit } from './execution/order-builder';
export {
  activeSessions,
  filterJournal,
  journalResultOf,
  outcomeOf,
  summarizeJournal,
  tradeStats,
} from './user/journal';
export type {
  Decision,
  Emotion,
  JournalEntry,
  JournalFilter,
  JournalResult,
  JournalSummary,
  Outcome,
  ReplayTrade,
  TradeStats,
} from './user/journal';
export { bucketEnds } from './data/resample';
export { sliceBars, toBars } from './features/bars';
export type { Bars } from './features/bars';
export {
  FEATURE_DEFAULTS,
  FEATURE_DEFINITIONS,
  computeFeatures,
  featuresAsOf,
  previousPeriods,
} from './features/compute';
export type { FeatureInput, FeatureParams, FeatureSet } from './features/compute';
export { FVG_DEFAULTS, detectFvgs } from './features/fvg';
export { periodLevels } from './features/periods';
export {
  detect2Crows,
  detectBeltHold,
  detectClosingMarubozu,
  detectCounterattack,
  detectDarkCloudCover,
  detectDoji,
  detectDojiStar,
  detectDragonflyDoji,
  detectEngulfing,
  detectGravestoneDoji,
  detectHarami,
  detectHaramiCross,
  detectHighWave,
  detectHomingPigeon,
  detectKicking,
  detectKickingByLength,
  detectLongLeggedDoji,
  detectLongLine,
  detectMarubozu,
  detectMatchingLow,
  detectPiercing,
  detectRickshawMan,
  detectSeparatingLines,
  detectShortLine,
  detectSpinningTop,
  detectStickSandwich,
  detectUpsideGap2Crows,
} from './patterns/candlestick';
export type { CandlePattern } from './patterns/types';
export {
  CANDLE_PATTERN_DETECTORS,
  CANDLE_PATTERN_IDS,
  detectAllCandlePatterns,
} from './patterns/candle-registry';
export {
  detect3BlackCrows,
  detect3Inside,
  detect3LineStrike,
  detect3Outside,
  detect3StarsInSouth,
  detect3WhiteSoldiers,
  detectAbandonedBaby,
  detectAdvanceBlock,
  detectBreakaway,
  detectConcealingBabySwallow,
  detectEveningDojiStar,
  detectEveningStar,
  detectGapSideSideWhite,
  detectHammer,
  detectHangingMan,
  detectHikkake,
  detectHikkakeMod,
  detectIdentical3Crows,
  detectInNeck,
  detectInvertedHammer,
  detectLadderBottom,
  detectMatHold,
  detectMorningDojiStar,
  detectMorningStar,
  detectOnNeck,
  detectRiseFall3Methods,
  detectShootingStar,
  detectStalledPattern,
  detectTakuri,
  detectTasukiGap,
  detectThrusting,
  detectTriStar,
  detectUnique3River,
  detectXSideGap3Methods,
} from './patterns/candlestick-trend';
export type { ChartPattern, ChartPatternPivot } from './patterns/types';
export { CHART_PIVOT_PARAMS } from './patterns/chart-shared';
export {
  detectDoubleBottom,
  detectDoubleTop,
  detectHeadShouldersBottom,
  detectHeadShouldersTop,
  detectTripleBottom,
  detectTripleTop,
} from './patterns/chart';
export {
  detectAscendingChannel,
  detectAscendingTriangle,
  detectBroadening,
  detectDescendingChannel,
  detectDescendingTriangle,
  detectFallingWedge,
  detectRectangle,
  detectRisingWedge,
  detectSymmetricalTriangle,
} from './patterns/chart-lines';
export { detectBearFlag, detectBullFlag, detectPennant } from './patterns/chart-continuation';
export { detectCupAndHandle, detectDiamond, detectRoundingBottom } from './patterns/chart-curve';
export { roundness } from './patterns/chart-shared';
export {
  CHART_PATTERN_DETECTORS,
  CHART_PATTERN_IDS,
  detectAllChartPatterns,
} from './patterns/chart-registry';
export type { HarmonicPattern, HarmonicPatternPivot } from './patterns/types';
export {
  detectAbCd,
  detectAltBat,
  detectBat,
  detectButterfly,
  detectCrab,
  detectCypher,
  detectDeepCrab,
  detectGartley,
  detectShark,
} from './patterns/harmonic';
export {
  HARMONIC_PATTERN_DETECTORS,
  HARMONIC_PATTERN_IDS,
  detectAllHarmonicPatterns,
  harmonicsAsOf,
} from './patterns/harmonic-registry';
export { CISD_DEFAULTS, detectCisd } from './features/cisd';
export { DISPLACEMENT_DEFAULTS, detectDisplacement } from './features/displacement';
export { ORDER_BLOCK_DEFAULTS, detectOrderBlocks } from './features/order-block';
export { detectIfvg } from './features/ifvg';
export { detectBreakers } from './features/breaker';
export { EQUAL_LEVELS_DEFAULTS, detectEqualLevels } from './features/equal-levels';
export { detectPremiumDiscount } from './features/premium-discount';
export { OTE_DEFAULTS, detectOte } from './features/ote';
export { CANDIDATE_SR_DEFAULTS, detectCandidateSr } from './features/candidate-sr';
export { SMC_DEFAULTS, computeSmc, smcAsOf } from './features/smc';
export type { SmcParams, SmcSet } from './features/smc';
export {
  atr,
  bollinger,
  diff,
  ema,
  lag,
  macd,
  movingMax,
  movingMin,
  movingSum,
  percentChange,
  rsi,
  sma,
  vwap,
  zscore,
} from './features/indicators';
export type { Bollinger, Macd } from './features/indicators';
export {
  OUTCOME_DEFAULTS,
  OUTCOME_VERSION,
  candidateOutcome,
  collectDetections,
  featureOutcomes,
  summarizeOutcomes,
} from './features/outcomes';
export type {
  CandidateOutcome,
  DetectionRef,
  OutcomeConcept,
  OutcomeParams,
  OutcomeStatus,
  OutcomeSummary,
} from './features/outcomes';
export { STRUCTURE_DEFAULTS, detectStructureBreaks } from './features/structure';
export { SWEEP_DEFAULTS, detectSweeps, liquidityLevels } from './features/sweep';
export type { LiquiditySources } from './features/sweep';
export { SWING_DEFAULTS, detectSwings } from './features/swing';
export type {
  Breaker,
  BreakBy,
  CandidateSr,
  CandidateSrParams,
  Cisd,
  CisdParams,
  Detection,
  DetectionTiming,
  Displacement,
  DisplacementParams,
  EqualLevels,
  EqualLevelsParams,
  FeatureDirection,
  Fvg,
  FvgParams,
  Ifvg,
  LiquidityKind,
  LiquidityLevel,
  LiquiditySweep,
  OrderBlock,
  OrderBlockParams,
  OteParams,
  OteZone,
  PeriodKind,
  PeriodLevel,
  PremiumDiscountZone,
  StructureBreak,
  StructureBreakParams,
  SweepParams,
  Swing,
  SwingParams,
} from './features/types';
export {
  REF_FIELDS,
  STRATEGY_STATUSES,
  availableRefs,
  canonicalJson,
  defaultSpec,
  newVersion,
  referencedSessionIds,
  setVersionStatus,
  specHash,
  specWarnings,
  validateSpec,
} from './strategy/schema';
export type {
  BreakerStep,
  BreakStep,
  CandlePatternEventStep,
  DonchianBreakStep,
  EmaPullbackStep,
  EntryRule,
  EventStep,
  FvgStep,
  IfvgStep,
  OrderBlockStep,
  OteStep,
  PatternEventStep,
  Ref,
  SpecProblem,
  SpecProblemCode,
  SpecWarning,
  StepType,
  StopRule,
  Strategy,
  StrategySpec,
  StrategyStatus,
  StrategyVersion,
  SweepStep,
  SwingStep,
  TargetRule,
  TimeWindow,
} from './strategy/schema';
export { findSetups, inWindow } from './strategy/matcher';
export type { Setup, StepMatch } from './strategy/matcher';
export {
  DEFAULT_LOT_RULES,
  lotRules,
  pipValuePerLot,
  positionSize,
  quoteToUsd,
  tradePnl,
} from './risk/sizing';
export type { LotRules, SizeResult } from './risk/sizing';
export { SKIP_REASONS, orderFor, runBacktest } from './backtest/run';
export type {
  BacktestConfig,
  BacktestCosts,
  BacktestExit,
  BacktestInput,
  BacktestResult,
  BacktestTrade,
  OpenPosition,
  SkipReason,
} from './backtest/run';
export { backtestStats } from './backtest/stats';
export type { BacktestStats, BreakdownRow } from './backtest/stats';
export { randomEntryBaseline } from './backtest/random-baseline';
export type { RandomBaselineInput } from './backtest/random-baseline';
export { CATALOG_STRATEGIES } from './catalog/strategies';
export type { CatalogStrategy } from './catalog/strategies';
export { draftFor, findConflicts, isWatchable, MIN_WATCHABLE_STATUS } from './live/signal-draft';
export type { DraftConflict, DraftSkipReason, SignalDraft } from './live/signal-draft';
export { batchExcursions, detectionExcursions, summarizeExcursions } from './research/excursion';
export type {
  ConceptExcursionReport,
  Excursion,
  ExcursionReport,
  ExcursionSummary,
} from './research/excursion';
export { buildQuiz } from './education/quiz';
export type { QuizInput, QuizKind, QuizQuestion } from './education/quiz';
export { rankCandidates } from './research/ranking';
export type { RankCandidate, RankedCandidate } from './research/ranking';
export {
  AMBIGUOUS_SHARE_FROM,
  COSTS_SHARE_FROM,
  interpretRun,
  MANY_TRIALS_FROM,
  OOS_KEPT_SHARE,
  randomBaselineParams,
  randomComparison,
} from './research/interpret';
export type { Finding, FindingCode, InterpretInput } from './research/interpret';
export { mulberry32, randomInt } from './core/rng';
export type { Rng } from './core/rng';
export { runRecord, splitRange } from './backtest/record';
export type { BacktestRun, RandomComparison, SplitRole, StoredBacktest } from './backtest/record';
export { MAX_SWEEP_COMBINATIONS, applyParam, sweepGrid, sweepableParams } from './research/sweep';
export type { SweepAxis, SweepParam, SweepParamId, SweepVariant } from './research/sweep';
export { conclude, oosState, recordOos, reopen, validateHypothesis } from './research/hypothesis';
export type {
  ExperimentSetup,
  Hypothesis,
  HypothesisProblem,
  HypothesisStatus,
  OosState,
} from './research/hypothesis';
export { detectServerOffset, mergeBrokerBars, offsetMayHaveChanged } from './data/broker';
export type { BrokerBar, MergeResult, OffsetResult } from './data/broker';
