# Trading Research Workstation: proje rehberi

Bu dosya her oturumda okunur. Kalıcı kurallar ve mimari kararlar burada; o oturumun görevi ayrıca verilir.

Son güncelleme: 5 Ekim 2026 (DEVIR.md'deki duruma göre).

## Proje nedir

Trading fikirlerini objektif kurallara dökmek, grafikte görmek, geçmiş veride dürüstçe test etmek ve sonuçları ölçmek için bir araştırma masası (workstation). Kullanıcı forex öğrenen bir öğrenci; proje hem aracı hem öğrenme sürecidir.

Bu proje "AI bana hangi işlemi açacağımı söylesin" projesi değildir. Temel döngü:

MANUEL GÖZLEM → KURALA DÖKME → BACKTEST → İSTATİSTİK → KARŞILAŞTIRMA → PAPER TRADE

## Mutlak kurallar

Bu kurallar her özellikten önce gelir. Çiğnenmesi gereken bir durum çıkarsa dur ve kullanıcıya sor.

1. **Veri yoksa sonuç yok.** Gerçek geçmiş veri yüklenmemişse backtest, win rate, istatistik, örnek işlem ya da performans üretme. Boş durum ekranı göster.
2. **Sentetik veri yalnızca testlerde.** Test fixture'ları küçük, elle yazılmış ve dosya adı ile içeriğinde `SYNTHETIC` etiketli olur. Arayüzde demo veri gösterilirse her ekranda açıkça "DEMO VERİ" yazar ve bu veriden çıkan sonuçlar kaydedilmez.
3. **İleriye bakma (lookahead) yasak.** Her hesap yalnızca o mumun kapanışında bilinen veriyle yapılır. Swing noktaları ancak sağında N mum oluştuktan sonra onaylanır; her tespit hem oluştuğu mumu hem de onaylandığı mumu saklar. Backtest, replay ve canlı mod yalnızca onay zamanından sonrasını görür. Onaylanmış bir olay sonradan değişmez ya da yeniden çizilmez.
4. **Aynı mumda SL ve TP.** Bir mum hem stop'a hem hedefe değiyorsa varsayılan kötümser kabul yapılır (önce stop). Bu ayar değiştirilebilir, her backtest sonucunda kaç işlemin bu belirsizlikten etkilendiği raporlanır. Alt zaman dilimi verisi varsa sıralama oradan çözülebilir.
5. **Determinizm.** Aynı veri + aynı strateji versiyonu + aynı maliyet ayarları + aynı motor versiyonu → birebir aynı sonuç. Rastgelelik gerekiyorsa sabit seed kullanılır ve kaydedilir.
6. **AI olasılık uydurmaz.** Asistan katmanı hipotez önerir, kuralları formüle eder, sonuçları yorumlar; hiçbir zaman ölçülmemiş bir kazanma olasılığı, "kesin" sinyal ya da al/sat kararı üretmez. Her sayısal iddia bir backtest kaydına referans verir.
7. **Gerçek parayla işlem yok.** Uygulama hiçbir zaman otomatik emir göndermez; broker bağlantısı yalnızca veri okumak ve paper trade için kullanılır (bkz. "Canlı veri ve MT5 köprüsü"). Emri her zaman kullanıcı kendi eliyle verir.
8. **Yetenek uydurma.** TradingView, veri sağlayıcılar ya da kütüphaneler hakkında bir özellikten emin değilsen resmi dokümantasyonu kontrol et; kontrol edemiyorsan "doğrulanmadı" diye belirt.
9. **Tavsiye ve paylaşım sınırı.** Uygulama çıktıları hiçbir zaman "al/sat tavsiyesi" dili kullanmaz; her zaman "bu senin için üretilmiş araştırma özeti" çerçevesinde kalır. Sinyal paylaşma, herkese açık strateji, başka birinin hesabına bağlanma gibi bir özellik gündeme gelirse, önce SPK'nın yatırım danışmanlığı ve sinyal paylaşımı kurallarını kontrol et; doğrulanmadan çok kullanıcılı ya da paylaşım özelliği geliştirilmez.
10. **Veri kalıcılığı garanti edilmez.** Hiçbir özellik "tarayıcıda güvenle kalıcı saklanır" varsayımıyla tasarlanmaz (gömülü tarayıcı veriyi daha önce iki kez sildi). İşlem günlüğü, strateji versiyonları, backtest sonuçları ve araştırma kayıtları her zaman dışa aktarılabilir olur (JSON/CSV); arayüz düzenli yedek almayı hatırlatır. Kalıcı kullanım için uygulama kullanıcının kendi tarayıcısında açılmalı, gömülü önizlemede değil; bu fark arayüzde belirtilir.

## Kavram tanımları (ICT / SMC ve diğerleri)

FVG, order block, MSS, CHoCH, likidite süpürmesi gibi kavramların tek bir resmi tanımı yoktur. Bu yüzden:

- Her kavram **parametreli ve versiyonlu bir tanım** olarak kodlanır. Örnek: swing = solda `L`, sağda `R` mum; FVG = üç mumlu boşluk, `minSize` parametresiyle; yapı kırılımı = `breakBy: CLOSE | WICK`.
- Her tanımın yanında: varsayımlar, parametreler, onay gecikmesi (kaç mum sonra bilinir), bilinen başarısızlık durumları yazılır (`docs/definitions/`).
- Otomatik tespitler arayüzde her zaman **aday** olarak gösterilir: "Aday direnç", "Aday FVG". "Kesin destek" gibi ifadeler kullanılmaz.
- Kullanıcının elle çizdikleri ile motorun tespit ettikleri ayrı katmanlarda ve farklı görünümde tutulur (`source: USER | ENGINE`).
- **Çizim araçlarındaki formasyon şablonları, otomatik formasyon kataloğuyla aynı şey değildir.** Çizim araçları (ör. Fibonacci, Gartley çizgisi) **manueldir** — kullanıcı çizer, sistem yalnızca aracı hazırlar. `catalog/patterns/*.json`'daki tanımlar ise motorun **otomatik** bulduğu adaylardır. İkisi aynı görsel dili paylaşabilir (örn. harmonik oranlar manuel çizim şablonuna kaynak olabilir) ama kodu ayrıdır. Bir görev ikisinden hangisi olduğunu başta netleştirmeli.

## Mimari ilkeler

- **Tek motor, iki tüketici.** Grafikte gösterilen setup ile backtest'te işlenen setup aynı fonksiyonlarla üretilir. Canlı/paper modda da aynı kod artımlı çalışır; ayrı bir "canlı kural motoru" yazılmaz. Motor saf, deterministik, arayüzden bağımsız bir pakettir (DOM, ağ, saat erişimi yok; zaman parametre olarak verilir).
- **Katmanlar:** market data → normalizasyon → session engine → feature engine (swing, yapı, likidite, FVG) → setup/strategy engine → risk engine → backtest / replay / canlı izleme. Her katman bir öncekinin çıktısını tüketir, geri çağırmaz.
- **Veri alanları ayrı:** market data, kullanıcı verisi (çizimler, günlük, tercihler), strateji verisi, araştırma verisi (deneyler, backtest sonuçları), eğitim içeriği. Farklı depolama anahtarları / tablolar.
- **Zaman:** tüm zaman damgaları UTC saklanır. Görüntüleme IANA saat dilimiyle yapılır (Europe/Istanbul, Europe/London, America/New_York, Asia/Tokyo, UTC). Yaz/kış saati bir kütüphaneyle hesaplanır, sabit ofset yazılmaz. Session sınırları yerel saatle tanımlanır ve kullanıcı kendi session şablonlarını tanımlayabilir (ör. ICT Asya aralığı 20:00–00:00 New York, kill zone'lar).
- **Enstrüman metadata'sı** kodda dağınık değil, tek bir yerde: pip/point büyüklüğü, kontrat büyüklüğü, kote para, işlem saatleri (forex 24/5, kripto 7/24, endeksler borsa saatleri), tick değeri. XAUUSD ve endekslerde pip tanımı yapılandırılabilir.
- **Zaman dilimleri** mümkünse tek bir taban veriden (örn. 1m) yeniden örnekleme ile üretilir; böylece tüm zaman dilimleri tutarlı olur.
- **Tekrarlanabilirlik:** her backtest sonucu şunları saklar: strateji id + versiyon, tanım versiyonları, veri kaynağı + tarih aralığı + veri özeti (hash), maliyet ayarları, motor versiyonu, SL/TP belirsizlik ayarı, çalışma tarihi.
- **Strateji versiyonları değişmezdir.** Kaydedilmiş bir versiyon düzenlenmez; değişiklik yeni versiyon oluşturur. Sonuçlar versiyona bağlıdır.

## Canlı veri ve MT5 köprüsü

- Köprü yalnızca **okur**: MT5 demo hesabından fiyat verisi çeker, yalnızca demo hesapla çalışır, emir gönderemez.
- Broker sunucu saati tahmin edilmez, ölçülür ve kaydedilir (şu an UTC+3 olarak ölçüldü; broker değişirse yeniden ölçülmeli).
- Paper oturumları yalnızca başlangıç anından sonraki veriyi işler; geriye dönük veri paper sonucuna karışmaz.
- Otomatik güncelleme sekme değişince ve sayfa yenilenince de devam eder.

## Ortak hesaplamalar (indikatörler)

Motorun üreteceği seriler: SMA, EMA, RSI, ATR, MACD (line/signal/histogram), Bollinger Bands, VWAP, hareketli min/maks/toplam, lag, yüzde değişim, fark, z-score. Her biri deterministik, yalnızca kapanmış mumlardan hesaplanır (ileriye bakmaz) ve testlidir.

## Varsayılan teknoloji

Repo zaten bir stack kullanıyorsa onu koru. Boş bir projeyse aşağıdakini öner, gerekçesiyle kullanıcıya göster ve onay al:

- TypeScript her yerde; motor ve arayüz aynı dili konuşur.
- `packages/engine`: saf TypeScript motor (session, feature, strategy, risk, backtest). Test: Vitest.
- `apps/web`: Vite + React + TypeScript. Uzun hesaplamalar Web Worker'da.
- Grafik: TradingView Lightweight Charts (açık kaynak, Apache 2.0; lisansındaki TradingView atıf koşuluna uy). Çizim araçları ve overlay'ler kütüphanenin eklenti / primitive API'si ile kendimiz yazılır.
- Depolama: tarayıcıda IndexedDB, ama veri kalıcılığı garanti edilmediği için her önemli veri dışa aktarılabilir olmalı (bkz. Mutlak kural 10). İleride dosya tabanlı ya da yerel bir veritabanına (örn. SQLite) geçiş değerlendirilecek.
- Python yalnızca ileride isteğe bağlı araştırma defterleri için.

Yeni bir bağımlılık eklemeden önce: neden gerekli, alternatifi ne, lisansı ne; tek satırla yaz.

## Veri

- Veri kaynağı: Dukascopy'den içe aktarılan CSV (OHLCV) ve MT5 demo köprüsünden canlı veri.
- İçe aktarma doğrulaması: tekrar eden mumlar, sıralama, boşluklar, hafta sonu mumları, sıfır/negatif fiyat, OHLC tutarlılığı (low ≤ open/close ≤ high). Sorunlar raporlanır, sessizce düzeltilmez.
- Veri kaynağının adı ve kullanım koşulları kullanıcının sorumluluğundadır; kaynak adı metadata olarak saklanır.

## Backtest gereklilikleri

- Girdi: enstrüman, tarih aralığı, zaman dilimi, strateji versiyonu, işlem başı risk, spread, komisyon, kayma, SL/TP belirsizlik kuralı.
- Çıktı: işlem sayısı, kazanan/kaybeden, kazanma oranı, ortalama R, beklenen değer, profit factor, maksimum düşüş, en uzun kazanç/kayıp serisi, en büyük kazanç/kayıp; equity eğrisi, R dağılımı; aylık, session'a ve haftanın gününe göre kırılım.
- Dürüstlük göstergeleri: işlem sayısı düşükse uyarı (örn. 30'un altında), belirsiz mum sayısı, veri boşluğu nedeniyle atlanan setup sayısı, uygulanan toplam maliyet.
- Veri bölme: in-sample / out-of-sample ayrımı desteklenir; parametre denemeleri yalnızca in-sample üzerinde yapılır ve kaç deneme yapıldığı kaydedilir.

## Strateji şeması (taslak)

Serbest metin koşul yok. Koşullar tipli, parametreli ve sıralıdır; adımlar arası zaman penceresi tanımlanır.

```json
{
  "id": "london-sweep",
  "version": 3,
  "status": "RESEARCH",
  "instrument": "EURUSD",
  "timeframe": "15m",
  "direction": "LONG",
  "window": { "session": "LONDON", "startLocal": "08:00", "endLocal": "11:00", "tz": "Europe/London" },
  "sequence": [
    { "id": "sweep", "type": "LIQUIDITY_SWEEP", "params": { "level": "ASIA_LOW", "confirm": "CLOSE_BACK_INSIDE" } },
    { "id": "mss", "type": "STRUCTURE_BREAK", "params": { "direction": "BULLISH", "swingLeft": 3, "swingRight": 3, "breakBy": "CLOSE" }, "within": { "after": "sweep", "maxBars": 12 } },
    { "id": "fvg", "type": "FVG", "params": { "direction": "BULLISH", "minSizePips": 2 }, "within": { "after": "mss", "maxBars": 6 } },
    { "id": "entry", "type": "LIMIT_AT", "params": { "ref": "fvg.top" }, "expireBars": 8 }
  ],
  "stop": { "type": "BELOW_REF", "params": { "ref": "sweep.low", "bufferPips": 1 } },
  "target": { "type": "R_MULTIPLE", "params": { "r": 2 } },
  "risk": { "percentPerTrade": 0.5 },
  "definitions": { "LIQUIDITY_SWEEP": "v1", "STRUCTURE_BREAK": "v1", "FVG": "v1" }
}
```

Strateji durumu: `IDEA → RESEARCH → TESTING → VALIDATED_ON_SAMPLE → PAPER → LIVE_CANDIDATE`. "Validated" yalnızca "belirli veri ve koşullarda şu sonuç gözlendi" demektir; arayüzde de böyle açıklanır.

## Kilometre taşları

**Tamamlandı:** M0 (plan), M1 (veri + grafik), M2 (seanslar + elle analiz), M3 (replay + günlük), M4 (swing/FVG/BOS-CHoCH/süpürme/önceki periyot seviyeleri — hepsi aday durumunda), M5 (strateji oluşturucu + maliyetli backtest), M6.1 (kullanıcı tanımlı seanslar), M6.2 (araştırma laboratuvarı, in-sample/out-of-sample ayrımı, deneme sayacı), M6.3 (MT5 köprüsü + paper trading), M6.4 (kavram kütüphanesi + "beklendiği gibi gitmedi" ölçümü), M7.1 (çizim araçları: 23 araç, geri al/yinele), M7.2 (yedek/dışa aktarma), M8 (indikatörler: SMA/EMA/RSI/ATR/MACD/Bollinger/VWAP grafiğe bağlı + 5 genel seri dönüşümü), M9 1. dilim (3 mum formasyonu, TA-Lib ile doğrulandı), M9 2.–4. dilim (SMC'nin eksik 8 alt kavramının hepsi — Displacement, Order block, IFVG, Breaker, EQH/EQL, Premium/Discount, OTE, Aday S/R — M4 motoruna ve grafiğe bağlı, gerçek veriyle doğrulandı), M9 5.–6. dilim (kalan 34 mum formasyonu da bitti, 61/61 mum formasyonu `VERIFIED` — katalog tamam).

**Sırada (öncelik sırasıyla):**
- **M8 İndikatörler: tamamlandı** (7 Ekim 2026, D44–D47). SMA, EMA, RSI, ATR, MACD, Bollinger, VWAP grafiğe bağlı ve gerçek MT5 verisiyle doğrulandı. Moving min/maks/toplam, lag, diff, yüzde değişim, z-score motorda (genel seri dönüşümleri); henüz grafiğe/stratejiye bağlı değil. Strateji adımlarına bağlama ayrı bir iş.
- **M9 Formasyon kataloğu — mum formasyonları tamam, devam ediyor:** 1. dilim (Doji, Engulfing, Marubozu; D48). 2.–4. dilim (8 Ekim 2026, D49–D51): SMC'nin eksik 8 alt kavramının hepsi motorda **ve** grafikte, gerçek Dukascopy verisiyle doğrulandı (plan `docs/PLAN-M9.md`). 5.–6. dilim (8 Ekim 2026, D52–D53): kalan 58 mum formasyonu da bitti — TA-Lib'in resmi kaynağından (tag v0.8.1) birebir port edilip gerçek 736.706 barlık EURUSD 1m veriyle doğrulandı. **61/61 mum formasyonu `VERIFIED`** — "trend bağlamı gerektiren" sanılan Hammer/Morning Star ailesinin TA-Lib'de hiç gerçek trend tespiti yapmadığı ortaya çıktı (D53). Kalan: 21 grafik formasyonu, 9 harmonik, 8 SMC kavramının strateji şemasına bağlanması, olay deposu, canlı mod, strateji kataloğu. Mevcut v1 tanımları (swing 3/3, BOS/CHoCH, FVG, süpürme) yeniden yazılmıyor, katalog referans kalıyor.
- **M10 Çizim araçları 2. aşama:** pitchfork, Gann araçları, fırça, çizim stilleri, formasyon çizim şablonları. Bkz. "Kavram tanımları" bölümündeki manuel/otomatik ayrımı.
- **M11 AI/quant bot:** ayrı bir taslak belgesinde tartışılır (`docs/AI-BOT-TASLAK.md`), açık sorular yanıtlanıp onaylanmadan kod yazılmaz. Hedef: stratejiyi canlı/paper veride izlemek, koşulları ve önerilen giriş/stop/hedef/lot'u göstermek; emri her zaman kullanıcı verir (Mutlak kural 7).

## Test zorunlulukları

Motora dokunan her değişiklik testle gelir. Asgari kapsam:

- Session: saat dilimleri, DST geçiş haftaları (ABD ve İngiltere farklı haftalarda geçer), hafta sonu kapanışı.
- Yeniden örnekleme: mum sınırları, eksik mumlar, günlük kapanış saati.
- Feature: swing onay gecikmesi, lookahead olmadığını kanıtlayan test (veri kesildiğinde geçmiş tespitler değişmemeli), FVG ve sweep kenar durumları.
- Backtest: determinizm, aynı mumda SL/TP, boşlukla açılış (gap), spread/komisyon/kayma, emir süresinin dolması, pozisyon büyüklüğü yuvarlama.
- Risk: lot hesabı (USD kote, USD baz, çapraz pariteler), R, beklenen değer, drawdown.
- Yeni indikatör ya da dedektör eklenirken: pozitif sentetik test, negatif sentetik test, ileriye bakmama testi, mümkünse dış bir kütüphaneyle (oracle) karşılaştırma, gerçek veride sıklık raporu.

## Çalışma şekli

- Kullanıcıyla Türkçe konuş. Kod, değişken adları, commit mesajları İngilizce. Arayüz metinleri Türkçe ve tek bir çeviri dosyasında.
- Her taş: plan → kullanıcı onayı → küçük adımlar → test → çalışır durumda gösterim.
- Belirsiz bir noktada tahmin yürütme, sor. Varsayım yaptıysan açıkça yaz.
- Çalışan özellikleri bozma; büyük yeniden yazımlar önce önerilir.
- Küçük, anlamlı commit'ler; oturum sonunda yerelde commit bırakma, `git push` ile kapat.
- Her oturumun sonunda `DEVIR.md` güncellenir: ne yapıldı, ne kaldı, açık sorular, projeyi çalıştırma ve test komutları.

## Tasarım

Koyu tema öncelikli, profesyonel terminal havası, yüksek bilgi yoğunluğu, masaüstü öncelikli ama mobilde bozulmayan. Kumarhane görüntüsü, neon, gereksiz animasyon, "hızlı zengin ol" estetiği yok. Yeşil/kırmızı yalnızca yön ve kâr/zarar anlamında kullanılır; renk tek başına bilgi taşımaz (etiket ya da ikonla desteklenir).

## Kapsam dışı (şimdilik)

Otomatik gerçek emir, garanti iddiası taşıyan stratejiler, AI kaynaklı kesin al/sat sinyalleri, sahte veri, sahte backtest, sahte istatistik, TradingView'in sunmadığı bir entegrasyonu zorlamak, doğrulanmadan çok kullanıcılı/paylaşım özelliği.
