// Shared domain types for the Crypto Pro Analyzer.

/** A single OHLCV candle, timestamps in epoch milliseconds (UTC). */
export interface Candle {
  time: number; // open time, ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Well-known market-data sources. */
export type MarketSource = "binance" | "simulated";

export type MarketStatus = "ok" | "stale" | "unavailable";

export interface MarketData {
  /** Symbol used, e.g. "BTCUSDT". */
  symbol: string;
  interval: string;
  candles: Candle[];
  /** Last candle close time (ms). */
  asOf: number;
  /** Epoch of last successful upstream fetch. */
  fetchedAt: number;
  /** Data source provenance. */
  source: MarketSource;
  status: MarketStatus;
  /** True when candles are synthetic (no upstream reachable). */
  simulated: boolean;
  /** Human message explaining caveats. */
  caveat?: string;
}

export type SignalBias = "bullish" | "bearish" | "neutral";

/** A single, explainable technical signal. */
export interface Signal {
  id: string;
  name: string;
  group: "trend" | "momentum" | "volatility" | "volume" | "mean-reversion";
  bias: SignalBias;
  /** Contribution to the composite score, roughly in [-100, 100]. */
  weight: number;
  strength: number; // 0..1 magnitude of the signal regardless of direction
  /** Human readable observation, e.g. "RSI(14) = 64.2". */
  detail: string;
  /** Short plain explanation of why this signal fired. */
  why: string;
  timeframe: string;
  /** Underlying value(s) for transparency. */
  values?: Record<string, number>;
}

export interface SupportResistance {
  level: number;
  kind: "support" | "resistance";
  /** Count of touches/clustering strength (higher = more meaningful). */
  touches: number;
  /** Distance from current price as a fraction (positive). */
  distancePct: number;
  /** Coarse confidence label derived from clustering/touches. */
  label: "strong" | "moderate" | "weak";
}

export interface RiskMetrics {
  /** ATR as a fraction of price. */
  atrPct: number;
  /** Realized volatility (annualized approximation) as decimal, e.g. 0.62. */
  volatility: number;
  /** Number of standard deviations of recent moves. */
  zScore: number;
  /** Suggested stop-loss price. */
  stopLoss: number | null;
  /** Suggested take-profit price. */
  takeProfit: number | null;
  /** Invalidation level (structure break). */
  invalidation: number | null;
  /** Risk:reward ratio (null when stop or target missing). */
  riskReward: number | null;
  /** Suggested risk per trade (fraction of capital) — analysis only. */
  suggestedRiskPct: number;
}

/** Result of a single timeframe's full analysis. */
export interface TimeframeAnalysis {
  interval: string;
  label: string;
  score: number; // -100..100 composite
  bias: SignalBias;
  /** Analytical confidence (0..100) — an opinion, NOT a probability. */
  confidence: number;
  /** Number of independent agreeing signals. */
  agreement: number;
  /** Degree to which indicators agree (0..1). */
  consensus: number;
  price: number;
  changePct: number;
  signals: Signal[];
  levels: SupportResistance[];
  risk: RiskMetrics;
  indicators: IndicatorSnapshot;
  /** True if there were not enough candles for reliable analysis. */
  insufficientData: boolean;
  /** Historical (walk-forward) hit rate for this bias, when computable. */
  backtest: BacktestResult;
}

export interface IndicatorSnapshot {
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema20: number | null;
  ema50: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  bollingerMid: number | null;
  atr: number | null;
  atrPct: number | null;
  stochasticK: number | null;
  stochasticD: number | null;
  volumeRatio: number | null; // vs 20-bar average
  obvSlope: number | null; // sign normalized
  adx: number | null;
}

export interface BacktestResult {
  /** Walk-forward hit rate (0..1) or null when not computable. */
  hitRate: number | null;
  /** Number of out-of-sample trades evaluated. */
  samples: number;
  /** Average forward return per trade (as decimal) over the horizon. */
  avgReturnPct: number | null;
  /** Bias actually tested. */
  bias: SignalBias | null;
  /** Look-ahead horizon in bars. */
  horizonBars: number;
  /** Plain note about method. */
  note: string;
}

/** Dashboard result bundling all timeframes. */
export interface AnalysisResult {
  symbol: string;
  symbolName: string;
  interval: string;
  price: number;
  changePct: number;
  asOf: number;
  fetchedAt: number;
  source: MarketSource;
  /** Overall multi-timeframe verdict across the selected set. */
  overall: OverallVerdict;
  timeframes: TimeframeAnalysis[];
  /** True when any timeframe had insufficient data. */
  insufficientData: boolean;
  simulated: boolean;
}

export interface OverallVerdict {
  bias: SignalBias;
  score: number;
  confidence: number;
  /** Description tying together the timeframes. */
  summary: string;
}