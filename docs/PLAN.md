# PLAN — M0 Keşif ve Plan (Trading Research Workstation)

> Durum: kullanıcı tarafından 2026-09-30 tarihinde onaylandı. Kararlar: `docs/DECISIONS.md`. Oturum devri: `DEVIR.md`.

## Bağlam
Kullanıcı forex öğrenen bir öğrenci; trading fikirlerini objektif kurallara döküp grafikte görmek, geçmiş veride dürüstçe test etmek ve ölçmek için yerel çalışan bir araştırma masası istiyor. Bu oturum yalnızca M0: kod yok, bağımlılık yok, dosya yok. Onay gelince `docs/PLAN.md`, `docs/DECISIONS.md`, `DEVIR.md` kaydedilecek; M1'e ancak "başla" ile geçilecek.

---

## 1. Repo durumu
- `C:\Users\EDALI\Downloads\tradingbot` içinde **yalnızca `CLAUDE.md`** var. README, DEVIR.md, docs, package.json, kaynak kod, test yok. **Repo boş — teyit edildi.**
- Klasör **git deposu değil**. M1'in ilk adımında `git init` önerilecek.
- Makine: Node **v22.17.0**, npm **11.1.0**, git **2.56.0** kurulu; **pnpm yok** → npm workspaces kullanılacak (ek araç kurmadan).

## 2. Grafik seçenekleri (TradingView resmi kaynaklar)

| | Gömülü widget'lar | Lightweight Charts™ | Advanced Charts | Trading Platform |
|---|---|---|---|---|
| Lisans | TradingView tescilli, TradingView barındırır | **Apache 2.0**, açık kaynak | Tescilli | Tescilli, ücretli |
| Erişim | Kopyala-yapıştır kod | npm / GitHub, serbest | Başvuru formu → onay → özel GitHub reposu daveti | Başvuru + broker backend şart |
| Kişisel projede | Kişisel kullanımı açıkça ele alan madde **doğrulanmadı**; TradingView atıf/marka zorunlu | **Evet** | **Hayır.** Resmi: kişisel kullanım, hobi, öğrenim ya da test için verilmiyor; yalnızca şirketlere, herkese açık web projelerinde | **Hayır** (aynı kısıt + broker bağlantısı) |
| Kendi verimiz | **Hayır.** Resmi FAQ: yalnızca TradingView verisi, kendi veri API'si yok | **Evet** (`setData` / `update`) | Evet (Datafeed API) | Evet (Broker API) |
| Kendi çizim araçlarımız / overlay | Hayır (Pine ya da strateji bile eklenemiyor) | **Evet**: plugin API (custom series, series primitive, pane primitive). Hazır çizim aracı **yok**, ama resmi plugin örneklerinde Rectangle Drawing Tool, Trend Line, Vertical Line, Session Highlighting, User Defined Price Lines var | 80+ hazır çizim aracı + API | Evet |
| Saat dilimi | — | **Yerleşik destek yok** (resmi doküman). Kendimiz ele alacağız (bkz. Risk R1) | Var (dokümanda detaylı doğrulanmadı) | — |

