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
