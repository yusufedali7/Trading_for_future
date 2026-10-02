# Tanım: FVG (fair value gap) — v1

Kod: `packages/engine/src/features/fvg.ts` · Test: `packages/engine/test/fvg.test.ts`

## Tanım
Ardışık üç kapanmış mum `i−2`, `i−1`, `i`:
- **Yükseliş FVG'si:** `low[i] > high[i−2]`. Boşluk: alt = `high[i−2]`, üst = `low[i]`.
- **Düşüş FVG'si:** `high[i] < low[i−2]`. Boşluk: alt = `high[i]`, üst = `low[i−2]`.
- Boşluk en az `minSizePips` olmalı (tick hassasiyetinde karşılaştırılır).

| Parametre | Varsayılan | Anlam |
|---|---|---|
| `minSizePips` | 1 | En küçük boşluk (pip). XAUUSD'de 1 pip = 0.1 |

## Onay gecikmesi
`formedIndex = i−1` (ortadaki, "itici" mum), `confirmedIndex = i`, `confirmedAt = i. mumun kapanışı`.

## Sonraki durum (doldurulma)
- `touchedAt`: Sonraki bir mumun boşluğun **yakın kenarına** ulaştığı mumun kapanışı (yükselişte fiyat `üst`e iner).
- `filledAt`: **Uzak kenara** ulaştığı (boşluğun tamamen doldurulduğu) mumun kapanışı.
- Bunlar yalnızca o ana kadar oluşmuş mumlarla hesaplanır. Replay'de imleçten sonraki doldurulma bilinmez (`null`).
- Grafikte kutu doldurulana kadar çizilir; görüntüde en fazla 50 mum uzunluğunda gösterilir (motor durumu değişmez).

## Varsayımlar
- Fitiller dahil (high/low) kullanılır; gövde tabanlı tanım v1'de yok.
- Kısmi doldurulma yüzdesi tutulmaz; yalnızca "dokundu" ve "doldu".

## Bilinen başarısızlık durumları
- Hafta sonu ya da veri boşluğu açılışlarında oluşan "boşluklar" gerçek bir FVG değildir ama tanıma uyabilir.
- Küçük zaman dilimlerinde (1m) çok sayıda FVG çıkar; `minSizePips` ile filtrelemek gerekir.
- Haber anlarında tek mumluk ani hareket büyük FVG üretir; bunların davranışı farklı olabilir.

## Kanıt
Kesme değişmezliği: kesilmiş veriden hesaplanan FVG'ler (dokunma/doldurma dahil) = tam veriden hesaplanıp o ana göre süzülenler.
