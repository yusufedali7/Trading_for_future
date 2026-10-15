# Harmonik formasyonları grafiğe çizmek — Tasarım

Tarih: 2026-10-15
Durum: Onaylandı (sohbette, bölüm bölüm).

## Bağlam ve motivasyon

D58'de 9/9 harmonik formasyon (Gartley, Kelebek, Yarasa, Alternatif Yarasa, Yengeç, Derin Yengeç, Cypher, Köpekbalığı, AB=CD) motorda `IMPLEMENTED` oldu. D82'de bu 9 formasyon Kavramlar sayfasına bağlandı (gerçek veriden örnekler, motorun tam tanımı), ama grafikte **görsel olarak çizilmiyor** — Kavramlar'daki "Grafikte göster" düğmesi yalnızca zaman atlıyor, bir katman açmıyor.

D82 sırasında daha genel bir boşluk da ortaya çıktı: M9'un **hiçbir** desen ailesi (61 mum formasyonu, 21 grafik formasyonu, 9 harmonik) grafikte çizili değil; yalnızca SMC (8 kavram) ve M4'ün temel adayları (swing/FVG/BOS/süpürme/önceki periyot) `ChartView`'da katman olarak var. Grafik ve mum formasyonları yalnızca strateji motoruna bağlı (D64/D67), görsel değil.

Kullanıcıyla konuşulup iş üçe bölündü (her biri farklı görsel şekil istiyor): bu spec yalnızca **harmoniklerin çizimini** kapsıyor — veri zaten hazır (D82) ve görsel ihtiyacı en basit (etiketli pivot yolu). Grafik formasyonları (pivot+kırılım+hedef çizgisi) ve mum formasyonları (tek-mum vurgusu) kapsam dışı, ayrı kararlar.

## Amaç (goals)

