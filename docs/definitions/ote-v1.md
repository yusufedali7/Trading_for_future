# Tanım: Optimal Trade Entry (OTE) — v1

Kod: `packages/engine/src/features/ote.ts` · Test: `packages/engine/test/ote.test.ts`
Katalog: `catalog/patterns/smc.json` → `ote` (durum: `IMPLEMENTED`, oracle doğrulaması yok).

## Tanım
Onaylı swing'ler `formedIndex`'e göre sıralanır; **ardışık, türü değişen** her çift bir "impuls bacağı" sayılır:
- **Dip → Tepe:** yükseliş impulsü. Bölge, tepeden aşağı bir geri çekilme: `top = tepe − lo×menzil`, `bottom = tepe − hi×menzil` (menzil = |tepe−dip|).
- **Tepe → Dip:** düşüş impulsü, simetrik (dipten yukarı).

| Parametre | Varsayılan | Anlam |
|---|---|---|
| `zone` | `[0.62, 0.79]` | Geri çekilme oranı aralığı |
| `sweetSpot` | `0.705` | Aralığın içindeki referans oran |

## Onay gecikmesi
`formedAt/Index`/`confirmedAt/Index` = bacağı tamamlayan (ikinci) swing'inki — ikisi de aynı `right` parametresiyle onaylandığı için her zaman daha büyüktür.

## `Detection` birleşimine dahil
Net bir yön ve geçersizleşme fiyatı var (menzil derinleşip bölgenin dışına kapanırsa kurulum geçersiz) — `features/outcomes.ts`'e eklendi (BULLISH → alt sınır altı, BEARISH → üst sınır üstü kapanış).

## Varsayımlar
- Her ardışık ters-yön swing çifti bir impuls sayılır — büyüklüğüne göre süzme yok (küçük sarsıntılar da "impuls" olabilir, bu bilinçli bir basitleştirme).
- Menzil 0 ise (iki swing aynı fiyatta, pratikte olmaz) o çift atlanır.

## Bilinen başarısızlık durumları
- Çok oynak/gürültülü verilerde her küçük zikzak bir OTE bölgesi üretir; "önemli" bir impuls ile "gürültü" ayrımı yapılmıyor.

## Kanıt
Kesme değişmezliği: kesilmiş veriden hesaplanan bölgeler = tam veriden hesaplanıp `confirmedIndex < k` olanlarla birebir aynı.
