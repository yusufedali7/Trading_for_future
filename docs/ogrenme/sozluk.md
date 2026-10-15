# Sözlük

Bu dosya, projede karşımıza çıkan kavramları sade Türkçeyle açıklar. Her kilometre taşında yeni kavramlar eklenir.

- Her maddede "Uygulamada" satırı, kavramın bu projede nerede ve nasıl kullanıldığını söyler.
- Örneklerdeki sayılar kavramı anlatmak için uydurulmuş hesap örnekleridir; piyasa verisi ya da tahmin değildir.
- Broker'dan broker'a değişebilen şeyler (kontrat büyüklüğü, altında pip tanımı gibi) ayrıca belirtilmiştir.

---

## Fiyat ve birimler

### Parite (döviz çifti)
İki para biriminin birbirine göre fiyatı. **EURUSD = 1.0850**, 1 euro'nun 1.0850 dolar ettiğini söyler. Soldaki para **baz** (EUR), sağdaki **kote** (USD) para birimidir.
*Uygulamada:* Her enstrümanın baz ve kote parası `instruments/registry.ts` dosyasında tek yerde tanımlı olacak.

### XAUUSD (altın)
1 ons altının dolar fiyatı. Örnek: 2650.50. Bir döviz çifti değil, emtia; ama forex platformlarında parite gibi işlem görür.

### Pip
Fiyat hareketini ölçmek için kullanılan geleneksel birim.
- **EURUSD:** 1 pip = 0.0001. 1.0850 → 1.0870 hareketi **20 pip**tir.
- **USDJPY gibi yen pariteleri:** 1 pip = 0.01.
- **XAUUSD:** Ortak bir standart yok; bazı yerler 0.1, bazıları 0.01 kullanır. Bu projede varsayılan **0.1** (2650.50 → 2651.50 = 10 pip); ayarlardan değiştirilebilir.

*Neden önemli:* Stop mesafesi ("20 pip stop"), hedef ve pozisyon büyüklüğü pip üzerinden hesaplanır.

### Tick (point)
Fiyatın gösterilebildiği en küçük adım. EURUSD genelde 5 ondalıkla gösterilir (1.08503), yani tick = 0.00001 = pip'in onda biri. Buna bazen "pipet" denir.
*Uygulamada:* İçe aktarılan veride tick'ten daha ince fiyat varsa doğrulama raporu bunu gösterir.

### BID, ASK ve spread
- **BID (alış fiyatı):** Senin **satabileceğin** fiyat.
- **ASK (satış fiyatı):** Senin **alabileceğin** fiyat.
- **Spread = ASK − BID.** İşleme girer girmez ödediğin gizli maliyettir. Örnek: BID 1.08500, ASK 1.08510 → spread 1 pip.

*Uygulamada:* Grafik BID verisiyle çizilir. Backtest'te long (alış) işlem ASK'tan açılır; spread maliyeti her sonuçta ayrıca raporlanır.

---

## Pozisyon büyüklüğü

