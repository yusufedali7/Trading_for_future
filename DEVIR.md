# DEVIR — Oturum Devir Notu

_Son güncelleme: 2026-10-01 (M2 oturumu)_

## Durum özeti
- **M1 (Veri ve grafik):** tamamlandı. Gerçek veriyle kabul yapıldı (aşağıda). Kullanıcı kendi tarayıcısında içe aktarmayı sonraya bıraktı.
- **M2 (Session ve manuel analiz):** görev 1–9 tamamlandı; plan `docs/PLAN-M2.md`, kararlar D23–D25. **Kullanıcının kendi tarayıcısında denemesi bekleniyor.**
- **Sıradaki:** M3 (replay ve işlem günlüğü) planı. Kullanıcı "başla" deyince kısa plan yazılıp hemen uygulamaya geçilir.

## M2'de yapılanlar
| # | Görev | Sonuç |
|---|---|---|
| 1 | Seans motoru | `session/sessions.ts`: Asya (Tokyo), Londra, New York yerel saatle; DST'ye uygun UTC; gece yarısını aşan seanslar; kapalı günler atlanır |
| 2 | Seans seviyeleri | `session/levels.ts`: 1m'den high/low, `complete`/`knownAt`; kesme değişmezliği testi (lookahead yok) |
| 3 | Seans kutuları | Hesaplama worker'ı seansları da döndürür; ENGINE katmanı primitive'i; seans aç/kapa (tercihlerde kalıcı); 1D/1W'de gizli |
| 4 | Koordinatlar | `chart/coords.ts` (zaman ↔ konum), `chart/lwc-coords.ts` (LWC 5.2.1'in kesirli konum hatasına karşı ara değer) |
| 5 | Çizim modeli ve depo | `user/drawings.ts` (motor); `trw-user` v2 (`drawings`, `levels`); çizim silinince seviyesi de silinir |
| 6 | Çizim araçları | Yatay çizgi, trend, bölge, fiyat aralığı, long/short; tıklayarak oluşturma (önizlemeli), seçme, tutamak sürükleme, Delete/Esc |
| 7 | Destek/direnç | Yan panel: renk, not, pozisyon fiyatları, seviye türü/zaman dilimi/durum ve durum geçmişi; seviye listesi |
| 8 | Görünür aralık | Zaman dilimi değişince aynı zaman aralığı görünür kalır; ilk açılışta son 150 bar |
| 9 | Belgeler | `docs/definitions/session-v1.md`, sözlükte M2 kavramları, D23–D25 |

Tarayıcıda gerçek EURUSD verisiyle doğrulananlar:
- 16 Mart 2026 haftası (ABD yaz saatinde, İngiltere değil): kutular doğru saatlerde.
- Kutular ve çizimler 15m ↔ 1h geçişinde aynı zaman ve fiyatta kalıyor.
- Hızlı ardışık tıklamalarla beş çizim türü oluşturuluyor.
- Tutamak sürükleme kaydediliyor ve sürüklerken grafik kaymıyor.
- Seviye kaydı ve durum değişikliği çalışıyor.
- Sayfa yenilenince çizimler korunuyor.

Bulunan ve düzeltilen hatalar:
- `logicalToCoordinate` kesirli konumda 0 döndürüyordu; kutular görünmüyordu (D24).
- Grafik kütüphanesi hızlı ikinci tıklamayı yutuyordu (D25).
- Zaman dilimi değişince grafik baştan kuruluyor ve sona sıçrıyordu.
- Vite HMR'nin eski bir modülü önbellekte tutması: geliştirme sırasında sayfa boş kalırsa sunucuyu yeniden başlat.

## M2 iyileştirme listesi
1. Seans kutusu etiketleri kalabalık yerlerde üst üste biniyor; yer yoksa etiketi atla.
2. Çizimin tamamını sürükleyerek taşıma (şu an yalnızca tutamaklar).
3. Özel seans tanımları (ör. ICT Asya aralığı 20:00–00:00 NY) için arayüz.
4. Seviye durumunu fiyata göre otomatik önermek ("kırılmış olabilir"). M4'ün aday mantığıyla birlikte, öneri olarak; kesin karar değil.
5. 1m görünümünde görünür aralığa göre veri vermek (M1 listesinden).
- **Veri (git dışı, `data/`):** `eurusd_m1_bid_2024-10-01_2026-09-30.csv` (38,7 MB, 736.706 mum), `xauusd_m1_bid_2024-10-01_2026-09-30.csv` (38,1 MB, 708.763 mum), karşılaştırma için `*_h1_*` dosyaları. Gün önbelleği: `data/.dukascopy-cache/` (730/730 gün, iki enstrüman).
- **Ağ notu:** Bazı ağlarda (ör. 2026-10-01 kafe Wi-Fi) Dukascopy alan adları idari tedbirle erişime kapalı ("erişime engellenmiş" sayfası). Kalan indirme, kullanıcının kendi bağladığı VPN üzerinden tamamlandı.
- Testler: **237 test yeşil** (motor 145+, web 90+). Lint ve tip kontrolü temiz.
- Git: tüm işler yerel `main` dalında commit edildi. **Push'u kullanıcı kendisi yapıyor** (`git push`). İçlerinde daha önce `.gitignore` yüzünden GitHub'a gitmemiş motor `data/` modülleri de var.

## Görev 13: gerçek veriyle kabul (2026-10-01)
**Uygulamada (gömülü tarayıcı, EURUSD 2 yıl, 1m):** okuma 1,0 sn; analiz 1,8 sn; kayıt 1,3 sn; ilk grafik 1,1 sn. Zaman dilimi geçişleri: 4H ≈ 0,6 sn, 1D ≈ 0,6 sn, 1h ≈ 1,9 sn, **1m ≈ 7,6 sn** (736 bin mum tek seferde; iyileştirme listesinde).

**Sayısal kabul:** 1m'den üretilen 4H/1D mumları, Dukascopy'nin kendi 1h verisinden üretilenlerle karşılaştırıldı (OHLC birebir).
| | 4H aynı | 1D aynı |
|---|---|---|
| XAUUSD | 3078 / 3094 (%99,5) | 510 / 517 |
| EURUSD | 2872 / 3091 (%93) | 444 / 521 |
Farklar yeniden örneklemeden değil, **kaynaktan** geliyor. Örnek: XAUUSD 2025-01-16 02:00'da 1m verisinin ilk dakikası 2695,919 ile açılıyor; Dukascopy'nin kendi 1h mumu ise 2697,705 (02:02'nin açılışı) diyor. EURUSD farkları Ekim 2024'te (neredeyse her mum 1–3 puan) ve 2–6 Aralık 2024'te yoğunlaşıyor.

**Kaynak veri kalitesi bulguları (Dukascopy):**
- **EURUSD 2024-10-10:** 617 dakikada OHLC kendi içinde tutarsız. Ham JSON elle çözülerek doğrulandı; kesirli delta değerleri var. İçe aktarmada `DROP_INVALID_PRICES` kabul edilerek çıkarıldı.
- **EURUSD 2–6 Aralık 2024:** 1 dakikalık veride günde 1 mum var, 1h veride 24 saat tam. Taze indirme de aynı sonucu verdi. Gelecekte tick verisinden yeniden oluşturulabilir.
- **Tatiller** (25 Aralık, 1 Ocak, Paskalya öncesi Cuma, ABD tatillerinde altının erken kapanışı): piyasa kapalı, ama tatil takvimi henüz modelde yok; "boşluk" olarak raporlanıyor.
- **EURUSD'de 2.136 küçük boşluk:** çoğu 1 dakikalık sessiz an. Araç sıfır hacimli "düz" dakikaları dışarıda bırakıyor (`--flats` kapalı).
- **XAUUSD:** düzeltme gerektirmedi.

## İyileştirme listesi (M1 sonrası, önceliğe göre)
1. 1m görünümünde yalnızca görünür aralığı grafiğe vermek (7,6 sn → hedef < 1 sn).
2. Tatil / erken kapanış takvimi (boşluk raporunu sadeleştirir; M2 session engine ile birlikte).
3. 2–6 Aralık 2024 EURUSD boşluğunu tick verisinden doldurma (isteğe bağlı).
4. Sıfır hacimli dakikaları (flats) "beklenen" olarak ayırmak.

## M1'de yapılanlar
| # | Görev | Sonuç |
|---|---|---|
| 1 | İskelet | npm workspaces (`packages/engine`, `apps/web`), TS 6 strict, Vitest, ESLint (motor saflık kuralları testli), Prettier, README, NOTICE |
| 2 | Zaman / saat dilimi | `core/timeframe.ts`, `core/tz.ts`: DST boşluk ve çakışmaları raporlanır; ofsetler 15 dk dilimlerde önbelleklenir |
| 3 | Enstrümanlar | `instruments/registry.ts` (EURUSD, GBPUSD, USDJPY, XAUUSD); tick üzerinden kesin pip hesabı; `instruments/hours.ts` (hafta sonu, altın günlük arası) |
| 4 | CSV ayrıştırma | `data/csv-rows.ts`: tarih kalıbı ve kolon eşlemesi ayarlanabilir, başlıktan tahmin edilir; hatalı satırlar satır numarasıyla raporlanır |
| 5 | Doğrulama | `data/validate.ts`: tekrar, sıra, boşluk (beklenen / beklenmeyen), kapalı piyasa mumu, fiyat hataları, tick hassasiyeti |
| 6 | Normalizasyon | `data/normalize.ts`: yalnızca kullanıcının kabul ettiği düzeltmeler uygulanır; SHA-256 içerik özeti (`data/columnar.ts`) |
| 7 | Yeniden örnekleme | `data/resample.ts`: 1m → 5m…1W, sınırlar 17:00 NY; `sourceCount/expectedCount`, `complete` |
| 8 | Arayüz iskeleti | koyu tema, `i18n/tr.ts`, boş durum ekranı (veri yoksa sonuç yok) |
| 9 | Depolama | Dexie: `trw-market` (sütunlu parçalar), `trw-user` (tercihler) |
| 10 | İçe aktarma sihirbazı | worker'da: oku → kolon eşleme → doğrulama raporu → düzeltme onayları → kaydet |
| 11 | Grafik | Lightweight Charts 5.2.1: mum + hacim, UTC ile beslenir, etiketler seçilen saat diliminde, bilgi şeridi (eksik / kapanmamış mum uyarısı) |
| 12 | Araç çubuğu | veri kümesi, zaman dilimi (≥ taban), saat dilimi (İstanbul, Londra, New York, Tokyo, UTC), tarihe git; tercihler kalıcı |
| ek | Hesaplama worker'ı | yükleme ve yeniden örnekleme worker'da; arayüz donmaz |

Tarayıcıda doğrulananlar (sentetik test verisiyle, sonra silindi):
- içe aktarma akışı;
- 15m, 4H ve 1D görünümleri;
- 1 Kasım 2026 ABD saat değişimi hafta sonunun "beklenen boşluk" olarak tanınması;
- 4H mumlarının NY saatiyle 17/21/01… hizalanması;
- 1D mumlarında boş Pazar mumu oluşmaması;
- tarihe git;
- tercihlerin sayfa yenilemede korunması;
- 375 px telefon genişliğinde yatay kaydırma olmaması.

## Kullanıcıdan beklenen: Görev 13, gerçek veriyle kabul
Dukascopy web aracı 2026-09-30'da incelendi (https://widgets.dukascopy.com/en/historical-data-export).
**Kısıt (2026-10-01'de doğrulandı):** Period "Minute" iken yalnızca **tek gün** seçilebiliyor. Period "Hour" iken tarih aralığı açılıyor ama **en fazla tam 1 ay** seçtiriyor (takvimde başlangıçtan 1 ay sonrası dışındaki her gün devre dışı/gri). Yani 2 yıllık saatlik veri için ~24 aylık dosya, 2 yıllık 1 dakikalık veri için ~520 günlük dosya gerekiyor.
Alanlar: enstrüman listesi → Export → Period (sayı + Tick/Second/Minute/Hour), Date, Timezone (UTC, Local time, şehirler), Offer side (Bid/Ask) → Download.
Doğrulanmayanlar: indirmenin giriş gerektirip gerektirmediği, saat aralığının üst sınırı, CSV'nin kolon ve tarih biçimi.

Önerilen kabul yolu (kullanıcı onayı bekleniyor, D14'ü değiştirir):
1. EUR/USD, **1 Hour**, son 2 yıl, **UTC**, **Bid** → tek dosya. Taban zaman dilimi 1h olarak içe aktarılır.
2. EUR/USD, **1 Minute**, tek bir gün (örn. bir Salı), UTC, Bid → 1m biçimini ve 1m→15m/1h/4H yolunu doğrulamak için.
3. Aynısını XAU/USD için tekrarla.
4. Doğrulama raporlarının ekran görüntüleri → 4H mumları Dukascopy'nin kendi grafiğiyle karşılaştırılır.

Uzun 1m geçmişi için seçenekler (karar bekliyor):
- (a) JForex demo hesabı → Historical Data Manager: aralıkla 1m dışa aktarımı mümkün görünüyor; doğrulanmadı.
- (b) Birden çok günlük dosyayı tek veri kümesinde birleştirme özelliği.
- (c) Otomatik veri adaptörü: CLAUDE.md gereği ayrı faz; önce kullanım koşulları kontrol edilir.

## Açık konular / doğrulanmamışlar
- **Dukascopy CSV biçimi** (kolonlar, tarih biçimi, hafta sonu düz mumları): ilk gerçek dosyayla netleşecek. Biçim tanınmazsa sihirbazdaki kolon eşlemesi elle ayarlanabilir.
- **Birden çok dosyayı birleştirme** yok. Dukascopy web aracı 1m veriyi günlük veriyor (yukarıya bak).
- **Grafik tick yerleşimi:** Lightweight Charts ana tick'leri UTC gün sınırlarına göre seçiyor. Etiketler seçilen saat diliminde doğru, ama "gün" tick'i yerel gece yarısına denk gelmeyebilir. Özel yatay ölçek alternatifi doğrulanmadı.
- **Altın (XAUUSD) tick hassasiyeti** 0.001 varsayıldı. Gerçek veride daha ince fiyat varsa doğrulama raporu gösterecek.
- **1m görünümünde çok büyük veri:** 750 bin mumu grafiğe tek seferde vermek yavaş olabilir. Gerçek veriyle ölçülecek; gerekirse görünür aralık yüklenir.
- Üretim paketi 530 kB (uyarı). Yerel uygulama için şimdilik kabul edildi.
- PLAN §5'teki `ValidationReport` taslağı değişti; güncel hali DECISIONS D19'da.

## Sonraki adım
Görev 13 kabulü tamamlanınca: M1 kapanışı (DEVIR güncellemesi) → **M2 planı** (session engine, çizim araçları, destek/direnç seviyeleri). Plan önce kullanıcıya sunulur, onay alınmadan başlanmaz.

## Çalıştırma ve test komutları
```bash
npm install        # bağımlılıkları kur (ilk seferde)
npm run dev        # uygulamayı başlat → http://localhost:5173
npm test           # tüm testler (Vitest)
npm run lint       # ESLint + Prettier kontrolü
npm run typecheck  # TypeScript kontrolü
npm run build      # üretim derlemesi
```

## Ortam
- Node v22.17.0, npm 11.1.0, git 2.56.0 (Windows 11), 8 GB RAM.
- Veri tarayıcının IndexedDB'sinde durur (`trw-market`, `trw-user`). Tarayıcı verilerini silersen içe aktarılan veriler de silinir; CSV dosyalarını sakla.
