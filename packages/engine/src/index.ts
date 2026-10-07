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
export { atr, bollinger, ema, macd, rsi, sma, vwap } from './features/indicators';
export type { Bollinger, Macd } from './features/indicators';
export {
  OUTCOME_DEFAULTS,
  OUTCOME_VERSION,
  candidateOutcome,
  featureOutcomes,
  summarizeOutcomes,
} from './features/outcomes';
export type {
  CandidateOutcome,
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
  BreakBy,
  Detection,
  DetectionTiming,
  FeatureDirection,
  Fvg,
  FvgParams,
  LiquidityKind,
  LiquidityLevel,
  LiquiditySweep,
  PeriodKind,
  PeriodLevel,
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
  BreakStep,
  EntryRule,
  EventStep,
  FvgStep,
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
export { runRecord, splitRange } from './backtest/record';
export type { BacktestRun, SplitRole, StoredBacktest } from './backtest/record';
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
