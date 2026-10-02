# Tanım: Önceki gün / hafta seviyeleri (PDH, PDL, PWH, PWL) — v1

Kod: `packages/engine/src/features/periods.ts` · Test: `packages/engine/test/periods.test.ts`

## Tanım
- **İşlem günü:** 17:00 New York'tan ertesi gün 17:00 New York'a (D11, D17). **İşlem haftası:** Pazar 17:00 NY'den sonraki Pazar 17:00 NY'ye.
- Her biten gün için en yüksek (**PDH**, previous day high) ve en düşük (**PDL**) fiyat; her biten hafta için **PWH** / **PWL**.
- Değerler 1 dakikalık taban veriden hesaplanır, grafiğin zaman diliminden bağımsızdır.

## Onay ve geçerlilik
- `knownAt = dönemin bitişi`. Dönem bitmeden seviye yoktur.
- `validUntil = piyasanın açık olduğu bir sonraki dönemin bitişi`. Cuma günü seviyeleri hafta sonunu atlayıp Pazartesi işlem gününün (Pazar 17:00 NY'den başlayan) sonuna kadar geçerlidir.
- Grafikte seviye, bilindiği andan geçerliliği bitene kadar kesik çizgiyle çizilir.

## Varsayımlar
- Tatil takvimi yok: tatil günü düşük hareketli ama normal bir gün sayılır.
- Hafta sonu verisi olmadığı varsayılır (FX). Kesilmiş veride haftalık seviye ancak hafta sonu bitip yeni hafta başlayınca (Pazar 17:00 NY) görünür.

## Bilinen başarısızlık durumları
- Veri boşluğu olan günlerde (ör. EURUSD 2–6 Aralık 2024) high/low eksik veriden hesaplanır.
- Broker'ınız günü farklı saatte kapatıyorsa (ör. 00:00 UTC) PDH/PDL onun grafiğindekinden farklı çıkar.

## Kanıt
Her kesme noktası için kesilmiş veriden hesaplanan seviyeler = tam veriden hesaplanıp `knownAt ≤ kesim` ile süzülenler.
