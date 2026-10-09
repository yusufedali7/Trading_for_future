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
  | 'CANDIDATE_SR';

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
];
