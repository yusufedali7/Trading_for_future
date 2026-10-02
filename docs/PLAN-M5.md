# PLAN — M5: Strateji ve backtest

> Durum: kullanıcı 2026-10-02'de "devam et" dedi; plan kaydedildi ve uygulandı. **Görev 1–11 tamamlandı (2026-10-02).** Kararlar `docs/DECISIONS.md` D31–D34, şema `docs/schema/strategy-v1.md`.

## Amaç
Elle gözlenen bir fikri **kod yazmadan** tipli kurallara dökmek (strateji), kuralları M4 adaylarıyla geçmiş veride **deterministik** olarak test etmek ve sonucu dürüstlük göstergeleriyle ölçmek.

## Strateji şeması v1 (D10 taslağının kesinleşmiş hali)
- Sıralı olay adımları: `LIQUIDITY_SWEEP`, `STRUCTURE_BREAK`, `FVG`, `SWING`; her adımın filtreleri (yön, tür, seviye) ve bir önceki adımdan sonra en fazla `maxBars` mum içinde onaylanma şartı.
- Giriş: `MARKET` (kurulum mumunun kapanışından sonraki ilk 1m açılış), `LIMIT_AT ref`, `STOP_AT ref`; `expireBars`.
- Stop: `BEYOND_REF ref + bufferPips` ya da `FIXED_PIPS`. Hedef: `R_MULTIPLE`, `FIXED_PIPS`, `AT_REF`.
- Referans: `adımId.alan` (ör. `sweep.extreme`, `fvg.top`, `mss.level`).
- Zaman penceresi (yerel saat + IANA dilimi), günlük en fazla işlem, işlem başı risk yüzdesi.
- Stratejinin kendi feature parametreleri (swing L/R, FVG min, kırılım tipi, süpürme yaşı) spec'in parçasıdır, böylece sonuç tekrar üretilebilir.
- Kaydedilen versiyon değişmez (D6); içerik özeti `specHash`.

## Backtest kuralları
- Aynı motor: `computeFeatures` → kurulum bulucu → `simulateTrade` (replay ile aynı dolum kuralları, D26).
- Tek pozisyon: bir işlem bitmeden yeni kurulum alınmaz (atlanan sayılır).
- Lot: risk % / (stop mesafesi × pip değeri), lot adımına aşağı yuvarlanır; en küçük lotun altı atlanır. USD kote ve USD baz desteklenir; çapraz pariteler v1'de atlanır.
- Maliyet: spread, kayma (pip), komisyon (lot başına, taraf başına USD). Sonuçlar maliyet sonrası.
- Aralık sonunda açık işlem aralık sonunda kapatılır (`END_OF_RANGE`).
- Dürüstlük: işlem < 30 uyarısı, belirsiz mum sayısı, atlanan kurulumlar (veri boşluğu, geçersiz stop, küçük lot, pozisyon açık, günlük sınır), süresi dolan emirler, toplam maliyet, in-sample deneme sayısı.
- Kayıt: strateji id+versiyon+specHash, tanım versiyonları, veri kümesi + içerik özeti + aralık, maliyet, risk, belirsizlik kuralı, motor versiyonu, çalışma zamanı.

## Görevler
| # | Görev | Test |
|---|---|---|
| 1 | Şema, doğrulama, `specHash`, referans listesi | Geçerli/geçersiz örnekler, hash kararlılığı |
| 2 | Kurulum bulucu | Sıra, `maxBars`, en erken aday, pencere, kesme değişmezliği |
| 3 | Lot ve pip değeri | USD kote, USD baz, XAU, yuvarlama, çapraz |
| 4 | Backtest koşucusu | Determinizm, tek pozisyon, gap, aynı mum SL/TP, süre dolması, maliyetler, günlük sınır, aralık sonu |
| 5 | İstatistik ve kırılımlar | Equity, % düşüş, R dağılımı, aylık/seans/gün kırılımları |
| 6 | Depolama: `trw-strategy`, `trw-research` | Versiyon değişmezliği, gidiş-dönüş |
| 7 | Worker: backtest ve grafik için kurulumlar | candle-source testi |
| 8 | Strateji sayfası: liste, oluşturucu, versiyonlar, durum | App testi |
| 9 | Backtest formu + sonuç ekranı + çalışma listesi + karşılaştırma | App testi; tarayıcıda gerçek veri |
| 10 | Strateji → grafik: seçilen versiyonun kurulumları ve işlemleri | App testi |
| 11 | Belgeler: şema belgesi, sözlük, kararlar, DEVIR | — |

## Kapsam dışı
Parametre optimizasyonu aracı (yalnızca deneme sayısı kaydı var), kısmi kâr / breakeven / trailing, çoklu pozisyon, çapraz paritelerde lot, Monte Carlo.
