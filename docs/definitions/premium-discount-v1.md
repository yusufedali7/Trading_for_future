# Tanım: Premium / discount — v1

Kod: `packages/engine/src/features/premium-discount.ts` · Test: `packages/engine/test/premium-discount.test.ts`
Katalog: `catalog/patterns/smc.json` → `premium_discount` (durum: `IMPLEMENTED`, oracle doğrulaması yok).

## Tanım
En son onaylanan swing tepe ve dip, bir aralık tanımlar: `top`/`bottom`. Bu aralığın %50'si denge (`equilibrium`) — üstü **premium**, altı **discount** olarak okunur. Referans tepe ya da dip her değiştiğinde (ikisi de mevcutsa) yeni bir bölge kaydı eklenir.

Parametre yok — algoritmanın kendisi sabit ("son onaylı swing aralığı").

## Onay gecikmesi
Her kayıt, onu tetikleyen swing'in onay anında (`formedAt=confirmedAt`) oluşur; gecikme yok çünkü zaten onaylı swing'lerden türetiliyor.

## Geçerlilik penceresi — bilinçli basitleştirme
Her kayıt, **bir sonraki kaydın `confirmedAt`'ına kadar** geçerli sayılır — ama bunu tutan bir `validUntil` alanı **yok**. `PeriodLevel`/`LiquidityLevel`'daki gibi geriye dönük doldurulan bir alan eklemek, kesme değişmezliği testini (`Fvg.filledAt` gibi) özel bir `featuresAsOf` kesme mantığı gerektirir hale getirirdi; bunun yerine düz, sıralı bir liste tutuluyor — her zaman diğer tüm dedektörlerle aynı basit kesme değişmezliği testi geçerli.

## `Detection` birleşimine neden dahil değil
Tek bir yön/geçersizleşme fiyatı yok — `equilibrium` bir referans çizgisi, destek/direnç gibi "tutar/kırılır" değil.

## Bilinen başarısızlık durumları
- Yalnızca bir swing tipi (yalnızca tepe ya da yalnızca dip) onaylanmışken hiç kayıt üretilmez.
- Dejenere durum (`top <= bottom`, normal veride olmaması gerekir) sessizce atlanır, hata fırlatılmaz.

## Kanıt
Kesme değişmezliği: kesilmiş veriden hesaplanan bölgeler = tam veriden hesaplanıp `confirmedIndex < k` olanlarla birebir aynı (ekstra bir kesme mantığı gerekmez, yukarıdaki basitleştirme sayesinde).
