# PLAN — M7: TradingView tarzı çizim araç takımı

> Durum: kullanıcı 2026-10-05'te istedi ("TradingView'deki sol taraftaki çizim araç takımını getir; sonra indikatörler"). M7.1 bu oturumda. Karar `docs/DECISIONS.md` D41.

## Neden kendimiz yazıyoruz
TradingView'in hazır çizim araç çubuğu yalnızca lisanslı "Advanced Charts" kütüphanesinde var; kişisel projelere verilmiyor (D1). Kullandığımız Lightweight Charts'ta hazır çizim aracı yok. Bu yüzden aynı düzeni (sol dikey şerit, gruplar, açılır listeler, alttaki yardımcı düğmeler) ve araçları kendi çizim katmanımızda yazıyoruz. Araç listesi TradingView'in resmi listesinden alındı: [Drawing tools available on TradingView](https://www.tradingview.com/support/solutions/43000703396-drawing-tools-available-on-tradingview/).

## Kurallar
- Çizimler kullanıcı verisidir (`source: USER`), UTC zaman + fiyat çapalarıyla saklanır; zaman dilimi değişince yerinde kalır (D24).
- Motor tespitleri (aday katmanı) ile kullanıcı çizimleri ayrı kalır.
- Replay'de imleçten sonra çizilmiş çizimler gizlenir (mevcut kural).
- Fibonacci seviyeleri bizim varsayılanımızdır ve ekranda yazar; TradingView'in varsayılanlarıyla birebir aynı olduğu doğrulanmadı.

## M7.1 kapsamı
**Şerit (sol, simgeli, gruplu):** Her grup son kullanılan aracın simgesini gösterir; yanındaki ok açılır listeyi açar (adlarıyla). Üzerine gelince Türkçe ad ve kısayol.

| Grup | Araçlar |
|---|---|
| İmleç | Seç, Silgi (tıkladığın çizimi siler) |
| Çizgiler | Trend çizgisi, Işın, Uzatılmış çizgi, Yatay çizgi, Yatay ışın, Dikey çizgi, Artı çizgi, Paralel kanal |
| Fibonacci | Fib düzeltme, Trend bazlı fib uzantısı |
| Şekiller | Dikdörtgen, Elips, Ok |
| Notlar | Metin, Yukarı ok işareti, Aşağı ok işareti |
| Tahmin ve ölçüm | Long pozisyon, Short pozisyon, Fiyat aralığı, Tarih aralığı, Tarih ve fiyat aralığı |

**Yardımcı düğmeler (şeridin altı):** Mıknatıs (çapayı en yakın mumun açılış/yüksek/düşük/kapanışına yapıştırır), Çizimde kal (araç her çizimden sonra "Seç"e dönmez), Tümünü kilitle, Tümünü gizle/göster, Tümünü sil (onaylı), Geri al / Yinele (Ctrl+Z / Ctrl+Y).

## Görevler
| # | Görev | Test |
|---|---|---|
| 1 | Motor: yeni çizim türleri, çapa sayıları, metin alanı, doğrulama; Fibonacci fiyatları | Çapa sayıları, doğrulama, fib fiyatları |
| 2 | Grafik: yeni türlerin şekli, çizimi, seçimi (isabet testi), tutamaçlar; 3 tıklamalı araçlar (kanal, fib uzantısı) önizlemeli | Geometri ve isabet testleri |
| 3 | Mıknatıs, çizimde kal, tümünü gizle/kilitle | Birim + uygulama testi |
| 4 | Geri al / yinele (anlık görüntü farkı; seviyeler dahil), silgi, tümünü sil | Uygulama testi |
| 5 | Simgeli şerit: gruplar, açılır listeler, kendi SVG simgelerimiz (yeni bağımlılık yok), mobilde yatay | Uygulama testi, tarayıcıda deneme |
| 6 | Seçili çizim paneli: metin düzenleme, yeni türlerin bilgileri (fib seviyeleri, tarih aralığı mum sayısı) | Uygulama testi |
| 7 | Belgeler: D41, sözlük (Fibonacci, ışın, kanal…), DEVIR | — |

## Sonraya (M7.2+)
Pitchfork, Gann, formasyonlar (XABCD, omuz-baş-omuz, Elliott), fırça / yol / çoklu çizgi, açıklama balonları, çizim stilleri (kalınlık, kesikli), favoriler. Anchored VWAP ve hacim profili indikatör çalışmasıyla birlikte.
