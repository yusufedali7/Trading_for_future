# PLAN — M4: Feature engine v1

> Durum: kullanıcı 2026-10-02'de "devam et" dedi; plan kaydedildi ve uygulamaya geçildi. Kararlar `docs/DECISIONS.md` (D28+).

## Amaç
Elle gözlemlenen kavramları (swing, FVG, yapı kırılımı, likidite süpürmesi, önceki gün/hafta seviyeleri) **parametreli, versiyonlu ve test edilmiş** tanımlara dökmek ve grafikte **aday** katmanı olarak göstermek. Aynı fonksiyonlar M5'te strateji ve backtest tarafından kullanılacak (tek motor, iki tüketici).

## Temel kurallar
- **Onay zamanı:** Her tespit `formedAt/formedIndex` (olayın mumu) ve `confirmedAt/confirmedIndex` (bilindiği mumun kapanışı) taşır. Yalnızca kapanmış (`complete`) mumlar kullanılır.
- **Kesme değişmezliği:** Veri herhangi bir anda kesildiğinde hesaplanan tespitler, tam veriden hesaplanıp `confirmedAt ≤ kesim` ile süzülenlerle birebir aynıdır. Replay bu yüzden tam veriden hesaplanan tespitleri imleçle süzerek gösterir. Her özellik için test zorunlu.
- **Aday dili:** Arayüzde "Aday tepe", "Aday FVG" gibi; "kesin" ifade yok. Motor katmanı kullanıcı çizimlerinden ayrı ve farklı görünümde.
- **Belgeler:** Her tanım `docs/definitions/<ad>-v1.md`: parametreler, onay gecikmesi, varsayımlar, bilinen başarısızlık durumları.

## Tanımlar (v1, varsayılanlar)
| Özellik | Tanım | Onay |
|---|---|---|
| Swing | Tepe: high, soldaki `L` mumdan kesin büyük, sağdaki `R` mumdan büyük-eşit (dip simetrik). `L=R=3` | Sağdaki `R`. mumun kapanışı |
| FVG | 3 mum: yükseliş için `low[i] > high[i-2]`, düşüş için `high[i] < low[i-2]`; boşluk ≥ `minSizePips` (1). Doldurulma: fiyat boşluğun öbür ucuna kadar dönünce | 3. mumun kapanışı |
| Yapı kırılımı | Son onaylı swing tepesinin üstünde (düşüşte dibinin altında) kapanış (`breakBy: CLOSE`, ya da `WICK`). Önceki kırılım ters yöndeyse `CHOCH`, aynı yöndeyse `BOS` | Kırılım mumunun kapanışı |
| Önceki gün/hafta | İşlem günü (17:00 NY) ve haftasının high/low'u; bir sonraki gün/hafta boyunca geçerli seviye | Gün/hafta kapanışı |
| Likidite süpürmesi | Önceden bilinen bir seviyenin (swing, PDH/PDL, PWH/PWL, seans high/low) fitille aşılıp aynı mumda seviyenin içinde kapanış. Seviye ilk aşıldığında "alınmış" sayılır | Süpürme mumunun kapanışı |

## Görevler ve testler
| # | Görev | Testler |
|---|---|---|
| 1 | Tespit tipleri, mum kapanış zamanı yardımcı fonksiyonu, swing | Onay gecikmesi, eşit tepeler, kenarlar, kesme değişmezliği |
| 2 | FVG + doldurulma durumu | Yön, minimum boyut, doldurulma zamanı, kesme değişmezliği |
| 3 | Yapı kırılımı (BOS/CHOCH) | Kapanış/fitil, referans swing değişimi, CHOCH, kesme değişmezliği |
| 4 | Önceki gün/hafta seviyeleri | Gün sınırı 17:00 NY, hafta, geçerlilik aralığı |
| 5 | Likidite seviyeleri + süpürme | Fitil+geri kapanış, kapanışla kırılma (süpürme değil), seviye bir kez alınır, geçerlilik |
| 6 | `computeFeatures` + `featuresAsOf` | Tam veri süzülmüş = kesilmiş veriden hesap (birkaç zaman diliminde) |
| 7 | Worker: özellikler grafik verisinde; replay'de imleçle süzme | candle-source testleri |
| 8 | Grafikte aday katmanı + katman aç/kapa (tercihlerde) | App testi; tarayıcıda gerçek veriyle |
| 9 | Tanım belgeleri, sözlük, kararlar, DEVIR | — |

## Kapsam dışı (sonraya)
Parametreleri arayüzden değiştirme, order block, eşit tepeler/dipler (EQH/EQL), çoklu zaman dilimi tespitleri (ör. 15m grafikte 1h swing), tatil takvimi.