- Harmonik formasyon adayları (9 tür) grafikte, her biri kendi aç/kapat katmanıyla, pivot noktalarını (X-A-B-C-D, Shark'ta 0-X-A-B-C) birbirine bağlayan bir yol olarak çizilir.
- Kavramlar sayfasındaki "Grafikte göster" düğmesi artık ilgili harmonik katmanını da açar (bugün yalnızca zaman atlıyor).
- Replay'de lookahead yok: bir harmonik aday yalnızca kendi onay anından (D'nin, Shark'ta C'nin swing'i onaylandığında) sonra görünür — bu zaten D82'nin `harmonicsAsOf`'u ile sağlanıyor, bu iş yalnızca gösterimi ekliyor.

## Kapsam dışı (bilerek)

- Grafik formasyonları (21) ve mum formasyonları (61) çizimi — ayrı bir karar.
- Harmonikleri stratejiye bağlamak (`EventStep`) — D noktasında anlık sinyal, geçersizleşme fiyatı yok; SMC'nin 4 EventStep'inden farklı bir şekil, ayrı bir tasarım gerektirir.
- "Beklendiği gibi gitmedi" ölçümü (`OutcomeConcept`) — bir geçersizleşme fiyatı tanımı gerektirir, ayrı karar.
- Pivot bacaklarındaki oran değerlerinin grafikte gösterilmesi (yalnızca nokta etiketleri: X/A/B/C/D) — kullanıcı onayladı, daha kalabalık bir alternatif reddedildi.
- Her formasyon için tek bir bütün katman yerine 9 ayrı katman — kullanıcı onayladı (SMC'nin "bir kavram = bir katman" kuralıyla tutarlı).

## Mimari genel bakış

Yeni bir çizim primitive'i (canvas sınıfı) **gerekmiyor**. Mevcut `FeaturesPrimitive` (`apps/web/src/chart/primitives/features.ts`) zaten `layoutFeatures()` (M4) ve `layoutSmc()` (SMC) çıktısını birleştirip tek bir canvas'a çiziyor. Üçüncü bir `layoutHarmonics()` fonksiyonu aynı desende eklenir ve aynı primitive'e beslenir — `FeatureItem` birleşimine yeni bir `PATH` varyantı eklenerek.

```
HarmonicPattern[] (candle-source.ts, D82'de hazır)
        │
        ▼
layoutHarmonics(harmonics, layers, times, tfMs)  →  FeatureItem[] (shape: 'PATH')
        │
        ▼  (layoutFeatures() + layoutSmc() çıktısıyla birleşir)
FeaturesPrimitive.setData(items, barCount)
        │
        ▼
draw() — yeni 'PATH' dalı: ardışık noktaları çizgiyle birleştir, her noktaya etiket yaz
```

## Bileşen 1: Yeni çizim şekli `PATH`

`apps/web/src/chart/primitives/feature-layout.ts`'teki `FeatureItem` birleşimine:

```ts
| {
    shape: 'PATH';
    layer: FeatureLayer | 'SETUP';
    points: { p: number; price: number; label: string }[];
    tone: Tone;
    dashed: boolean;
  }
```

`visibleItems()`'a bir dal: `shape === 'PATH'` ise yolun en küçük/en büyük bar pozisyonu (`Math.min/max(...points.map(pt => pt.p))`) görünür aralıkla (`from`/`to`) kesişiyor mu diye bakılır (BOX/LINE'ın `p1`/`p2` kontrolüyle aynı mantık, çok noktalı hali).

`apps/web/src/chart/primitives/features.ts`'in `draw()`'una yeni bir `else if (it.shape === 'PATH')` dalı: `points` dizisini sırayla `moveTo`/`lineTo` ile birleştirir (mevcut LINE dalının `ctx.strokeStyle`/`setLineDash`/`stroke()` kurallarıyla aynı renk/kalınlık), her noktanın yanına (varsa `showText`) `label`'ını yazar (mevcut MARK dalının etiket yerleşimine benzer, nokta fiyatının hemen üstüne/altına, yöne göre).

## Bileşen 2: `layoutHarmonics()`

`feature-layout.ts`'e, `layoutSmc()`'e benzer ama daha sade bir imza (diğerlerinin aksine çeviri fonksiyonu gerekmiyor — pivot etiketleri `HarmonicPatternPivot.label`'dan doğrudan geliyor, sabit harfler: X/A/B/C/D, Shark'ta 0/X/A/B/C):

```ts
export function layoutHarmonics(
  hs: readonly HarmonicPattern[],
  layers: ReadonlySet<FeatureLayer>,
  times: ArrayLike<number>,
  tfMs: number,
): FeatureItem[]
```

Her `HarmonicPattern`, `patternId`'sine karşılık gelen katman açıksa (`GARTLEY`/`BUTTERFLY`/.../`AB_CD`) bir `PATH` öğesine çevrilir: `points` = `h.pivots.map(pv => ({ p: bar(pv.at), price: pv.price, label: pv.label }))`, `tone` = `h.direction === 'BULLISH' ? 'UP' : 'DOWN'`, `dashed: false`.

## Bileşen 3: Katmanlar ve Kavramlar bağlantısı

- `chart/primitives/feature-layout.ts`'teki `FEATURE_LAYERS`'a 9 yeni giriş: `GARTLEY, BUTTERFLY, BAT, ALT_BAT, CRAB, DEEP_CRAB, CYPHER, SHARK, AB_CD` (D82'nin `ConceptId`leriyle aynı isimler — kasıtlı, iki taraf arasında çeviri gerekmiyor).
- `i18n/tr.ts`'in `features.layers`/`features.layerHints`'ine 9 giriş (buton etiketi + ipucu metni, Kavramlar kartlarındaki `short` alanlarına yakın).
- `content/concepts.ts`'teki 9 harmonik `Concept` girdisine `layer:` alanı eklenir (bugün yok). Bu, `ConceptsPage.tsx`'in zaten var olan `onShow({ at, layer })` mekanizmasını (D59'dan beri çalışıyor) otomatik olarak devreye sokar — `ConceptsPage.tsx`'te ek kod gerekmiyor.
- `ChartView.tsx`: `layoutHarmonics()` çağrısı, `layoutFeatures`/`layoutSmc` çağrılarının yanına (`props.harmonics ?? []`). `ChartViewProps`'a `harmonics?: HarmonicPattern[]`. `App.tsx`: `data.harmonics`'i `ChartView`'a geçirir (D82'den beri `data` zaten bu alanı taşıyor, tek satırlık prop ekleme).

## Hata yönetimi

Yeni başarısızlık modu yok: veri zaten D82'den beri var ve doğrulanmış (lookahead'siz, testli). Çizim tarafı yalnızca mevcut `toX`/`toY` null kontrollerini (BOX/LINE dallarındaki gibi) her nokta için tekrarlıyor — bir nokta ekranda değilse o segment atlanır, tüm yol değil (kısmi görünürlük, mevcut davranışla tutarlı).

## Test gereklilikleri

- `layoutHarmonics()`: katman kapalıyken boş dönüyor mu; açıkken doğru `PATH` öğesi üretiyor mu (pozisyon/fiyat/etiket eşlemesi); yalnızca ilgili `patternId`'nin katmanı açıkken o formasyon çiziliyor mu (9'u birbirinden bağımsız).
- `visibleItems()`'ın yeni `PATH` dalı: yarı görünür / tamamen görünmez / tamamen görünür yol senaryoları.
- Gömülü tarayıcıda canlı kontrol: Kavramlar'da bir harmonik örneğine "Grafikte göster" tıklanınca ilgili katman açılıyor ve yol+etiketler doğru render ediyor mu; konsol hatasız mı.

## CLAUDE.md kurallarıyla eşleme

- Kural 3 (lookahead yasak): zaten D82'de `harmonicsAsOf`/`composeReplay` ile sağlanmış; bu iş yalnızca zaten-doğru veriyi çiziyor.
- Kural 2 (aday dili): mevcut tüm katmanlar gibi "aday" çerçevesinde, kesinlik ifadesi yok; Kavramlar'daki `limits` metinleri zaten bunu söylüyor.
- Mimari ilke (tek motor, iki tüketici): motor hiç değişmiyor, yalnızca web tarafının gösterim katmanı.

## Açık riskler

1. **Çakışan oran kümeleri:** Gartley gibi bazı formasyonlar aynı geometride iki farklı kaynaktan (`ratioSetSource`) iki ayrı aday üretebilir (D82'de doğrulandı, `harmonic-registry.test.ts`). İkisi de çizilir — aynı ya da çok yakın D noktalarıyla üst üste binen iki yol görünebilir. Görsel gürültü potansiyeli var ama yanlış değil (her ikisi de geçerli bir aday); ilk sürümde dedupe edilmiyor, gerekirse sonraki bir dilimde ele alınır.
2. **Toolbar kalabalığı:** 14 katman 23'e çıkıyor. "Katmanlar (n)" paneli zaten aç/kapat edilebilir olduğu için kabul edilebilir bulundu (kullanıcı onayladı), ama çok büyürse (grafik + mum formasyonları da eklenince) ayrı bir gruplama/arama ihtiyacı doğabilir — o zaman ele alınır.
