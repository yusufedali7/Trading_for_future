# Forex formasyon ve strateji kataloğu (v1)

Bu klasör, sistemdeki ajanın okuyup koda çevireceği **veridir**. Formasyonlar burada kural ve parametre olarak durur; motor bunları koda çevirir, testler doğrular, grafik olaylardan çizer.

## İçerik

| Dosya | Ne | Adet |
|---|---|---|
| `patterns/candlestick.json` | Mum formasyonları. Tanım TA-Lib'dir; motor ya birebir üretir ya da farkı belgeler. `gap_sensitivity` forex'te boşluk gerektiren formasyonları işaretler. | 61 |
| `patterns/chart.json` | Pivot tabanlı klasik grafik formasyonları: parametreler, kurallar, onay, geçersizlik, hedef, prototip noktaları. | 21 |
| `patterns/harmonic.json` | XABCD harmonikleri. Her kaynağın oranları ayrı bir `ratio_set` (ayrı tanım versiyonu). | 9 |
| `patterns/smc.json` | Yapı ve likidite kavramları (swing, BOS, CHoCH, MSS, FVG, OB, sweep, seans seviyeleri...). Uygulama sırası dosyada. | 16 |
| `strategies/*.json` | Strateji hipotezleri. Hepsi `IDEA` durumunda, hiçbirinin sonucu yok. Belirsizlikler `ambiguities` alanında. | 6 |
| `claims.jsonl` | İddia defteri: internetteki rakamlar, kaynak, piyasa, "başarı" tanımı ve kanıt düzeyiyle. Asla bizim sonucumuz gibi gösterilmez. | 9 |
| `references.json` | Kaynak ve depo kaydı: rol (oracle, referans, veri), lisans. `KONTROL ET` yazan lisanslar kod kullanılmadan önce doğrulanır. | 18 |
| `schema/*.schema.json` | Doğrulama şemaları. Katalog bozuksa testler kırılmalı. | 3 |
| `visuals/*.svg` | Prototip noktalarından **üretilmiş** şematik formasyon resimleri (kavram kütüphanesi için). | 21 |
| `experiments/fvg_random_walk.py` | `fvg-random-walk` iddiasını üreten, tohumu sabit sentetik deney. | 1 |

## Temel kurallar

- **Kesinlik yok:** motorun bulduğu her şey arayüzde "aday"dır.
- **known_at:** her tespit ancak `known_at` mumunun kapanışından sonra var sayılır. Pivotlar `pivot_right` mum gecikmeyle bilinir. Onaylanmış bir olay sonradan taşınmaz ya da yeniden çizilmez.
- **Prototip:** `prototype` normalize (zaman 0..1, fiyat 0..1) noktalardır. `prototype_pivots`, hangi noktanın P1, P2... olduğunu söyler. Üç işe yarar: şematik resim çizmek, SENTETİK test verisi üretmek, kullanıcıya açıklamak. Gerçek veri yerine geçmez.
- **Doğrulama düzeyi:** `verification: sourced | partial | unverified | missing`. `missing` olan uygulanmaz; `unverified` uygulanabilir ama arayüzde belirtilir.
- **Durum:** `TO_IMPLEMENT → IMPLEMENTED → VERIFIED` (VERIFIED = sentetik + negatif + ileriye-bakmama testleri ve varsa oracle karşılaştırması geçti). `BLOCKED_NEEDS_SOURCE` = tanım eksik.

## Yeni formasyon eklemek

1. İlgili JSON'a giriş ekle (benzersiz `id`, `version`).
2. `prototype` ve `prototype_pivots` ver; doğrulama betiği her pivotun gerçekten yerel tepe/dip olduğunu kontrol eder.
3. Kaynağını `sources` alanına ve gerekiyorsa `references.json`'a ekle; rakam iddiası varsa `claims.jsonl`'a yaz.
4. Testleri yazmadan durumu `IMPLEMENTED` yapma.
