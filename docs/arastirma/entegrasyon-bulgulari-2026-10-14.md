# Entegrasyon bulguları: Yüksek/Orta fayda kaynakların derinlemesine incelemesi

> Tarih: 14 Ekim 2026. Kapsam: [dis-kaynaklar-trading-botlari.md](dis-kaynaklar-trading-botlari.md)'deki
> **Yüksek** ve **Orta** fayda etiketli tüm kaynaklar (14 repo + 2 n8n şablonu), 4 paralel
> araştırma oturumuyla derinlemesine incelendi (README ötesi: kaynak kod, lisans dosyaları,
> GitHub API, bağımsız çapraz kontrol). Bu bir **araştırma raporu** — hiçbir kod değişikliği
> yapılmadı, hiçbir bağımlılık eklenmedi. Amaç: hangi kaynaktan ne alınabilir, ne alınamaz,
> somut sonraki adım ne.

## Nasıl okunmalı

Her kaynak için: lisans (doğrulanmış), gerçekte ne var (README ötesi), bizim kataloğumuzla
karşılaştırma, entegrasyon önerisi, somut sonraki adım. **Kural 8** (yetenek uydurma) gereği
hiçbir sayısal eşik/oran/formül bu raporda doğrudan "doğru" kabul edilmedi — ya bağımsız
çapraz kontrol yapıldı ya da "doğrulanmadı" olarak işaretlendi.

---

## 1. Backtest motorları

### QuantConnect/Lean
- **Lisans:** Apache-2.0 (doğrulandı).
- **Ne var:** Backtest/live aynı Engine/Algorithm kod tabanı (bizim "tek motor iki tüketici"
  ile örtüşüyor). Enstrüman metadata'sı (`SymbolProperties`), fill mantığı (`FillModel`),
  komisyon (`FeeModel`), kaldıraç (`SecurityMarginModel`) dört ayrı, pluggable bileşen.
  Kaynak kodun satır-satır fill mantığı bu oturumda doğrulanamadı (erişim yetersiz).
- **Entegrasyon:** Sadece mimari fikir — ayrıştırılmış pluggable model deseni,
  `packages/engine/src/execution/fills.ts`'i gözden geçirirken referans olabilir.
- **Sonraki adım:** `packages/engine/src/instruments/` alan listesini Lean'in
  `SymbolProperties` alanlarıyla (pip/lot/tick/kote para/işlem saatleri) karşılaştır.

### nautechsystems/nautilus_trader
- **Lisans:** LGPL-3.0-only (kopyleft, kod kopyalanamaz).
- **Ne var:** Rust çekirdek + Python katmanı; backtest/sandbox/live aynı `NautilusKernel`'i
  paylaşıyor, ortam farkı yalnızca Data/Execution Client adaptörlerinde ("Ports & Adapters").
  Tek-thread deterministik mesaj dispatch. README kendi sınırını dürüstçe yazıyor
  ("live davranışı simülasyonda birebir yeniden üretilemez").
- **Entegrasyon:** Sadece mimari fikir — Data/Execution Client ayrımı, M11'de MT5 köprüsü
  için `MarketDataSource` arayüzü adlandırmasına ilham olabilir.
- **Sonraki adım:** Düşük öncelik, kavramsal not olarak yeterli.

### mementum/backtrader
- **Lisans:** GPL-3.0 (kopyleft), bakım durumu zayıf.
- **Ne var:** Market/Limit/Stop/Bracket/OCO emir tipleri; "Cheat-On-Close/Open" modları
  **açıkça adlandırılmış ve varsayılan DEĞİL** — bizim STOP_FIRST varsayımını destekleyen
  bağımsız bir emsal. Aynı barda SL/TP önceliği detayı bu oturumda **doğrulanamadı**
  (kaynak sayfalar erişilemez).
- **Entegrasyon:** Sadece oku, kod alma (GPL + zayıf bakım).
- **Sonraki adım:** Yok, düşük öncelik.

### polakowo/vectorbt
- **Lisans:** Apache-2.0 **+ Commons Clause** (ürün satışı yasak, kullanım serbest).
- **Ne var:** Vektörize (NumPy/Numba) toplu parametre taraması — path-dependent mantığı
  (aynı-bar SL/TP belirsizliği) vektörize etmek zorlaşıyor, bizim "her işlem izlenebilir"
  ilkemizle gerilimde.
