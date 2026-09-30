# DEVIR — Oturum Devir Notu

_Son güncelleme: 2026-09-30 (M1 oturumu)_

## Durum özeti
- **Aktif kilometre taşı:** M1 (Veri ve grafik): görev 1–12 tamamlandı. **Görev 13 (gerçek veriyle kabul) kullanıcının Dukascopy dosyasını bekliyor.** M1, kabul yapılmadan "bitti" sayılmaz.
- Testler: **150 test yeşil** (motor 111, web 39). Lint, tip kontrolü ve üretim derlemesi temiz.
- Git: tüm işler yerel `main` dalında commit edildi. **Push'u kullanıcı kendisi yapıyor** (`git push -u origin main`).

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
Adımlar **doğrulanmadı**; Dukascopy ekranındaki adlar farklı olabilir. Farklıysa bana ekran görüntüsü at.
1. dukascopy.com → geçmiş veri (Historical Data Feed) sayfasında ücretsiz hesapla giriş yap.
2. Enstrüman **EUR/USD**, zaman dilimi **1 dakika**, fiyat **BID**, saat dilimi **GMT**, son 2 yıl → CSV indir.
   - Tek dosyada 2 yıl indirilemiyorsa bana söyle. Birden fazla dosyayı tek veri kümesinde birleştirme özelliği henüz yok.
3. Uygulamayı başlat (`npm run dev`), **CSV içe aktar** → dosyayı seç. Ayarlar: kaynak adı "Dukascopy", saat dilimi **UTC / GMT**, fiyat tipi **BID** → Dosyayı oku → Analiz et.
4. Doğrulama raporunu bana gönder (ekran görüntüsü yeterli). Özellikle bakacağım yerler: hafta sonu "düz mum" uyarısı, boşluklar, tick hassasiyeti.
5. Kaydet → 1m, 15m, 1h ve 4H'ye geç. Rastgele 3 tane 4H mumunun A/Y/D/K değerlerini Dukascopy'nin kendi grafiğiyle karşılaştıracağız.
6. Aynısını XAU/USD için tekrarla.

## Açık konular / doğrulanmamışlar
- **Dukascopy CSV biçimi** (kolonlar, tarih biçimi, GMT seçeneği, hafta sonu düz mumları): ilk gerçek dosyayla netleşecek. Biçim tanınmazsa sihirbazdaki kolon eşlemesi elle ayarlanabilir.
- **Birden çok dosyayı birleştirme** yok. Dukascopy indirmeyi parçalara bölerse eklenecek.
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
