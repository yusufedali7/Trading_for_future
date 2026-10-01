# DEVIR — Oturum Devir Notu

_Son güncelleme: 2026-10-01 (M1 oturumu, veri indirme)_

## Durum özeti
- **Aktif kilometre taşı:** M1 (Veri ve grafik): görev 1–12 tamamlandı. **Görev 13 (gerçek veriyle kabul): 2 yıllık 1m veri indiriliyor** (D22).
- **İndirme durumu:** gün dosyaları `data/.dukascopy-cache/` altında (git dışı). EURUSD 632/730, XAUUSD 424/730 gün. Eksik günler, sırayla ve kibar hızda indiren bir betikle tamamlanıyor; betik yalnızca eksik günleri indirir. Sonra CSV, `npx dukascopy-node@1.50.0 ... -ch -chpath data/.dukascopy-cache` ile tamamen önbellekten üretilir.
- **Ağ notu:** Bazı ağlarda (ör. 2026-10-01 kafe Wi-Fi) Dukascopy alan adları idari tedbirle erişime kapalı ("erişime engellenmiş" sayfası). Engel aşılmaya çalışılmaz (VPN/DNS değişikliği yok). İndirme, erişimin normal olduğu ev bağlantısında tamamlanır.
- Testler: **154 test yeşil**. Lint, tip kontrolü ve üretim derlemesi temiz; temiz clone ile doğrulandı.
- Git: tüm işler yerel `main` dalında commit edildi. **Push'u kullanıcı kendisi yapıyor** (`git push`). Son push'tan beri 7 commit bekliyor; içlerinde daha önce `.gitignore` yüzünden GitHub'a gitmemiş motor `data/` modülleri de var.

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
