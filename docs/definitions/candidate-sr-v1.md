# Tanım: Aday destek/direnç — v1

Kod: `packages/engine/src/features/candidate-sr.ts` · Test: `packages/engine/test/candidate-sr.test.ts`
Katalog: `catalog/patterns/smc.json` → `candidate_sr` (durum: `IMPLEMENTED`, oracle doğrulaması yok).

## Tanım
Onaylanan her swing (tepe **ve** dip — bir seviye hem destek hem direnç olarak çalışabilir, tek bir kümelemeye katılırlar), zaman sırasıyla işlenir:
1. Mevcut kümelerden, fiyatı (kümenin ortalamasına göre) `clusterToleranceAtr × ATR` içinde olan **en yakın** kümeye katılır; yoksa yeni bir küme açılır.
2. En yeni üyesi, işlenen swing'den `lookbackBars`'tan daha eski bir küme eşleşme için değerlendirilmez (eski/soğumuş kabul edilir).
3. Bir küme `minTouches`'a ilk eriştiği anda **bir kez** bir aday bölge kaydı üretilir; sonradan büyümesi yeniden kayıt üretmez.

| Parametre | Varsayılan | Anlam |
|---|---|---|
| `clusterToleranceAtr` | 0.3 | Kümeye katılma toleransı (ATR çarpanı) |
| `minTouches` | 3 | Bölge sayılması için gereken pivot sayısı |
| `lookbackBars` | 500 | Bir kümenin "soğuduğu" kabul edilen yaş sınırı |
| `atrPeriod` | 14 | ATR'nin hesaplandığı geriye dönük mum sayısı |

## Onay gecikmesi
`formedAt/Index` = kümenin **ilk** üyesinin (bölgenin ilk oluştuğu yer). `confirmedIndex/confirmedAt` = `minTouches`'ı tamamlayan swing'in onayı (katalogun `known_at` tanımıyla birebir).

## `Detection` birleşimine neden dahil değil
Destek **ve** direnç olarak çalışabilir — tek bir yön/geçersizleşme fiyatı yok (FVG/order block gibi "BULLISH altı kırılırsa başarısız" mantığı burada anlamsız).

## Varsayımlar (bilinçli basitleştirmeler)
- Her swing, en yakın TEK kümeye katılır — örtüşen kümeleri birleştirme (merge) yapılmıyor.
- Bir küme ilk `minTouches`'a eriştiğinde dondurulur (`emitted`); sonraki üyeler kümeye eklenir ama yeni kayıt üretmez, mevcut kaydın `top/bottom/touches` alanları da güncellenmez.
- Kümenin referans fiyatı, üyelerin **ortalaması** (ilk üyenin fiyatında sabitlenmiyor) — zaman içinde hafifçe kayabilir.

## Bilinen başarısızlık durumları
- `lookbackBars` küçükse uzun süre önce oluşmuş gerçek bir seviye "soğumuş" sayılıp yeni dokunuşları kaçırabilir.
- Çok sık swing üreten küçük `left`/`right` parametreleriyle kümeler hızla şişebilir.

## Kanıt
Kesme değişmezliği: kesilmiş veriden hesaplanan bölgeler = tam veriden hesaplanıp `confirmedIndex < k` olanlarla birebir aynı.
