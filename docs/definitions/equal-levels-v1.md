# Tanım: Eşit tepeler/dipler (EQH/EQL) — v1

Kod: `packages/engine/src/features/equal-levels.ts` · Test: `packages/engine/test/equal-levels.test.ts`
Katalog: `catalog/patterns/smc.json` → `equal_highs_lows` (durum: `IMPLEMENTED`, oracle doğrulaması yok).

## Tanım
Onaylanan her swing, **aynı türden (tepe/dip) kendisinden önceki en yakın swing** ile karşılaştırılır (üçüncü, dördüncü... swing'i aynı kümeye katan bir kümeleme yok — bu katalogun varsayılan `min_count:2` değeriyle birebir örtüşüyor, ama 2'den büyük değerler v1'de desteklenmiyor). Fiyat farkı, yeni swing'in mumundaki ATR'nin `toleranceAtr` katından küçük/eşitse eşleşme sayılır.

| Parametre | Varsayılan | Anlam |
|---|---|---|
| `toleranceAtr` | 0.1 | Fiyat farkı toleransı (ATR çarpanı) |
| `atrPeriod` | 14 | ATR'nin hesaplandığı geriye dönük mum sayısı |

## Onay gecikmesi
`formedAt/Index` = daha önceki swing'inki (seviyenin ilk oluştuğu yer). `confirmedIndex/confirmedAt` = sonraki (yeni) swing'in onayı — bu, "eşit" olduğumuzu bilme anı.

## `Detection` birleşimine neden dahil değil
Bir swing **çifti** üzerine not — kendi başına alım-satılabilir tek bir bölge/yön taşımıyor (likidite havuzu adayı, `liquidity_sweep`'in zaten işlediği tekil swing seviyelerinden farklı bir gözlem). Doğal bir geçersizleşme fiyatı yok.

## Varsayımlar
- Yalnızca pairwise (ikili) karşılaştırma; gerçek bir kümeleme (3+ swing'i aynı gruba toplama) `candidate-sr-v1.md`'nin işi, orada uygulanıyor.
- Tolerans ATR tabanlı; katalogun kendisi de ATR periyodu belirtmiyor, 14 bizim seçimimiz (diğer indikatörlerle tutarlı varsayılan).

## Bilinen başarısızlık durumları
- ATR henüz hesaplanmadan (`atrPeriod` kadar geçmiş mum yokken) hiçbir eşleşme üretilmez.
- Çok oynak dönemlerde (yüksek ATR) tolerans genişler, gerçekte alakasız seviyeler "eşit" sayılabilir.

## Kanıt
Kesme değişmezliği: kesilmiş veriden hesaplanan eşleşmeler = tam veriden hesaplanıp `confirmedIndex < k` olanlarla birebir aynı.