Ek notlar:
- Lightweight Charts güncel doküman sürümü **5.2** (npm'deki tam sürüm M1 kurulumunda doğrulanacak).
- Atıf koşulu: kodda NOTICE metni ("TradingView Lightweight Charts™, Copyright (c) 2025 TradingView, Inc.") ve sayfada tradingview.com bağlantısı. `layout.attributionLogo` varsayılan olarak `true` ve resmi dokümana göre bu logo bağlantı koşulunu karşılıyor. **Logo açık kalacak**, NOTICE da README'ye ve Hakkında ekranına eklenecek.
- Primitive'lerde fare etkileşimi (`hitTest`) çekilen sayfalarda açıkça görünmedi → **doğrulanmadı**, M2 başında API referansından kontrol edilecek.
- Özel yatay ölçek davranışı (custom horizontal scale) seçeneği hatırlıyorum ama **doğrulanmadı** (bkz. R1).

**Öneri: Lightweight Charts v5.x.** Kişisel projede yasal olarak kullanılabilen, kendi CSV verimizi besleyebildiğimiz ve kendi overlay'lerimizi (aday FVG, session kutusu, USER/ENGINE katmanları) yazabildiğimiz tek seçenek bu. Advanced Charts lisans koşulları nedeniyle elenir. Widget'lar kendi veri ve motor çıktısı gösteremediği için elenir. Kullanıcı manuel gözlem için tradingview.com sitesini ayrıca kullanmaya devam edebilir; bu uygulamanın parçası değil.

## 3. Teknoloji önerisi
CLAUDE.md'deki varsayılan stack **onaylanıyor**. İki küçük netleştirme: pnpm yerine npm workspaces; saat dilimi için Luxon.

| Bağımlılık | Nerede | Gerekçe (tek satır) | Lisans |
|---|---|---|---|
| typescript | tümü | Motor ve arayüz aynı dil, strict mod | Apache-2.0 |
| vitest | engine, web | Vite ile uyumlu, hızlı birim testleri | MIT |
| luxon | engine | IANA saat dilimi ve DST hesabı `Intl` üzerinden. Alternatif: date-fns-tz (MIT) ya da Temporal polyfill (Temporal'ın tarayıcı/Node desteği doğrulanmadı) | MIT |
| zod | engine | Strateji JSON'u ve içe aktarma ayarlarının çalışma zamanı doğrulaması, tipten şema. Alternatif: elle doğrulayıcı | MIT |
| @noble/hashes | engine | Node ve tarayıcıda aynı sonucu veren saf SHA-256 (veri özeti, determinizm). Alternatif: WebCrypto (async ve motoru platforma bağlar) | MIT |
| vite, @vitejs/plugin-react | web | Geliştirme sunucusu ve derleme, Web Worker desteği | MIT |
| react, react-dom | web | Arayüz | MIT |
| lightweight-charts | web | Grafik (bkz. §2) | Apache-2.0 (+ NOTICE atıf) |
| papaparse | web (worker) | Büyük CSV'yi akış halinde, worker içinde ayrıştırma. Alternatif: elle yazılmış ayrıştırıcı | MIT |
| dexie | web | IndexedDB üzerinde indeksli sorgular (günlük filtreleme M3'te gerekecek). Alternatif: idb (ISC, daha çıplak) | Apache-2.0 |
| fake-indexeddb (dev) | web | Depolama katmanını Node'da test etmek | Apache-2.0 |
| eslint, typescript-eslint, prettier (dev) | tümü | Motorda `Date.now`, `Math.random`, `window`, `document`, `fetch` yasağını lint kuralıyla zorlamak | MIT |

Bilerek eklenmeyenler: durum yönetimi kütüphanesi (M1 için React state yeter), CSS framework'ü (CSS değişkenleri yeter), i18n kütüphanesi (tek `tr.ts` dosyası), Python.

## 4. Klasör yapısı
```
tradingbot/
├─ CLAUDE.md  DEVIR.md  README.md  NOTICE
├─ package.json            (npm workspaces: packages/*, apps/*)
├─ tsconfig.base.json  eslint.config.js  .prettierrc  .gitignore
├─ docs/
│  ├─ PLAN.md  DECISIONS.md
│  ├─ schema/strategy-v0.md
│  └─ definitions/          (M4: swing-v1.md, fvg-v1.md, …)
├─ packages/
│  └─ engine/               ← saf TS; DOM, ağ ve saat erişimi yok; apps'e bağımlılığı yok
│     ├─ src/
│     │  ├─ index.ts        (tek public API)
│     │  ├─ version.ts      (ENGINE_VERSION, semver)
│     │  ├─ core/           time.ts, timeframe.ts, tz.ts, hash.ts, types.ts
│     │  ├─ instruments/    registry.ts (tüm enstrüman metadata'sı TEK yerde)
│     │  ├─ data/           csv-rows.ts, validate.ts, normalize.ts, resample.ts, columnar.ts
│     │  ├─ session/        (M2)
│     │  ├─ features/       (M4) swing/, fvg/, structure/, sweep/, levels/, registry.ts
│     │  ├─ strategy/       (M5) schema.ts, validate.ts, refs.ts, matcher.ts
│     │  ├─ execution/      (M3/M5) fills.ts, ambiguity.ts  ← replay ve backtest ORTAK
│     │  ├─ risk/           (M5) sizing.ts, costs.ts
│     │  ├─ backtest/       (M5) run.ts, stats.ts, breakdowns.ts
│     │  └─ replay/         (M3) cursor.ts
│     └─ test/
│        ├─ fixtures/SYNTHETIC_*.csv   (küçük, elle yazılmış, içerikte SYNTHETIC satırı)
│        └─ *.test.ts
└─ apps/
   └─ web/                  ← Vite + React; motoru yalnızca index.ts üzerinden kullanır
      └─ src/
         ├─ main.tsx  App.tsx
         ├─ i18n/tr.ts                 (TÜM arayüz metinleri)
         ├─ theme/tokens.css           (koyu tema öncelikli)
         ├─ storage/                   db-market.ts, db-user.ts, db-strategy.ts, db-research.ts
         ├─ workers/                   import.worker.ts, compute.worker.ts
         ├─ chart/                     ChartView.tsx, lwc-adapter.ts, primitives/ (M2+)
         ├─ features/import/           ImportWizard.tsx, ValidationReportView.tsx
         ├─ features/workspace/        Toolbar, SymbolPicker, TimeframePicker, TimezonePicker
         └─ components/                EmptyState.tsx, DemoBadge.tsx
```

## 5. Veri modelleri (taslak)
Depolama: dört ayrı IndexedDB veritabanı: `trw-market`, `trw-user`, `trw-strategy`, `trw-research`. Eğitim içeriği repoda statik dosya olarak durur. Aşağıdaki `[alan]` etiketi verinin nerede saklandığını gösterir.

```ts
type UtcMs = number;              // Unix epoch ms, her zaman UTC
type IanaTz = string;             // "Europe/London"
type LocalTime = `${number}:${number}`; // "08:00"
type Timeframe = '1m'|'5m'|'15m'|'30m'|'1h'|'4h'|'1D'|'1W';
type Source = 'USER' | 'ENGINE';

// [market] — kod içindeki registry (varsayılanlar) + kullanıcı override'ı trw-market'te
interface Instrument {
  symbol: string;                       // "EURUSD"
  assetClass: 'FX' | 'METAL' | 'INDEX' | 'CRYPTO';
  base: string; quote: string;          // "EUR", "USD"
  tickSize: number;                     // 0.00001
  pipSize: number;                      // 0.0001; XAUUSD/endeks: yapılandırılabilir
  pricePrecision: number;               // 5
  contractSize: number;                 // 100000
  tradingHours:
    | { kind: 'FX_24_5'; weekOpen: { day: 'SUN'; time: LocalTime; tz: IanaTz }; weekClose: { day: 'FRI'; time: LocalTime; tz: IanaTz } }
    | { kind: 'ALWAYS' }
    | { kind: 'EXCHANGE'; tz: IanaTz; sessions: { days: number[]; start: LocalTime; end: LocalTime }[] };
  dailyClose: { time: LocalTime; tz: IanaTz };   // 1D/4H mum sınırı (bkz. Soru 3)
  metaVersion: number;
}

// [market] — mum AÇILIŞ zamanıyla anahtarlanır; kapanışta bilinir: knownAt = t + tfMs
interface Candle { t: UtcMs; o: number; h: number; l: number; c: number; v?: number }
// Depoda sütunlu parçalar halinde: { datasetId, chunkIndex, t: Float64Array, o, h, l, c, v }
// Yeniden örneklenmiş mumlar saklanmaz; taban veriden deterministik türetilir.
// Türetilmiş mum ek alanları: { complete: boolean; sourceCount: number; expectedCount: number }

// [market]
interface DataSet {
  id: string;
  instrument: string;
  baseTimeframe: Timeframe;             // içe aktarılan TF (tercihen 1m)
  priceType: 'BID' | 'ASK' | 'MID' | 'UNKNOWN';
  source: {
    name: string;                       // "Dukascopy", kullanıcı yazar; koşullar kullanıcının sorumluluğunda
    fileName: string;
    sourceTimezone: IanaTz;             // kullanıcı içe aktarırken seçer
    columnMapping: Record<string, string>;
    importedAt: UtcMs;
  };
  range: { from: UtcMs; to: UtcMs };
  candleCount: number;
  contentHash: string;                  // normalize mumların SHA-256'sı
  validation: ValidationReport;
  acceptedIssues: string[];             // kullanıcının bilerek kabul ettiği sorunlar (sessiz düzeltme yok)
  demo: boolean;                        // true ise her ekranda "DEMO VERİ", sonuçlar kaydedilmez
}
interface ValidationReport {
  duplicates: { t: UtcMs; identical: boolean; rows: number[] }[];
  outOfOrder: { row: number; t: UtcMs }[];
  gaps: { from: UtcMs; to: UtcMs; missingBars: number; expected: boolean /* hafta sonu vb. */ }[];
  weekendCandles: { t: UtcMs; row: number }[];
  nonPositive: { row: number; field: string }[];
  ohlcInconsistent: { row: number; t: UtcMs }[];
  dstAmbiguousOrMissing: { row: number; local: string; kind: 'AMBIGUOUS' | 'NONEXISTENT' }[];
  precisionOverflow: { row: number }[]; // tickSize'dan ince fiyat
  inferredTimeframe: Timeframe | null;
}

// [market] kod içindeki yerleşik tanımlar + [user] özel tanımlar
interface SessionDefinition {
  id: string; name: string;             // "LONDON"
  tz: IanaTz; start: LocalTime; end: LocalTime; // end < start → gece yarısını geçer
  days: number[];                       // yerel başlangıç günü (1=Pzt … 7=Paz)
  version: number; source: 'BUILTIN' | 'USER';
}
interface SessionInstance {             // türetilmiş; saklanmaz
  sessionId: string; startUtc: UtcMs; endUtc: UtcMs;
  high?: number; highAt?: UtcMs; low?: number; lowAt?: UtcMs;
  complete: boolean; knownAt: UtcMs;    // high/low ancak session bitince "kesin"
}

// [user] yalnızca USER çizimler saklanır; ENGINE çizimleri tespitlerden her seferinde türetilir
interface Drawing {
  id: string; source: Source;
  kind: 'HLINE' | 'VLINE' | 'TRENDLINE' | 'RECT' | 'PRICE_RANGE' | 'POSITION_LONG' | 'POSITION_SHORT' | 'TEXT';
  instrument: string; createdOnTimeframe: Timeframe;
  anchors: { t: UtcMs; p: number }[];   // UTC, TF'den bağımsız
  style: { color?: string; lineStyle?: 'SOLID' | 'DASHED'; label?: string };
  note?: string; locked: boolean; hidden: boolean;
  engineRef?: { detectionId: string; type: string; defVersion: string }; // yalnızca ENGINE
  createdAt: UtcMs; updatedAt: UtcMs;
}

// [user]
interface SupportResistanceLevel {
  id: string; source: Source; instrument: string;
  kind: 'SUPPORT' | 'RESISTANCE' | 'FLIP';
  price?: number; zone?: { top: number; bottom: number };
  timeframe: Timeframe; originAt: UtcMs;
  status: 'ACTIVE' | 'BROKEN' | 'RETESTED' | 'INVALIDATED';
  statusHistory: { status: string; at: UtcMs; note?: string }[];
  note?: string; tags: string[]; drawingId?: string;
}

// [strategy] tanımlar kodda versiyonlu yaşar; burada metadata sözleşmesi
interface FeatureDefinition<P = Record<string, unknown>> {
  type: 'SWING' | 'FVG' | 'STRUCTURE_BREAK' | 'LIQUIDITY_SWEEP' | 'SESSION_LEVEL' | 'PERIOD_LEVEL';
  version: string;                      // "v1"
  params: { name: string; kind: 'int' | 'number' | 'enum'; min?: number; max?: number; values?: string[]; default: unknown }[];
  confirmationDelayBars: (p: P) => number | 'VARIABLE'; // örn. SWING: p.right
  outputs: string[];                    // referans verilebilir alanlar: ["high","low","top","bottom","mid","time"]
  assumptions: string[]; knownFailures: string[];
  docPath: string;                      // docs/definitions/fvg-v1.md
}
interface Detection {                   // motor çıktısı; saklanmaz, türetilir
  id: string;                           // deterministik: type+ver+paramsHash+formedAt
  type: string; defVersion: string; paramsHash: string;
  direction?: 'BULLISH' | 'BEARISH';
  formedAt: UtcMs; formedIndex: number;       // olayın geçmişteki mumu
  confirmedAt: UtcMs; confirmedIndex: number; // bilindiği mumun KAPANIŞI
  fields: Record<string, number>;       // top, bottom, high, low…
}

// [strategy]
type StrategyStatus = 'IDEA' | 'RESEARCH' | 'TESTING' | 'VALIDATED_ON_SAMPLE' | 'PAPER' | 'LIVE_CANDIDATE';
interface Strategy { id: string; name: string; description: string; latestVersion: number; tags: string[]; createdAt: UtcMs }
interface StrategyVersion {
  strategyId: string; version: number;
  spec: StrategySpecV0;                 // DEĞİŞMEZ
  specHash: string;
  parentVersion?: number; changeNote: string; createdAt: UtcMs;
  status: StrategyStatus;               // yaşam döngüsü: spec dışında, değişebilir, geçmişi tutulur
  statusHistory: { status: StrategyStatus; at: UtcMs; evidenceRunIds: string[] }[];
}

// [research]
interface BacktestRun {
  id: string; runAt: UtcMs;             // uygulama verir, motor saat okumaz
  engineVersion: string;
  strategy: { id: string; version: number; specHash: string };
  definitionVersions: Record<string, string>;
  data: { datasetId: string; contentHash: string; sourceName: string; timeframe: Timeframe; from: UtcMs; to: UtcMs };
  split: { role: 'FULL' | 'IN_SAMPLE' | 'OUT_OF_SAMPLE'; boundary?: UtcMs };
  costs: { spreadPips: number; commissionPerLotPerSide: number; slippagePips: number };
  risk: { startEquity: number; accountCcy: 'USD'; percentPerTrade: number; lotStep: number; minLot: number };
  ambiguity: 'STOP_FIRST' | 'TARGET_FIRST' | 'LOWER_TF_ELSE_STOP_FIRST';
  seed?: number; experimentId?: string;
}
interface BacktestResult {
  runId: string;
  stats: {
    trades: number; wins: number; losses: number; winRate: number; avgR: number; expectancyR: number;
    profitFactor: number | null; maxDrawdownPct: number; maxDrawdownR: number;
    longestWinStreak: number; longestLossStreak: number; largestWinR: number; largestLossR: number;
  };
  equity: { t: UtcMs; equity: number; drawdownPct: number }[];
  rDistribution: { bucket: string; count: number }[];
  breakdowns: { monthly: Row[]; bySession: Row[]; byWeekday: Row[] };
  honesty: {
    lowSampleWarning: boolean;          // trades < 30
    ambiguousBarTrades: number; skippedSetupsDataGap: number; skippedSetupsSizeTooSmall: number;
    skippedSetupsInvalidStop: number; expiredOrders: number; totalCosts: number;
  };
}

// [research] backtest işlemleri; [user] replay işlemleri. Şema ortak.
interface Trade {
  id: string; origin: 'BACKTEST' | 'REPLAY' | 'PAPER'; runId?: string; replaySessionId?: string;
  instrument: string; direction: 'LONG' | 'SHORT'; setupDetectionIds: string[];
  signalAt: UtcMs; orderType: 'MARKET' | 'LIMIT' | 'STOP'; entryAt: UtcMs; entryPrice: number;
  stop: number; target: number;
  exitAt: UtcMs; exitPrice: number;
  exitReason: 'SL' | 'TP' | 'EXPIRED' | 'SESSION_END' | 'END_OF_DATA' | 'MANUAL';
  lots: number; riskAmount: number; rMultiple: number; pnl: number;
  costs: { spread: number; commission: number; slippage: number };
  maeR: number; mfeR: number; barsHeld: number;
  ambiguous: boolean;                   // aynı mumda SL ve TP
  session: string | null; weekday: number;
}

// [user]
interface JournalEntry {
  id: string; createdAt: UtcMs;
  trade?: { origin: Trade['origin']; tradeId: string };
  instrument: string; session: string | null;
  strategy?: { id: string; version: number };
  reason: string;
  emotion: 'CALM' | 'CONFIDENT' | 'FOMO' | 'FEAR' | 'REVENGE' | 'BORED' | 'OTHER'; emotionIntensity: 1 | 2 | 3 | 4 | 5;
  screenshotBlobIds: string[]; tags: string[]; lesson?: string;
}

// [research]
interface ResearchExperiment {
  id: string; hypothesis: string; createdAt: UtcMs;
  strategyId: string; baseVersion: number;
  inSample: { from: UtcMs; to: UtcMs }; outOfSample: { from: UtcMs; to: UtcMs };
  trialCount: number;                   // IS üzerinde denenen parametre seti sayısı (aşırı optimizasyonu görünür kılar)
  inSampleRunIds: string[]; outOfSampleRunIds: string[];
  status: 'OPEN' | 'CONCLUDED' | 'ABANDONED'; conclusion?: string;
}
```

## 6. Strateji şeması v0
```ts
interface StrategySpecV0 {
  schema: 'strategy/v0';
  instrument: string; timeframe: Timeframe; direction: 'LONG' | 'SHORT';
  window?: { start: LocalTime; end: LocalTime; tz: IanaTz; days?: number[] };  // sinyal yalnızca bu pencerede
  sequence: Step[];                     // sıralı; en az 1 olay adımı + tam olarak 1 giriş adımı (son adım)
  stop: StopRule; target: TargetRule;
  risk: { percentPerTrade: number };
  limits?: { maxTradesPerDay?: number; oneOpenPosition: true; closeAtWindowEnd?: boolean };
  definitions: Record<string, string>;  // kullanılan her tip → tanım versiyonu
}
type Step = EventStep | EntryStep;
interface EventStep {
  id: string;                           // /^[a-z][a-z0-9_]*$/, benzersiz
  type: 'SWING' | 'LIQUIDITY_SWEEP' | 'STRUCTURE_BREAK' | 'FVG' | 'LEVEL_TOUCH' | 'CLOSE_BEYOND';
  params: Record<string, unknown>;      // tipin tanımına göre zod ile doğrulanır
  within?: { after: string; maxBars: number };  // önceki adım + mum penceresi
}
interface EntryStep {
  id: 'entry';
  type: 'MARKET_NEXT_OPEN' | 'LIMIT_AT' | 'STOP_AT';
  params: { ref?: Ref };                // LIMIT_AT/STOP_AT için zorunlu
  within?: { after: string; maxBars: number };
  expireBars: number;                   // emir kaç mum geçerli
}
type StopRule =
  | { type: 'BEYOND_REF'; params: { ref: Ref; bufferPips: number } }   // LONG: ref altı, SHORT: ref üstü
  | { type: 'FIXED_PIPS'; params: { pips: number } };
type TargetRule =
  | { type: 'R_MULTIPLE'; params: { r: number } }
  | { type: 'AT_REF'; params: { ref: Ref; bufferPips?: number } }
  | { type: 'FIXED_PIPS'; params: { pips: number } };
type Ref = string;                      // bkz. sözdizimi
```

**Adım tipleri (v0):**
| Tip | Temel parametreler | Referans alanları |
|---|---|---|
| SWING | `kind: HIGH\|LOW`, `left`, `right` | `price`, `time` |
| LIQUIDITY_SWEEP | `level: ASIA_HIGH\|ASIA_LOW\|LONDON_HIGH\|LONDON_LOW\|PREV_DAY_HIGH\|PREV_DAY_LOW\|PREV_WEEK_HIGH\|PREV_WEEK_LOW\|SWING_HIGH\|SWING_LOW`, `confirm: CLOSE_BACK_INSIDE\|WICK_ONLY`, `maxBarsToReclaim` | `level`, `high`, `low`, `extreme` |
| STRUCTURE_BREAK | `direction`, `swingLeft`, `swingRight`, `breakBy: CLOSE\|WICK` | `brokenLevel`, `high`, `low` |
| FVG | `direction`, `minSizePips` | `top`, `bottom`, `mid` |
| LEVEL_TOUCH | `level` (yukarıdaki seviye listesi ya da Ref), `tolerancePips` | `level` |
| CLOSE_BEYOND | `ref`, `side: ABOVE\|BELOW` | `close` |

**Referans sözdizimi:** `stepId.field` (örn. `fvg.top`, `sweep.low`) ya da `level.NAME` (örn. `level.PREV_DAY_HIGH`, sinyal anında bilinen değer). Dilbilgisi: `Ref := (StepId | "level") "." Field`. İfade yok (toplama ve çarpma yok); tampon ayrı parametreyle verilir.

**Zaman penceresi semantiği:** `within: { after: X, maxBars: N }` → adayın `confirmedIndex` değeri X'in eşleşen tespitinin `confirmedIndex` değerinden **büyük ya da eşit** olmalı ve farkı **en fazla N** mum olmalı. Birden fazla aday varsa **en erken** onaylanan seçilir (deterministik). `within` yoksa bir önceki adımdan sonra, aynı pencere/gün içinde herhangi bir zaman.

**Doğrulama kuralları (statik, kayıttan önce):**
1. `schema`, `timeframe`, `instrument` (registry'de var mı), `direction` geçerli.
2. Adım id'leri benzersiz ve regex'e uyuyor; son adım `entry`, ondan başka giriş adımı yok.
3. Her `Ref` yalnızca **kendinden önceki** adımlara ya da `level.*`'a işaret ediyor; alan o tipin `outputs` listesinde var.
4. `within.after` önceki bir adım; `maxBars` ≥ 1; `expireBars` ≥ 1.
5. Parametreler tanımın aralıklarında (zod); `definitions` kullanılan her tipi kapsıyor ve bu versiyonlar motorda mevcut.
6. `window.tz` geçerli IANA; `start ≠ end`.
7. Yön tutarlılığı **uyarı** (hata değil): LONG + BEARISH yapı kırılımı gibi.
8. `risk.percentPerTrade` 0 < x ≤ 5 (üst sınır ayarlanabilir).

**Çalışma zamanı kuralları (setup atlanır ve sayılır):** stop giriş fiyatının yanlış tarafında; stop mesafesi sıfır; lot < minLot; veri boşluğu pencereye denk geldi.

**v0'ın ifade EDEMEDİKLERİ (bilerek):**
- VEYA / alternatif dallar, olumsuzlama ("FVG yoksa…").
- Çoklu zaman dilimi koşulu (HTF yön filtresi). Yalnızca `level.*` önceki gün/hafta değerleri istisna.
- İndikatörler (MA, RSI, ATR), ATR tabanlı stop.
- Pozisyon yönetimi: breakeven, kısmi kâr alma, trailing stop, pozisyon ekleme.
- Aynı anda birden fazla pozisyon, çoklu enstrüman ya da korelasyon.
- Haber veya ekonomik takvim filtresi.
- Aday seçiminde "en son" ya da "en büyük" gibi seçim kuralları (yalnızca en erken).
- Aritmetik referans ifadeleri (`fvg.mid + 2 pip` gibi; tampon parametre dışında).

## 7. Motor akışı
```
 CSV (kullanıcı TZ)                              [apps/web: worker]
   │ parse (papaparse)                           
   ▼                                              
 data/csv-rows → validate → ValidationReport ──► kullanıcı onayı (sessiz düzeltme yok)
   │ normalize: yerel→UTC, tickSize, hash
   ▼
 Taban seri (1m, sütunlu, UTC) ──► resample(tf, instrument.dailyClose) ──► Candle[] (+complete)
   │
   ▼
 session engine: SessionInstance[] (high/low knownAt = session sonu)
   │
   ▼
 feature engine: Detection[]  { formedIndex, confirmedIndex }   ← TEK kaynak
   │
   ▼
 strategy/matcher: sıra + within + window → Setup[] (her setup confirmedIndex'i = son adımın)
   │
   ▼
 risk: stop/target/lot → Order[]      execution: fills + ambiguity (ORTAK modül)
   │                                         │
   ├──────────────► backtest/run ◄───────────┤──► stats / honesty
   ├──────────────► replay/cursor (i'ye kadar kesilmiş girdi) ◄─┘
   └──────────────► grafik adaptörü (ENGINE katmanı, "Aday …" etiketleri)
```

**Grafikteki setup = backtest'teki setup:** Motor tek bir saf fonksiyon sunar: `computePipeline(candles, config) → { sessions, detections, setups }`. Grafik (worker'da çalışır), replay ve backtest bu fonksiyonun çıktısını kullanır; hiçbiri kendi tespit mantığını yazmaz. Arayüzde yalnızca **görüntüleme dönüşümü** olur (Detection → primitive). Test: aynı fixture'da `computePipeline` çıktısı ile backtest'in kullandığı setup listesi eşit (`toEqual`).

**Lookahead engeli (onay zamanı):**
- Her tespit `formedIndex` ve `confirmedIndex` taşır. Swing için `confirmedIndex = formedIndex + right`. FVG için 3. mumun kapanışı. Sweep için geri-kapanış mumunun kapanışı.
- Matcher, `i` mumunda yalnızca `confirmedIndex ≤ i` olan tespitleri görür. Emir en erken `i+1` mumunda aktif olur.
- Session high/low seviyeleri `knownAt` sonrasında referans alınabilir.
- Replay imleci `k` iken grafik yalnızca `confirmedIndex ≤ k` olan tespitleri çizer. İşaret formedIndex'e konur ama "onay: +N mum" etiketi taşır.
- **Kesme değişmezliği testi** (her feature için zorunlu): `computePipeline(data[0..k])` sonucu, `computePipeline(data[0..n])` içinde `confirmedIndex ≤ k` olan tespitlerle birebir aynı. Küçük fixture'larda tüm `k` değerleri için döngüyle.
- Lint: motorda `Date.now`, `new Date()` (argümansız), `Math.random`, DOM ve ağ global'leri yasak.

**Aynı mumda SL/TP ve dolum kuralları (`execution/`):**
- Fiyat serisi BID varsayılır (bkz. Soru 1). LONG girişi ASK = BID + spread; LONG çıkışı BID. SHORT tersi; SHORT stop'u `high + spread ≥ stop` olunca tetiklenir.
- Limit: mum aralığı limite değerse dolar. Açılış limitten iyiyse (gap) açılıştan dolar. Stop emri ve SL: gap ile açılış stop'u geçmişse **açılıştan** dolar (daha kötü fiyat). Market ve stop dolumlarına kayma uygulanır, limit dolumlarına uygulanmaz.
- Bir mum hem SL'e hem TP'ye değerse `ambiguity` ayarı uygulanır: varsayılan `STOP_FIRST`. `LOWER_TF_ELSE_STOP_FIRST`: aynı veri kümesinde daha düşük TF (örn. 1m) varsa o mumun içi sırayla oynatılır; 1m mumu da belirsizse stop önce. Etkilenen her işlem `ambiguous: true` alır ve `honesty.ambiguousBarTrades` sayılır.
- **Giriş mumu:** emir dolduğu mumda stop da aralıktaysa kötümser kabul (stop). TP aynı mumda sayılmaz (dolumdan sonra mı geldiği bilinemez); düşük TF varsa çözülür. Bu durum da belirsiz sayılır.
- `expireBars` dolunca emir iptal ve `expiredOrders++`. Pencere sonunda kapatma opsiyonel.
- Lot = floor(risk tutarı / (stop mesafesi × pip değeri) , lotStep). USD kote: pip değeri = contractSize × pip. USD baz: ÷ fiyat. Çapraz: dönüşüm kuru gerekir (bkz. R5).

## 8. M1 görev listesi
Her görev küçük bir commit. Motor görevleri test ile birlikte gelir.

| # | Görev | Bitti kriteri | Testler |
|---|---|---|---|
| 1 | `git init`, npm workspaces, `tsconfig.base` (strict), ESLint (motor yasak global kuralları dahil), Prettier, Vitest, `.gitignore`, README + NOTICE | `npm test` ve `npm run lint` yeşil; `npm run dev` boş sayfa açıyor | Motor için smoke test; lint kuralının `Date.now` yakaladığını gösteren negatif örnek |
| 2 | `core/timeframe.ts`, `core/tz.ts` (Luxon): yerel duvar saati → UTC (belirsiz/olmayan saatleri **raporlar**), UTC → yerel biçim, TF ms | API dokümante, yüzde yüz dal kapsamı | Londra ve New York DST haftaları (Mart ve Ekim/Kasım, farklı haftalar), Istanbul (sabit +3), geri alınan saatte tekrar eden 01:xx, ileri alınan saatte olmayan 01:xx |
| 3 | `instruments/registry.ts`: EURUSD, GBPUSD, USDJPY, XAUUSD (+ Soru 2'ye göre) | Tüm metadata tek dosyada, yapılandırılabilir pip | pip, tick ve precision değerleri; bilinmeyen sembol hatası |
| 4 | `data/csv-rows.ts`: satır dizisi + kolon eşlemesi + tarih biçimi → ham kayıt (saf; papaparse arayüz tarafında) | Soru 1'deki biçim(ler) + genel eşleme | `SYNTHETIC_eurusd_1m_small.csv` gibi elle yazılmış fixture'lar; başlıklı/başlıksız, ayraç `,` `;` `\t`, ondalık virgül reddi |
| 5 | `data/validate.ts`: tekrar (aynı/çakışan), sıralama, boşluk (işlem saatlerine göre beklenen/beklenmeyen), hafta sonu mumu, sıfır/negatif, OHLC tutarlılığı, tick hassasiyeti, TF çıkarımı | Rapor üretir, **hiçbir şeyi değiştirmez** | Her sorun türü için ayrı fixture; temiz fixture'da boş rapor |
| 6 | `data/normalize.ts` + `core/hash.ts`: UTC'ye çevirme, kullanıcı onaylı düzeltmeler (örn. "sırala", "birebir aynı tekrarları at") açık ve kayıtlı, SHA-256 içerik özeti | Aynı girdi → aynı hash; uygulanan her düzeltme `acceptedIssues`'da | Determinizm; tek fiyat değişince hash değişiyor; onaysız düzeltme yapılmıyor |
| 7 | `data/resample.ts`: 1m → 5m/15m/30m/1h/4h/1D/1W; 4H ve 1D sınırı `instrument.dailyClose`'a (DST'li) hizalı; eksik dakikalar `sourceCount` ile; son mum `complete:false` | CLAUDE.md M1 kriteri: yeniden örnekleme testleri geçiyor | Mum sınırları, eksik mumlar, günlük kapanış saati DST öncesi ve sonrası, hafta açılışı (Pazar), boş aralık mum üretmiyor, OHLCV birleştirme doğruluğu, 1m→15m→1h ile 1m→1h eşitliği |
| 8 | `apps/web` iskeleti: koyu tema token'ları, `i18n/tr.ts`, yerleşim, **boş durum ekranı** (veri yok → sonuç yok) | Veri yokken yalnızca "Veri yok — CSV içe aktar" görünüyor | Bileşen testi: veri yokken grafik ve istatistik bileşenleri render edilmiyor |
| 9 | Depolama: `trw-market` (Dexie), sütunlu parça yazma/okuma; diğer 3 DB boş şema | Veri kümesi yazılıp yeniden yüklenince hash aynı | fake-indexeddb ile gidiş-dönüş, parça sınırları |
| 10 | İçe aktarma sihirbazı (worker): dosya seç → kolon eşleme → kaynak adı, **kaynak saat dilimi**, enstrüman, fiyat tipi → doğrulama raporu → kabul/iptal → kaydet | Sorunlu dosyada rapor görünüyor, kullanıcı bilinçli kabul etmeden kayıt yok | Worker mesaj protokolü birim testi; ilerleme ve iptal |
| 11 | Grafik: `chart/lwc-adapter.ts` + `ChartView`: mum + hacim paneli, UTC zaman, etiketler seçilen IANA dilimde biçimlenir (bkz. R1), atıf logosu açık | 1m…4H/1D arası geçiş, crosshair OHLC göstergesi, zoom/pan | Adaptör: UTC ↔ chart time dönüşümü, DST gecesinde zaman damgaları kesin artan |
| 12 | Araç çubuğu: veri kümesi/sembol seçici, TF seçici (yalnızca ≥ taban TF), saat dilimi seçici (İstanbul, Londra, New York, Tokyo, UTC), tarihe git | Tercihler `trw-user`'da kalıcı | Tercih gidiş-dönüş |
| 13 | **Kabul:** kullanıcının gerçek CSV'si yüklenir; 1m, 15m, 1h ve 4H görüntülenir; 3 rastgele 4H mumu elle (ya da kaynak platformla) karşılaştırılır; `DEVIR.md` güncellenir | CLAUDE.md M1 "bitti" tanımı | Tüm test paketi yeşil; kabul notları DEVIR.md'de |

## 9. Riskler ve açık sorular

**Teknik riskler**
- **R1 Saat dilimi gösterimi.** Lightweight Charts saat dilimini desteklemiyor. Resmi öneri zaman damgalarını kaydırmak, ama sonbahar DST geri alımında kaydırılmış zamanlar **tekrar eder** ve kütüphane kesin artan zaman bekler (hata ya da bozuk grafik). Plan: veriyi UTC ile beslemek, etiketleri `localization.timeFormatter` ve `tickMarkFormatter` ile seçilen dilimde biçimlemek. Tick yerleşimi UTC günlerine göre olabilir; özel yatay ölçek seçeneği **doğrulanmadı**, M1 görev 11'de denenecek.
- **R2 Veri hacmi.** 5 yıllık 1m ≈ 1,8M mum. IndexedDB'ye sütunlu yazma, bellekteki Float64Array'ler ve 1m'de tüm seriyi `setData`'ya vermek yavaş olabilir. Önlem: parçalı yükleme, görünür aralığa göre pencere, worker. M1'de ölçülecek.
- **R3 Günlük/4H mum sınırı.** Farklı kaynaklar farklı kapanış kullanıyor (NY 17:00, UTC 00:00, broker sunucu saati). Yanlış seçim tüm D/4H analizini ve "önceki gün high/low"u değiştirir (Soru 3).
- **R4 tzdata farkı.** Luxon, `Intl`'ın saat dilimi verisini kullanır; Node ve tarayıcı farklı tzdata sürümleri taşıyabilir. Güncel yıllar için pratikte sorun beklenmez, ama determinizm kaydı için motor sürümüyle birlikte not edilecek.
- **R5 Çapraz paritelerde lot hesabı.** EURGBP gibi paritelerde hesap para birimine çevirmek için eşzamanlı ikinci veri kümesi gerekir; yoksa işlem atlanmalı ya da kullanıcı sabit kur girmeli (M5'te karar).
- **R6 Kavram tanımları.** ICT/SMC tanımlarının resmi karşılığı yok; kullanıcının öğrendiği tanımla motorun tanımı farklı olabilir. Tanım dokümanları ve "aday" dili bunu yönetir.
- **R7 Kayan nokta.** Fiyatlar float64. Karşılaştırmalar tickSize'a yuvarlanmış değerlerle yapılacak, testlerde epsilon kullanılmayacak.

**Sorular (en fazla 5)**
1. **Veri kaynağı ve biçim:** Elinde hangi CSV var ya da nereden alacaksın (MT4/MT5 dışa aktarımı, Dukascopy, HistData, başka)? Dosyanın saat dilimi ve fiyat tipi (BID/ASK/orta) biliniyor mu? Mümkünse ilk 5 satırı paylaşabilir misin?
2. **Enstrümanlar:** Hangileriyle başlayalım? Önerim EURUSD + GBPUSD + XAUUSD. XAUUSD'de 1 pip'i 0.1 mi, 0.01 mi kabul ediyorsun? Endeks (US30, NAS100) M1'de gerekli mi?
3. **Günlük mum kapanışı:** Forex'te yaygın olan **17:00 New York** (DST'ye göre kayar) mı, 00:00 UTC mi, yoksa broker sunucu saati mi? 4H mumları da buna hizalanacak.
4. **Veri hacmi:** 1m taban veriden kaç yıl yüklemeyi planlıyorsun? (Performans tasarımını belirliyor.)
5. **Git:** Yalnızca yerel git deposu yeterli mi, yoksa bir GitHub (özel) reposuna da bağlamak istiyor musun?

## Onay sonrası yapılacaklar (bu oturumda, kod yok)
1. Bu planı `docs/PLAN.md` olarak kaydet (Türkçe; kod blokları aynen).
2. `docs/DECISIONS.md`: karar kayıtları (ADR biçimi, kısa): D1 Lightweight Charts, D2 npm workspaces + TS/Vite/React/Vitest, D3 Luxon, D4 dört ayrı IndexedDB, D5 yalnızca taban TF saklanır ve TF'ler türetilir, D6 StrategyVersion.spec değişmez ama status değişebilir, D7 onay zamanı modeli ve kesme değişmezliği testi, D8 STOP_FIRST varsayılanı ve giriş mumu kuralı, D9 grafik UTC beslenir, etiketler biçimlenir. Soruların cevapları da buraya işlenir.
3. `DEVIR.md`: yapılanlar (M0), kalanlar (M1 görev listesi), açık sorular, çalıştırma ve test komutları ("henüz yok, M1 görev 1'de gelecek").
4. M1'e **yalnızca kullanıcı "başla" deyince** geçilir.

## Doğrulama (M0 için)
- Kaydedilen üç dosyanın bu planla birebir tutarlı olduğunu okuyup kontrol et; kod ya da bağımlılık oluşturulmadığını dizin listesiyle teyit et.

## Kaynaklar
- https://www.tradingview.com/free-charting-libraries/
- https://tradingview.github.io/lightweight-charts/docs
- https://tradingview.github.io/lightweight-charts/docs/time-zones
- https://tradingview.github.io/lightweight-charts/docs/plugins/intro
- https://tradingview.github.io/lightweight-charts/plugin-examples/
- https://tradingview.github.io/lightweight-charts/docs/api/interfaces/LayoutOptions
- https://github.com/tradingview/lightweight-charts/blob/master/NOTICE
- https://www.tradingview.com/charting-library-docs/latest/getting_started/Frequently-Asked-Questions/
- https://www.tradingview.com/widget-docs/faq/data/
- https://www.tradingview.com/widget-docs/faq/general/
