// Education content (CLAUDE.md: its own data area). Mirrors docs/definitions/*-v1.md; when a
// definition changes there, change it here too.
import type { OutcomeConcept } from '@trw/engine';
import type { FeatureLayer } from '../chart/primitives/feature-layout';

export type ConceptId =
  | 'SWING'
  | 'FVG'
  | 'STRUCTURE_BREAK'
  | 'LIQUIDITY_SWEEP'
  | 'PERIOD_LEVELS'
  | 'SESSIONS'
  | 'DISPLACEMENT'
  | 'ORDER_BLOCK'
  | 'IFVG'
  | 'BREAKER'
  | 'EQUAL_LEVELS'
  | 'PREMIUM_DISCOUNT'
  | 'OTE'
  | 'CANDIDATE_SR'
  | 'CISD'
  | 'GARTLEY'
  | 'BUTTERFLY'
  | 'BAT'
  | 'ALT_BAT'
  | 'CRAB'
  | 'DEEP_CRAB'
  | 'CYPHER'
  | 'SHARK'
  | 'AB_CD';

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
    id: 'DISPLACEMENT',
    name: 'Displacement (güçlü hareket)',
    short: 'Önceki ortalamadan belirgin büyük gövdeli tek mum.',
    what: [
      'Fiyat bazen tek bir mumda, önceki mumlara göre çok daha büyük bir gövdeyle hareket eder. Buna "displacement" (yer değiştirme) denir — ICT/SMC anlatımlarında güçlü kurumsal ilginin işareti olarak okunur.',
      'Bu motor bunu yalnızca geometrik bir ölçüm olarak ele alır: mumun gövdesi, kendinden önceki mumların ortalama "true range"inden belirgin büyük mü?',
    ],
    onChart:
      "Ayrı bir görsel katmanı yok (tek mum sınıflandırması, bir bölge değil) — order block'un oluşması için arka planda kullanılır.",
    rule: [
      "Mum i'nin gövdesi (|kapanış−açılış|), kendinden ÖNCEKİ 14 mumun ortalama true range'inin 1,5 katından büyükse displacement.",
      'Ortalama, mumun kendisini hiç içermez.',
      'Yön: kapanış ≥ açılış ise yükseliş, değilse düşüş.',
    ],
    params: [
      { name: 'minBodyAtr', value: '1.5', meaning: 'Gövde / ortalama TR eşik çarpanı' },
      { name: 'atrPeriod', value: '14', meaning: 'Ortalamanın alındığı geriye dönük mum sayısı' },
    ],
    delay: 'Anında — yalnızca kendisinden önceki veriyi kullanır, mumun kendi kapanışında bilinir.',
    limits: [
      'Haber anındaki tek mumluk sıçramalar da displacement sayılır; piyasa mikro-yapısından değil, yalnızca geometriden ayırt edilemez.',
      'İlk 14 mum (ortalama oluşmadan) hiç sonuç üretmez.',
      'Bu kavram için "beklendiği gibi gitmedi" ölçüsü yok — doğal bir geçersizleşme fiyatı taşımıyor (tek mum sınıflandırması, bir seviye/bölge adayı değil).',
    ],
    doc: 'docs/definitions/displacement-v1.md',
  },
  {
    id: 'ORDER_BLOCK',
    name: 'Order block',
    short: 'Bir yapı kırılımını yaratan güçlü mumdan önceki son ters renkli mum.',
    what: [
      'ICT/SMC anlatımında, büyük oyuncuların emirlerini biriktirdiği varsayılan son karşıt-yönlü mum "order block" olarak işaretlenir — fiyat oraya geri dönünce tepki vermesi beklenir.',
      'Bu motorda order block, bir yapı kırılımı (BOS/CHoCH) + o kırılımı yaratan mumun aynı zamanda bir "displacement" olması şartına bağlı.',
    ],
    onChart:
      'Grafikte renkli kutu (destek/talep ya da direnç/arz bölgesi). "Katmanlar → Order block" ile açılır.',
    rule: [
      'Bir yapı kırılımının kırılım mumu aynı yönde bir displacement ise devam edilir.',
      "Kırılım mumundan geriye, en fazla 10 mum içinde, kırılımın TERSİ renkte ilk mum aranır — bulunursa o mum order block'un kaynağıdır.",
      'Bölge, o mumun gövdesi (varsayılan) ya da tam yüksek-düşük aralığı olabilir.',
    ],
    params: [
      { name: 'zone', value: 'BODY', meaning: 'Bölge gövde mi tam aralık mı' },
      { name: 'lookbackBars', value: '10', meaning: 'Referans muma kaç mum geriye kadar bakılır' },
    ],
    delay:
      'Kırılım/displacement mumunun kapanışında bilinir (bölge daha önce oluşmuştu, ama bu ana kadar "order block" olduğu bilinemez).',
    expectation: "Order block'a geri dönüşte tepki (destek/direnç gibi davranması) beklenir.",
    failure: (n) =>
      `Onaydan sonraki ${n} mum içinde bir mum bölgenin uzak kenarının gerisinde kapanırsa "beklendiği gibi gitmedi" sayılır.`,
    limits: [
      'Yalnızca BOS/CHoCH + eşlik eden displacement kullanılıyor; ayrı bir "gerçek MSS" tipi henüz yok.',
      'lookbackBars içinde referans mum bulunamazsa o kırılım için order block üretilmez.',
      'Forex verisinde gerçek hacim olmadığı için hacim tabanlı güç ölçütü kullanılmıyor.',
    ],
    layer: 'ORDER_BLOCK',
    outcome: 'ORDER_BLOCK',
    doc: 'docs/definitions/order-block-v1.md',
  },
  {
    id: 'IFVG',
    name: 'Ters FVG (Inversion FVG)',
    short: "Kapanışla tamamen geçersizleşen bir FVG'nin artık ters yönde izlenmesi.",
    what: [
      'Bir FVG (fiyat boşluğu), fiyatın bir mumun kapanışıyla boşluğun uzak kenarını tamamen geçmesiyle geçersizleşebilir.',
      'ICT/SMC anlatımında bu geçersiz boşluk silinmez — artık TERS yönde bir aday olarak izlenir: "inversion FVG".',
    ],
    onChart:
      'Grafikte renkli kutu, kaynak FVG\'nin tersi yönde. "Katmanlar → Ters FVG" ile açılır.',
    rule: [
      'Her FVG için, onayından sonraki mumlar taranır.',
      'Bir mumun KAPANIŞI boşluğun uzak kenarını tamamen geçerse FVG geçersizleşir ve aynı bölge artık ters yönde bir aday olur.',
      'Yalnızca ilk geçersizleşen mum sayılır; fitille dokunma sayılmaz.',
    ],
    params: [],
    delay: 'Geçersizleştiren mumun kapanışında bilinir.',
    expectation: "Ters FVG'ye geri dönüşte yeni yönde tepki beklenir.",
    failure: (n) =>
      `Onaydan sonraki ${n} mum içinde bir mum bölgenin uzak kenarının gerisinde kapanırsa "beklendiği gibi gitmedi" sayılır.`,
    limits: [
      "Bir FVG en fazla bir kez ters FVG'ye dönüşür.",
      "Çok sık FVG üreten gürültülü verilerde sayısı da artar; kaynak FVG'nin minimum boyut filtresiyle süzülmeli.",
    ],
    layer: 'IFVG',
    outcome: 'IFVG',
    doc: 'docs/definitions/ifvg-v1.md',
  },
  {
    id: 'BREAKER',
    name: 'Breaker block',
    short: "Kapanışla tamamen geçersizleşen bir order block'un artık ters yönde izlenmesi.",
    what: [
      'Order block gibi, ama kaynağı bir order block olan, geçersizleşince ters yönde izlenen bir bölge.',
      'Ters FVG ile birebir aynı mekanik — kaynağı order block olması dışında.',
    ],
    onChart: 'Grafikte renkli kutu. "Katmanlar → Breaker" ile açılır.',
    rule: [
      'Her order block için, onayından sonraki mumlar taranır.',
      'Bir mumun KAPANIŞI bölgenin uzak kenarını tamamen geçerse order block geçersizleşir, aynı bölge ters yönde bir aday olur.',
    ],
    params: [],
    delay: 'Geçersizleştiren mumun kapanışında bilinir.',
    expectation: "Breaker'a geri dönüşte yeni yönde tepki beklenir.",
    failure: (n) =>
      `Onaydan sonraki ${n} mum içinde bir mum bölgenin uzak kenarının gerisinde kapanırsa "beklendiği gibi gitmedi" sayılır.`,
    limits: [
      "Bir order block en fazla bir kez breaker'a dönüşür.",
      "Order block'un kendisi az sayıda üretiliyorsa (displacement + kırılım şartı), breaker da az sayıda olur.",
    ],
    layer: 'BREAKER',
    outcome: 'BREAKER',
    doc: 'docs/definitions/breaker-v1.md',
  },
  {
    id: 'EQUAL_LEVELS',
    name: 'Eşit tepeler/dipler (EQH/EQL)',
    short: 'Birbirine çok yakın fiyatlı iki ardışık tepe ya da dip.',
    what: [
      'İki tepe (ya da iki dip) neredeyse aynı seviyedeyse, ICT/SMC anlatımında bunun altında/üstünde bekleyen likiditenin daha güçlü olduğu söylenir (çift seviyeye konmuş stoplar).',
      'Bu, kendi başına alım-satılabilir bir bölge değil — bir gözlem, bir "likidite havuzu" adayı.',
    ],
    onChart:
      'Grafikte iki swing arasında ince bir çizgi/etiket. "Katmanlar → Eşit seviyeler" ile açılır.',
    rule: [
      'Onaylanan her swing, aynı türden (tepe/dip) kendisinden önceki en yakın swing ile karşılaştırılır.',
      "Fiyat farkı, yeni swing'in mumundaki ATR'nin 0,1 katından küçük/eşitse eşleşme sayılır.",
    ],
    params: [
      { name: 'toleranceAtr', value: '0.1', meaning: 'Fiyat farkı toleransı (ATR çarpanı)' },
      { name: 'atrPeriod', value: '14', meaning: "ATR'nin hesaplandığı geriye dönük mum sayısı" },
    ],
    delay: "İkinci (yeni) swing'in onayında bilinir.",
    limits: [
      "Yalnızca ikili karşılaştırma; 3+ swing'i aynı kümeye toplayan bir kümeleme bu kavramda yok (bkz. Aday destek/direnç).",
      'Çok oynak dönemlerde (yüksek ATR) tolerans genişler, alakasız seviyeler "eşit" sayılabilir.',
      'Bu kavram için "beklendiği gibi gitmedi" ölçüsü yok — tek bir yön/geçersizleşme fiyatı taşımıyor.',
    ],
    layer: 'EQUAL_LEVELS',
    doc: 'docs/definitions/equal-levels-v1.md',
  },
  {
    id: 'PREMIUM_DISCOUNT',
    name: 'Premium / Discount',
    short: "Son swing aralığının %50'si: üstü pahalı, altı ucuz bölge.",
    what: [
      'ICT anlatımında bir aralığın (en son tepe-dip arası) üst yarısı "premium" (pahalı, satış için aranan bölge), alt yarısı "discount" (ucuz, alış için aranan bölge) olarak okunur.',
      'Orta nokta "equilibrium" (denge) olarak adlandırılır.',
    ],
    onChart:
      'Grafikte aralığın üst/alt yarısını ayıran kesik çizgi. "Katmanlar → Premium/Discount" ile açılır.',
    rule: [
      'En son onaylanan swing tepe ve dip bir aralık tanımlar.',
      "Bu aralığın %50'si denge; üstü premium, altı discount.",
      'Referans tepe ya da dip değiştikçe yeni bir bölge kaydı eklenir.',
    ],
    params: [],
    delay: "Onu tetikleyen swing'in onay anında bilinir, ek gecikme yok.",
    limits: [
      'Yalnızca bir swing tipi (yalnızca tepe ya da yalnızca dip) onaylanmışken hiç kayıt üretilmez.',
      'Bu kavram için "beklendiği gibi gitmedi" ölçüsü yok — tek bir yön/geçersizleşme fiyatı yok, bir referans çizgisi.',
    ],
    layer: 'PREMIUM_DISCOUNT',
    doc: 'docs/definitions/premium-discount-v1.md',
  },
  {
    id: 'OTE',
    name: 'OTE (Optimal Trade Entry)',
    short: 'Bir fiyat hareketinin %62-%79 geri çekilme bölgesi.',
    what: [
      'ICT anlatımında, bir dip-tepe (ya da tepe-dip) hareketinden sonra fiyatın Fibonacci %62-%79 aralığına geri çekilmesi "en iyi giriş bölgesi" (OTE) olarak okunur.',
      '%70,5 bu aralığın içindeki referans oran ("sweet spot") olarak işaretlenir.',
    ],
    onChart: 'Grafikte renkli bölge + sweet spot çizgisi. "Katmanlar → OTE" ile açılır.',
    rule: [
      'Onaylı swing\'ler sıralanır; ardışık, türü değişen her çift bir "impuls bacağı" sayılır.',
      'Dip→Tepe: yükseliş impulsü, bölge tepeden aşağı %62-%79 geri çekilme. Tepe→Dip: simetrik.',
    ],
    params: [
      { name: 'zone', value: '[0.62, 0.79]', meaning: 'Geri çekilme oranı aralığı' },
      { name: 'sweetSpot', value: '0.705', meaning: 'Aralığın içindeki referans oran' },
    ],
    delay: "Bacağı tamamlayan (ikinci) swing'in onayında bilinir.",
    expectation: 'OTE bölgesinden fiyatın impuls yönünde devam etmesi beklenir.',
    failure: (n) =>
      `Onaydan sonraki ${n} mum içinde bir mum bölgenin dışında (derinleşerek) kapanırsa "beklendiği gibi gitmedi" sayılır.`,
    limits: [
      'Her ardışık ters-yön swing çifti bir impuls sayılır — büyüklüğüne göre süzme yok, küçük sarsıntılar da "impuls" olabilir.',
      'Çok oynak verilerde her küçük zikzak bir OTE bölgesi üretir.',
    ],
    layer: 'OTE',
    outcome: 'OTE',
    doc: 'docs/definitions/ote-v1.md',
  },
  {
    id: 'CANDIDATE_SR',
    name: 'Aday destek/direnç',
    short: '3 ya da daha fazla kez dokunulan bir fiyat kümesi.',
    what: [
      'Birçok swing aynı fiyat bölgesine yakınsa, bu bölge tekrar tekrar "test edilen" bir destek/direnç adayı sayılır.',
      'Diğer SMC kavramlarından farklı olarak hem destek hem direnç olarak çalışabilir — tek bir yöne bağlı değil.',
    ],
    onChart: 'Grafikte yatay bölge + dokunuş sayısı etiketi. "Katmanlar → Aday S/D" ile açılır.',
    rule: [
      'Onaylanan her swing (tepe ve dip), zaman sırasıyla işlenir ve en yakın kümeye katılır (ATR toleransı içinde) ya da yeni bir küme açar.',
      '500 mumdan daha eski kümeler eşleşme için değerlendirilmez ("soğumuş" kabul edilir).',
      'Bir küme 3 dokunuşa ilk eriştiğinde BİR KEZ bir aday bölge kaydı üretilir.',
    ],
    params: [
      {
        name: 'clusterToleranceAtr',
        value: '0.3',
        meaning: 'Kümeye katılma toleransı (ATR çarpanı)',
      },
      { name: 'minTouches', value: '3', meaning: 'Bölge sayılması için gereken pivot sayısı' },
      {
        name: 'lookbackBars',
        value: '500',
        meaning: 'Bir kümenin "soğuduğu" kabul edilen yaş sınırı',
      },
    ],
    delay: "3. dokunuşu tamamlayan swing'in onayında bilinir.",
    limits: [
      'Her swing en yakın TEK kümeye katılır; örtüşen kümeleri birleştirme yok.',
      'Bir küme 3 dokunuşa ilk eriştiğinde dondurulur; sonraki dokunuşlar kaydı güncellemiyor.',
      'Bu kavram için "beklendiği gibi gitmedi" ölçüsü yok — hem destek hem direnç olarak çalışabildiği için tek bir yön/geçersizleşme fiyatı yok.',
    ],
    layer: 'CANDIDATE_SR',
    doc: 'docs/definitions/candidate-sr-v1.md',
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
  {
    id: 'CISD',
    name: 'CISD (teslimat yönünde değişim)',
    short: 'Ters yönlü kısa bir serinin ilk açılışının ötesinde kapanış.',
    what: [
      'Fiyat birkaç mum boyunca bir yönde kapanış yaparken ("teslimat" o yöndeyken), ters yönde gelen bir kapanış bu serinin başladığı seviyeyi geçerse, ICT anlatımlarında bu "teslimat yönünün değişmesi" (Change in State of Delivery) olarak okunur.',
      'Bu motor bunu yalnızca bir seviye ve kapanış ölçümü olarak ele alır: ardışık düşüş kapanışlarından oluşan kısa bir serinin ilk mumunun açılışının üzerinde kapanış = yükseliş yönlü aday (tersi düşüş).',
      "Tanım resmi bir ICT kuralı değil; açık kaynak bir MT5 Expert Advisor'ının (MrOwl1011/Smc_ZOB_CISD) yorumundan sadeleştirildi ve senin seçimlerinle sabitlendi: süpürme şartı yok, seviye = serinin ilk açılışı, seri 1–5 mum.",
    ],
    onChart:
      'Serinin ilk mumundan onay mumuna kadar, seviyede kısa bir çizgi ve "CISD ↑ / ↓" etiketi (CISD katmanı).',
    rule: [
      'Ardışık düşüş kapanışları (kapanış < açılış) bir seri oluşturur; doji (kapanış = açılış) seriyi bitirir ama seriye dahil değildir.',
      'Seri 1–5 mumsa, ilk mumunun açılışı yükseliş seviyesi olur; daha uzun seriler trend sayılır ve seviye üretmez.',
      'Sonraki, düşüş kapanışı olmayan ilk mum bu seviyenin kesinlikle üzerinde kapanırsa: yükseliş yönlü CISD adayı.',
      'Arada yeni bir düşüş kapanışı gelirse bekleyen seviye iptal olur; yeni seri bittiğinde yeni seviye onun ilk açılışıdır.',
      'Düşüş yönlü CISD bunun aynasıdır (yükseliş kapanışları serisi, ilk açılışın altında kapanış).',
    ],
    params: [{ name: 'maxSeries', value: '5', meaning: 'Sayılan en uzun ters yönlü seri (mum)' }],
    delay: 'Onaylayan mumun kapanışında bilinir; sonradan değişmez.',
    limits: [
      'Likidite süpürmesi şartı tanımın içinde yok; istenirse strateji oluşturucuda "önce süpürme, sonra CISD" adımları olarak kurulmalı (CISD henüz bir strateji adımı değil).',
      'Çok kısa zaman dilimlerinde sık ve gürültülü aday üretir; tek mumluk seriler de sayılır.',
      'Bu kavram için henüz "beklendiği gibi gitmedi" ölçüsü yok — v1 bir geçersizleşme fiyatı tanımlamıyor.',
      'Kaynak tek bir EA yorumu; bağımsız ikinci bir kaynakla doğrulanmadı.',
    ],
    layer: 'CISD',
    doc: 'docs/definitions/cisd-v1.md',
  },
  {
    id: 'GARTLEY',
    name: 'Gartley',
    short: 'Beş noktalı (X-A-B-C-D) bir fiyat yapısı, belirli Fibonacci oranlarıyla.',
    what: [
      'Harmonik formasyonlar, fiyatın birbirini izleyen beş dönüş noktası (X, A, B, C, D) arasındaki uzunluk oranlarının belirli Fibonacci değerlerine yakın olmasını arar. Gartley bunların en eski ve en bilinenidir (H. M. Gartley, 1935).',
      'Diğer grafik formasyonlarından farkı: bir kırılım beklenmez. Oranlar D noktasında tamamlanınca formasyonun kendisi "aday tersinme bölgesi" (PRZ) sayılır.',
      'Motor iki farklı kaynaktan alınan oran kümesini ayrı ayrı dener (ikisi de aynı geometriye uyabilir, iki ayrı aday üretir).',
    ],
    onChart:
      'Pivotları birleştiren etiketli bir yol (X-A-B-C-D, Shark\'ta 0-X-A-B-C). "Katmanlar" ile açılır.',
    rule: [
      'Pivotlar sırayla X, A, B, C, D (zigzag: tepe-dip-tepe-dip-tepe ya da aynası).',
      'AB/XA oranı 0,618 ±%5.',
      'BC/AB oranı 0,382–0,886 arası ±%5.',
      'CD/BC oranı 1,13–1,618 (kaynağa göre üst sınır 1,27 ya da 1,618) ±%5.',
      'AD/XA oranı 0,786 ±%5.',
      'Yükseliş yönlü: D bir dip. Düşüş yönlü: D bir tepe (ayna).',
    ],
    params: [
      {
        name: 'pivot_left/right',
        value: '5',
        meaning: 'Grafik formasyonu ailesiyle aynı swing ayarı',
      },
      { name: 'pct_error', value: '0,05', meaning: 'Her oran için izin verilen sapma payı (±%5)' },
    ],
    delay: "D'nin kendi swing'i onaylandığında bilinir (sağda 5 mum kapanınca).",
    limits: [
      'İki kaynaktan alınan oran kümesi de "sourced" (tek kaynaklı, ikinci bir kaynakla çapraz kontrol edilmedi) — bağımsız doğrulanmış değil.',
      'Henüz bir strateji adımı değil (D noktasında anlık sinyal, geçersizleşme fiyatı yok).',
      'Bu kavram için henüz "beklendiği gibi gitmedi" ölçüsü yok — v1 bir geçersizleşme fiyatı tanımlamıyor.',
      'Katı 5 mumluk swing ayarı kısa zaman dilimlerinde az, uzun zaman dilimlerinde (1 dakika gibi) gürültülü aday üretebilir.',
    ],
    layer: 'GARTLEY',
    doc: 'catalog/patterns/harmonic.json',
  },
  {
    id: 'BUTTERFLY',
    name: 'Kelebek (Butterfly)',
    short: "Gartley'e benzer ama D, X'in ötesine uzanır (1,27 katı).",
    what: [
      "Kelebek de beş noktalı bir harmonik formasyondur; Gartley'den farkı D'nin X'in ötesine taşmasıdır (AD/XA oranı 1'in üzerinde).",
      "Bu sürümde CD/BC oranı için bir sınır yok — formasyon yalnızca AB/XA ve AD/XA ile belirleniyor (katalogdaki iki kaynak da CD_BC'yi boş bırakıyor).",
    ],
    onChart:
      'Pivotları birleştiren etiketli bir yol (X-A-B-C-D, Shark\'ta 0-X-A-B-C). "Katmanlar" ile açılır.',
    rule: [
      'Pivotlar sırayla X, A, B, C, D.',
      'AB/XA oranı 0,786 ±%5.',
      'BC/AB oranı 0,382–0,886 arası ±%5.',
      "AD/XA oranı 1,27–1,41 (kaynağa göre üst sınır 1,27 ya da 1,41) ±%5; D, X'in ötesine taşar.",
      'Yükseliş yönlü: D bir dip. Düşüş yönlü: D bir tepe (ayna).',
    ],
    params: [
      {
        name: 'pivot_left/right',
        value: '5',
        meaning: 'Grafik formasyonu ailesiyle aynı swing ayarı',
      },
      { name: 'pct_error', value: '0,05', meaning: 'Her oran için izin verilen sapma payı (±%5)' },
    ],
    delay: "D'nin kendi swing'i onaylandığında bilinir (sağda 5 mum kapanınca).",
    limits: [
      'İki kaynaktan alınan oran kümesi de "partial" (CD/BC oranı hiç kontrol edilmiyor) — Gartley\'den daha gevşek bir tanım.',
      'Henüz bir strateji adımı değil (D noktasında anlık sinyal, geçersizleşme fiyatı yok).',
      'Bu kavram için henüz "beklendiği gibi gitmedi" ölçüsü yok.',
    ],
    layer: 'BUTTERFLY',
    doc: 'catalog/patterns/harmonic.json',
  },
  {
    id: 'BAT',
    name: 'Yarasa (Bat)',
    short: "D, X'in oldukça yakınında (0,886 katı) tamamlanan bir harmonik formasyon.",
    what: [
      'Yarasa formasyonunda B, XA hareketinin yalnızca sığ bir kısmını (0,382-0,5) geri çeker ve D, X\'e yakın (0,886 katı) tamamlanır — Gartley/Kelebek\'ten daha "sıkı" bir geometri.',
      "Oranları Scott Carney'nin yaygın harmonik literatüründen alınıyor; D58'de dört bağımsız kaynakla (LuxAlgo, HarmonicTrader.com, HowToTrade, TradingSim) çapraz kontrol edildi, hepsi eşleşti.",
    ],
    onChart:
      'Pivotları birleştiren etiketli bir yol (X-A-B-C-D, Shark\'ta 0-X-A-B-C). "Katmanlar" ile açılır.',
    rule: [
      'Pivotlar sırayla X, A, B, C, D.',
      'AB/XA oranı 0,382–0,5 arası ±%5.',
      'BC/AB oranı 0,382–0,886 arası ±%5.',
      'CD/BC oranı 1,618–2,618 arası ±%5.',
      "AD/XA oranı 0,886 ±%5 (D, X'e yakın).",
      'Yükseliş yönlü: D bir dip. Düşüş yönlü: D bir tepe (ayna).',
    ],
    params: [
      {
        name: 'pivot_left/right',
        value: '5',
        meaning: 'Grafik formasyonu ailesiyle aynı swing ayarı',
      },
      { name: 'pct_error', value: '0,05', meaning: 'Her oran için izin verilen sapma payı (±%5)' },
    ],
    delay: "D'nin kendi swing'i onaylandığında bilinir (sağda 5 mum kapanınca).",
    limits: [
      'Henüz bir strateji adımı değil (D noktasında anlık sinyal, geçersizleşme fiyatı yok).',
      'Bu kavram için henüz "beklendiği gibi gitmedi" ölçüsü yok.',
    ],
    layer: 'BAT',
    doc: 'catalog/patterns/harmonic.json',
  },
  {
    id: 'ALT_BAT',
    name: 'Alternatif Yarasa (Alt Bat)',
    short: "Yarasa'nın bir çeşidi: B daha sığ (0,382), D daha uzak (1,13 katı).",
    what: [
      "Alternatif Yarasa, Yarasa'nın bir çeşididir: B sabit 0,382'de, ve D X'in biraz ötesinde (1,13 katı) tamamlanır — Kelebek kadar uzak değil, Yarasa kadar yakın da değil.",
      "Oranları D58'de dört bağımsız kaynakla çapraz kontrol edildi, hepsi eşleşti.",
    ],
    onChart:
      'Pivotları birleştiren etiketli bir yol (X-A-B-C-D, Shark\'ta 0-X-A-B-C). "Katmanlar" ile açılır.',
    rule: [
      'Pivotlar sırayla X, A, B, C, D.',
      'AB/XA oranı 0,382 ±%5 (sabit).',
      'BC/AB oranı 0,382–0,886 arası ±%5.',
      'CD/BC oranı 2,0–3,618 arası ±%5.',
      "AD/XA oranı 1,13 ±%5 (D, X'in biraz ötesinde).",
      'Yükseliş yönlü: D bir dip. Düşüş yönlü: D bir tepe (ayna).',
    ],
    params: [
      {
        name: 'pivot_left/right',
        value: '5',
        meaning: 'Grafik formasyonu ailesiyle aynı swing ayarı',
      },
      { name: 'pct_error', value: '0,05', meaning: 'Her oran için izin verilen sapma payı (±%5)' },
    ],
    delay: "D'nin kendi swing'i onaylandığında bilinir (sağda 5 mum kapanınca).",
    limits: [
      'Henüz bir strateji adımı değil (D noktasında anlık sinyal, geçersizleşme fiyatı yok).',
      'Bu kavram için henüz "beklendiği gibi gitmedi" ölçüsü yok.',
    ],
    layer: 'ALT_BAT',
    doc: 'catalog/patterns/harmonic.json',
  },
  {
    id: 'CRAB',
    name: 'Yengeç (Crab)',
    short: 'D, X\'in epey ötesinde (1,618 katı) tamamlanan, "aşırı uzamış" bir harmonik formasyon.',
    what: [
      "Yengeç, bu ailenin en \"uzamış\" üyesidir: D, X'in 1,618 katı ötesinde tamamlanır. Derin Yengeç'in (DEEP_CRAB) farkı B'nin daha derin geri çekilmesidir.",
      'CD/BC oranının alt sınırı kaynaklar arasında ayrışıyor (bazı kaynaklar 2,24, bazıları 2,618 der); katalog 2,24 değerini koruyor, bu çözülmeden not edildi.',
    ],
    onChart:
      'Pivotları birleştiren etiketli bir yol (X-A-B-C-D, Shark\'ta 0-X-A-B-C). "Katmanlar" ile açılır.',
    rule: [
      'Pivotlar sırayla X, A, B, C, D.',
      'AB/XA oranı 0,382–0,618 arası ±%5.',
      'BC/AB oranı 0,382–0,886 arası ±%5.',
      'CD/BC oranı 2,24–3,618 arası ±%5.',
      "AD/XA oranı 1,618 ±%5 (D, X'in epey ötesinde).",
      'Yükseliş yönlü: D bir dip. Düşüş yönlü: D bir tepe (ayna).',
    ],
    params: [
      {
        name: 'pivot_left/right',
        value: '5',
        meaning: 'Grafik formasyonu ailesiyle aynı swing ayarı',
      },
      { name: 'pct_error', value: '0,05', meaning: 'Her oran için izin verilen sapma payı (±%5)' },
    ],
    delay: "D'nin kendi swing'i onaylandığında bilinir (sağda 5 mum kapanınca).",
    limits: [
      'CD/BC oranının alt sınırı (2,24) kaynaklar arasında tartışmalı; bazı kaynaklar 2,618 der. Çözülmedi, katalogdaki değer kullanılıyor.',
      'Henüz bir strateji adımı değil (D noktasında anlık sinyal, geçersizleşme fiyatı yok).',
      'Bu kavram için henüz "beklendiği gibi gitmedi" ölçüsü yok.',
    ],
    layer: 'CRAB',
    doc: 'catalog/patterns/harmonic.json',
  },
  {
    id: 'DEEP_CRAB',
    name: 'Derin Yengeç (Deep Crab)',
    short: "Yengeç'in bir çeşidi: B daha derin (0,886) geri çekiliyor.",
    what: [
      "Derin Yengeç, Yengeç'in bir çeşididir: B, XA hareketinin neredeyse tamamını (0,886) geri çeker; D yine X'in 1,618 katı ötesinde tamamlanır.",
      "Oranları D58'de dört bağımsız kaynakla çapraz kontrol edildi, hepsi eşleşti.",
    ],
    onChart:
      'Pivotları birleştiren etiketli bir yol (X-A-B-C-D, Shark\'ta 0-X-A-B-C). "Katmanlar" ile açılır.',
    rule: [
      'Pivotlar sırayla X, A, B, C, D.',
      'AB/XA oranı 0,886 ±%5 (sabit, derin geri çekilme).',
      'BC/AB oranı 0,382–0,886 arası ±%5.',
      'CD/BC oranı 2,0–3,618 arası ±%5.',
      "AD/XA oranı 1,618 ±%5 (D, X'in epey ötesinde).",
      'Yükseliş yönlü: D bir dip. Düşüş yönlü: D bir tepe (ayna).',
    ],
    params: [
      {
        name: 'pivot_left/right',
        value: '5',
        meaning: 'Grafik formasyonu ailesiyle aynı swing ayarı',
      },
      { name: 'pct_error', value: '0,05', meaning: 'Her oran için izin verilen sapma payı (±%5)' },
    ],
    delay: "D'nin kendi swing'i onaylandığında bilinir (sağda 5 mum kapanınca).",
    limits: [
      'Henüz bir strateji adımı değil (D noktasında anlık sinyal, geçersizleşme fiyatı yok).',
      'Bu kavram için henüz "beklendiği gibi gitmedi" ölçüsü yok.',
    ],
    layer: 'DEEP_CRAB',
    doc: 'catalog/patterns/harmonic.json',
  },
  {
    id: 'CYPHER',
    name: 'Cypher',
    short:
      "Ailenin geri kalanından farklı: oranlar XC bacağına göre tanımlanır, C, A'nın ötesine taşar.",
    what: [
      "Cypher, bu ailenin diğer üyelerinden farklı ölçülür: BC/AB yerine XC/XA ve XD/XC oranları kullanılır; C noktası A'nın ötesine taşar (diğerlerinde taşmaz).",
      "Oranları D58'de dört bağımsız kaynakla çapraz kontrol edildi, hepsi eşleşti.",
    ],
    onChart:
      'Pivotları birleştiren etiketli bir yol (X-A-B-C-D, Shark\'ta 0-X-A-B-C). "Katmanlar" ile açılır.',
    rule: [
      'Pivotlar sırayla X, A, B, C, D.',
      'AB/XA oranı 0,382–0,618 arası ±%5.',
      'XC/XA oranı 1,272–1,414 arası ±%5.',
      'XD/XC oranı 0,786 ±%5.',
      "C, A'nın ötesine geçmelidir (geçmezse aday reddedilir — Cypher'i tanımlayan özellik budur).",
      'Yükseliş yönlü: D bir dip. Düşüş yönlü: D bir tepe (ayna).',
    ],
    params: [
      {
        name: 'pivot_left/right',
        value: '5',
        meaning: 'Grafik formasyonu ailesiyle aynı swing ayarı',
      },
      { name: 'pct_error', value: '0,05', meaning: 'Her oran için izin verilen sapma payı (±%5)' },
    ],
    delay: "D'nin kendi swing'i onaylandığında bilinir (sağda 5 mum kapanınca).",
    limits: [
      'Henüz bir strateji adımı değil (D noktasında anlık sinyal, geçersizleşme fiyatı yok).',
      'Bu kavram için henüz "beklendiği gibi gitmedi" ölçüsü yok.',
    ],
    layer: 'CYPHER',
    doc: 'catalog/patterns/harmonic.json',
  },
  {
    id: 'SHARK',
    name: 'Köpekbalığı (Shark)',
    short: "Beş noktalı ama 0-X-A-B-C etiketli; D yerine C'de tamamlanan, ailenin en yeni üyesi.",
    what: [
      "Köpekbalığı diğer harmonik formasyonlardan iki şekilde farklı: pivotlar 0-X-A-B-C diye etiketlenir (D yok) ve formasyon C noktasında tamamlanır; B, X'in ötesine geçmek zorundadır.",
      "İlk bacağın (XA'nın 0X'e oranı) bu sürümde bir şartı yok: üç bağımsız kaynak (LuxAlgo, HowToTrade, FXOpen/Algorush) ilk bacağa hiç oran şartı koymuyor; tek kaynaklı bir dördüncü oran (0,5–0,886) bu yüzden bilerek uygulanmadı (D78).",
    ],
    onChart:
      'Pivotları birleştiren etiketli bir yol (X-A-B-C-D, Shark\'ta 0-X-A-B-C). "Katmanlar" ile açılır.',
    rule: [
      'Pivotlar sırayla 0, X, A, B, C (D yok).',
      'AB/XA oranı 1,13–1,618 arası ±%5.',
      'BC/AB oranı 1,618–2,24 arası ±%5.',
      "XC/0X oranı 0,886–1,13 arası ±%5 (C'nin kendisi için).",
      "B, X'in ötesine geçmelidir (geçmezse aday reddedilir).",
      'Yükseliş yönlü: C bir dip. Düşüş yönlü: C bir tepe (ayna).',
    ],
    params: [
      {
        name: 'pivot_left/right',
        value: '5',
        meaning: 'Grafik formasyonu ailesiyle aynı swing ayarı',
      },
      { name: 'pct_error', value: '0,05', meaning: 'Her oran için izin verilen sapma payı (±%5)' },
    ],
    delay: "C'nin kendi swing'i onaylandığında bilinir (sağda 5 mum kapanınca).",
    limits: [
      'İlk bacak için oran şartı yok (üç kaynak koymuyor); tek kaynaklı bir dördüncü oran bilerek atlandı (Kural 8).',
      'Henüz bir strateji adımı değil (D noktasında anlık sinyal, geçersizleşme fiyatı yok).',
      'Bu kavram için henüz "beklendiği gibi gitmedi" ölçüsü yok.',
    ],
    layer: 'SHARK',
    doc: 'catalog/patterns/harmonic.json',
  },
  {
    id: 'AB_CD',
    name: 'AB=CD',
    short: "Dört noktalı en sade harmonik formasyon: CD uzunluğu yaklaşık AB'ye eşit.",
    what: [
      'AB=CD, ailenin en basit üyesidir: yalnızca dört nokta (A, B, C, D), X yok. Adını CD bacağının uzunluğunun AB bacağına yaklaşık eşit olmasından alır.',
      "Oranları D58'de dört bağımsız kaynakla çapraz kontrol edildi, hepsi eşleşti.",
    ],
    onChart:
      'Pivotları birleştiren etiketli bir yol (X-A-B-C-D, Shark\'ta 0-X-A-B-C). "Katmanlar" ile açılır.',
    rule: [
      'Pivotlar sırayla A, B, C, D.',
      'BC/AB oranı 0,382–0,886 arası ±%5.',
      'CD/BC oranı 1,13–2,618 arası ±%5.',
      "CD/AB oranı 1,0 ±%5 (CD, AB'ye yaklaşık eşit uzunlukta).",
      'Yükseliş yönlü: D bir dip. Düşüş yönlü: D bir tepe (ayna).',
    ],
    params: [
      {
        name: 'pivot_left/right',
        value: '5',
        meaning: 'Grafik formasyonu ailesiyle aynı swing ayarı',
      },
      { name: 'pct_error', value: '0,05', meaning: 'Her oran için izin verilen sapma payı (±%5)' },
    ],
    delay: "D'nin kendi swing'i onaylandığında bilinir (sağda 5 mum kapanınca).",
    limits: [
      'En az noktalı harmonik formasyon olduğu için diğerlerine göre daha sık aday üretir.',
      'Henüz bir strateji adımı değil (D noktasında anlık sinyal, geçersizleşme fiyatı yok).',
      'Bu kavram için henüz "beklendiği gibi gitmedi" ölçüsü yok.',
    ],
    layer: 'AB_CD',
    doc: 'catalog/patterns/harmonic.json',
  },
];
