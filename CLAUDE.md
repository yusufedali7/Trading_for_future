# Trading Research Workstation: proje rehberi

Bu dosya her oturumda okunur. Kalıcı kurallar ve mimari kararlar burada; o oturumun görevi ayrıca verilir.

## Proje nedir

Trading fikirlerini objektif kurallara dökmek, grafikte görmek, geçmiş veride dürüstçe test etmek ve sonuçları ölçmek için bir araştırma masası (workstation). Kullanıcı forex öğrenen bir öğrenci; proje hem aracı hem öğrenme sürecidir.

Bu proje "AI bana hangi işlemi açacağımı söylesin" projesi değildir. Temel döngü:

MANUEL GÖZLEM → KURALA DÖKME → BACKTEST → İSTATİSTİK → KARŞILAŞTIRMA → PAPER TRADE

## Mutlak kurallar

Bu kurallar her özellikten önce gelir. Çiğnenmesi gereken bir durum çıkarsa dur ve kullanıcıya sor.

1. **Veri yoksa sonuç yok.** Gerçek geçmiş veri yüklenmemişse backtest, win rate, istatistik, örnek işlem ya da performans üretme. Boş durum ekranı göster.
2. **Sentetik veri yalnızca testlerde.** Test fixture'ları küçük, elle yazılmış ve dosya adı ile içeriğinde `SYNTHETIC` etiketli olur. Arayüzde demo veri gösterilirse her ekranda açıkça "DEMO VERİ" yazar ve bu veriden çıkan sonuçlar kaydedilmez.
3. **İleriye bakma (lookahead) yasak.** Her hesap yalnızca o mumun kapanışında bilinen veriyle yapılır. Swing noktaları ancak sağında N mum oluştuktan sonra onaylanır; her tespit hem oluştuğu mumu hem de onaylandığı mumu saklar. Backtest ve replay yalnızca onay zamanından sonrasını görür. Grafikte geçmişte "boyanan" ama o anda bilinemeyecek sinyal gösterilmez.
4. **Aynı mumda SL ve TP.** Bir mum hem stop'a hem hedefe değiyorsa varsayılan kötümser kabul yapılır (önce stop). Bu ayar değiştirilebilir, her backtest sonucunda kaç işlemin bu belirsizlikten etkilendiği raporlanır. Alt zaman dilimi verisi varsa sıralama oradan çözülebilir.
5. **Determinizm.** Aynı veri + aynı strateji versiyonu + aynı maliyet ayarları + aynı motor versiyonu → birebir aynı sonuç. Rastgelelik gerekiyorsa sabit seed kullanılır ve kaydedilir.
6. **AI olasılık uydurmaz.** Asistan katmanı hipotez önerir, kuralları formüle eder, sonuçları yorumlar; hiçbir zaman ölçülmemiş bir kazanma olasılığı, "kesin" sinyal ya da al/sat kararı üretmez. Her sayısal iddia bir backtest kaydına referans verir.
7. **Gerçek parayla işlem yok.** Broker bağlantısı, canlı emir, otomatik gerçek işlem bu projenin kapsamında değil (kullanıcı Türkiye'de; kaldıraçlı işlemler SPK düzenlemesine tabi).
8. **Yetenek uydurma.** TradingView, veri sağlayıcılar ya da kütüphaneler hakkında bir özellikten emin değilsen resmi dokümantasyonu kontrol et; kontrol edemiyorsan "doğrulanmadı" diye belirt.

## Kavram tanımları (ICT / SMC ve diğerleri)

FVG, order block, MSS, CHoCH, likidite süpürmesi gibi kavramların tek bir resmi tanımı yoktur. Bu yüzden:

- Her kavram **parametreli ve versiyonlu bir tanım** olarak kodlanır. Örnek: swing = solda `L`, sağda `R` mum; FVG = üç mumlu boşluk, `minSize` parametresiyle; yapı kırılımı = `breakBy: CLOSE | WICK`.
- Her tanımın yanında: varsayımlar, parametreler, onay gecikmesi (kaç mum sonra bilinir), bilinen başarısızlık durumları yazılır (`docs/definitions/`).
- Otomatik tespitler arayüzde her zaman **aday** olarak gösterilir: "Aday direnç", "Aday FVG". "Kesin destek" gibi ifadeler kullanılmaz.
- Kullanıcının elle çizdikleri ile motorun tespit ettikleri ayrı katmanlarda ve farklı görünümde tutulur (`source: USER | ENGINE`).

## Mimari ilkeler

- **Tek motor, iki tüketici.** Grafikte gösterilen setup ile backtest'te işlenen setup aynı fonksiyonlarla üretilir. Motor saf, deterministik, arayüzden bağımsız bir pakettir (DOM, ağ, saat erişimi yok; zaman parametre olarak verilir).
- **Katmanlar:** market data → normalizasyon → session engine → feature engine (swing, yapı, likidite, FVG) → setup/strategy engine → risk engine → backtest / replay. Her katman bir öncekinin çıktısını tüketir, geri çağırmaz.
- **Veri alanları ayrı:** market data, kullanıcı verisi (çizimler, günlük, tercihler), strateji verisi, araştırma verisi (deneyler, backtest sonuçları), eğitim içeriği. Farklı depolama anahtarları / tablolar.
- **Zaman:** tüm zaman damgaları UTC saklanır. Görüntüleme IANA saat dilimiyle yapılır (Europe/Istanbul, Europe/London, America/New_York, Asia/Tokyo, UTC). Yaz/kış saati bir kütüphaneyle hesaplanır, sabit ofset yazılmaz. Session sınırları yerel saatle tanımlanır ("Londra 08:00–17:00 Europe/London").
- **Enstrüman metadata'sı** kodda dağınık değil, tek bir yerde: pip/point büyüklüğü, kontrat büyüklüğü, kote para, işlem saatleri (forex 24/5, kripto 7/24, endeksler borsa saatleri), tick değeri. XAUUSD ve endekslerde pip tanımı yapılandırılabilir.
- **Zaman dilimleri** mümkünse tek bir taban veriden (örn. 1m) yeniden örnekleme ile üretilir; böylece tüm zaman dilimleri tutarlı olur.
- **Tekrarlanabilirlik:** her backtest sonucu şunları saklar: strateji id + versiyon, tanım versiyonları, veri kaynağı + tarih aralığı + veri özeti (hash), maliyet ayarları, motor versiyonu, SL/TP belirsizlik ayarı, çalışma tarihi.
- **Strateji versiyonları değişmezdir.** Kaydedilmiş bir versiyon düzenlenmez; değişiklik yeni versiyon oluşturur. Sonuçlar versiyona bağlıdır.

## Varsayılan teknoloji

Repo zaten bir stack kullanıyorsa onu koru. Boş bir projeyse aşağıdakini öner, gerekçesiyle kullanıcıya göster ve onay al:

- TypeScript her yerde; motor ve arayüz aynı dili konuşur.
- `packages/engine`: saf TypeScript motor (session, feature, strategy, risk, backtest). Test: Vitest.
- `apps/web`: Vite + React + TypeScript. Uzun hesaplamalar Web Worker'da.
- Grafik: TradingView Lightweight Charts (açık kaynak, Apache 2.0; lisansındaki TradingView atıf koşuluna uy). Çizim araçları ve overlay'ler kütüphanenin eklenti / primitive API'si ile kendimiz yazılır. Güncel sürümü ve API'yi resmi dokümandan doğrula.
- Depolama: MVP yerel çalışır (sunucu yok), tarayıcıda IndexedDB. Sunucu ihtiyacı doğarsa ayrı bir fazda tartışılır.
- Python yalnızca ileride isteğe bağlı araştırma defterleri için.

Yeni bir bağımlılık eklemeden önce: neden gerekli, alternatifi ne, lisansı ne; tek satırla yaz.

## Veri

- MVP'de veri kaynağı: kullanıcının içe aktardığı CSV (OHLCV). İçe aktarırken kullanıcı saat dilimini belirtir; motor UTC'ye çevirir.
- İçe aktarma doğrulaması: tekrar eden mumlar, sıralama, boşluklar, hafta sonu mumları, sıfır/negatif fiyat, OHLC tutarlılığı (low ≤ open/close ≤ high). Sorunlar raporlanır, sessizce düzeltilmez.
- Veri kaynağının adı ve kullanım koşulları kullanıcının sorumluluğundadır; kaynak adı metadata olarak saklanır.
- Otomatik veri adaptörleri (API'ler) sonraki bir fazdır; eklenmeden önce kullanım koşulları kontrol edilir.

## Backtest gereklilikleri

- Girdi: enstrüman, tarih aralığı, zaman dilimi, strateji versiyonu, işlem başı risk, spread, komisyon, kayma, SL/TP belirsizlik kuralı.
- Çıktı: işlem sayısı, kazanan/kaybeden, kazanma oranı, ortalama R, beklenen değer, profit factor, maksimum düşüş, en uzun kazanç/kayıp serisi, en büyük kazanç/kayıp; equity eğrisi, R dağılımı; aylık, session'a ve haftanın gününe göre kırılım.
- Dürüstlük göstergeleri: işlem sayısı düşükse uyarı (örn. 30'un altında), belirsiz mum sayısı, veri boşluğu nedeniyle atlanan setup sayısı, uygulanan toplam maliyet.
- Veri bölme: in-sample / out-of-sample ayrımı desteklenir; parametre denemeleri yalnızca in-sample üzerinde yapılır ve kaç deneme yapıldığı kaydedilir (aşırı optimizasyonu görünür kılmak için).

## Strateji şeması (taslak)

Serbest metin koşul yok. Koşullar tipli, parametreli ve sıralıdır; adımlar arası zaman penceresi tanımlanır. Taslak örnek (nihai şema M0'da tasarlanır):

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

Her taş çalışan, test edilmiş bir dilim bırakır. Bir taş bitmeden sonrakine geçilmez.

- **M0 Keşif ve plan:** repo incelemesi (varsa), teknoloji kararı, klasör yapısı, veri modelleri, strateji şeması v0, motor katman arayüzleri, M1 görev listesi. Kod yok.
- **M1 Veri ve grafik:** CSV içe aktarma + doğrulama raporu, mum grafiği, sembol ve zaman dilimi değiştirme (yeniden örnekleme), saat dilimi seçimi, crosshair/zoom/pan. *Bitti sayılır:* gerçek bir CSV yüklenip 1m'den 4H'ye doğru görüntüleniyor; yeniden örnekleme testleri geçiyor.
- **M2 Session ve manuel analiz:** IANA tabanlı session engine (DST testleriyle), session kutuları ve high/low; çizim araçları (yatay çizgi, trend çizgisi, dikdörtgen/bölge, fiyat aralığı, long/short pozisyon aracı); metadata'lı kullanıcı destek/direnç seviyeleri (tür, zaman dilimi, not, durum: aktif/kırıldı/retest). Çizimler kalıcı.
- **M3 Replay ve günlük:** mum mum ilerleyen geçmiş simülatörü (gelecek mumlar gizli), long/short/işlem yok, giriş/SL/TP, sonuç (R, MAE, MFE, süre), işlem günlüğü (session, strateji, neden, duygu, ekran görüntüsü) ve filtreleme. Bu taş kullanıcının şu anki öğrenme planında doğrudan kullanılacak.
- **M4 Feature engine v1:** onaylı swing'ler, önceki gün/hafta high-low, session high-low, likidite süpürmesi, FVG, yapı kırılımı; her biri tanım dokümanı + testlerle; grafikte aday katmanı olarak.
- **M5 Strateji ve backtest:** şema, kod yazmadan strateji oluşturucu, strateji → grafik bağlantısı (seçilen versiyonun setup'ları grafikte), deterministik backtest (maliyetler, belirsizlik raporu), istatistik ekranı, versiyon karşılaştırma.
- **M6 ve sonrası (her biri ayrı planlanır):** araştırma laboratuvarı (hipotez kayıtları, deney geçmişi), kavram kütüphanesi (tanım, görsel örnek, başarısızlık örneği, test edilebilir tanım, sınırlar), AI araştırma asistanı, paper trading. Broker entegrasyonu bu yol haritasında yok.

## Test zorunlulukları

Motora dokunan her değişiklik testle gelir. Asgari kapsam:

- Session: saat dilimleri, DST geçiş haftaları (ABD ve İngiltere farklı haftalarda geçer), hafta sonu kapanışı.
- Yeniden örnekleme: mum sınırları, eksik mumlar, günlük kapanış saati.
- Feature: swing onay gecikmesi, lookahead olmadığını kanıtlayan test (veri kesildiğinde geçmiş tespitler değişmemeli), FVG ve sweep kenar durumları.
- Backtest: determinizm, aynı mumda SL/TP, boşlukla açılış (gap), spread/komisyon/kayma, emir süresinin dolması, pozisyon büyüklüğü yuvarlama.
- Risk: lot hesabı (USD kote, USD baz, çapraz pariteler), R, beklenen değer, drawdown.

## Çalışma şekli

- Kullanıcıyla Türkçe konuş. Kod, değişken adları, commit mesajları İngilizce. Arayüz metinleri Türkçe ve tek bir çeviri dosyasında.
- Her taş: plan → kullanıcı onayı → küçük adımlar → test → çalışır durumda gösterim.
- Belirsiz bir noktada tahmin yürütme, sor. Varsayım yaptıysan açıkça yaz.
- Çalışan özellikleri bozma; büyük yeniden yazımlar önce önerilir.
- Küçük, anlamlı commit'ler.
- Her oturumun sonunda `DEVIR.md` güncellenir: ne yapıldı, ne kaldı, açık sorular, projeyi çalıştırma ve test komutları.

## Tasarım

Koyu tema öncelikli, profesyonel terminal havası, yüksek bilgi yoğunluğu, masaüstü öncelikli ama mobilde bozulmayan. Kumarhane görüntüsü, neon, gereksiz animasyon, "hızlı zengin ol" estetiği yok. Yeşil/kırmızı yalnızca yön ve kâr/zarar anlamında kullanılır; renk tek başına bilgi taşımaz (etiket ya da ikonla desteklenir).

## Kapsam dışı (şimdilik)

Canlı broker işlemi, gerçek parayla otomatik işlem, garanti iddiası taşıyan stratejiler, AI kaynaklı kesin al/sat sinyalleri, sahte veri, sahte backtest, sahte istatistik, TradingView'in sunmadığı bir entegrasyonu zorlamak.