### Lot
İşlem büyüklüğü birimi.
- **1 standart lot** = 100 000 birim baz para (EURUSD'de 100 000 euro).
- **0.1 lot** = mini lot, **0.01 lot** = mikro lot.
- **Altında** 1 lot genelde 100 onstur (broker'a göre değişir).

### Pip değeri
1 pip hareketin kaç dolar kâr ya da zarar ettirdiği.
- **EURUSD:** 1 lotta 1 pip = 100 000 × 0.0001 = **10 $**.
- **XAUUSD:** 1 lot = 100 ons ve pip = 0.1 kabulüyle 1 pip = 100 × 0.1 = **10 $**.

*Uygulamada:* Risk motoru lotu bu değerle hesaplayacak (M5).

### Kaldıraç ve marjin
Kaldıraç, küçük bir teminatla (marjin) büyük bir pozisyon açmayı sağlar. Kazancı da zararı da büyütür. Bu proje gerçek parayla işlem **yapmaz**. Türkiye'de kaldıraçlı işlemler SPK düzenlemesine tabidir.

---

## Grafik ve zaman

### Mum (OHLC)
Belirli bir sürede fiyatın dört değeri:
- **O**pen: açılış
- **H**igh: en yüksek
- **L**ow: en düşük
- **C**lose: kapanış

Kapanış açılıştan yüksekse mum yükseliş (genelde yeşil), düşükse düşüş (genelde kırmızı) mumudur. Kural: low ≤ open ve close ≤ high. Uymayan veri hatalıdır.
*Uygulamada:* İçe aktarmada bu tutarlılık kontrol edilir ve hatalar raporlanır.

### Zaman dilimi (timeframe)
Her mumun kapsadığı süre: 1m (1 dakika), 15m, 1h, 4h, 1D (gün), 1W (hafta).
*Uygulamada:* Yalnızca 1 dakikalık veri saklanır; 15m, 1h, 4h gibi diğer dilimler ondan hesaplanır. Böylece hepsi birbiriyle tutarlı olur.

### Günlük kapanış
Forex'te "gün" gece yarısında değil, New York saatiyle **17:00**'de biter. Bu projede de böyle (karar D11). 4 saatlik mumlar da bu saate hizalanır: NY saatiyle 17, 21, 01, 05, 09, 13.

### Session (seans)
Büyük piyasaların aktif olduğu saat aralıkları: **Asya** (Tokyo), **Londra**, **New York**. Seans sınırları yerel saatle tanımlanır (örn. "Londra 08:00–17:00, Londra saatiyle").

### UTC, saat dilimi ve yaz saati (DST)
- **UTC**, dünya genelinde referans saattir. Uygulama bütün zamanları UTC olarak saklar ve istediğin saat diliminde (İstanbul, Londra, New York…) gösterir.
- Londra ve New York yaz saatine **farklı haftalarda** geçer. Bu yüzden seans saatleri yılda birkaç hafta birbirine göre kayar.
- Türkiye 2016'dan beri yaz saati uygulamıyor (sabit UTC+3).

### Crosshair, zoom, pan
- **Crosshair:** Fareyi grafikte gezdirince çıkan artı imleci; üstünde durduğun mumun değerlerini gösterir.
- **Zoom:** yakınlaştırma/uzaklaştırma.
- **Pan:** grafiği sağa sola kaydırma.

---

## Test ve ölçüm

### Backtest
Bir stratejinin kurallarını geçmiş veriye uygulayıp "o dönemde bu kurallar izlenseydi ne olurdu"yu ölçmek. Geçmiş sonuç, gelecek için garanti değildir.

### Replay
Geçmiş veriyi mum mum oynatıp, gelecek mumları görmeden elle işlem kararı alarak pratik yapmak (M3).
*Uygulamada:* Replay başlangıç tarihini seç → "Replay başlat". → / ← bir mum ilerler/geri gider, boşluk tuşu oynatır. Grafikte yalnızca imlece kadar kapanmış mumlar görünür.

### Lookahead (ileriye bakma) hatası
Test sırasında o anda bilinemeyecek bir bilgiyi kullanmak. Örneğin bir tepe noktasının "tepe" olduğu, ancak sonraki birkaç mum düştüğünde anlaşılır. O mumlar oluşmadan tepeyi biliyormuş gibi davranmak sonuçları sahte biçimde iyi gösterir.
*Uygulamada:* Her tespit "oluştuğu mum" ve "anlaşıldığı (onaylandığı) mum" ile birlikte saklanır.

### Stop loss (SL) ve take profit (TP)
- **SL:** Zararı sınırlamak için önceden belirlenen çıkış fiyatı.
- **TP:** Hedef kâr fiyatı.

Bir mum hem SL'e hem TP'ye değerse hangisinin önce olduğu o mumdan anlaşılamaz. Bu projede varsayılan kötümser kabul yapılır: **önce stop** (karar D8).

### R (risk birimi)
İşlemde göze aldığın zarar = **1R**.
- 20 pip stop ile girip 40 pip kazandıysan sonuç **+2R**.
- Stop olduysan **−1R**.

R kullanmak, farklı büyüklükteki işlemleri karşılaştırılabilir yapar.

### Kazanma oranı ve beklenen değer
- **Kazanma oranı:** kazanan işlem / toplam işlem.
- **Beklenen değer (expectancy):** işlem başına ortalama R.

Düşük kazanma oranı tek başına kötü değildir. Örneğin %40 kazanıp her kazançta +2R, her kayıpta −1R alan bir kurala bakalım: 0.4 × 2 − 0.6 × 1 = **+0.2R** (hesap örneği).

### Drawdown (düşüş)
Hesabın zirveden en fazla ne kadar geri düştüğü. Bir stratejinin psikolojik olarak dayanılabilir olup olmadığını anlamak için önemlidir.

### Örneklem büyüklüğü
Az sayıda işlemle yapılan ölçüm şansa çok açıktır. Bu projede 30'dan az işlem içeren her sonuçta uyarı gösterilir.

---

## Veri

### CSV
Virgülle (ya da noktalı virgülle) ayrılmış düz metin tablo dosyası. Geçmiş fiyat verisi genelde bu biçimde indirilir: tarih, açılış, en yüksek, en düşük, kapanış, hacim.

### Dukascopy
İsviçreli bir banka; geçmiş fiyat verisini ücretsiz hesapla CSV olarak indirmeye izin veriyor. Bu projenin veri kaynağı (karar D12). İndirme ve kullanım koşulları kullanıcının sorumluluğundadır.

### Veri boşluğu (gap)
Olması gereken mumların eksik olması. Hafta sonu forex kapalı olduğu için oluşan boşluk **beklenen** boşluktur. Hafta içindeki boşluklar raporlanır.

---

## M1'de eklenenler: veri ve grafik

### İşlem günü
Forex'te bir gün, New York saatiyle 17:00'de başlar ve ertesi gün 17:00'de biter. Gün, **kapandığı tarihle** anılır: Pazartesi 17:00'de açılan günlük mum "Salı" mumudur.
*Uygulamada:* Günlük (1D) mumların altındaki tarih, hangi saat dilimini seçersen seç işlem gününün tarihidir (karar D18).

### Yeniden örnekleme (resampling)
Küçük zaman dilimindeki mumları birleştirerek büyük zaman dilimi mumu üretmek. On beş tane 1 dakikalık mumdan bir 15 dakikalık mum oluşturmak buna örnek:
- **açılış** = ilk mumun açılışı
- **en yüksek** = en yüksek değer
- **en düşük** = en düşük değer
- **kapanış** = son mumun kapanışı
- **hacim** = toplam

*Uygulamada:* Uygulama yalnızca 1 dakikalık veriyi saklar. 15m, 1h, 4h, 1D ve 1W mumlarını her seferinde bu veriden hesaplar; böylece bütün zaman dilimleri birbiriyle tutarlı kalır.

### Eksik mum
Piyasa açıkken olması gereken ama veride bulunmayan 1 dakikalık mum. Örneğin veri sağlayıcı o dakikada fiyat kaydetmemiş olabilir.
*Uygulamada:* Grafiğin üstündeki bilgi şeridinde "eksik 1m mum: 3/15" gibi bir uyarı görürsen, o 15 dakikalık mum 15 yerine 12 dakikalık veriden oluşmuş demektir.

### Henüz kapanmamış mum
Süresi dolmamış, hâlâ oluşan mum. Açılışı belli ama en yüksek, en düşük ve kapanış değerleri daha değişebilir. Bu yüzden kapanmamış bir mumla analiz yapmak "ileriye bakma" hatasına yol açabilir.
*Uygulamada:* Grafikte gri gösterilir ve bilgi şeridinde "mum henüz kapanmadı" yazar.

### Doğrulama raporu
CSV içe aktarılırken verinin kontrol edildiği rapor. Tekrar eden satırlar, sırası bozuk satırlar, eksik mumlar, hafta sonu mumları ve tutarsız fiyatlar burada listelenir.
*Uygulamada:* Uygulama hiçbir düzeltmeyi kendiliğinden yapmaz. Her düzeltme için senin kutucuğu işaretlemen gerekir ve kabul ettiğin düzeltmeler veriyle birlikte kaydedilir.

### Veri parmak izi (içerik özeti / hash)
Verinin tamamından hesaplanan kısa bir kod (64 karakter). Veride tek bir fiyat bile değişse bu kod tamamen değişir.
*Uygulamada:* İleride her backtest sonucunun yanında saklanacak. Böylece "bu sonuç tam olarak hangi veriyle üretildi?" sorusu her zaman cevaplanabilecek.

### Bilgi şeridindeki kısaltmalar
Grafiğin üstündeki satırda: **A** açılış, **Y** en yüksek, **D** en düşük, **K** kapanış. ▲ mumun yükselişle, ▼ düşüşle kapandığını gösterir.

---

## M2'de eklenenler: seanslar ve elle analiz

### Seans kutusu
Bir seansın başlangıç ve bitiş saatleri arasında fiyatın en yükseği ile en düşüğünü gösteren kutu.
*Uygulamada:* Asya mor, Londra mavi, New York bakır renginde, kesik çizgili ve isim etiketlidir. Seans henüz bitmediyse kutu soluk görünür ve "devam ediyor" yazar. Çünkü o seansın en yükseği ve en düşüğü daha kesinleşmemiştir; bunu kesinmiş gibi kullanmak "ileriye bakma" hatası olur.

### Seans çakışması (overlap)
İki seansın aynı anda açık olduğu saatler. Londra–New York çakışması genelde günün en hareketli zamanıdır.
*Bilgi:* ABD ve İngiltere yaz saatine farklı haftalarda geçer. Örneğin 2026'da 8–29 Mart arasında Londra–New York çakışması 4 yerine 5 saat sürer. Uygulama bunu otomatik hesaplar.

### Destek ve direnç
- **Destek:** Fiyatın düşerken durup döndüğü düşünülen seviye.
- **Direnç:** Fiyatın yükselirken durup döndüğü düşünülen seviye.
- **Rol değişimi (flip):** Kırılan bir direncin sonradan destek olarak çalışması ya da tersi.

Bunlar kesin kurallar değil, gözlemdir. Bir seviyenin "çalışıp çalışmadığı" ancak çok sayıda örnekle ölçülebilir; M5'te bunu yapabileceğiz.
*Uygulamada:* Yatay çizgi ya da bölge çiz, "Destek/direnç olarak kaydet" de. Her seviyenin türü, zaman dilimi, notu ve durumu olur.

### Kırılım ve retest
- **Kırılım:** Fiyatın bir seviyenin ötesinde kapanması.
- **Retest:** Kırılan seviyeye geri dönüp test etmesi.

*Uygulamada:* Seviyenin durumunu "Kırıldı" ya da "Retest" yaptığında bu değişiklik tarih ve notla geçmişe yazılır. Böylece ileride kendi gözlemlerini geriye dönük inceleyebilirsin.

### Trend çizgisi
Ardışık diplerden (yükselen trend) ya da tepelerden (düşen trend) geçen eğimli çizgi.

### Bölge (zone)
Tek bir fiyat yerine bir fiyat aralığı. Fiyat genelde tam bir çizgiye değil, bir bölgeye tepki verir.

### Fiyat aralığı aracı
İki nokta arasındaki farkı ölçer: kaç pip, yüzde kaç, ne kadar sürede. Yukarı hareket yeşil ve "+", aşağı hareket kırmızı ve "−" ile gösterilir.

### Long / short pozisyon aracı ve R:R
- **Long:** Yükselişten kazanç bekleyen işlem. **Short:** Düşüşten kazanç bekleyen işlem.
- **R:R (risk/ödül oranı):** Hedefe kadar olan mesafenin stop'a kadar olan mesafeye oranı. 20 pip stop ve 40 pip hedef → R:R 2,00.

Yüksek R:R tek başına iyi bir işlem demek değildir; hedefe ulaşma olasılığı da önemlidir. Bu olasılık ancak backtest ile ölçülür (M5).
*Uygulamada:* Araç 20 pip stop ve 2R hedefle başlar; fiyatları panelden değiştirebilirsin. Stop girişin yanlış tarafındaysa araç "Geçersiz" der.

---

## M3'te eklenenler: replay ve işlem günlüğü

### Emir tipleri: piyasa, limit, stop
- **Piyasa emri:** "Şimdi gir." O anki fiyattan dolar. Replay'de karar anından sonraki ilk 1 dakikalık mumun açılışından dolar.
- **Limit emri:** "Daha iyi bir fiyattan gir." Long için şimdiki fiyatın altına, short için üstüne konur. Fiyat oraya gelirse dolar.
- **Stop emri:** "Fiyat bu seviyeyi geçerse gir." Long için şimdiki fiyatın üstüne, short için altına konur (kırılım girişi).
- **Emir süresi:** Limit ve stop emri bu kadar mum içinde dolmazsa iptal olur ("süresi doldu").

*Uygulamada:* Sağ paneldeki "İşlem" bölümü yalnızca replay sırasında açılır.

### Spread ve kayma (slippage)
- **Spread:** Alış (ASK) ile satış (BID) fiyatı arasındaki fark. Grafik BID fiyatını gösterir. Long açarken ASK'tan alırsın, yani girişin grafikteki fiyattan spread kadar kötüdür.
- **Kayma:** Emrin istediğin fiyattan biraz daha kötü dolması. Hızlı piyasada ve stop emirlerinde olur.

*Uygulamada:* İkisi de pip olarak girilir, varsayılan 0'dır. 0 iken "maliyetsiz" uyarısı görünür, çünkü maliyetsiz sonuçlar gerçekte olacağından iyi görünür. EURUSD için tipik spread bir broker'dan diğerine değişir; kendi kaynağına bak.

### Açık pozisyon, anlık R
Dolmuş ama henüz stop'a ya da hedefe değmemiş işlem. **Anlık R**, işlem şu an kapatılsa kaç R olacağını gösterir. İmleç ilerledikçe güncellenir.

### MAE ve MFE
- **MAE (maximum adverse excursion):** İşlem açıkken fiyatın senin aleyhine en fazla ne kadar gittiği.
- **MFE (maximum favorable excursion):** Lehine en fazla ne kadar gittiği.

İkisi de R cinsindendir. Örnek: MAE −0,8R, MFE +1,5R ve sonuç −1R ise fiyat bir ara +1,5R'ye kadar gitmiş, sonra stop olmuşsun. Bu, hedefin uzak ya da çıkışın geç olabileceğine dair bir ipucudur (tek örnekle değil, çok sayıda kayıtla bakılır).

### Belirsiz mum
Aynı 1 dakikalık mumda hem stop hem hedef fiyatı varsa hangisinin önce geldiği o mumdan bilinemez. Uygulama kötümser davranır: önce stop (karar D8). Böyle işlemler işaretlenir ve özetlerde sayıları gösterilir.

### İşlem günlüğü (journal)
Her kararın kaydı: ne zaman, hangi seansta, neden, nasıl hissederek karar verdin ve sonuç ne oldu. Amaç, zamanla kendi alışkanlıklarını görmek. Örneğin "FOMO ile açtığım işlemler" ya da "Asya seansındaki kararlarım".
- **İşlem yok kararı** da kayda değer. Doğru yerde işlem açmamak da bir beceridir.
- **Duygu ve şiddet:** Sakin, kendinden emin, FOMO (kaçırma korkusu), korku, intikam (önceki kaybı telafi etme isteği), sıkılmış; 1 (hafif) – 5 (çok güçlü).

*Uygulamada:* İşlem kapanınca form kendiliğinden açılır. Seans, R, süre, MAE/MFE önceden doludur. Grafiğin ekran görüntüsü de kaydedilebilir. Üst menüdeki "Günlük" sayfasında kayıtları filtreleyip özetini görebilirsin.

### Profit factor
Toplam kazanılan R'nin toplam kaybedilen R'ye oranı. 1'in üstü, ölçülen dönemde kazancın kayıptan fazla olduğu anlamına gelir. Kayıp yoksa hesaplanamaz ("—").

### Kazanç / kayıp serisi
Art arda gelen kazançlı ya da kayıplı işlem sayısı. En uzun kayıp serisi, psikolojik olarak neye hazırlıklı olman gerektiğini gösterir.

### Maksimum düşüş (R cinsinden)
Toplam R'nin bir zirveden sonra en fazla ne kadar gerilediği. Örnek: +3R'ye çıkıp sonra 3 işlem üst üste −1R alırsan düşüş 3R olur.

*Hatırlatma:* Günlük özetindeki sayılar **ölçülen** değerlerdir, gelecekteki bir olasılık değildir. 30'dan az işlemle büyük ölçüde rastlantı olabilir.

---

## M4'te eklenenler: motor adayları (feature engine)

### Aday (candidate)
Motorun bir tanıma göre otomatik bulduğu yapı. "Aday" denmesinin sebebi: bu kavramların (swing, FVG, süpürme…) tek bir resmi tanımı yok ve bulunan her yapı işe yarar bir sinyal değil. Bir adayın işe yarayıp yaramadığını ancak çok sayıda örnekle backtest ölçer (M5).
*Uygulamada:* Araç çubuğundaki "Motor adayları" düğmeleriyle katmanları açıp kapatırsın. Tanımlar `docs/definitions/` içinde.

### Onay gecikmesi
Bir yapının oluştuğu mum ile **anlaşıldığı** mum farklı olabilir. Örneğin bir tepenin tepe olduğu, ancak sağındaki 3 mum daha düşük kapandıktan sonra bilinir. Uygulama her adayı ancak onaylandığı mumun kapanışından sonra gösterir; replay'de de geçmişi "boyamaz".

### Swing tepe / dip
Solundaki ve sağındaki birkaç mumdan daha yüksek (ya da daha düşük) olan mum. Varsayılan: solda 3, sağda 3 mum.
*Grafikte:* Tepenin üstünde küçük ▼ ve "T", dibin altında ▲ ve "D".

### FVG (fair value gap, "adil değer boşluğu")
Üç mumluk bir hareketin ortasında, 1. mumun fitili ile 3. mumun fitili arasında kalan, fiyatın hiç işlem görmediği boşluk. Hızlı ve tek yönlü bir hareketi gösterir. Birçok trader fiyatın bu boşluğa geri dönmesini bekler; bunun gerçekten olup olmadığı ölçülmelidir.
- **Dokunma:** Fiyat boşluğun kenarına geri geldi.
- **Doldurulma:** Fiyat boşluğun öbür ucuna kadar geçti.

*Grafikte:* Yükselişte yeşil, düşüşte kırmızı yarı saydam kutu, "Aday FVG ↑/↓" etiketiyle. Kutu doldurulunca biter.

### Yapı kırılımı: BOS ve CHoCH
- **BOS (break of structure):** Fiyat son onaylı tepenin üstünde (ya da dibin altında) kapanır ve önceki kırılımla aynı yöndedir; yani trend devam ediyor gibi görünür.
- **CHoCH (change of character):** Kırılım önceki kırılımın tersi yönündedir; yön değişiyor olabilir. Bazı kaynaklar buna MSS (market structure shift) der.

*Grafikte:* Kırılan seviyede, swing'den kırılım mumuna kadar çizgi. BOS kesik, CHoCH düz çizgi; "↑/↓" ile yön.

### Likidite ve likidite süpürmesi (sweep)
- **Likidite:** Belirgin tepelerin üstünde ve diplerin altında birikmiş olduğu varsayılan stop emirleri.
- **Süpürme:** Fiyatın bir seviyeyi fitille aşıp **aynı mumda** geri seviyenin içinde kapanması. "Stop'lar alındı, fiyat geri döndü" yorumu yapılır. Kapanış seviyenin ötesindeyse bu süpürme değil kırılımdır.

*Uygulamada:* Önceki gün/hafta en yüksek-en düşükleri, biten seansların en yüksek-en düşükleri ve swing'ler seviye olarak kullanılır. Grafikte sarı ▼/▲ ve "Süpürme PDH" gibi etiket.

### PDH / PDL / PWH / PWL
- **PDH / PDL:** Önceki işlem gününün (17:00 New York'tan 17:00'ye) en yüksek / en düşük fiyatı.
- **PWH / PWL:** Önceki haftanın en yüksek / en düşük fiyatı.

*Grafikte:* Bir sonraki gün (hafta) boyunca kesik yatay çizgi.

### Kesme değişmezliği (truncation invariance)
"İleriye bakma" olmadığını kanıtlayan test. Veri herhangi bir anda kesildiğinde motorun bulduğu adaylar, tam veriden bulunup o ana kadar onaylanmış olanlarla birebir aynı olmalı. Aynı değilse motor, o anda bilinemeyecek bir bilgiyi kullanıyor demektir.

---

## M5'te eklenenler: strateji ve backtest

### Strateji, versiyon, kurulum (setup)
- **Strateji:** Bir fikrin adı ve açıklaması (hipotez).
- **Versiyon:** O fikrin kesin kuralları. Kaydedilen versiyon değiştirilmez; kuralı değiştirmek yeni versiyon demektir. Böylece her backtest sonucu hangi kurallarla elde edildiğini bilir.
- **Kurulum:** Kuralların tüm adımlarının sırayla gerçekleştiği an. Kurulum ancak son adımın mumu kapanınca bilinir.

*Uygulamada:* Üst menüde "Strateji". Kurallar formla girilir; serbest metin koşul yoktur.

### İçerik özeti (specHash)
Kuralların parmak izi. Aynı kurallar her zaman aynı özeti verir; tek bir sayı değişse özet değişir.

### Lot ve risk yüzdesi
İşlem başı risk yüzdesi, stop olursan bakiyenin en fazla yüzde kaçını kaybedeceğindir. Lot buna göre hesaplanır: risk tutarı / (stop mesafesi × pip değeri). Lot, risk aşılmasın diye aşağı yuvarlanır.
*Örnek:* 10.000 USD, %0,5 risk = 50 USD. 20 pip stop, EURUSD'de 1 lot için pip başına 10 USD → 50 / 200 = 0,25 lot.

### Komisyon
Broker'ın işlem başına aldığı ücret. Genelde "lot başına, giriş ve çıkış için ayrı" verilir (ör. 3,5 USD / lot / taraf → 1 lotluk gidiş-dönüş 7 USD).

### Profit factor ve beklenen değer
- **Beklenen değer (ortalama R):** İşlem başına ortalama sonuç. Pozitifse ölçülen dönemde kazandırmış.
- **Profit factor:** Kazanılan toplam / kaybedilen toplam. 1'in üstü kazanç.

İkisi de **geçmişte ölçülen** değerlerdir; gelecekte aynı çıkacağı garanti değildir.

### In-sample / out-of-sample
- **In-sample:** Kuralları ve parametreleri denediğin veri bölümü.
- **Out-of-sample:** Hiç dokunmadığın, en sona sakladığın bölüm. Kurallar burada da benzer sonuç veriyorsa fikir biraz daha güvenilir olur.

Aynı veride çok fazla parametre denersen bir noktada "şans eseri" iyi görünen ayarı bulursun (aşırı optimizasyon). Uygulama bu yüzden in-sample deneme sayısını sayar ve gösterir.

### Atlanan kurulum
Kurallar gerçekleştiği halde işleme dönüşmeyen kurulum: o sırada açık işlem vardı, veri eksikti, stop yanlış taraftaydı, lot çok küçüktü ya da günlük sınır dolmuştu. Hepsi sayılır, çünkü sessizce atlanırlarsa sonuç olduğundan iyi görünebilir.

### "Örneklemde doğrulandı"
Stratejinin durumu. Yalnızca "belirli veri ve koşullarda şu sonuç gözlendi" demektir; gelecekte işe yarayacağının kanıtı değildir.

---

## M6.1'de eklenenler: özel seanslar

### Özel seans
Kendi tanımladığın zaman aralığı: saat dilimi, başlangıç, bitiş ve günler. Grafikte kutu olarak görünür; en yüksek ve en düşük fiyatı süpürme seviyesi olur; stratejide kullanılabilir.
*Uygulamada:* Araç çubuğunda "Seanslar…" → şablon seç ya da "Yeni seans".

### ICT Asya aralığı
ICT eğitimlerinde kullanılan Asya tanımı: 20:00–00:00 New York saati. Uygulamanın yerleşik "Asya (Tokyo)" seansından (09:00–18:00 Tokyo) farklıdır. Yerleşik Asya, Londra açılışına kadar sürdüğü için "Asya dibi süpürüldü, Londra'da dönüş" fikrini test etmeye uygun değildir; ICT tanımı Londra açılmadan saatler önce biter.

### Kill zone
ICT terimi: fiyatın en hareketli olduğu varsayılan kısa zaman aralıkları. Yaygın tanımlar: Londra 02:00–05:00, New York 07:00–10:00 (New York saati). Bunlar gözlemdir, kural değildir; işe yarayıp yaramadığı backtest ile ölçülür.

### Seans kopyası (stratejide)
Bir stratejide özel seans kullandığında, seansın o anki tanımı strateji versiyonunun içine kopyalanır. Seansı sonra değiştirsen ya da silsen bile o versiyonun backtest sonuçları aynı kalır.

---

## M6.2'de eklenenler: araştırma laboratuvarı

### Hipotez
Testten **önce** yazılan, doğru ya da yanlış çıkabilecek bir cümle. Örnek: "ICT Asya dibi süpürüldükten sonra Londra'daki yükseliş MSS girişleri maliyet sonrası pozitif ortalama R verir." Önce yazmak önemlidir: sonuca bakıp cümleyi sonuca uydurmak kolaydır.

### Test düzeni (deney)
Hipotezin bütün çalışmalarında aynı kalan ayarlar: veri, tarih aralığı, in-sample / out-of-sample sınırı, maliyetler. Böylece sonuçlar elma ile elma karşılaştırılır.

### Parametre taraması
Bir ya da iki ayarın (ör. hedef R ve "MSS en fazla kaç mum sonra") farklı değerlerini sırayla denemek. Sonuç bir tabloda görünür.
*Dikkat:* Tablodaki en iyi hücreyi seçmek kolay ama yanıltıcıdır. Komşu hücreler de benzerse fikir daha sağlamdır; tek bir hücre parlıyorsa muhtemelen şanstır.

### Deneme sayısı
Her in-sample çalışma bir denemedir. 9 ayar denersen, 9 rastgele sonuçtan en iyisini seçme ihtimalin vardır. Uygulama bu sayıyı her zaman gösterir.

### Out-of-sample kapısı
Out-of-sample verisine yalnızca **bir kez**, ayarı kesinleştirdikten sonra bakılır. Sonuca bakıp ayarı değiştirir ve tekrar bakarsan o veri artık "görülmemiş" değildir. Uygulama ikinci bakışı kalıcı uyarıyla işaretler.

### Hipotez sonucu
- **Desteklendi / desteklenmedi:** En az bir çalışma kanıt olarak seçilir (genelde out-of-sample çalışması).
- **Yetersiz veri:** İşlem sayısı ya da veri karar vermeye yetmiyorsa.

"Desteklendi" bile gelecekte işe yarayacağının garantisi değildir; yalnızca "bu veride ve bu koşullarda böyle gözlendi" demektir.

---

## M6.3'te eklenenler: paper trading ve MT5

### Paper trading (kağıt üzerinde işlem)
Bir stratejiyi gerçek para kullanmadan, **başlattığın andan sonra** gelen yeni fiyatlarla denemek. Backtest geçmişe bakar; paper trading ileriye bakar. Bu yüzden out-of-sample'ın en dürüst halidir: sonuçlar henüz yaşanmamış veride oluşur.
*Uygulamada:* Üst menüde "Paper". Bir strateji versiyonu seçip oturumu başlatırsın; uygulama yeni mumlar geldikçe kurulumları ve işlemleri kendisi işler. Broker'a emir gitmez.

### Demo hesap
Broker'ın sanal parayla açtığı hesap. Fiyatlar gerçek piyasadan gelir, para gerçek değildir. Bu projede MT5 demo hesabı yalnızca **fiyat okumak** için kullanılır.

### MetaTrader 5 (MT5)
Birçok broker'ın kullandığı işlem programı. Bilgisayarında açık olduğunda Python ile fiyatları okunabilir.

### Köprü (bridge)
MT5 ile uygulama arasında duran küçük program. Yalnızca bilgisayarının içinden erişilebilir, yalnızca okur, yalnızca demo hesapla çalışır.

### Sunucu saati
Broker'ların MT5 sunucuları genelde kendi saat dilimlerini kullanır (çoğunlukla UTC+2 ya da UTC+3). Uygulama farkı son fiyatın zamanından ölçer ve mumları UTC'ye çevirir. Piyasa kapalıyken fark ölçülemez; o zaman güncelleme yapılmaz.

### Broker fiyatı farkı
Her broker'ın fiyatı biraz farklıdır (spread, kaynak). Bu yüzden Dukascopy verisiyle yapılan backtest ile MT5 verisindeki paper sonuçları birebir aynı çıkmaz; karşılaştırırken bunu akılda tut.

---

## M6.4'te eklenenler: kavram kütüphanesi

### Kavram kütüphanesi
Üst menüde "Kavramlar". Swing, FVG, yapı kırılımı, likidite süpürmesi, önceki gün/hafta seviyeleri ve seanslar için: ne oldukları, motorun tam tanımı, **yüklü gerçek veriden** örnekler ve sınırlar. "Grafikte göster" seni grafikte o ana götürür.

### "Beklendiği gibi gitmedi" ölçütü (outcome-v1)
Her kavram için yaygın bir beklenti vardır (ör. "dip destek olur"). Uygulama bunu tek, açık bir kuralla ölçer: aday onaylandıktan sonraki **N mum** içinde bir mum belirli bir fiyatın gerisinde **kapanırsa** "beklendiği gibi gitmedi", N mum boyunca kapanmazsa "tuttu" sayılır. N mum dolmadıysa "henüz belli değil". Bu bizim tanımımızdır; ICT/SMC'nin resmi bir kuralı yoktur.

### Ölçülen sıklık ve olasılık farkı
"Bu veride swing diplerinin %43'ü 12 mum içinde bozuldu" bir **ölçümdür**: belirli bir veri, zaman dilimi ve tanım için geçmişte ne olduğunu söyler. "Bu dip %57 ihtimalle tutar" ise bir **tahmindir**; uygulama bunu söylemez. Az sayıda örnekle ölçülen oranlar (30'dan az) özellikle güvenilmezdir.

---

## M7.1'de eklenenler: çizim araçları

### Işın ve uzatılmış çizgi
**Trend çizgisi** iki nokta arasında kalır. **Işın** ikinci noktadan sonra sonsuza uzar; **uzatılmış çizgi** iki yöne de uzar. Eğimli bir destek/direncin ileride nereye denk geleceğini görmek için kullanılır.

### Yatay ışın, dikey çizgi, artı çizgi
Yatay ışın bir fiyattan başlayıp sağa uzar (ör. "bu seviye şu andan itibaren önemli"). Dikey çizgi bir zamanı işaretler (ör. haber saati). Artı çizgi ikisinin kesişimidir.

### Paralel kanal
Bir trend çizgisi ve ona paralel ikinci bir çizgi. Fiyatın iki çizgi arasında gidip geldiği dönemleri gösterir. Ortadaki kesikli çizgi kanalın ortasıdır.

### Fibonacci düzeltme (retracement)
Bir hareketin başına ve sonuna çizilir; hareketin ne kadarının geri alındığını oranlarla gösterir (0,236 · 0,382 · 0,5 · 0,618 · 0,786). Uygulamada 0 ikinci noktada, 1 ilk noktadadır. Bu oranların "işe yaradığı" bir varsayımdır; Kavramlar ve backtest ile ölçülmeden kanıt sayılmaz.

### Trend bazlı Fibonacci uzantısı (extension)
Üç nokta: bir hareket (A → B) ve geri çekilmenin bittiği yer (C). İlk hareketin oranlarla C'den ileri taşınmış hâlini gösterir (0,618 · 1 · 1,272 · 1,618 · 2 · 2,618); hedef fikri vermek için kullanılır.

### Tarih aralığı / tarih ve fiyat aralığı
İki nokta arasındaki mum sayısını ve süreyi (ikincisinde ayrıca pip ve yüzde farkını) ölçer.

### Mıknatıs
Açıkken tıkladığın nokta, en yakın mumun açılış, en yüksek, en düşük ya da kapanış fiyatına yapışır. Çizgileri tam fitil ucuna koymak için.

### Geri al / yinele
Ctrl+Z son çizim değişikliğini geri alır, Ctrl+Y yineler. Silinen bir çizim geri gelince bağlı destek/direnç seviyesi de geri gelir.

---

## M7.2'de eklenenler: yedek

### Yedek dosyası
Başlıktaki "Yedek" düğmesi tek bir JSON dosyası indirir: çizimler, seviyeler, günlük (ekran görüntüleriyle), seanslar, stratejiler ve versiyonları, backtest sonuçları, hipotezler, paper oturumları, tercihler. Fiyat verisi girmez. Kayıtlı çalışman varken 7 günden uzun süre yedek almazsan düğmede uyarı çıkar.

### Geri yükleme
Yedek dosyasını seçince önce bir özet görürsün: eklenecek, aynı, çakışan, geçersiz kayıtlar. Hiçbir şeyin üzerine yazılmaz; aynı kimlikte farklı bir kayıt varsa mevcut olan korunur.

### Kalıcı depolama
Tarayıcılar yer azalınca site verisini silebilir. Uygulama tarayıcıdan "silme" ricasında bulunabilir; tarayıcı kabul etmeyebilir. En güvenlisi uygulamayı kendi tarayıcında açmak ve düzenli yedek almaktır.

### CSV
Excel'de açılabilen tablo dosyası. Günlük ve backtest işlemleri CSV olarak indirilebilir; Türkçe Excel için noktalı virgül ve ondalık virgül kullanılır.

---

## M9'da eklenenler: mum formasyonları

### Doji
Açılış ve kapanış fiyatı neredeyse aynı olan mum — kararsızlığın işareti sayılır. Ortalama mum aralığının %10'undan küçük gövde, TA-Lib'in tanımı.

### Engulfing (yutan mum)
Bir mumun gövdesinin, bir öncekinin gövdesini tamamen kapsaması ve ters renkte olması. Küçük bir mumdan sonra gelen büyük, ters yönlü mum.

### Marubozu
Neredeyse hiç fitili olmayan, uzun gövdeli mum — açılıştan kapanışa kadar kesintisiz bir yönde gittiğinin işareti.

### Oracle (referans) testi
Kendi kodumuzun doğruluğunu, aynı veri üzerinde bağımsız bir kaynakla (burada: TA-Lib kütüphanesi) karşılaştırarak kanıtlama yöntemi. Bizim motorumuz hâlâ TypeScript'te çalışıyor; TA-Lib yalnızca geliştirme sırasında "doğru cevap bu mu?" diye sormak için kullanıldı, uygulamanın çalışması için gerekli değil.

## M9 2. dilimde eklenenler: SMC (Smart Money Concepts)

### Displacement (güçlü hareket)
Normalden çok daha büyük gövdeli bir mum — piyasada ani, kararlı bir hareket olduğunun işareti sayılır. "Normal" ölçüsü, önceki mumların ortalama fiyat aralığıdır (ATR).

### Order block
Güçlü bir harekete (displacement) hemen önce gelen, o hareketin tersi renkteki son mum. ICT/SMC fikrine göre bu bölge, fiyat geri geldiğinde destek ya da direnç gibi davranabilir — "aday" bir bölge, kesin değil.

### Aday (candidate)
Motorun bulduğu her şeyin (swing, FVG, order block, ...) önündeki sıfat. "Kesin destek" değil, "aday destek" denir — çünkü bu tanımların resmi, tek bir karşılığı yok (bkz. CLAUDE.md "Kavram tanımları").

### Inversion FVG / Breaker block
Bir FVG'nin (ya da order block'un) fiyatın kapanışla tamamen içinden geçmesiyle "geçersiz" sayılması, ve aynı bölgenin bundan sonra **ters yönde** bir aday olarak izlenmesi — önce destek sayılan bir yer, kırılınca direnç adayı olabilir (ya da tersi).

### Eşit tepeler/dipler (EQH/EQL)
Birbirine çok yakın fiyatta oluşan iki tepe (ya da iki dip). ICT/SMC fikrine göre bu seviyenin altında/üstünde bekleyen emirler birikmiş olabilir — bir "likidite havuzu" adayı.

### Premium / discount
Son önemli tepe-dip aralığının tam ortası (denge çizgisi). Üstü "premium" (pahalı bölge), altı "discount" (ucuz bölge) olarak yorumlanır — kesin bir kural değil, bir çerçeve.

### OTE (Optimal Trade Entry)
Bir fiyat hareketinin (impuls) %62-%79'luk geri çekilme bölgesi — ICT'ye göre girişin "en iyi" olduğu aralık. Bizim için de bir **aday** bölge, garanti değil.

### Aday destek/direnç (candidate S/R)
Birbirine yakın fiyatlarda tekrar tekrar (en az 3 kez) dönülen bir seviye — yatay bir "duvar" adayı. Tepe ya da dip olması önemli değil, aynı seviye hem destek hem direnç gibi davranabilir.

## M9 5. dilimde eklenenler: 24 mum formasyonu daha

### Belt-hold / Kapanış Marubozu
Marubozu'nun "yarısı" gibi düşün: uzun gövdeli bir mum, ama yalnızca **bir** tarafında fitil yok (Belt-hold: açılış tarafında; Kapanış Marubozu: kapanış tarafında). Marubozu'dan daha sık görülür çünkü şart daha gevşek.

### Üst gölge, alt gölge (shadow)
Bir mumun gövdesinin üstünde kalan ince çizgi "üst gölge" (fitil), altında kalan "alt gölge". Topuz (Spinning Top) ve Yüksek Dalga (High Wave) gibi formasyonlar, küçük gövde + uzun gölgelerle tanınır — piyasanın kararsız olduğunun işareti.

### Harami ("gebe" mumu)
Büyük bir mumun içine tamamen sığan küçük bir mum. İkinci mum bir doji ise "Harami Cross" denir — kararsızlığın daha güçlü işareti.

### Yıldız (star) formasyonları
Büyük bir mumdan sonra, ondan **boşluklu** (gap) ayrılan küçük bir mum ya da doji — "Doji Star" gibi. Forex'te gün içi boşluk nadirdir, bu yüzden bu formasyonlar forex'te seyrek görülür.

### Piercing / Dark Cloud Cover
İki mumluk dönüş formasyonları: biri önceki mumun gövdesinin ortasından öteye geçerek kapanır. Piercing yükseliş yönünde, Dark Cloud Cover düşüş yönünde.

### Kicking (tekmeleme)
İki zıt yönlü marubozu arasında **boşluk** olması — çok güçlü, ani bir yön değişimi adayı. Forex'te gün içi nadir görülür (24/5 işlem, boşluk azdır).

### Eşit kapanış/açılış toleransı (Equal)
Bazı formasyonlar (Matching Low, Counterattack, Separating Lines, Stick Sandwich) iki fiyatın "neredeyse aynı" sayılması gerekir — bunun için küçük bir tolerans payı kullanılır (TA-Lib'in kendi varsayılanı, motorumuzda da aynen kullanılıyor).

## M9 6. dilimde eklenenler: kalan 34 mum formasyonu (katalog tamam)

### Çekiç (Hammer) / Asılı Adam (Hanging Man)
**Aynı mum şekli** — küçük gövde, uzun alt fitil, neredeyse hiç üst fitil yok, önceki mumun dibine (Çekiç) ya da tepesine (Asılı Adam) yakın. Aradaki fark **tamamen bağlama** dayanıyor: düşüş sonrası görülürse Çekiç (dönüş umudu), yükseliş sonrası görülürse Asılı Adam (dönüş uyarısı) deniyor — motor bu bağlamı kontrol etmiyor, ikisini de "aday" olarak işaretliyor, yorumu sana bırakıyor.

### Yıldız (Morning/Evening Star) ailesi
Üç mumluk dönüş formasyonları: büyük bir mum, ondan boşluklu ayrılan küçük bir "yıldız" mumu, sonra ilk mumun içine giren üçüncü bir mum. Morning Star yükseliş (düşüşten sonra), Evening Star düşüş (yükselişten sonra) yönünde.

### Hikkake
İçeride kalan bir mumdan (bir önceki mumun tepe-dip aralığının içinde kalan) sonra o aralığın dışına çıkılması — kısa vadeli bir tuzak/yön değişimi adayı. TA-Lib'in "sonraki 3 mumda onay" özelliği motorumuzda yok, yalnızca ilk sinyal tutuluyor.

## M9 7. dilimde eklenenler: grafik formasyonlarının ilk 6'sı

Mum formasyonlarından farklı olarak bunlar **tek mumla değil, birden çok onaylı tepe/dip (pivot) ile** tanınır — M4'ün swing motorunun ürettiği noktalar üzerine kurulu.

### Boyun çizgisi (neckline)
İkili/Üçlü Tepe-Dip ve Omuz Baş Omuz'un "kırılınca formasyonu onaylayan" referans seviyesi — iki dip (tepe formasyonlarında) ya da iki tepe (dip formasyonlarında) arasından geçen çizgi. Omuz Baş Omuz'da bu çizgi eğimli olabilir; diğerlerinde düz bir seviyedir.

### İkili Tepe / İkili Dip (Double Top / Bottom)
Aynı seviyeye iki kez ulaşıp geri çekilme (tepe) ya da aynı seviyeye iki kez düşüp geri sıçrama (dip) — ortadaki geri çekilme/sıçrama derinliği ATR'ye göre yeterince büyük olmalı, yoksa sıradan bir dalgalanmadan ayırt edilemez. Onay: fiyat boyun çizgisini kapanışla kırınca.

### Üçlü Tepe / Üçlü Dip (Triple Top / Bottom)
İkili Tepe/Dip'in üç tepe/dip'li hâli — Omuz Baş Omuz ile karışmaması için ortadaki tepe/dip diğerlerinden belirgin yüksek/düşük olmamalı (motor bunu ATR toleransıyla kontrol ediyor).

### Omuz Baş Omuz / Ters Omuz Baş Omuz (Head and Shoulders)
Üç tepeli (ya da dipli) bir dönüş formasyonu: ortadaki "baş" diğer ikisinden ("omuzlar") belirgin şekilde yüksek (tepe formasyonunda) ya da düşük (dip formasyonunda); omuzlar birbirine yakın. Onay: fiyat boyun çizgisini (iki omuz arasındaki dip/tepe çizgisi) kapanışla kırınca.

### Bu ailede "VERIFIED" değil "IMPLEMENTED" denmesinin sebebi
Mum formasyonlarında TA-Lib gibi resmi, kurulu bir karşılaştırma kütüphanesi (oracle) vardı. Grafik formasyonlarında öyle bir kütüphane yok — kurallar doğrudan kataloğun kendi tanımından (Bulkowski'nin kitabından) koda çevrildi ve sentetik testlerle + ileriye-bakmama testiyle doğrulandı, ama bağımsız bir kütüphaneyle karşılaştırılmadı. Bu yüzden katalogda "doğrulandı" (VERIFIED) değil "uygulandı" (IMPLEMENTED) yazıyor — SMC kavramlarıyla aynı durum.

## M9 8. dilimde eklenenler: doğru-çizgi ailesi (üçgen, kama, kanal, dikdörtgen, genişleyen)

Bu grup, iki pivot çiftinden geçen **iki doğru** (direnç/destek ya da üst/alt sınır) uydurup bu doğruların eğimine ve birbirine göre durumuna (yakınsıyor mu, paralel mi, ıraksıyor mu) bakıyor.

### Üçgen (Triangle) — yükselen, alçalan, simetrik
Yükselen Üçgen: yatay bir direnç + yükselen bir destek (düşük dipler yükseliyor). Alçalan Üçgen: tam tersi. Simetrik Üçgen: direnç aşağı, destek yukarı eğimli — ikisi bir noktada ("apex") buluşmaya gidiyor. Kırılım apex'e ulaşmadan olmalı; aksi halde formasyon geçersizleşiyor (artık sıkışacak yer kalmıyor).

### Kama (Wedge) — yükselen, alçalan
İki doğru da AYNI yöne eğimli ama biri diğerinden daha dik — aralarındaki mesafe daralıyor. Yükselen Kama (iki çizgi de yukarı, alt çizgi daha dik) genelde düşüşle bitiyor (dönüş sinyali); Alçalan Kama (iki çizgi de aşağı, üst çizgi daha dik) genelde yükselişle.

### Kanal (Channel) — yükselen, alçalan
Üçgen/kama gibi yakınsamıyor — iki doğru birbirine **paralel**, aynı yöne kayıyor. Kırılım, trendin bittiğinin ilk işareti olarak okunuyor.

### Dikdörtgen (Rectangle)
Hem direnç hem destek **yatay** — fiyat bir bant içinde gidip geliyor. Yukarı ya da aşağı kırılabilir; hangisi olursa o yöne "aday" oluyor.

### Genişleyen Formasyon / Megafon (Broadening)
Tepeler gittikçe yükseliyor, dipler gittikçe düşüyor — iki doğru birbirinden **uzaklaşıyor** (ıraksıyor). Diğerlerinin aksine bir "sıkışma" yok, piyasanın gittikçe daha kararsız/oynak hale geldiğinin işareti.

## M9 9. dilimde eklenenler: bayrak ve flama (direk + konsolidasyon)

### Direk (Pole)
Bayrak/flama formasyonlarının ilk parçası: kısa bir sürede, sert bir fiyat hareketi (ATR'ye göre büyük). Formasyonun "yakıtı" gibi düşün — ne kadar güçlüyse, kırılım sonrası beklenen hareket de o kadar büyük (hedef, direğin boyu kadar).

### Boğa/Ayı Bayrağı (Bull/Bear Flag)
Direkten sonra, ona **ters yönde hafifçe eğimli** (ya da yatay) küçük bir konsolidasyon — direğin yönünün aksine kısa bir "soluklanma". Fiyat bu küçük kanaldan direk yönünde çıkınca (kırılınca) formasyon onaylanıyor.

### Flama (Pennant)
Bayrakla aynı mantık, ama konsolidasyon bir bayrak değil minik bir **simetrik üçgen** — iki çizgi birbirine yaklaşıyor. Kataloğumuzda yalnızca yükseliş yönlü direk + flama tanımlı (düşüş yönlüsü için ayrı bir resmi tanım yok).

### Bu ailede kullanılan bir varsayım
Bayrak/flama'nın kataloğu, bir kanalın/üçgenin ihtiyaç duyduğu "her çizgi için 2 nokta" kuralına göre bir pivot eksik veriyor (yalnızca 3-4 pivot var). Motor bunu, kırılacak tarafı direğin ucu + konsolidasyondaki tek pivottan **bir doğru**, karşı tarafı da o pivotun fiyatında **düz bir sınır** olarak yorumluyor — bu, dış bir kaynaktan doğrulanmış bir kural değil, kataloğun eksik bıraktığı bir noktanın savunulabilir bir okuması (bkz. `docs/DECISIONS.md` D56).

## M9 10. dilimde eklenenler: Fincan-Kulp, Çanak Dip, Elmas (grafik formasyonu kataloğu tamam)

### Fincan-Kulp (Cup and Handle) / Çanak Dip (Rounding Bottom)
İki kenar (aynı seviyede) arasında **yuvarlak bir çanak** şeklinde yavaş bir düşüş-ve-yükseliş. Fincan-Kulp'ta çanağın ardından küçük bir "kulp" (hafif bir geri çekilme) daha var; Çanak Dip bunun kulpsuz, daha uzun süreli hâli. İkisi de kırılım ile (üst kenarın üzerine kapanışla) onaylanıyor.

### "Yuvarlaklık" nasıl ölçülüyor
Kataloğun kendisi bunun için somut bir formül vermiyor, sadece "basit bir eğri uyumu skoru yeterli" diyor — yani bu tanım zaten **öznel**. Motor, çanağın kapanış fiyatlarına bir **parabol** (ikinci derece eğri) uydurup ne kadar iyi uyduğunu (**R²**, 1 = kusursuz uyum) ölçüyor. Bu, kullanıcıya sorulup onaylanmış bir mühendislik kararı (bkz. `docs/DECISIONS.md` D57) — dış bir kaynaktan doğrulanmış resmi bir tanım değil.

### Elmas (Diamond)
Önce tepeler/dipler birbirinden **uzaklaşıyor** (Genişleyen Formasyon gibi), sonra **yakınlaşıyor** (Simetrik Üçgen gibi) — iki formasyonun arka arkaya gelmiş hâli, elmas şeklini andırıyor. Nadir ve kataloğun kendisine göre de en öznel formasyonlardan biri.

## M9 11. dilimde eklenenler: harmonik formasyonlar (XABCD)

Harmonikler, grafik formasyonlarından farklı bir aile: tek bir kırılım beklemek yerine, **5 noktanın (X-A-B-C-D) birbirine oranı** Fibonacci seviyelerine ne kadar uyuyorsa o kadar "aday" sayılıyor. Formasyonun kendisi D noktasında zaten sinyal — ek bir kapanış beklenmiyor.

### X-A-B-C-D ve "PRZ" (Potansiyel Dönüş Bölgesi)
X, A, B, C, D fiyatın sırayla gittiği beş uç nokta (tepe-dip-tepe-dip-tepe ya da tersi). Her bacağın (XA, AB, BC, CD) uzunluğu, bir öncekine göre belirli bir Fibonacci oranında olmalı. D noktası, bu oranların hepsi tutarsa "PRZ" (olası dönüş bölgesi) oluyor — kesin bir dönüş değil, izlenmeye değer bir aday.

### Gartley, Yarasa (Bat), Alternatif Yarasa, Yengeç (Crab), Derin Yengeç, Kelebek (Butterfly)
Hepsi aynı X-A-B-C-D iskeletini kullanıyor, sadece her bacağın oranı farklı (ör. Yengeç'te D, X'in çok ötesine geçiyor; Yarasa'da D, X'e yakın kalıyor). Her biri Scott Carney'nin harmonik ticaret literatüründen, bu oturumda bağımsız kaynaklarla çapraz kontrol edildi.

### Cypher
Diğerlerinden farklı: C noktası A'nın **ötesine** taşıyor (daha yüksek bir tepe/daha düşük bir dip), ve D, XA bacağına göre değil **XC** bacağına göre ölçülüyor. Darren Oglesbee'ye ait.

### AB=CD
En basit harmonik şekil — X yok, sadece A-B-C-D dört nokta. Adından da anlaşılacağı gibi, CD bacağının uzunluğu AB bacağına **yaklaşık eşit** olmalı.

### Shark (Köpekbalığı)
Beş noktalı (0-X-A-B-C) bir harmonik formasyon; D yerine C'de tamamlanır. B, X'in ötesine taşar (AB, XA'nın 1,13–1,618 katı); C, AB'nin 1,618–2,24 katı kadar ilerler ve 0X bacağının 0,886–1,13'ü civarına döner.
Uzun süre "güvenilir kaynak yok" diye eklenmedi; D78'de bu üç oranın her biri en az iki bağımsız kaynakta eşleşince eklendi. Bir kaynağın ilk bacak için koyduğu ek oran (0,5–0,886) tek kaynaklı olduğu için **uygulanmadı** — tahmin yürütmek yerine kurala uyuldu.
*Uygulamada:* Motorda `detectShark`; harmonik formasyonlar henüz grafiğe bağlı değil.

## Eğitim fazında eklenenler: Öğren sayfası

### Bağlamsal açıklama
Ekranlarda altı noktalı çizgili terimler (örneğin backtest raporundaki "Kazanma oranı") tıklanabilir: bu sözlükteki açıklaması yerinde açılır. "Sözlükte aç" seni bu sayfada o terime götürür.
*Uygulamada:* Öğren → Sözlük sekmesi bu dosyanın kendisini gösterir; dosya güncellendikçe arayüz de güncellenir.

### Rastgele giriş kıyası
Stratejinin işlemleriyle **aynı sayıda**, aynı ortalama stop mesafesi, aynı hedef (R), aynı maliyet ve risk ile ama giriş zamanı **rastgele** seçilmiş işlemler. Soru şu: "Kurallarım, rastgele bir zamanda girmekten daha iyi mi?" Rastgelelik sabit bir tohumla (seed) üretilir, aynı koşu her zaman aynı rastgele işlemleri verir.
*Uygulamada:* Backtest raporundaki "Bu sonuç ne diyor?" panelinde "Rastgele girişle kıyasla" düğmesi.

### Güven aralığı (bootstrap)
Ölçülen bir farkın ne kadar "sallantılı" olduğunu gösteren aralık. İşlemler defalarca rastgele yeniden çekilip fark her seferinde yeniden hesaplanır; sonuçların ortadaki %95'i aralığı verir. Aralık **sıfırı içeriyorsa**, bu veride fark şanstan ayırt edilemiyor demektir. Bu bir olasılık tahmini değil, eldeki örneğin ne kadar oynak olduğunun ölçüsüdür.
*Uygulamada:* Rastgele giriş kıyasında farkın yanında gösterilir.

## D77'de eklenenler: CISD

### CISD (teslimat yönünde değişim)
"Change in State of Delivery." Fiyat birkaç mum boyunca bir yönde kapanış yaparken, ters yönde gelen bir kapanış bu kısa serinin **başladığı mumun açılışını** geçerse, ICT anlatımlarında bu "teslimat yönü değişti" diye okunur. Örnek: üç düşüş mumu 1.1012, 1.1008, 1.1004'ten açılmış; ardından bir mum 1.1015'te kapanırsa (1.1012'nin üzeri) yükseliş yönlü CISD adayı.
Bu bir **aday**dır; resmi tek bir tanımı yoktur. Buradaki tanım bir MT5 Expert Advisor'ının yorumundan sadeleştirildi (süpürme şartı yok, seri 1–5 mum).
*Uygulamada:* Grafikte CISD katmanı ve Öğren → Kavramlar'da "CISD".