- **Entegrasyon:** Sadece mimari fikir — çoklu-deneme/overfitting uyarısı, mevcut
  `sweep.ts`'teki deneme sayacının "neden" önemli olduğuna ek gerekçe.
- **Sonraki adım:** Düşük öncelik, kavramsal not.

### robcarver17/pysystemtrade
- **Lisans:** GPL-3.0 (kopyleft).
- **Ne var:** Katmanlı risk ölçekleme: forecast scaling → Forecast Diversification
  Multiplier → volatilite hedefleme → Instrument Diversification Multiplier.
- **Entegrasyon:** Sadece felsefi fikir — volatilite-hedefleme, M11 taslağında "açık soru"
  olarak not edilebilir (şu an kod değişikliği gerektirmiyor, futures-odaklı formüller
  forex'e direkt uygulanamaz).
- **Sonraki adım:** `docs/AI-BOT-TASLAK.md`'ye açık soru olarak eklenebilir.

**Genel:** 5 kaynaktan hiçbiri kod kopyalamaya uygun değil (2×GPL, 1×LGPL, 1×Commons-Clause,
Lean Apache-2.0 olsa da C#→TS port maliyeti yüksek). Hepsi yalnızca mimari/felsefi referans.

---

## 2. MT5/MQL5 SMC botları

### Smc_ZOB_CISD (doğru adres: **MrOwl1011**/Smc_ZOB_CISD, orijinal URL 404 verdi)
- **Lisans:** MIT (doğrulandı).
- **Ne var — en önemli bulgu:** **CISD (Change in State of Delivery)** kavramı — bizim
  kütüphanemizde hiç yok. 4 aşamalı: likidite süpürmesi → ters renkli ardışık mum serisi →
  seri high/low'u aşan kapanış ("CONFIRMED") → geri çekilme = giriş sinyali. Order block
  tespiti de bizden daha sıkı: 4 ayrı displacement kriteri (net hareket ATR çarpanı, en
  güçlü gövde ATR çarpanı, gövde/aralık oranı, göreli güç) hepsi geçmeli.
- **Entegrasyon:** Hem tanım karşılaştırması hem **yeni kavram ekleme fikri**. Kod MIT
  olsa da mantık port edilecekse kendi testimiz + oracle'ımız şart (Kural 8).
- **Somut sonraki adım:** `docs/definitions/cisd-v1.md` taslağı — "kaynak: MrOwl1011
  DESIGN.md, doğrulanmadı (resmi ICT tanımı değil, bir EA'nın yorumu)" etiketiyle,
  parametreleri (sweep modu, maxSeriesCandles, seviye tipi) kullanıcıyla netleştirerek.

### KVignesh122/MT5-SMC-trading-bot
- **Lisans:** Apache-2.0 (doğrulandı).
- **Ne var:** Adaptif FVG min-size (volatiliteye bağlı eşik — bizim sabit `min_size`
  parametremize alternatif fikir), ADX≥18/Efficiency-Ratio≥0.30 rejim filtresi. OB'de
  invalidasyon yok (bizden eksik bir özellik, yani bize katkısı yok).
- **Entegrasyon:** Sadece tanım/parametre fikri — yeni bir SMC kavramı değil, mevcut
  tanımlara alternatif parametre notu.
- **Sonraki adım:** İstenirse `docs/definitions/fvg-v1.md`'ye "alternatif: adaptif
  min_size (doğrulanmadı)" notu — onay gerektirir, şimdilik aksiyon yok.

### geraked/metatrader5
- **Lisans:** MIT.
- **Ne var:** SMC ile ilgisi yok — klasik gösterge-tabanlı 12 strateji (MACD, Bollinger,
  RSI, ATR kombinasyonları).
- **Entegrasyon:** **Kullanma** — kapsam dışı, SMC karşılaştırması için ilgisiz.

---

## 3. SMC + formasyon kütüphaneleri (en yüksek potansiyel değer)

### joshyattridge/smart-money-concepts
- **Lisans:** MIT.
- **KRİTİK bulgu:** **Lookahead onayı yok** — `swing_highs_lows`/`fvg` fonksiyonları
  tüm seriye vektörel uygulanıyor, bizim `confirmedIndex` garantimiz (Kural 3) burada
  yok. Kod bu yüzden **adapte edilmemeli**, sadece parametre fikri (`range_percent=0.01`
  likidite kümeleme eşiği gibi) ve çapraz kontrol kaynağı olarak kullanılabilir.
- **Sonraki adım:** `range_percent` tipi bir eşiği `docs/definitions/liquidity.md`'de
  alternatif parametre olarak not düş.

### GeneralTradingSarl/Smart-Money-Concepts
- **Lisans:** Yok (tüm hakları saklı), kaynak kod da yok (sadece derlenmiş `.ex5`).
- **Entegrasyon:** **Kullanma** — teknik değeri sıfır.

### djoffrey/HarmonicPatterns — **Shark formasyonu için ana kaynak**
- **Lisans:** MIT.
- **Shark oranları (kaynak koddan):** XAB 0.5–0.886, ABC 1.13–1.618, BCD 1.618–2.24,
  XAD 0.886–1.13. **3/4 bacak bağımsız kaynaklarla (FXOpen, Algorush) çapraz
  doğrulandı** (ABC, BCD, XAD eşleşti). **XAB bacağı için ikinci bağımsız sayısal
  teyit bulunamadı** — Kural 8'in "en az 2 bağımsız kaynak" standardına henüz tam
  ulaşmıyor.
- **Sonuç:** Shark **kısmen yapılabilir** — XAB (0.5–0.886) için ikinci kaynak
  (örn. HarmonicTrader.com/Scott Carney) bulunursa, diğer 8 harmonik formasyonla
  aynı disiplinde (sentetik test + lookahead testi) eklenebilir.
- **Sonraki adım:** XAB'ı ikinci kaynaktan teyit et → `catalog/patterns/harmonic.json`'a
  "doğrulanmadı→taslak" etiketiyle ekle, teyit tamamlanınca `IMPLEMENTED`'a yükselt.

### BennyThadikaran/stock-pattern
- **Lisans — DÜZELTME:** Gerçek lisans **GPL-3.0**, AGPL-3.0 DEĞİL (önceki dosyada
  yanlış varsayılmıştı, bu oturumda GitHub API + ham LICENSE metniyle düzeltildi).
  Yine de kopyleft, kod kopyalanamaz.
- **Ne var:** Pivot mantığı (6 sol + merkez + 6 sağ, bizim L/R swing'imize kavramsal
  yakın), trend çizgisi temas sayımı (%0.1 yakınlık), ATR-bağıl geometrik toleranslar.
- **Entegrasyon:** Sadece mimari/algoritma fikri — zaten kendi motorumuz var, ikinci
  bir tasarım referansı olarak değerli ama aksiyon gerektirmiyor.

### gilson0516/pt-lib
- **Lisans:** GPL-3.0 (stock-pattern'dan miras, gerçek kod türetmesi doğrulandı —
  aynı `utils.py` fonksiyonlarını import ediyor).
- **Ne var:** 28 formasyonun çoğu bizim 21+8'imizle örtüşüyor. **Bizde olmayan:
  VCP (Volatility Contraction Pattern) ve Uptrend/Downtrend Line tespiti.**
- **Entegrasyon:** Kod kullanılamaz (GPL); VCP istenirse Minervini'nin orijinal,
  telifsiz tanımından (pt-lib kodundan DEĞİL) + ikinci kaynaktan tanımlanmalı.
- **Sonraki adım:** Düşük öncelik, gelecekte istenirse ayrı bir M9-sonrası görev.

### twopirllc/pandas-ta
- **ÖNEMLİ BULGU:** **Repo artık yok** — GitHub'dan kaldırılmış (404, API da 404).
  Zaten TA-Lib'e sarmalayıcıydı (bağımsız ikinci oracle değildi). Topluluk forku
  (pandas-ta-classic) da muhtemelen aynı TA-Lib mantığının portu.
- **Entegrasyon:** **Kullanma** — bu kümeden çıkar, zaman ayırmaya değmez.

---

## 4. n8n şablonları

### MT5 webhook sinyal handler (n8n.io/workflows/11439)
- **Yapı:** POST webhook (sinyal al) → bellek içi "pending" kaydı → MT5 EA 5sn'de bir
  GET ile poll eder → emir açılınca "processed" işaretlenir. Gerçek emir MT5 EA'nın
  kendi `OrderSend` kodunda, n8n sadece kuyruk.
- **Bizim kullanabileceğimiz kısım:** Sadece **POST webhook → alan ayıkla → Telegram/
  Discord'a mesaj** 3 node'luk alt küme. Poll/confirm/emir kısmı hiç uygulanmayacak
  (biz emir göndermiyoruz).
- **Sonraki adım:** SignalDraft oluşunca n8n'e POST atan basit bir webhook entegrasyonu
  — bu zaten M11'in beklemedeki "webhook" parçası, n8n formatın netleşince yapılabilir.

### Trade log → Google Sheets (IBKR Flex Statement örneği)
- **Yapı:** Zamanlanmış tetik → Flex Report indir → XML parse → alan normalize
  (tradeID, symbol, giriş/çıkış, miktar) → Sheets'e tradeID'ye göre append/update
  (dedupe).
- **Bizim kullanabileceğimiz kısım:** "Normalize et + tradeID ile dedupe append/
  update" deseni — işlem günlüğümüzün otomatik yedek/log kanalı olarak uyarlanabilir
  (mevcut JSON/CSV dışa aktarmanın YANINA, onun yerine değil).
- **Sonraki adım:** İstenirse, paper-trade/backtest kaydı kapanınca n8n'e webhook +
  Sheets append-by-id zinciri — düşük öncelik, isteğe bağlı özellik.

---

## 5. Konsolide, uygulanabilir sonraki adımlar (öncelik sırasıyla)

1. **CISD'yi `docs/definitions/cisd-v1.md` taslağı olarak ekle** — yeni bir SMC
   kavramı, kaynak MIT, parametreleri kullanıcıyla netleştirerek.
2. **Shark harmonik formasyonu için XAB bacağını ikinci bağımsız kaynaktan teyit et**
   — teyit olursa `catalog/patterns/harmonic.json`'a eklenebilir (9/9 tamamlanır).
3. **Enstrüman metadata alan listesini Lean'in `SymbolProperties`'iyle karşılaştır**
   (eksik alan var mı kontrol, düşük efor).
4. **n8n webhook→Telegram bildirimi** — M11'in bekleyen parçası, n8n formatı
   netleşince.
5. Düşük öncelikli/isteğe bağlı notlar: adaptif FVG eşiği, volatilite-hedefleme
   (M11 taslağında açık soru olarak), VCP formasyonu (gelecek), trade-log→Sheets
   otomatik yedek kanalı.

## Lisans özeti (tüm kaynaklar)

| Kaynak | Lisans (doğrulanmış) | Kod kullanılabilir mi |
|---|---|---|
| QuantConnect/Lean | Apache-2.0 | Teknik olarak evet, pratikte sadece fikir (C#→TS maliyeti) |
| nautilus_trader | LGPL-3.0 | Hayır, sadece fikir |
| backtrader | GPL-3.0 | Hayır, sadece fikir |
| vectorbt | Apache-2.0 + Commons Clause | Hayır (yapı farklı), sadece fikir |
| pysystemtrade | GPL-3.0 | Hayır, sadece fikir |
| MrOwl1011/Smc_ZOB_CISD | MIT | Evet (fikir+tanım, kod port edilmeyecek) |
| KVignesh122/MT5-SMC-trading-bot | Apache-2.0 | Evet (fikir) |
| geraked/metatrader5 | MIT | Kapsam dışı |
| joshyattridge/smart-money-concepts | MIT | Evet ama lookahead garantisi yok — sadece fikir |
| GeneralTradingSarl/Smart-Money-Concepts | Yok | Hayır |
| djoffrey/HarmonicPatterns | MIT | Evet — Shark oranları için ana kaynak |
| BennyThadikaran/stock-pattern | GPL-3.0 (düzeltildi, AGPL değil) | Hayır, sadece fikir |
| gilson0516/pt-lib | GPL-3.0 | Hayır, sadece fikir |
| twopirllc/pandas-ta | Repo kaldırılmış | Kullanılamaz |
