/**
 * Education area (D40/D73): the learning path. Static, ordered lessons that tie the glossary
 * (docs/ogrenme/sozluk.md), the concept library and the app's own screens together. A test proves
 * every glossary id, concept and chart layer referenced here exists. No lesson promises an outcome
 * or tells the reader to buy or sell (CLAUDE.md rules 6 and 9).
 */
import type { FeatureLayer } from '../chart/primitives/feature-layout';
import type { ConceptId } from './concepts';

export type LessonView = 'CHART' | 'STRATEGY' | 'RESEARCH' | 'PAPER' | 'JOURNAL' | 'EVENTS';

export type LessonAction =
  | { kind: 'OPEN_GLOSSARY'; term: string }
  | { kind: 'OPEN_CONCEPT'; concept: ConceptId }
  | { kind: 'OPEN_CHART_LAYER'; layer: FeatureLayer }
  | { kind: 'OPEN_VIEW'; view: LessonView }
  | { kind: 'OPEN_EXERCISE' };

export interface Lesson {
  id: string;
  title: string;
  /** One sentence: what you can do after this lesson. */
  goal: string;
  /** Markdown subset (see components/Markdown). */
  body: string;
  terms: readonly string[];
  concepts: readonly ConceptId[];
  actions: readonly LessonAction[];
}

export interface LessonModule {
  id: string;
  title: string;
  lessons: readonly Lesson[];
}

