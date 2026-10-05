// Education content (CLAUDE.md: its own data area). Mirrors docs/definitions/*-v1.md; when a
// definition changes there, change it here too.
import type { OutcomeConcept } from '@trw/engine';
import type { FeatureLayer } from '../chart/primitives/feature-layout';

export type ConceptId =
  'SWING' | 'FVG' | 'STRUCTURE_BREAK' | 'LIQUIDITY_SWEEP' | 'PERIOD_LEVELS' | 'SESSIONS';

export interface Concept {
  id: ConceptId;
  name: string;
  /** One line for the list. */
  short: string;
  /** Plain explanation for a beginner. */
  what: string[];
  /** How the candidate looks on this app's chart. */
  onChart: string;
  /** The exact, testable rule the engine uses. */
  rule: string[];
  params: { name: string; value: string; meaning: string }[];
  /** When the candidate becomes known (confirmation delay). */
  delay: string;
  /** What traders commonly expect, and our measured "did not go as expected" yardstick. */
  expectation?: string;
  failure?: (n: number) => string;
  limits: string[];
  /** Chart layer that draws it and engine outcome kind, when there is one. */
  layer?: FeatureLayer;
  outcome?: OutcomeConcept;
  doc: string;
}

export const CONCEPTS: readonly Concept[] = [
  {
    id: 'SWING',
    name: 'Swing (tepe / dip)',
    short: 'Komşularından yüksek bir tepe ya da alçak bir dip.',
    what: [
      'Fiyat düz gitmez; yükselir, döner, düşer. Dönüş noktalarına swing denir: tepe (swing high) ve dip (swing low).',
      'Birçok yöntem bu noktaları referans alır: yapı kırılımı tepelerin ve diplerin aşılmasıyla, likidite de onların hemen ötesindeki stop emirleriyle anlatılır.',
    ],
    onChart:
      'Grafikte mumun üstünde ▼ (aday tepe) ya da altında ▲ (aday dip) işareti. "Katmanlar → Swing" ile açılır.',
    rule: [
      'Tepe: mumun en yükseği, solundaki 3 mumun en yükseklerinden kesin büyük, sağındaki 3 mumunkinden büyük ya da eşit.',
      'Dip: aynı kural en düşüklerle.',
      'Yalnızca kapanmış mumlar ve grafiğin kendi zaman dilimi kullanılır.',
    ],
    params: [
      { name: 'left', value: '3', meaning: 'Soldaki karşılaştırma mumu' },
      { name: 'right', value: '3', meaning: 'Sağdaki karşılaştırma mumu; onay gecikmesi de budur' },
    ],
    delay:
      'Sağındaki 3 mum kapanınca bilinir. İşaret tepe mumuna konur ama ancak 3 mum sonra görünür; o ana kadar "bu bir tepeydi" denemez.',
    expectation: 'Tepe direnç, dip destek gibi davranır diye beklenir.',
    failure: (n) =>
      `Onaydan sonraki ${n} mum içinde bir mum tepenin üstünde (dipte: altında) kapanırsa "beklendiği gibi gitmedi" sayılır.`,
    limits: [
      'Yatay, sıkışık piyasada çok sayıda küçük swing çıkar; hepsi önemli değildir.',
      'Veri boşluğu, iki yanındaki mumları komşu gibi gösterir.',
      'Sağdaki mum sayısı büyürse tespit daha geç ama daha seçici olur; küçülürse erken ama gürültülü.',
    ],
    layer: 'SWING',
    outcome: 'SWING',
    doc: 'docs/definitions/swing-v1.md',
  },
  {
    id: 'FVG',
    name: 'FVG (fair value gap)',
    short: 'Üç mumluk hızlı harekette kalan fiyat boşluğu.',
    what: [
      'Fiyat bir yöne çok hızlı gidince, birinci mumun fitili ile üçüncü mumun fitili arasında hiç işlem görmemiş bir aralık kalır. Buna FVG (dengesizlik, boşluk) denir.',
      'ICT/SMC anlatımlarında fiyatın bu boşluğa geri dönüp tepki verdiği söylenir. Bu bir varsayımdır; burada ölçebilirsin.',
    ],
    onChart:
      'Grafikte renkli kutu: yükseliş boşluğu ve düşüş boşluğu. Boşluk tamamen doldurulunca kutu biter. "Katmanlar → FVG" ile açılır.',
    rule: [
      'Yükseliş: üçüncü mumun en düşüğü, birinci mumun en yükseğinin üstünde. Boşluk = birinci mumun tepesi ile üçüncü mumun dibi arası.',
      'Düşüş: üçüncü mumun en yükseği, birinci mumun en düşüğünün altında.',
      'Boşluk en az 1 pip olmalı.',
    ],
    params: [{ name: 'minSizePips', value: '1', meaning: 'En küçük boşluk (pip)' }],
    delay: 'Üçüncü mum kapanınca bilinir.',
    expectation: 'Yükseliş boşluğu destek, düşüş boşluğu direnç gibi davranır diye beklenir.',
    failure: (n) =>
      `Onaydan sonraki ${n} mum içinde bir mum boşluğun uzak kenarının gerisinde kapanırsa (boşluk tamamen geçildi) "beklendiği gibi gitmedi" sayılır.`,
    limits: [
      'Hafta sonu ya da veri boşluğundan sonraki açılış boşlukları tanıma uyabilir ama gerçek FVG değildir.',
      '1 dakikalık grafikte çok fazla FVG çıkar.',
      'Haber anlarındaki tek mumluk ani hareketler büyük boşluklar üretir; davranışları farklı olabilir.',
    ],
    layer: 'FVG',
    outcome: 'FVG',
    doc: 'docs/definitions/fvg-v1.md',
  },
  {
    id: 'STRUCTURE_BREAK',
    name: 'Yapı kırılımı (BOS / CHoCH)',
    short: 'Son onaylı tepenin ya da dibin kapanışla aşılması.',
    what: [
      'Yükselen piyasa daha yüksek tepeler yapar. Son tepenin üstüne çıkılması "yapı kırıldı, yükseliş sürüyor" diye okunur: BOS (break of structure).',
      'Önceki kırılım ters yöndeyse buna CHoCH (change of character, karakter değişimi) denir; bazı kaynaklar MSS der. Yön değişiminin ilk işareti olarak anlatılır.',
    ],
    onChart:
      'Grafikte kırılan seviyede kısa çizgi ve "BOS ↑" / "CHoCH ↓" etiketi. "Katmanlar → Kırılım" ile açılır.',
    rule: [
      'Referans: en son onaylanmış swing tepe (ya da dip).',
      'Yükseliş kırılımı: bir mumun kapanışı referans tepenin üstüne çıkarsa. Düşüş: dibin altına.',
      'Önceki kırılım aynı yöndeyse ya da ilk kırılımsa BOS, ters yöndeyse CHoCH.',
    ],
    params: [
      { name: 'breakBy', value: 'CLOSE', meaning: 'Kapanışla kırılım (fitil sayılmaz)' },
      { name: 'swing', value: '3 / 3', meaning: 'Referans swing tanımı' },
    ],
    delay: 'Kırılım mumunun kapanışında bilinir. Swing de onaylanmış olmalıdır.',
    expectation: 'Kırılım yönünde devam beklenir.',
    failure: (n) =>
      `Onaydan sonraki ${n} mum içinde bir mum kırılan seviyenin tekrar gerisinde kapanırsa (sahte kırılım) "beklendiği gibi gitmedi" sayılır.`,
    limits: [
      'Yatay piyasada art arda BOS ve CHoCH üretir.',
      'Swing gecikmesi yüzünden hızlı hareketlerde kırılım, swing onaylanmadan olmuş olabilir; o zaman sayılmaz.',
      "Yalnızca en son swing izlenir; daha eski kırılmamış seviyeler v1'de yok.",
    ],
    layer: 'STRUCTURE',
    outcome: 'STRUCTURE_BREAK',
    doc: 'docs/definitions/structure-break-v1.md',
  },
  {
    id: 'LIQUIDITY_SWEEP',
    name: 'Likidite süpürmesi (sweep)',
    short: 'Bir seviyenin fitille aşılıp aynı mumda geri içeri kapanması.',
    what: [
      'Tepelerin üstünde ve diplerin altında bekleyen stop emirleri olduğu varsayılır; bunlara likidite denir.',
      'Fiyat bir seviyenin ötesine fitil atıp aynı mumda geri dönerse "likidite alındı, süpürüldü" denir. ICT anlatımlarında dönüşün habercisi olarak kullanılır.',
    ],
    onChart:
      'Grafikte süpürme mumunda işaret ve "Süpürme PDL" gibi bir etiket. "Katmanlar → Süpürme" ile açılır.',
    rule: [
      "Seviyeler: onaylı swing tepe/dipleri, önceki gün/hafta high-low, biten seansların high-low'u (senin eklediğin seanslar dahil).",
      'Seviyeyi ilk aşan mum, aynı mumda seviyenin içinde kapanırsa süpürmedir. Kapanış ötedeyse kırılımdır.',
      'Tepe süpürmesi düşüş yönlü, dip süpürmesi yükseliş yönlü sayılır.',
    ],
    params: [
      {
        name: 'swingMaxAgeBars',
        value: '100',
        meaning: 'Swing seviyelerinin geçerlilik süresi (mum)',
      },
    ],
    delay: 'Süpürme mumunun kapanışında bilinir; kapanış görülmeden "geri döndü" denemez.',
    expectation: 'Süpürmeden sonra ters yöne dönüş beklenir.',
    failure: (n) =>
      `Onaydan sonraki ${n} mum içinde bir mum süpürme fitilinin ucunun gerisinde kapanırsa (dönüş olmadı) "beklendiği gibi gitmedi" sayılır.`,
    limits: [
      'Seviyeye bir tick değmek bile aşma sayılır; broker grafiğinde spread yüzünden farklı görünebilir.',
      "Kapanışla kırılıp sonraki mumda geri dönen hareket v1'de süpürme sayılmaz.",
      'Büyük zaman dilimlerinde mumun içinde ne olduğu görünmez.',
    ],
    layer: 'SWEEP',
    outcome: 'LIQUIDITY_SWEEP',
    doc: 'docs/definitions/liquidity-sweep-v1.md',
  },
  {
    id: 'PERIOD_LEVELS',
    name: 'Önceki gün / hafta seviyeleri',
    short: 'Dünün ve geçen haftanın en yüksek ve en düşük fiyatı.',
    what: [
      'PDH / PDL: önceki işlem gününün en yüksek ve en düşük fiyatı. PWH / PWL: önceki haftanınki.',
      'Birçok trader bu seviyeleri hedef ya da likidite seviyesi olarak izler.',
    ],
    onChart: 'Grafikte kesik yatay çizgiler. "Katmanlar → Önceki gün / Önceki hafta" ile açılır.',
    rule: [
      "İşlem günü 17:00 New York'tan ertesi gün 17:00 New York'a kadardır; hafta Pazar 17:00 NY'den başlar.",
      'Değerler 1 dakikalık veriden hesaplanır; grafiğin zaman diliminden bağımsızdır.',
    ],
    params: [],
    delay: 'Gün ya da hafta bitince bilinir; bir sonraki gün/hafta boyunca geçerlidir.',
    limits: [
      'Tatil takvimi yok; tatil günü normal gün sayılır.',
      'Broker günü farklı saatte kapatıyorsa (ör. 00:00 UTC) onun grafiğindeki PDH/PDL farklı çıkar.',
      'Bu seviyeler için "beklendiği gibi gitmedi" ölçüsü v1\'de yok.',
    ],
    layer: 'PREV_DAY',
    doc: 'docs/definitions/period-levels-v1.md',
  },
  {
    id: 'SESSIONS',
    name: 'Seanslar ve ICT Asya aralığı',
    short: "Günün belirli saat aralıkları ve bu aralıkların high/low'u.",
    what: [
      'Forex 24 saat açıktır ama hareket gün içinde değişir. Asya, Londra ve New York seansları en çok konuşulan aralıklardır.',
      'ICT anlatımında "Asya aralığı" 20:00–00:00 New York saatidir; bu aralığın tepesi ve dibi Londra açılışında süpürülecek likidite olarak izlenir.',
    ],
    onChart:
      'Grafikte seans kutuları ve high/low çizgileri. "Seanslar" menüsünden açılır; kendi seansını "Seanslar…" ile ekleyebilirsin.',
    rule: [
      'Seans yerel saatle tanımlanır (ör. Londra 08:00–17:00 Europe/London); yaz saati otomatik uygulanır.',
      'High/low 1 dakikalık veriden hesaplanır.',
    ],
    params: [],
    delay:
      'Seans bitene kadar high/low "devam ediyor" olarak gösterilir; strateji ve backtest seviyeyi ancak seans bittikten sonra kullanabilir.',
    limits: [
      'Yerleşik seans saatleri yaygın kullanımdır, resmi tanım değildir.',
      'Tatil takvimi yok; seans içinde eksik veri varsa high/low eksik mumlardan hesaplanır.',
      'Bu seviyeler için "beklendiği gibi gitmedi" ölçüsü v1\'de yok.',
    ],
    doc: 'docs/definitions/session-v1.md',
  },
];
