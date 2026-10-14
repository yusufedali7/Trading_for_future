# Tanım: CISD (Change in State of Delivery, teslimat yönünde değişim) — v1

Kod: `packages/engine/src/features/cisd.ts` · Test: `packages/engine/test/cisd.test.ts`
Katalog: `catalog/patterns/smc.json` → `cisd` (durum: `IMPLEMENTED`, oracle doğrulaması yok — ICT/SMC'nin tek resmi tanımı yok).
Kaynak: [MrOwl1011/Smc_ZOB_CISD](https://github.com/MrOwl1011/Smc_ZOB_CISD) (MIT) `DESIGN.md`'sindeki CISD aşamalarının sadeleştirilmiş hali (bkz. `docs/arastirma/entegrasyon-bulgulari-2026-10-14.md`). **Bir EA'nın yorumu; bağımsız ikinci bir kaynakla doğrulanmadı.** Kod alınmadı, yalnızca kavram; parametreler kullanıcıyla seçildi (D77).

## Tanım
- Ardışık **düşüş kapanışları** (`close < open`) bir seri oluşturur. Doji (`close = open`) seriyi bitirir ama seriye dahil değildir.
- Seri `1..maxSeries` mumsa, ilk mumunun **açılışı** yükseliş seviyesi olur. Daha uzun seriler trend sayılır, seviye üretmez (bekleyen bir yükseliş seviyesini de iptal eder).
- Sonraki **düşüş kapanışı olmayan** ilk mum bu seviyenin **kesinlikle üzerinde** kapanırsa: yükseliş yönlü CISD (BULLISH).
- Arada yeni bir düşüş kapanışı gelirse bekleyen seviye iptal olur; o yeni seri bitince yeni seviye onun ilk açılışıdır.
- Düşüş yönlü CISD aynasıdır: yükseliş kapanışları (`close > open`) serisi, ilk açılışın **kesinlikle altında** kapanış.

| Parametre | Varsayılan | Anlam |
|---|---|---|
| `maxSeries` | 5 | Sayılan en uzun ters yönlü seri (mum) |

Kullanıcı seçimleri (D77): likidite süpürmesi şartı **yok** (istenirse strateji adımı olarak eklenir); seviye = serinin **ilk mumunun açılışı** (serinin en yüksek/en düşüğü değil); seri **1–5** mum.

## Onay gecikmesi
`formedIndex = confirmedIndex =` onaylayan mum; `confirmedAt =` o mumun kapanışı. Seri ve seviye yalnızca geçmiş mumlardan gelir; sonraki mumlar bir tespiti değiştiremez.

## `Detection` birleşimine neden (henüz) dahil değil
v1 bir geçersizleşme fiyatı tanımlamıyor; bu yüzden "beklendiği gibi gitmedi" ölçümü (`features/outcomes.ts`) ve strateji adımı yok. Aday adayı bir seviye (`level`) ve serinin başlangıcı (`seriesStartIndex/At`, `seriesLength`) taşır.

## Varsayımlar
- Kaynak EA'daki 4. aşama (seviyeye geri çekilme = giriş) motorda yok; bu bir giriş kuralıdır ve strateji oluşturucunun işidir.
- Kaynak EA'daki çoklu zaman dilimi eşlemesi (OB üst TF'de, CISD alt TF'de) yok; CISD seçili zaman diliminde hesaplanır.
- Sabit pip ya da ATR eşiği yok: kapanışın seviyeyi 0,1 pip geçmesi de sayılır.

## Bilinen başarısızlık durumları
- Kısa zaman dilimlerinde ve yatay piyasada çok sık, gürültülü aday üretir (tek mumluk seriler de sayılır).
- Boşluklu (gap) açılışlarda seviye, piyasanın gerçekten "teslim ettiği" fiyatı yansıtmayabilir.

## Kanıt
Kesme değişmezliği: kesilmiş veriden hesaplanan CISD'ler = tam veriden hesaplanıp `confirmedIndex < k` olanlarla birebir aynı (test: 400 mumluk sabit tohumlu rastgele yürüyüş, her 13 mumda bir).

## Gerçek veride sıklık (D77)
Kullanıcının Dukascopy EURUSD BID 1m dosyası (2026-10-01 00:00–09:41 UTC, 582 mum — küçük, tek sabahlık bir örnek): 1m'de 135, 5m'de 27, 15m'de 11 aday. Bu örnekte kabaca **her 4 mumdan birinde** bir aday — tek başına seçici bir olay değil. Bir minimum mesafe/gövde eşiği eklenmesi ayrı bir karar (v2).

