# PLAN — M3: Replay ve işlem günlüğü

> Durum: kullanıcı 2026-10-02'de "devam edelim, izin veriyorum" dedi; plan bu belgeyle kaydedildi ve uygulamaya geçildi. Kararlar `docs/DECISIONS.md` (D26+).

## Amaç
Geçmiş veriyi mum mum oynatarak, geleceği görmeden "burada ne yapardım?" pratiği yapmak:
- long, short ya da işlem yok kararı vermek;
- giriş, stop ve hedef belirlemek;
- işlemin sonucunu dürüstçe ölçmek: R, MAE, MFE, süre;
- her işlemi bir günlüğe yazmak: seans, neden, duygu, ekran görüntüsü, ders;
- günlüğü filtreleyerek kendi alışkanlıklarını görmek.

## Temel kurallar
- **Gelecek gizli (kural 3):** Replay imleci `cursor` ise grafikte yalnızca `cursor`'a kadar kapanmış mumlar görünür. Seans kutuları da `asOf = cursor` ile hesaplanır; devam eden seansın high/low değeri o ana kadarki değerdir.
- **İşlem simülasyonu motorda:** Dolum ve çıkış kuralları M5 backtest ile **aynı modüldür** (`execution/`). Hesap 1m taban veriyle yapılır. Kurallar:
  - Market emri bir sonraki 1m mumun açılışından dolar.
  - Limit ve stop emirleri fiyata değince dolar. Gap durumunda açılıştan dolar.
  - Aynı 1m mumda hem SL hem TP varsa varsayılan "önce stop"tur ve işlem `ambiguous` olarak işaretlenir.
  - Simülasyon yalnızca `cursor`'a kadar kapanmış mumları kullanır. İşlem, imleç ilerledikçe sonuçlanır.
- **Maliyet açık:** Spread ayarlanabilir. Varsayılan 0'dır ve bu durumda ekranda "maliyetsiz" uyarısı görünür. Long girişi ASK (BID + spread) ile, short çıkışı ASK ile hesaplanır.
- **İstatistik dürüstlüğü:** Replay özetinde 30'dan az işlem varsa uyarı gösterilir. Kazanma olasılığı uydurulmaz, yalnızca ölçülen değerler gösterilir.

## Görevler ve testler
| # | Görev | Testler |
|---|---|---|
| 1 | `replay/view.ts`: imlece kadar görünen mumlar ve tamamlanmış/devam eden seanslar | Görünen mumlar = kesilmiş veriden yeniden örnekleme (kesme değişmezliği); gelecek mum yok |
| 2 | `execution/trade-sim.ts`: emir (market/limit/stop), SL/TP, gap, aynı mumda SL+TP, spread, emir süresi, manuel kapatma, R, MAE/MFE, süre | CLAUDE.md backtest listesindeki uç durumlar; imleçten sonrasını görmeme testi |
| 3 | Günlük modeli + işlem istatistikleri (kazanma oranı, ortalama R, beklenen değer, en uzun seriler) + seans etiketi | Saf fonksiyon testleri |
| 4 | Depolama: `trw-user` v3 (`trades`, `journal`, `screenshots`) | Gidiş-dönüş, sürüm yükseltme |
| 5 | Replay modu: başlangıç tarihi, ileri/geri adım, oynat/duraklat, hız; worker'da imleç bazlı seanslar | App testi (sahte grafik); tarayıcıda kontrol |
| 6 | İşlem paneli: long/short, emir tipi, SL/TP (pip ya da fiyat), açık işlemin anlık R'si, manuel kapatma; grafikte giriş/SL/TP çizgileri | App testi |
| 7 | Günlük formu: işlem kapanınca açılır; seans, R, süre önceden dolu; neden, duygu (+ şiddet), ders, etiketler; grafik ekran görüntüsü | App testi |
| 8 | Günlük sayfası: liste + filtreler (enstrüman, seans, yön, sonuç, duygu, tarih) + özet istatistik | App testi |
| 9 | Sözlük (R, MAE, MFE, beklenen değer, replay), DEVIR, kararlar | — |

## Kapsam dışı
Otomatik strateji (M5), lot hesabı (M5), kısmi kâr alma, breakeven ve trailing stop. Bunlar M3 sonrası iyileştirme listesine.
