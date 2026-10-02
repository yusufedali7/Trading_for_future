# Tanım: Likidite süpürmesi (liquidity sweep) — v1

Kod: `packages/engine/src/features/sweep.ts` · Test: `packages/engine/test/sweep.test.ts`

## Likidite seviyeleri
Bekleyen emirlerin (stop'ların) toplandığı varsayılan fiyatlar. Tepelerin üstü ve diplerin altı.

| Tür | Kaynak | Bilindiği an | Geçerlilik |
|---|---|---|---|
| `SWING_HIGH` / `SWING_LOW` | Onaylı swing (`swing-v1`) | Swing'in onayı | Swing'den sonra `swingMaxAgeBars` (100) mum süresi |
| `PDH` / `PDL`, `PWH` / `PWL` | `period-levels-v1` | Gün/hafta bitişi | Bir sonraki işlem günü/haftası |
| `ASIA_*`, `LONDON_*`, `NEW_YORK_*` | Biten seans high/low (`session-v1`) | Seans bitişi | Aynı seans yeniden başlayana kadar |

## Süpürme tanımı
- Bir seviye, onu aşan **ilk** mumla "alınmış" olur (tepe seviyesi için `high > seviye`, dip için `low < seviye`).
- O mum aynı zamanda seviyenin içinde kapanırsa (`kapanış ≤ tepe seviyesi` ya da `kapanış ≥ dip seviyesi`) bu bir **süpürmedir**:
  - Tepe süpürmesi → yön `BEARISH` (fiyat yukarıda reddedildi).
  - Dip süpürmesi → yön `BULLISH`.
- Kapanış seviyenin ötesindeyse bu bir **kırılımdır**, süpürme değildir. Seviye yine de kullanılmış sayılır.
- Seviye yalnızca, bilindiği anda ya da sonrasında açılan mumlarda ve geçerlilik süresi içinde değerlendirilir.

| Parametre | Varsayılan | Anlam |
|---|---|---|
| `swingMaxAgeBars` | 100 | Swing seviyelerinin geçerlilik süresi (mum) |

## Onay gecikmesi
Süpürme mumunun kapanışında bilinir (`confirmedIndex = formedIndex`). Kapanış görülmeden "geri döndü" denemez.

## Varsayımlar
- v1 yalnızca **aynı mum** içinde geri dönüşü sayar. "Birkaç mum içinde geri dönüş" (`maxBarsToReclaim`) sonraki sürüm için bir adaydır.
- Aynı mum birden fazla seviyeyi süpürebilir; her biri ayrı raporlanır (grafikte tek işarette birleştirilir).

## Bilinen başarısızlık durumları
- Seviyeye bir tick değmek bile "aşma" sayılır; spread farkı gerçek broker grafiğinde farklı sonuç verebilir (veri BID).
- Kapanışla kırılıp sonraki mumda geri dönen hareketler v1'de süpürme sayılmaz.
- Büyük zaman dilimlerinde bir mum içinde ne olduğu görünmez; süpürme ile kırılım ayrımı yalnızca kapanışa bakar.

## Kanıt
Elle yazılmış süpürme, kırılım, geçerlilik örnekleri; swing seviyeleriyle kesme değişmezliği; PDH/PDL ve seans seviyeleri dahil uçtan uca kesme testi (`features-invariance.test.ts`).
