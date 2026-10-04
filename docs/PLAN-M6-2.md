# PLAN — M6.2: Araştırma laboratuvarı

> Durum: kullanıcı 2026-10-04'te "nasıl istiyorsan öyle devam edelim" dedi; plan kaydedildi ve uygulamaya geçildi. Kararlar `docs/DECISIONS.md` (D37+).

## Amaç
Strateji fikirlerini dağınık backtest'ler yerine **hipotez → deney → sonuç** düzeninde araştırmak; aşırı optimizasyonu görünür kılmak.

## Kavramlar
- **Hipotez:** Test edilebilir bir cümle ("ICT Asya dibi süpürmesinden sonraki Londra MSS'leri, maliyet sonrası pozitif ortalama R verir") + bağlı strateji versiyonu.
- **Deney:** Hipotezin sabit test düzeni: veri kümesi, in-sample aralığı, out-of-sample sınırı, maliyetler, lot kuralları, belirsizlik kuralı. Deneydeki tüm çalışmalar aynı düzenle yapılır, böylece karşılaştırılabilir.
- **Parametre taraması:** Stratejinin en fazla iki parametresi (ör. hedef R, stop tamponu, MSS için en fazla mum, swing sol/sağ) için değer listeleri; her kombinasyon **yalnızca in-sample** çalıştırılır ve her biri bir deneme sayılır. Sonuç tablo/ısı haritası olarak gösterilir.
- **Out-of-sample kapısı:** Deney başına bir kez açılır; hangi kombinasyonla açıldığı kaydedilir. Tekrar açılırsa "tekrarlanan out-of-sample" uyarısı kalıcı olarak görünür.
- **Sonuç:** Desteklendi / desteklenmedi / yetersiz veri + not + dayandığı çalışmalar. Sayısal her iddia bir çalışma kaydına bağlıdır (kural 6).

## Görevler
| # | Görev | Test |
|---|---|---|
| 1 | Motor: taranabilir parametre kataloğu, `applyParam`, ızgara (deterministik sıra, `specHash`) | Geçersiz değerler elenir, hash'ler farklı, sıra sabit |
| 2 | Motor: hipotez / deney modelleri, durumlar, OOS kapısı kuralları | Saf fonksiyon testleri |
| 3 | Depolama: `trw-research` v2 (`hypotheses`, `experiments`; çalışmalara deney ve varyant bilgisi) | Gidiş-dönüş, yükseltme |
| 4 | Worker: tarama (özellikler parametre başına bir kez hesaplanır) | candle-source testi |
| 5 | Arayüz: "Araştırma" sayfası (hipotez listesi, oluşturma, deney düzeni) | App testi |
| 6 | Arayüz: tarama formu, sonuç ızgarası, deneme sayacı, OOS kapısı, sonuç notu, varyantı yeni versiyon olarak kaydetme | App testi; tarayıcıda gerçek veri |
| 7 | Belgeler: sözlük, kararlar, DEVIR | — |

## Kapsam dışı
Otomatik "en iyiyi seç", walk-forward analizi, Monte Carlo, rastgele giriş karşılaştırması (sonraya; sabit tohumla yapılmalı).
