# Tanım: Inversion FVG (IFVG) — v1

Kod: `packages/engine/src/features/ifvg.ts` · Test: `packages/engine/test/ifvg.test.ts`
Katalog: `catalog/patterns/smc.json` → `ifvg` (durum: `IMPLEMENTED`, oracle doğrulaması yok).

## Tanım
Her `Fvg` için, `confirmedIndex`'inden sonraki mumlar taranır. Bir mumun **kapanışı** boşluğun uzak kenarını tamamen geçerse (yükseliş FVG'si için `close < bottom`, düşüş FVG'si için `close > top`) o FVG geçersizleşir ve aynı bölge artık **ters yönde** bir aday olarak izlenir. Yalnızca ilk geçersizleşen mum sayılır.

| Parametre | Not |
|---|---|
| — | Katalogdaki `invalidate_by` tek değeri (`CLOSE`) sabit kodlandı; `WICK` varyantı v1'de yok. |

## Onay gecikmesi
`formedAt/Index` kaynak FVG'ninkiyle aynı (bölge zaten orada oluşmuştu). `confirmedIndex` = geçersizleştiren mumun indeksi, `confirmedAt` = o mumun kapanışı.

## `Detection` birleşimine dahil
FVG'yle aynı mantık — tek, net bir yön ve geçersizleşme fiyatı var. `features/outcomes.ts`'e eklendi (BULLISH → alt sınır altı, BEARISH → üst sınır üstü kapanış).

## Varsayımlar
- Yalnızca kapanışla geçersizleşme; fitille dokunma sayılmaz (bu zaten `Fvg.filledAt`'ın işi, farklı bir alan).
- Bir FVG en fazla bir kez IFVG'ye dönüşür (ilk geçersizleşmeden sonra taramaya devam edilmez).

## Bilinen başarısızlık durumları
- Çok sık FVG üreten gürültülü verilerde IFVG sayısı da artar; kaynak FVG'nin `minSizePips` filtresiyle süzülmeli.

## Kanıt
Kesme değişmezliği: kesilmiş veriden hesaplanan IFVG'ler = tam veriden hesaplanıp `confirmedIndex < k` olanlarla birebir aynı.
