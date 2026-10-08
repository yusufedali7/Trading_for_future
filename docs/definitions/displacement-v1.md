# Tanım: Displacement (güçlü hareket) — v1

Kod: `packages/engine/src/features/displacement.ts` · Test: `packages/engine/test/displacement.test.ts`
Katalog: `catalog/patterns/smc.json` → `displacement` (durum: `IMPLEMENTED`, oracle doğrulaması yok — ICT/SMC'nin tek resmi tanımı yok).

## Tanım
Mum `i`'nin gövdesi (`|close[i] − open[i]|`), kendisinden **önceki** `atrPeriod` mumun basit ortalama true range'inden (`minBodyAtr` ile çarpılmış) büyükse displacement.

- Ortalama, mum `i`'nin kendisini **hiç içermez** (bkz. `patterns/candle-classify.ts`'deki aynı "strictly before" kural — kendi büyüklüğünün kendi eşiğini şişirmesini önler).
- Yön: `close[i] ≥ open[i]` ise BULLISH, değilse BEARISH (`candlestick.ts`'deki engulfing renk kuralıyla aynı kapsayıcı kural; gövde zaten eşikten büyük olmak zorunda olduğu için pratikte hiçbir zaman gerçek bir düz mumla tetiklenmez).

| Parametre | Varsayılan | Anlam |
|---|---|---|
| `minBodyAtr` | 1.5 | Gövde / ortalama TR eşik çarpanı |
| `atrPeriod` | 14 | Ortalamanın alındığı geriye dönük mum sayısı |

## Onay gecikmesi
Tek mumluk bir ölçüm: `formedIndex = confirmedIndex = i`, `confirmedAt = i. mumun kapanışı`. Gecikme yok çünkü yalnızca kendisinden önceki veriyi kullanır.

## `Detection` birleşimine neden dahil değil
Swing/FVG/yapı kırılımı/süpürme hepsi "bu seviye tutar mı, kırılır mı" diye izlenebilen bir **seviye/bölge adayı**; `features/outcomes.ts`'deki sonuç takibi bunun üzerine kurulu. Displacement öyle değil — tek bir mumun sınıflandırması, tam olarak mum formasyonlarına (`patterns/`) benziyor. Bu yüzden ayrı bir tip (`Displacement`), `Detection` birleşiminde değil; doğal bir "geçersizleşme fiyatı" yok.

## Varsayımlar
- Katalogun "ya da ardışık mum dizisi" alternatifi v1'de yok — yalnızca tek mum.
- Basit ortalama (Wilder'ın üstel ATR'si değil) — `candle-classify.ts`'nin eşik kıyaslama yöntemiyle tutarlı olsun diye.

## Bilinen başarısızlık durumları
- Haber anındaki tek mumluk sıçramalar da displacement sayılır; piyasa mikro-yapısından değil, sadece geometriden ayırt edilemez.
- `atrPeriod` kadar geçmiş mum olmadan hiç sonuç üretmez (serinin başında `null` bölge).

## Kanıt
Kesme değişmezliği: kesilmiş veriden hesaplanan displacement'lar = tam veriden hesaplanıp `confirmedIndex < k` olanlarla birebir aynı (her mum yalnızca kendinden önceki veriyi kullandığı için beklenen sonuç).
