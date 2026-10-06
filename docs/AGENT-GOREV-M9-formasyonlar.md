# Görev: formasyon ve strateji kataloğunu sisteme entegre et

Bu repoya `catalog/` klasörü eklendi (açıklaması `catalog/README.md`'de). Görevin, bu katalogdaki formasyonları ve strateji hipotezlerini **mevcut sisteme** entegre etmek: motor bunları gerçek veride bulsun, canlı grafikte göstersin, stratejiler backtest edilsin ve en iyi adaylar dürüst ölçütlerle sıralansın.

Repoda CLAUDE.md varsa oradaki kurallar bu dosyadan önce gelir.

## Değişmez kurallar

- **Veri dürüstlüğü:** gerçek veri yoksa sonuç, istatistik ya da örnek işlem üretme. Sentetik veri yalnızca testlerde ve `SYNTHETIC` etiketiyle.
- **İleriye bakma yok:** her tespit `known_at` mumunun kapanışında ortaya çıkar. Onaylanmış olaylar sonradan değişmez.
- **Aday dili:** arayüzde "aday", "onaysız", "oluşuyor" gibi ifadeler; "kesin" yok.
- **Emir yok:** sistem hiçbir broker'a emir göndermez. Canlı kullanım = grafik, alarm, paper trade.
- **Sor:** mevcut mimariyi değiştirmen gerekiyorsa ya da katalogdaki bir tanım belirsizse, önce bana sor.

## Adım 0: keşif (Plan Mode, kod yok)

1. Mevcut sistemi incele: mum verisi nasıl tutuluyor, indikatör/formasyon var mı, grafik kütüphanesi ve overlay sistemi ne, strateji ve backtest yapısı ne, canlı veri nereden geliyor.
2. Katalog şemalarını mevcut modellere nasıl eşleyeceğini öner (adaptör katmanı). Sistemi katalog için yeniden yazma.
3. Aşağıdaki adımlar için görev listesi ve her adımın bitti kriterini çıkar. Onayımı bekle.

## Adım 1: katalog yükleyici

- `catalog/` dosyalarını şemalarla doğrulayan bir yükleyici ve testi. Katalog bozuksa testler kırılır.
- Tanımlar sistemde **versiyonlu veri** olarak durur: her olay `definition_id@version` taşır.

## Adım 2: pivot motoru

Her şeyin temeli. `swing_pivot` tanımına göre, artımlı (yeni mum geldikçe) çalışan, onay gecikmesini (`right` mum) uygulayan pivot üreticisi. Her pivot hem oluştuğu hem onaylandığı mumu saklar.

## Adım 3: dedektörler (test güdümlü, sırayla)

Sıra: `smc.json` içindeki `implementation_order` → ikili tepe/dip → H&S → üçgenler → bayrak/flama → dikdörtgen/kanal → mum formasyonları → kamalar → harmonikler (yalnızca `verification` değeri `missing` olmayanlar) → fincan kulp, çanak dip, megafon, elmas (`definition_confidence: low`, en son).

Her dedektör için şu testler zorunlu:

1. **Pozitif sentetik:** `prototype` noktalarını fiyata ölçekle, aralarını mumlarla doldur (sabit seed'li küçük gürültü). Dedektör formasyonu bir kez, doğru pivotlarla ve doğru `known_at` ile bulmalı.
2. **Negatif sentetik:** bir kuralı toleransın dışına it (ör. ikinci tepe çok yüksek). Tespit olmamalı.
3. **İleriye bakmama:** veriyi her mumda kesip yeniden çalıştır. Geçmiş olaylar değişmemeli, hiçbir olay `known_at`'ten önce görünmemeli.
4. **Oracle karşılaştırması** (varsa, `references.json`'da `role: oracle`): aynı gerçek CSV'de dış kütüphanenin sonucuyla karşılaştır, uyuşma oranını ve farkların nedenini raporla. Mum formasyonlarında TA-Lib çıktısı test altın değeridir.
5. **Sıklık raporu:** gerçek veride enstrüman ve zaman dilimine göre 1.000 mumda kaç kez oluştuğu. `gap_sensitivity: yes` olan mum formasyonlarının forex'te gerçekten nadir olup olmadığı burada görülür. Hiç oluşmayan ya da her mumda oluşan bir dedektör hatalıdır.

Testler geçince katalogdaki `status` alanını `VERIFIED` yap (oracle yoksa `IMPLEMENTED`).

## Adım 4: olay deposu

Her tespit bir olaydır: `event_id`, `definition@version`, enstrüman, zaman dilimi, pivot noktaları, seviyeler (neckline, hedef, geçersizlik), `formed_at`, `known_at`, durum (`forming`, `confirmed`, `invalidated`, `target_hit`, `expired`), motor versiyonu, veri seti özeti (hash).

Ek olarak bir **sonuç tablosu**: onaydan 10, 20, 50 mum sonra MFE/MAE, hedefe mi geçersizliğe mi önce ulaşıldığı. Her olay için aynı mesafede rastgele bir **kontrol seviyesi** de ölçülür (`catalog/experiments/fvg_random_walk.py` mantığı).

## Adım 5: canlı mod

- Yeni mum **kapandığında** motor artımlı güncellenir; kapanmamış mum değerlendirilmez.
- `forming` olaylar kesikli çizgiyle ve "oluşuyor, onaysız" etiketiyle gösterilebilir; `confirmed` olaylar düz çizgiyle. Onaylanmış olay asla taşınmaz.
- Canlı veri kaynağı için bana sor; seçenekleri (kullanım koşulları dahil) karşılaştırarak öner.
- Alarm: onaylanan olay ya da strateji sinyali bildirim üretir (ör. webhook üzerinden n8n ve Telegram). Emir yok.

## Adım 6: grafik

- Olaylardan çizim: pivot noktaları, çizgiler, bölgeler, hedef ve geçersizlik seviyeleri. Aile bazında aç/kapat (mum, grafik, harmonik, yapı/likidite).
- Olaya tıklayınca detay paneli: tanım ve parametreler, `claims.jsonl`'dan ilgili iddialar (kaynak ve kanıt düzeyiyle, "bu bizim sonucumuz değil" notuyla) ve varsa bizim gerçek veri istatistiğimiz.
- Kavram kütüphanesinde `catalog/visuals/*.svg` şemaları. Gerçek örnek "fotoğrafları" elle eklenmez: gerçek veride bulunan olayların çevresinden otomatik grafik görüntüsü üretilir ve `event_id` ile saklanır.

## Adım 7: stratejiler

- `catalog/strategies/*.json` dosyalarını yükle ve doğrula. `ambiguities` alanındaki her madde, strateji test edilmeden önce bana sorulacak bir sorudur.
- Backtest kuralları: maliyetler (spread, komisyon, kayma), aynı mumda SL/TP için kötümser kabul ve bunun raporu, sabit seed, tekrarlanabilir sonuç kaydı.
- `baseline_random_entry` her stratejinin zorunlu karşılaştırmasıdır: aynı stop, hedef ve işlem sıklığıyla rastgele girişler.

## Adım 8: "en iyi strateji" seçimi

Sistem "en iyi strateji" demez; **"bu örneklemde en iyi aday"** der. Sıralama ölçütleri:

1. Örneklem dışı (out-of-sample) dönemde en az 100 işlem (30'un altı hiç listelenmez).
2. Maliyetler düşüldükten sonra pozitif beklenen değer.
3. Rastgele giriş tabanını yenmesi; fark ve bootstrap güven aralığıyla raporlanır.
4. Komşu parametrelerde de dayanıklı olması (tek bir optimize değerde değil).
5. Yıllara ve enstrümanlara göre tutarlılık.
6. Denenen varyant sayısının kaydı (çok deneme, şans eseri iyi sonuç ihtimalini artırır).

Seçilen aday canlıda yalnızca grafik, alarm ve paper trade olarak çalışır.

## Bitirince

`DEVIR.md`'yi güncelle: hangi dedektörler `VERIFIED`, hangilerinin oracle ile farkı var, sıklık raporundan ilginç bulgular, cevap bekleyen sorular.