export const LESSON_MODULES: readonly LessonModule[] = [
  {
    id: 'basics',
    title: 'Temeller',
    lessons: [
      {
        id: 'price-pip-spread',
        title: 'Fiyat, pip ve spread',
        goal: 'Bir fiyat hareketini pip ile ölçebilmek ve spread maliyetini görebilmek.',
        body: `Bir parite iki para biriminin birbirine göre fiyatıdır. Hareketler **pip** ile ölçülür: EURUSD'de 1 pip = 0.0001.
Her işlemin gizli bir maliyeti vardır: **spread**, yani alış ile satış fiyatı arasındaki fark. Grafik BID fiyatıyla çizilir; long bir işlem ASK'tan açılır.
- Bir stop mesafesini, hedefi ve maliyeti pip cinsinden düşünmeye alış.
- Spread küçük görünür ama çok işlem yapan bir stratejide toplam sonucu belirgin biçimde değiştirebilir.`,
        terms: ['parite-doviz-cifti', 'pip', 'tick-point', 'bid-ask-ve-spread'],
        concepts: [],
        actions: [
          { kind: 'OPEN_GLOSSARY', term: 'pip' },
          { kind: 'OPEN_GLOSSARY', term: 'bid-ask-ve-spread' },
        ],
      },
      {
        id: 'lot-risk-r',
        title: 'Lot, risk ve R',
        goal: 'Bir işlemin riskini para yerine R cinsinden düşünebilmek.',
        body: `İşlem büyüklüğü **lot** ile ifade edilir; pip değeri lota göre değişir. Bu projede her işlemin riski önce hesap bakiyesinin bir yüzdesi olarak seçilir, lot bu riske göre hesaplanır.
**R**, o işlemde göze alınan risk birimidir: stop'ta kapanan bir işlem −1R, riskin iki katı kazanan bir işlem +2R'dir. Sonuçları R ile ölçmek, farklı stop mesafelerindeki işlemleri karşılaştırılabilir yapar.
- Kaldıraç kazancı da zararı da büyütür; bu uygulama gerçek parayla işlem yapmaz.`,
        terms: ['lot', 'pip-degeri', 'kaldirac-ve-marjin', 'r-risk-birimi', 'lot-ve-risk-yuzdesi'],
        concepts: [],
        actions: [{ kind: 'OPEN_GLOSSARY', term: 'r-risk-birimi' }],
      },
      {
        id: 'candles-timeframes',
        title: 'Mum, zaman dilimi ve günlük kapanış',
        goal: 'Bir mumun neyi gösterdiğini ve ne zaman "bilindiğini" söyleyebilmek.',
        body: `Her mum bir zaman aralığının açılış, en yüksek, en düşük ve kapanış fiyatıdır (OHLC). Uygulama yalnızca 1 dakikalık veriyi saklar; 15m, 1h, 4h gibi diğer dilimler ondan hesaplanır.
Bir mumun değerleri ancak **kapandığında** kesinleşir. Henüz kapanmamış son mum grafikte işaretlidir; motor hiçbir hesabı kapanmamış mumla yapmaz.
Forex'te gün New York saatiyle 17:00'de biter; günlük ve 4 saatlik mumlar buna hizalıdır.`,
        terms: ['mum-ohlc', 'zaman-dilimi-timeframe', 'gunluk-kapanis', 'henuz-kapanmamis-mum'],
        concepts: [],
        actions: [{ kind: 'OPEN_VIEW', view: 'CHART' }],
      },
      {
        id: 'sessions',
        title: 'Seanslar ve saat dilimleri',
        goal: 'Asya, Londra ve New York seanslarını grafikte tanıyabilmek.',
        body: `Forex 24 saat açıktır ama hareket seanslara göre değişir. Seans sınırları yerel saatle tanımlanır; yaz saati geçişleri ABD ve İngiltere'de farklı haftalarda olduğu için UTC karşılıkları kayar.
Grafikteki seans kutuları her seansın en yüksek ve en düşük fiyatını gösterir. Bu seviyeler ancak seans **bittiğinde** kesinleşir.
- Kendi seanslarını (ör. ICT Asya aralığı, kill zone'lar) araç çubuğundaki seans yöneticisinden tanımlayabilirsin.`,
        terms: ['session-seans', 'utc-saat-dilimi-ve-yaz-saati-dst', 'seans-kutusu', 'kill-zone'],
        concepts: ['SESSIONS'],
        actions: [
          { kind: 'OPEN_CONCEPT', concept: 'SESSIONS' },
          { kind: 'OPEN_VIEW', view: 'CHART' },
        ],
      },
    ],
  },
  {
    id: 'structure',
    title: 'Piyasa yapısı',
    lessons: [
      {
        id: 'swings',
        title: 'Swing tepe/dip ve onay gecikmesi',
        goal: 'Bir swing noktasının neden birkaç mum sonra bilindiğini açıklayabilmek.',
        body: `Swing tepe, sağında ve solunda belli sayıda daha düşük tepe olan mumdur (dip için tersi). Sağdaki mumlar oluşmadan bir tepenin swing olduğu **bilinemez**: bu, onay gecikmesidir.
Grafikte motorun bulduğu her swing bir **aday**dır ve oluştuğu mum ile onaylandığı mum ayrı tutulur. Geçmişe bakıp "burası tepeydi" demek kolaydır; asıl soru o anda ne bilindiğidir.
- Lookahead (ileriye bakma) hatası, geleceğin bilgisini geçmiş bir karara sızdırmaktır; backtest'leri olduğundan iyi gösterir.`,
        terms: [
          'swing-tepe-dip',
          'onay-gecikmesi',
          'aday-candidate',
          'lookahead-ileriye-bakma-hatasi',
        ],
        concepts: ['SWING'],
        actions: [
          { kind: 'OPEN_CONCEPT', concept: 'SWING' },
          { kind: 'OPEN_CHART_LAYER', layer: 'SWING' },
          { kind: 'OPEN_EXERCISE' },
        ],
      },
      {
        id: 'bos-choch',
        title: 'Yapı kırılımı: BOS ve CHoCH',
        goal: 'Aynı yönde kırılım (BOS) ile yön değişimini (CHoCH) ayırt edebilmek.',
        body: `Fiyat son swing tepesini yukarı kırarsa bu bir yapı kırılımıdır. Mevcut yönde olursa **BOS**, önceki yönün tersine olursa **CHoCH** denir.
Kırılımın "kapanışla" mı "fitille" mi sayılacağı bir tanım tercihidir; bu projede parametre olarak açıkça seçilir.
- Bir kırılım bir sonraki hareketin garantisi değildir; kavram kütüphanesinde "beklendiği gibi gitmedi" oranını gerçek verinde ölçebilirsin.`,
        terms: ['yapi-kirilimi-bos-ve-choch', 'kirilim-ve-retest'],
        concepts: ['STRUCTURE_BREAK'],
        actions: [
          { kind: 'OPEN_CONCEPT', concept: 'STRUCTURE_BREAK' },
          { kind: 'OPEN_CHART_LAYER', layer: 'STRUCTURE' },
        ],
      },
      {
        id: 'levels',
        title: 'Önceki gün/hafta seviyeleri ve destek-direnç',
        goal: 'Grafikteki referans seviyelerin nereden geldiğini bilmek.',
        body: `Önceki günün ve haftanın en yüksek/en düşük fiyatları (PDH/PDL, PWH/PWL) birçok stratejinin referans aldığı seviyelerdir; dönem bitince kesinleşirler.
Motor ayrıca en az birkaç kez dönülen bölgelerden **aday** destek/direnç türetir. "Kesin destek" diye bir şey yoktur; bir seviye kırılabilir ve kırıldıktan sonra rol değiştirebilir.`,
        terms: ['pdh-pdl-pwh-pwl', 'destek-ve-direnc', 'aday-destek-direnc-candidate-s-r'],
        concepts: ['PERIOD_LEVELS', 'CANDIDATE_SR'],
        actions: [
          { kind: 'OPEN_CHART_LAYER', layer: 'PREV_DAY' },
          { kind: 'OPEN_CONCEPT', concept: 'CANDIDATE_SR' },
        ],
      },
    ],
  },
  {
    id: 'liquidity',
    title: 'Likidite ve boşluklar (SMC)',
    lessons: [
      {
        id: 'sweep',
        title: 'Likidite ve likidite süpürmesi',
        goal: 'Bir seviyenin fitille aşılıp geri dönülmesini tanıyabilmek.',
        body: `Belirgin tepe ve diplerin ötesinde bekleyen emirler "likidite" olarak adlandırılır. Fiyatın bir seviyeyi fitille geçip mumu yeniden içeride kapatmasına **süpürme** denir.
Eşit tepeler/dipler (birbirine çok yakın iki swing) olası likidite havuzu olarak işaretlenir.
- Bunlar ICT/SMC literatürünün kavramlarıdır; resmi tek bir tanımları yoktur. Bu projedeki tanımlar parametreli ve versiyonludur.`,
        terms: ['likidite-ve-likidite-supurmesi-sweep', 'esit-tepeler-dipler-eqh-eql'],
        concepts: ['LIQUIDITY_SWEEP', 'EQUAL_LEVELS'],
        actions: [
          { kind: 'OPEN_CONCEPT', concept: 'LIQUIDITY_SWEEP' },
          { kind: 'OPEN_CHART_LAYER', layer: 'SWEEP' },
        ],
      },
      {
        id: 'fvg',
        title: 'FVG (adil değer boşluğu)',
        goal: 'Üç mumluk bir boşluğu grafikte bulup sınırlarını okuyabilmek.',
        body: `Üç mumda, birinci mumun en yükseği ile üçüncü mumun en düşüğü arasında kalan ve ortadaki güçlü mumun bıraktığı boşluk bir **FVG**'dir (düşüşte tersi).
FVG üçüncü mum kapanınca bilinir. Fiyat boşluğa geri dönüp onu doldurabilir ya da dönmeyebilir; ikisi de sık görülür.
- Kapanışla tamamen geçilen bir FVG, ters yönde bir aday olarak (IFVG) izlenir.`,
        terms: ['fvg-fair-value-gap-adil-deger-boslugu', 'inversion-fvg-breaker-block'],
        concepts: ['FVG', 'IFVG'],
        actions: [
          { kind: 'OPEN_CONCEPT', concept: 'FVG' },
          { kind: 'OPEN_CHART_LAYER', layer: 'FVG' },
          { kind: 'OPEN_EXERCISE' },
        ],
      },
      {
        id: 'order-blocks',
        title: 'Displacement, order block ve breaker',
        goal: 'Güçlü bir hareketten önceki son ters mumun nasıl işaretlendiğini bilmek.',
        body: `**Displacement**, ortalamaya göre belirgin derecede güçlü bir harekettir. Böyle bir hareketten hemen önceki son ters renkli mum aday bir **order block** olarak işaretlenir.
Order block kapanışla geçersizleşirse ters yönde bir **breaker** adayına dönüşür.
- Her aşama ayrı bir tanım ve onay zamanı taşır; grafikte hepsi "aday" diye görünür.`,
        terms: ['displacement-guclu-hareket', 'order-block', 'inversion-fvg-breaker-block'],
        concepts: ['DISPLACEMENT', 'ORDER_BLOCK', 'BREAKER'],
        actions: [
          { kind: 'OPEN_CONCEPT', concept: 'ORDER_BLOCK' },
          { kind: 'OPEN_CHART_LAYER', layer: 'ORDER_BLOCK' },
        ],
      },
      {
        id: 'premium-discount',
        title: 'Premium/discount ve OTE',
        goal: 'Bir hareketin hangi bölgesinde olunduğunu tarif edebilmek.',
        body: `Son swing aralığının ortası **denge** noktasıdır; üstü premium, altı discount bölgesi olarak adlandırılır.
**OTE**, bir hareketin yaklaşık %62–79 geri çekilme bölgesidir. Bunlar bir konumu tarif eden etiketlerdir; tek başlarına bir giriş kuralı değildir.`,
        terms: ['premium-discount', 'ote-optimal-trade-entry', 'fibonacci-duzeltme-retracement'],
        concepts: ['PREMIUM_DISCOUNT', 'OTE'],
        actions: [
          { kind: 'OPEN_CONCEPT', concept: 'PREMIUM_DISCOUNT' },
          { kind: 'OPEN_CHART_LAYER', layer: 'OTE' },
        ],
      },
    ],
  },
  {
    id: 'rules-to-tests',
    title: 'Kuraldan teste',
    lessons: [
      {
        id: 'idea-to-rules',
        title: 'Bir fikri kurala dökmek',
        goal: 'Gözlemini, sırası ve zaman penceresi belli adımlardan oluşan bir stratejiye çevirebilmek.',
        body: `Bu projede strateji serbest metin değildir: tipli adımlardan oluşur (ör. önce süpürme, sonra yapı kırılımı, sonra FVG), adımlar arasına zaman penceresi konur, giriş/stop/hedef/risk açıkça seçilir.
Kaydedilen bir strateji versiyonu **değişmez**; değişiklik yeni versiyon oluşturur ve her sonuç hangi versiyondan geldiğini bilir.
- Katalogdan hazır bir strateji ekleyip adımlarını incelemek iyi bir başlangıçtır.`,
        terms: [
          'strateji-versiyon-kurulum-setup',
          'stop-loss-sl-ve-take-profit-tp',
          'emir-tipleri-piyasa-limit-stop',
        ],
        concepts: [],
        actions: [{ kind: 'OPEN_VIEW', view: 'STRATEGY' }],
      },
      {
        id: 'read-backtest',
        title: 'Backtest sonucunu okumak',
        goal: 'Bir backtest raporunun neyi söyleyip neyi söylemediğini ayırt edebilmek.',
        body: `Backtest, kuralların geçmiş veride nasıl sonuç verdiğini **ölçer**; gelecekte ne olacağını söylemez.
Önce örneklem büyüklüğüne bak: 30'un altındaki işlem sayısında sonuç büyük ölçüde şansla açıklanabilir. Sonra maliyetleri, aynı mumda stop/hedef görülen işlemleri ve drawdown'u oku.
Raporun "Bu sonuç ne diyor?" panelinde **rastgele girişle kıyasla** düğmesi, kurallarının rastgele zamanlarda girmekten ayırt edilip edilemediğini gösterir.`,
        terms: [
          'orneklem-buyuklugu',
          'kazanma-orani-ve-beklenen-deger',
          'profit-factor',
          'drawdown-dusus',
          'belirsiz-mum',
          'rastgele-giris-kiyasi',
          'guven-araligi-bootstrap',
        ],
        concepts: [],
        actions: [
          { kind: 'OPEN_VIEW', view: 'STRATEGY' },
          { kind: 'OPEN_GLOSSARY', term: 'rastgele-giris-kiyasi' },
        ],
      },
      {
        id: 'out-of-sample',
        title: 'In-sample, out-of-sample ve deneme sayısı',
        goal: 'Parametre ayarlamanın neden iyimser sonuçlar ürettiğini açıklayabilmek.',
        body: `Kuralları ayarladığın veri **in-sample**, hiç dokunmadığın veri **out-of-sample**'dır. Ayar yalnızca in-sample'da yapılır; out-of-sample yalnızca son kontrol içindir.
Ne kadar çok parametre denersen, in-sample'da iyi görünen bir sonucun şanstan gelmiş olması o kadar kolaylaşır; bu yüzden deneme sayısı kaydedilir ve raporda gösterilir.
- Araştırma laboratuvarında bir hipotez açıp bu düzeni adım adım kurabilirsin.`,
        terms: [
          'in-sample-out-of-sample',
          'deneme-sayisi',
          'parametre-taramasi',
          'hipotez',
          'out-of-sample-kapisi',
        ],
        concepts: [],
        actions: [{ kind: 'OPEN_VIEW', view: 'RESEARCH' }],
      },
    ],
  },
  {
    id: 'discipline',
    title: 'Pratik ve disiplin',
    lessons: [
      {
        id: 'replay',
        title: 'Replay ile pratik',
        goal: 'Geleceği görmeden mum mum ilerleyip karar vermeyi denemek.',
        body: `Replay, grafiği geçmişte bir noktada keser ve geleceği gizler; mum mum ilerlersin. Bu, "sonradan bakınca belliydi" yanılgısını kırmanın en doğrudan yoludur.
Replay'de açtığın işlemler ve günlüğün, kendi karar verme biçimini görmeni sağlar.`,
        terms: ['replay', 'mae-ve-mfe', 'acik-pozisyon-anlik-r'],
        concepts: [],
        actions: [{ kind: 'OPEN_VIEW', view: 'CHART' }],
      },
      {
        id: 'paper-journal',
        title: 'Paper trade ve işlem günlüğü',
        goal: 'Bir stratejiyi gerçek para riske atmadan canlı veride izleyip kaydetmek.',
        body: `Paper trade, MT5 demo hesabından gelen canlı veride stratejiyi yalnızca başladığı andan sonrası için işler; geriye dönük hiçbir şey saymaz.
İşlem günlüğüne her kararın gerekçesini ve o anki duygunu yazmak, hangi hataların tekrarlandığını görmeni sağlar.
- Bu uygulama hiçbir zaman emir göndermez; emri her zaman sen verirsin.`,
        terms: ['paper-trading-kagit-uzerinde-islem', 'demo-hesap', 'islem-gunlugu-journal'],
        concepts: [],
        actions: [
          { kind: 'OPEN_VIEW', view: 'PAPER' },
          { kind: 'OPEN_VIEW', view: 'JOURNAL' },
        ],
      },
    ],
  },
];

export const LESSONS: readonly Lesson[] = LESSON_MODULES.flatMap((m) => m.lessons);

/** The first lesson not yet completed, in path order; null when all are done. */
export function nextLesson(completed: readonly string[]): Lesson | null {
  const done = new Set(completed);
  return LESSONS.find((l) => !done.has(l.id)) ?? null;
}
