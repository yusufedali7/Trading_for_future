# Tanım: Breaker block — v1

Kod: `packages/engine/src/features/breaker.ts` · Test: `packages/engine/test/breaker.test.ts`
Katalog: `catalog/patterns/smc.json` → `breaker` (durum: `IMPLEMENTED`, oracle doğrulaması yok).

## Tanım
Her `OrderBlock` için, `confirmedIndex`'inden sonraki mumlar taranır. Bir mumun **kapanışı** bölgenin uzak kenarını tamamen geçerse (BULLISH order block için `close < bottom`, BEARISH için `close > top`) order block geçersizleşir ve aynı bölge artık **ters yönde** bir aday olarak izlenir (`ifvg-v1.md` ile birebir aynı mekanik, kaynağı order block olması dışında).

| Parametre | Not |
|---|---|
| — | `invalidate_by` sabit `CLOSE`; `WICK` varyantı yok (ifvg ile aynı gerekçe). |

## Onay gecikmesi
`formedAt/Index` kaynak order block'unkiyle aynı. `confirmedIndex`/`confirmedAt` = geçersizleştiren mumun indeksi/kapanışı.

## `Detection` birleşimine dahil
Order block'la aynı mantık — `features/outcomes.ts`'e eklendi.

## Varsayımlar ve bilinen başarısızlık durumları
`ifvg-v1.md` ile aynı: yalnızca kapanışla geçersizleşme, bir order block en fazla bir kez breaker'a dönüşür.

## Kanıt
Kesme değişmezliği: kesilmiş veriden hesaplanan breaker'lar = tam veriden hesaplanıp `confirmedIndex < k` olanlarla birebir aynı.
