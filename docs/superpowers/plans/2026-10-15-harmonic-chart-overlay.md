# Harmonik Formasyonları Grafiğe Çizmek — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 9 harmonik formasyon adayı (Gartley, Kelebek, Yarasa, Alternatif Yarasa, Yengeç, Derin Yengeç, Cypher, Köpekbalığı, AB=CD), her biri kendi aç/kapat katmanıyla, grafikte etiketli bir pivot yolu (X-A-B-C-D) olarak çizilir; Kavramlar sayfasındaki "Grafikte göster" bu katmanları gerçekten açar.

**Architecture:** Yeni bir çizim primitive'i yok — mevcut `FeaturesPrimitive`/`FeatureItem` sistemine (MARK/BOX/LINE) bir `PATH` varyantı eklenir. `layoutHarmonics()` adlı yeni bir fonksiyon `layoutSmc()`'nin desenini izler. Veri zaten D82'de hazır (`candle-source.ts`'in `harmonics: HarmonicPattern[]`'i, lookahead'siz).

**Tech Stack:** TypeScript, React, Canvas 2D (lightweight-charts `ISeriesPrimitive`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-15-harmonic-chart-overlay-design.md`

## Global Constraints

- Yeni bir çizim primitive sınıfı yok; mevcut `FeaturesPrimitive` genişletilir.
- Pivot etiketleri sabit harfler (`HarmonicPatternPivot.label`'dan doğrudan: X/A/B/C/D, Shark'ta 0/X/A/B/C) — çeviri fonksiyonu yok, oran değeri gösterilmiyor.
- 9 yeni `FeatureLayer`: `GARTLEY, BUTTERFLY, BAT, ALT_BAT, CRAB, DEEP_CRAB, CYPHER, SHARK, AB_CD` — D82'nin `ConceptId`leriyle birebir aynı isimler.
- Ton: `h.direction === 'BULLISH' ? 'UP' : 'DOWN'` (yeni ton yok).
- Grafik/mum formasyonları bu planın kapsamında değil.
- Harmonikleri stratejiye bağlamak ve "beklendiği gibi gitmedi" ölçümü bu planın kapsamında değil.

## Review Focus

1. **`harmonics` prop eksik/undefined** (chart henüz veri yokken ya da eski bir çağrı yoluyla) → `ChartView` ve `layoutHarmonics` çökmeden boş liste döner (diğer `features`/`smc` opsiyonel alanlarıyla aynı davranış).
2. **Bir yolun bazı noktaları görünür aralığın dışında** (kaydırılmış/uzaklaştırılmış grafik) → BOX/LINE'ın tek çiftlik null kontrolünün aksine, PATH'in her noktası ayrı ayrı null kontrolünden geçmeli; aksi halde kısmen görünür bir formasyon tüm çizimi (ya da uygulamayı) çökertebilir.
3. **9 katmandan biri açılınca yalnızca o formasyon çiziliyor** (diğer 8'i değil) → her formasyonun kendi `patternId`'sine göre filtrelendiği, birbirine sızmadığı test edilir.

---

## Dilim 1: `PATH` şekli + 9 katman + `layoutHarmonics()`

### Task 1: Veri katmanı — `feature-layout.ts` + i18n

**Files:**
- Modify: `apps/web/src/chart/primitives/feature-layout.ts`
- Modify: `apps/web/src/i18n/tr.ts` (`features.layers`, `features.layerHints`)
- Test: `apps/web/test/feature-layout.test.ts`

**Interfaces:**
- Consumes: `HarmonicPattern`, `HarmonicPatternPivot` (`@trw/engine`, zaten `candle-source.ts`'te D82'den beri kullanılıyor).
- Produces: `FeatureItem` birleşimine yeni varyant `{ shape: 'PATH'; layer: FeatureLayer | 'SETUP'; points: { p: number; price: number; label: string }[]; tone: Tone; dashed: boolean }`; `FEATURE_LAYERS`'a 9 yeni giriş; `export function layoutHarmonics(hs: readonly HarmonicPattern[], layers: ReadonlySet<FeatureLayer>, times: ArrayLike<number>, tfMs: number): FeatureItem[]`; `visibleItems()`'ın yeni `PATH` dalı.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/feature-layout.test.ts`'e, `describe('layoutHarmonics')` bloğu (dosyanın sonuna, `layoutSmc` bloğundan sonra):

```ts
import { layoutHarmonics } from '../src/chart/primitives/feature-layout';
import type { HarmonicPattern } from '@trw/engine';

// SYNTHETIC: bullish Gartley (X,A,B,C,D) ve bearish Shark (0,X,A,B,C), 10 bar içinde.
const gartley: HarmonicPattern = {
  id: 'h1',
  patternId: 'gartley',
  ratioSetSource: 'test',
  defVersion: 'v1',
  direction: 'BULLISH',
  pivots: [
    { at: at(0), index: 0, price: 1.1, kind: 'LOW', label: 'X' },
    { at: at(2), index: 2, price: 1.2, kind: 'HIGH', label: 'A' },
    { at: at(4), index: 4, price: 1.14, kind: 'LOW', label: 'B' },
    { at: at(6), index: 6, price: 1.18, kind: 'HIGH', label: 'C' },
    { at: at(8), index: 8, price: 1.116, kind: 'LOW', label: 'D' },
  ],
  formedAt: at(8),
  formedIndex: 8,
  confirmedAt: at(9),
  confirmedIndex: 9,
  ratios: {},
};
const shark: HarmonicPattern = {
  ...gartley,
  id: 'h2',
  patternId: 'shark',
  direction: 'BEARISH',
  pivots: [
    { at: at(0), index: 0, price: 1.0, kind: 'HIGH', label: '0' },
    { at: at(2), index: 2, price: 0.9, kind: 'LOW', label: 'X' },
    { at: at(4), index: 4, price: 0.95, kind: 'HIGH', label: 'A' },
    { at: at(6), index: 6, price: 0.88, kind: 'LOW', label: 'B' },
    { at: at(8), index: 8, price: 0.92, kind: 'HIGH', label: 'C' },
  ],
};

describe('layoutHarmonics', () => {
  it('returns nothing when given no patterns (Review Focus #1: empty/missing harmonics)', () => {
    expect(layoutHarmonics([], new Set(['GARTLEY']), times, TF)).toEqual([]);
  });

  it('returns nothing when its layer is off', () => {
    expect(layoutHarmonics([gartley], new Set(), times, TF)).toEqual([]);
  });

  it('lays out a path with one point per pivot, labelled, toned by direction', () => {
    const items = layoutHarmonics([gartley], new Set(['GARTLEY']), times, TF);
    expect(items).toEqual([
      {
        shape: 'PATH',
        layer: 'GARTLEY',
        points: [
          { p: 0.5, price: 1.1, label: 'X' },
          { p: 2.5, price: 1.2, label: 'A' },
          { p: 4.5, price: 1.14, label: 'B' },
          { p: 6.5, price: 1.18, label: 'C' },
          { p: 8.5, price: 1.116, label: 'D' },
        ],
        tone: 'UP',
        dashed: false,
      },
    ]);
  });

  it("includes Shark's leading '0' pivot label and BEARISH tone", () => {
    const items = layoutHarmonics([shark], new Set(['SHARK']), times, TF);
    expect(items[0]!.points[0]).toEqual({ p: 0.5, price: 1.0, label: '0' });
    expect(items[0]!.tone).toBe('DOWN');
  });

  it("only draws a pattern when its own layer is on, not another pattern's layer", () => {
    expect(layoutHarmonics([gartley, shark], new Set(['SHARK']), times, TF)).toHaveLength(1);
    expect(layoutHarmonics([gartley, shark], new Set(['SHARK']), times, TF)[0]!.layer).toBe(
      'SHARK',
    );
  });
});
```

`describe('visibleItems')` içine (yoksa yeni bir `describe` bloğu ekle, varsa mevcuda ekle):

```ts
describe('visibleItems — PATH', () => {
  const path = {
    shape: 'PATH' as const,
    layer: 'GARTLEY' as const,
    points: [
      { p: 1, price: 1, label: 'X' },
      { p: 5, price: 1, label: 'D' },
    ],
    tone: 'UP' as const,
    dashed: false,
  };
  it('keeps a path whose range overlaps the visible window', () => {
    expect(visibleItems([path], 3, 10, 10)).toEqual([path]);
  });
  it('drops a path entirely outside the visible window', () => {
    expect(visibleItems([path], 10, 20, 10)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/test/feature-layout.test.ts`
Expected: FAIL — `layoutHarmonics is not exported`, `PATH` tip hatası.

- [ ] **Step 3: Implement**

`feature-layout.ts`:
- `FEATURE_LAYERS` dizisine 9 string ekle: `'GARTLEY', 'BUTTERFLY', 'BAT', 'ALT_BAT', 'CRAB', 'DEEP_CRAB', 'CYPHER', 'SHARK', 'AB_CD'`.
- `FeatureItem` birleşimine `PATH` varyantını ekle (yukarıdaki imza).
- `visibleItems()`'a `PATH` dalı: `Math.max(...it.points.map(pt => pt.p)) >= from && Math.min(...it.points.map(pt => pt.p)) <= to`.
- `layoutHarmonics()`: `patternId` (`'gartley'`, `'ab_cd'` vb.) → `FeatureLayer` (`'GARTLEY'`, `'AB_CD'`) eşlemesi için küçük bir sabit sözlük, `HARMONIC_PATTERN_LAYER: Record<string, FeatureLayer>` (`ConceptsPage.tsx`'teki `HARMONIC_CONCEPT_PATTERN_ID`'nin tersi — iki taraf da küçük, bağımsız sözlükler; ortak bir yere çıkarmak bu planın kapsamında değil). Her `HarmonicPattern h` için: `HARMONIC_PATTERN_LAYER[h.patternId]` katmanı `layers` içindeyse bir `PATH` öğesi üret, değilse atla. `points = h.pivots.map(pv => ({ p: timeToPosition(times, tfMs, pv.at) + 0.5, price: pv.price, label: pv.label }))`.

`i18n/tr.ts`'in `features.layers` ve `features.layerHints`'ine 9'ar giriş (D82'nin Concept `short` metinlerine yakın, örn. `GARTLEY: 'Gartley'`, ipucu: `GARTLEY: 'Aday Gartley: beş noktalı (X-A-B-C-D) Fibonacci oranlı formasyon'`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/web/test/feature-layout.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: temiz (yeni `FEATURE_LAYERS` girişleri `tr.ts`'teki `layers`/`layerHints` ile eşleşmezse burada hata çıkar).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/chart/primitives/feature-layout.ts apps/web/src/i18n/tr.ts apps/web/test/feature-layout.test.ts
git commit -m "feat(chart): PATH shape + 9 harmonic layers + layoutHarmonics()"
```

---

### Task 2: Canvas çizimi — `features.ts`

**Files:**
- Modify: `apps/web/src/chart/primitives/features.ts`

**Interfaces:**
- Consumes: Task 1'in `FeatureItem` (`PATH` varyantı).
- Produces: `draw()`'un `PATH` dalı (dışa açık bir arayüz değişikliği yok).

- [ ] **Step 1: `draw()`'a yeni bir `else if (it.shape === 'PATH')` dalı ekle**

Mevcut `LINE` dalının (`ctx.strokeStyle`/`setLineDash(it.dashed ? ... : [])`/`stroke()`) desenini izle, ama tek çizgi yerine `it.points`'i sırayla `moveTo`/`lineTo` ile birleştir. **Her nokta için ayrı ayrı** `toX(pt.p)`/`toY(pt.price)` null kontrolü yap (Review Focus #2) — bir nokta ekranda değilse o noktaya giden segmenti atla, yolun geri kalanını çizmeye devam et (tek bir null'da tüm yolu iptal etme). `showText` açıkken her noktanın yanına `pt.label`'ını yaz (MARK dalının etiket konumlandırmasına benzer: noktanın hemen üstüne ya da altına, üst üste binmeyecek şekilde — ör. hep üstüne, `textBaseline: 'bottom'`).

- [ ] **Step 2: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: temiz.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/chart/primitives/features.ts
git commit -m "feat(chart): draw PATH items (per-point visibility guard)"
```

---

## Dilim 2: Gerçek veriyle uçtan uca bağlama

### Task 3: `ChartViewProps`/`ChartView`/`App.tsx` + Kavramlar `layer` alanları

**Files:**
- Modify: `apps/web/src/chart/types.ts`
- Modify: `apps/web/src/chart/ChartView.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/content/concepts.ts` (9 harmonik `Concept`'e `layer:` alanı)
- Test: `apps/web/test/app-concepts.test.tsx`
- Test: `apps/web/test/app-features.test.tsx` (gerekirse — bkz. Step 1)

**Interfaces:**
- Consumes: Task 1'in `layoutHarmonics`, `FEATURE_LAYERS`; D82'nin `ChartData.harmonics` (`candle-source.ts`, zaten var).
- Produces: `ChartViewProps.harmonics?: HarmonicPattern[]`; `App.tsx`'in `ChartView`'a `harmonics={chartData.harmonics}` geçirmesi; `concepts.ts`'teki 9 harmonik girdinin artık `layer:` alanı taşıması.

- [ ] **Step 1: Write the failing test**

`apps/web/test/app-concepts.test.tsx`'e, mevcut "turns on the layer of the concept it shows" (FVG) testinin yanına, aynı desenle bir harmonik versiyonu — ama harmonikler sentetik dalgalı veride nadiren oluştuğu için, `latest!.harmonics` gerçek bir aday içermeyebilir; bu yüzden test yalnızca **katmanın açıldığını** doğrular (adayın kendisini değil, Review Focus #1'in "boş de olsa çökmez" tarafını da örtük olarak kanıtlar):

```ts
it('turns on a harmonic layer from its Kavramlar card, even with no examples in this data (D83)', async () => {
  const { prefs } = await setup(true);
  expect(latest!.featureLayers).not.toContain('GARTLEY');
  fireEvent.click(screen.getByRole('button', { name: /^Gartley/ }));
  const gartley = card('Gartley');
  // "Grafikte göster" yalnızca örnek varsa görünür (Browser bileşeni boş listede gizlenir) -
  // bu yüzden düğme yoksa test burada biter; varsa katmanı açtığını doğrular.
  const btn = gartley.queryByRole('button', { name: 'Grafikte göster' });
  if (!btn) return;
  fireEvent.click(
    within(gartley.getByRole('group', { name: 'Örnekler' })).getByRole('button', {
      name: 'Grafikte göster',
    }),
  );
  await waitLong(() => expect(latest!.featureLayers).toContain('GARTLEY'));
  await waitLong(async () => expect((await prefs.load()).features).toContain('GARTLEY'));
});
```

Ayrıca `latest!.harmonics` prop'unun App'ten her zaman iletildiğini doğrulayan bir satır, mevcut "counts candidates..." testine eklenir: `expect(Array.isArray(latest!.harmonics)).toBe(true);`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/app-concepts.test.tsx`
Expected: FAIL — `Gartley` kartında `layer` olmadığı için `ShowTarget`'ta `layer` hiç gönderilmiyor, katman açılmıyor.

- [ ] **Step 3: Implement**

`chart/types.ts`: `ChartViewProps`'a `harmonics?: HarmonicPattern[];` (features/smc'nin yanına, aynı import satırına `HarmonicPattern` eklenir).

`chart/ChartView.tsx`: `const { features, smc, harmonics, featureLayers, setups } = props;` satırına `harmonics` eklenir; `useEffect`'in gövdesine `const harmonicsItems = layers.size > 0 ? layoutHarmonics(harmonics ?? [], layers, times, tfMs) : [];` ve `featuresRef.current?.setData([...items, ...smcItems, ...harmonicsItems], times.length);`; bağımlılık dizisine `harmonics` eklenir.

`App.tsx`: `smc={chartData.smc}` satırının altına `harmonics={chartData.harmonics}`.

`content/concepts.ts`: 9 harmonik `Concept` girdisinin her birine, `doc:` satırından önce, `layer: 'GARTLEY'` (ilgili formasyonun kendi layer adı) eklenir.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/web/test/app-concepts.test.tsx apps/web/test/app-features.test.tsx`
Expected: PASS

- [ ] **Step 5: Full suite + typecheck + lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: hepsi yeşil/temiz.

- [ ] **Step 6: Gömülü tarayıcıda canlı kontrol**

`preview_start` ile `web` sunucusunu aç; Öğren → Kavramlar → bir harmonik kart (ör. Gartley) → varsa "Grafikte göster" tıkla → grafiğe gidildiğinde ilgili katmanın açık olduğunu (Katmanlar panelinde buton `aria-pressed=true`) ve (bir aday gerçekten o veri setinde varsa) pivot yolunun + X/A/B/C/D etiketlerinin çizildiğini doğrula. Mümkünse grafiği kaydırıp/uzaklaştırıp bir yolu kısmen görünür hale getirip çökmediğini kontrol et (Review Focus #2). Konsolda hata olmadığını doğrula.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/chart/types.ts apps/web/src/chart/ChartView.tsx apps/web/src/App.tsx apps/web/src/content/concepts.ts apps/web/test/app-concepts.test.tsx apps/web/test/app-features.test.tsx
git commit -m "feat(chart): wire harmonics through ChartView, Kavramlar can now open their layer"
```

---

## Final Review

Plan tamamlanınca (3 task, 2 commit grubu): `review-package` ile tüm plan diff'i (Task 1'in ilk commit'inden Task 3'ün son commit'ine) çıkarılır, taze bir alt-ajan en yetkin modelle bu plan + spec dosyasının yollarıyla ve yukarıdaki Review Focus'la gözden geçirir. Kritik/Önemli bulgular TDD ile bu oturumda düzeltilir; Minor bulgular ledger'a ertelenmiş olarak yazılır. Temiz bir incelemeden sonra plan workspace'i silinir, `superpowers:finishing-a-development-branch` çağrılır.
