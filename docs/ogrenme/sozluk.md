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
