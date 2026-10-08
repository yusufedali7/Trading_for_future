# Proje briefi — Trading Research Workstation

> Bu dosya, projeyi **başka kaynaklarla / araçlarla / topluluklarla** paylaşmak için hazırlandı (örn. bir GitHub issue'ya, bir forum sorusuna, başka bir AI aracına yapıştırmak için). Türkçe ana metin + sonda İngilizce kısa özet var, çünkü çoğu dış kaynak (GitHub, Hugging Face, Reddit) İngilizce.
>
> Hassas bilgi yok (API anahtarı, hesap numarası, kişisel veri paylaşılmıyor) — güvenle dışarı kopyalanabilir.

## Ne inşa ediyoruz

**Trading Research Workstation**: forex öğrenen bir bireyin kendi trading fikirlerini objektif kurallara dökebildiği, grafikte görebildiği, geçmiş veride dürüstçe test edebildiği ve sonuçları ölçebildiği, yerel/tek-kullanıcılı bir araştırma masası. **Bir "AI bana ne alıp satacağımı söylesin" uygulaması değil.** Temel döngü:

```
MANUEL GÖZLEM → KURALA DÖKME → BACKTEST → İSTATİSTİK → KARŞILAŞTIRMA → PAPER TRADE
```

## Mutlak sınırlar (pazarlık konusu değil)

- Gerçek para ile **hiçbir zaman** otomatik emir gönderilmez; broker bağlantısı (MT5, demo) yalnızca fiyat **okumak** için var.
- Sistem hiçbir zaman ölçülmemiş bir "kazanma olasılığı" ya da "al/sat sinyali" üretmez. Her sayısal iddia bir backtest kaydına referans verir.
- İleriye bakma (lookahead) yasak: her hesap, o anda zaten "bilinen" veriyle yapılır; test edilirken bu açıkça doğrulanıyor.
- Aynı veri + aynı strateji versiyonu + aynı motor versiyonu → birebir aynı sonuç (determinizm).
- Sentetik/demo veri asla gerçek sonuç gibi sunulmaz.

## Teknik yapı (şu an)

- **Dil:** TypeScript (motor + arayüz aynı dil). Python yalnızca ileride isteğe bağlı araştırma script'leri için (örn. oracle doğrulama — TA-Lib).
- **`packages/engine`**: saf, deterministik TS motoru (DOM/ağ/saat erişimi yok). Session, feature (swing/FVG/yapı kırılımı/likidite süpürmesi), indikatör (SMA/EMA/RSI/ATR/MACD/Bollinger/VWAP + genel seri dönüşümleri), ve ayrı bir mum-formasyonu katalog sistemi (`patterns/`).
- **`apps/web`**: Vite + React. Grafik: TradingView Lightweight Charts (Apache-2.0). IndexedDB depolama + tam JSON/CSV yedekleme (veri kalıcılığı garanti edilmiyor, her şey dışa aktarılabilir olmak zorunda).
- **Canlı veri:** MetaTrader 5 demo hesabından **yalnızca okuma** yapan yerel bir Python köprüsü (emir gönderemez).
- Test: Vitest, >480 test; yeni her indikatör/dedektör pozitif+negatif sentetik test, ileriye-bakmama testi, mümkünse üçüncü parti bir "oracle" ile karşılaştırma (örn. TA-Lib) ister.

## Şu ana kadar yapılanlar

Veri içe aktarma + grafik, seans analizi, replay + günlük, swing/FVG/yapı kırılımı/likidite süpürmesi tespiti (hepsi "aday" etiketli, "kesin" denmiyor), strateji oluşturucu + maliyetli backtest, araştırma lab'ı (in-sample/out-of-sample), MT5 köprüsü + paper trading, 23 çizim aracı, yedekleme/dışa aktarma, 7 indikatör, ve mum formasyonu kataloğunun ilk dilimi (Doji/Engulfing/Marubozu, TA-Lib ile doğrulanmış).

## Şu an aradığımız şey (bu kaynak taraması bunun için)

1. **ICT/Smart Money Concepts alt kavramları için tanım/parametre referansı** — displacement, order block, inversion FVG, breaker, equal highs/lows, premium/discount, optimal trade entry, aday destek/direnç. Tek bir "resmi" tanım yok; farklı açık kaynak projelerin bunu nasıl parametrik hale getirdiğini görmek istiyoruz (kod kopyalamıyoruz, tanım/parametre karşılaştırması yapıyoruz).
2. **Mum formasyonu (candlestick) ve grafik formasyonu (chart pattern) tespit algoritmaları**, özellikle TA-Lib'in kapsamadığı harmonik formasyonlar (Gartley, Bat, Butterfly, Crab, Shark, Cypher) ve pivot-tabanlı grafik formasyonları (H&S, double top/bottom, üçgen, kanal).
3. **Backtest motoru mimarisi karşılaştırması** — aynı mumda SL/TP çakışması, slippage/spread modelleme, emir doldurma sırası gibi konularda kurumsal açık kaynak motorların (QuantConnect Lean, backtrader) ne yaptığı.

## Bilerek kullanmadığımız/aramadığımız şeyler

- AI/LLM tabanlı "tahmin" veya "sinyal" modelleri (FinGPT, FinRL, XAUUSD "trading AI" modelleri gibi) — bizim felsefemizle doğrudan çatışıyor, ölçülmemiş olasılık üretiyorlar.
- Otomatik emir gönderen herhangi bir sistem/şablon (n8n "AI yorumla + Coinbase'e emir gönder" gibi) — gerçek para kuralımızla çatışıyor.
- Ücretli/kapalı kaynak sinyal servisleri, forum EA'leri (kalite/doğruluk garantisiz, genelde "kanıtsız karlılık" iddiası taşıyor).

## Lisans/güvenlik notu

Hangi açık kaynak projeden ne alınırsa alınsın (tanım, parametre, algoritma fikri), kullanmadan önce lisansı kontrol ediyoruz (AGPL/GPL gibi kopyalamaya kapalı lisanslar varsa sadece "fikir" olarak okunur, kod alınmaz) ve kendi testimizle (mümkünse bağımsız bir oracle ile) doğruluyoruz.

---

## English TL;DR (for pasting into GitHub issues / Reddit / other tools)

I'm building a **local, single-user trading *research* workstation** for learning forex — not an auto-trading bot. Core loop: manual observation → encode as objective rule → backtest on real historical data → measure → compare → paper trade. Hard constraints: **never places real orders** (broker connection is read-only, demo account), **never fabricates win probabilities or buy/sell signals** (every numeric claim must trace to a backtest record), **no lookahead** (every calculation only uses data known at that candle's close, verified with dedicated tests), and **full determinism** (same data + strategy version + engine version → identical results). Stack: TypeScript engine (`packages/engine`, pure, no DOM/network/clock access) + React/Vite app, TradingView Lightweight Charts, IndexedDB with mandatory JSON/CSV export (no durable-storage assumption). Currently extending a candlestick/chart-pattern catalog (candlestick patterns verified against TA-Lib as an oracle) and an ICT/Smart-Money-Concepts detection layer (swing, FVG, structure break, liquidity sweep — all surfaced as "candidate", never "confirmed"). Looking for: (1) how other open-source projects parametrize ICT/SMC sub-concepts (order blocks, breaker, premium/discount, OTE), (2) candlestick/harmonic/chart-pattern detection algorithms not covered by TA-Lib, (3) backtest engine design patterns for same-bar SL/TP ambiguity and fill/slippage modeling. **Not** looking for AI "prediction" models or auto-order-execution templates — those conflict with the project's core rules.
