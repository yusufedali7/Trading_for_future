# Tanım: Order block — v1

Kod: `packages/engine/src/features/order-block.ts` · Test: `packages/engine/test/order-block.test.ts`
Katalog: `catalog/patterns/smc.json` → `order_block` (durum: `IMPLEMENTED`, oracle doğrulaması yok — ICT/SMC'nin tek resmi tanımı yok).

## Tanım
Girdi: mevcut M4 motorunun `StructureBreak[]` (BOS/CHoCH) ve bu dilimde eklenen `Displacement[]` çıktıları.

1. Bir yapı kırılımının kırılım mumu (`breakIndex = brk.formedIndex`) **aynı yönde** bir displacement mumuysa (katalogun "BOS/MSS'yi yaratan displacement" şartının karşılığı — ayrı bir MSS tipi henüz yok, bu yüzden "displacement eşlik eden her BOS/CHoCH" kullanılıyor) devam edilir, yoksa bu kırılım için order block üretilmez.
2. Kırılım mumundan geriye, en fazla `lookbackBars` mum içinde, **kırılım yönünün tersi renkte** ilk mum aranır (kapsayıcı renk kuralı: `close ≥ open` BULLISH — `patterns/candlestick.ts`'deki engulfing rengiyle aynı kural). Bulunursa o mum referans mumdur.
3. Bölge (`zone`): `BODY` ise referans mumun gövdesi (`min/max(open,close)`), `RANGE` ise tam yüksek-düşük aralığı.
4. `direction` = kırılımın yönü (mumun kendi rengi değil): BULLISH order block aşağıda destek/talep bölgesi, BEARISH yukarıda direnç/arz bölgesi olarak okunur.

| Parametre | Varsayılan | Anlam |
|---|---|---|
| `zone` | `BODY` | Bölge gövde mi tam aralık mı |
| `lookbackBars` | 10 | Referans muma kaç mum geriye kadar bakılır |

**Forex notu:** Bazı kütüphaneler order block'un gücünü hacimle ölçüyor; forex verisinde gerçek hacim olmadığı için (katalogun notu) hacim tabanlı güç kullanılmıyor.

## Onay gecikmesi
`formedIndex` = referans (ters renkli) mumun indeksi — bölgenin fiyat olarak **oluştuğu** yer. `confirmedIndex` = kırılım/displacement mumunun indeksi — bölgenin **bilindiği** an (geriye dönük işaretlenir ama bu andan önce var sayılmaz, swing'teki `formedAt < confirmedAt` deseniyle aynı).

## `Detection` birleşimine neden dahil
Swing/FVG/süpürme gibi "tutar mı, kırılır mı" izlenebilen bir seviye adayı — `features/outcomes.ts`'e `ORDER_BLOCK` için bir başarısızlık çizgisi eklendi (BULLISH → alt sınırın altına kapanış; BEARISH → üst sınırın üstüne kapanış, FVG'nin aynı mantığı). Henüz `FeatureSet`'e (grafik/backtest ana borusu) bağlanmadı — bu, M8'deki indikatörlerin önce motorda yazılıp sonra ayrı bir adımda grafiğe bağlanmasıyla aynı sıralama; `candidateOutcome()` doğrudan çağrılarak kullanılabilir.

## Varsayımlar
- Yalnızca BOS/CHoCH + eşlik eden displacement; gerçek bir MSS (CHoCH + displacement) tipi henüz ayrı kodlanmadı.
- Referans mum bulunamazsa (ör. `lookbackBars` içinde hep aynı renk) o kırılım için order block üretilmez, hata fırlatılmaz.
- Bölge, sonraki mumlarla "mitigated/tested" diye güncellenmiyor v1'de — yalnızca oluşum + geçersizleşme fiyatı (outcome takibiyle).

## Bilinen başarısızlık durumları
- `lookbackBars` küçükse (veya displacement çok ani oluştuysa) gerçek referans mum penceresinin dışında kalabilir, order block atlanır.
- Çok sık displacement üreten gürültülü 1m verisinde order block sayısı da artar; `minBodyAtr`/`atrPeriod` ile süzülmeli.

## Kanıt
Kesme değişmezliği: kesilmiş veriden hesaplanan order block'lar (aynı veriden yeniden hesaplanan swing/break/displacement ile) = tam veriden hesaplanıp `confirmedIndex < k` olanlarla birebir aynı.
