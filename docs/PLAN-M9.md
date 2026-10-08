# PLAN — M9: Formasyon kataloğu

> Durum: **3. dilim tamamlandı (2026-10-08)** — SMC'nin eksik 8 alt kavramının **hepsi** artık motorda (displacement, order_block, ifvg, breaker, equal_highs_lows, premium_discount, ote, candidate_sr). Kararlar `docs/DECISIONS.md` D49 (2. dilim: displacement+order_block) ve D50 (3. dilim: kalan 6). (1. dilim: 2026-10-07, 3 mum formasyonu, TA-Lib ile doğrulandı — D48.) Kalan: 58 mum formasyonu + 21 grafik formasyonu + 9 harmonik + bu 8 SMC kavramının `FeatureSet`'e/grafiğe/strateji şemasına bağlanması.

## Neden dilimler halinde
`docs/AGENT-GOREV-M9-formasyonlar.md` kendisi 8 adıma bölünmüş; 107 tanımın hepsini tek oturumda CLAUDE.md'nin istediği titizlikte (pozitif + negatif sentetik test, ileriye-bakmama testi, oracle karşılaştırması, gerçek veride sıklık raporu) yapmak gerçekçi değil. M8'deki gibi küçük, test edilmiş parçalar halinde ilerliyoruz.

## Kullanıcı kararları (2026-10-07)
- **Swing parametresi korunuyor (3/3).** Kataloktaki SMC kavramları (BOS/CHoCH/FVG/süpürme) mevcut M4 motoruna bağlanacak; katalog yalnızca referans/kaynak belgesi, kod üretmiyor.
- **İlk aile: mum formasyonları** (TA-Lib tanımı, nesnel kurallar, hızlı somut sonuç).
- **TA-Lib kuruldu ve oracle karşılaştırması yapıldı** (kullanıcı onayıyla, `py -m pip install TA-Lib`).

## Mimari: ayrı sistem
`packages/engine/src/patterns/` — M4'ün `features/` klasöründen **ayrı**, CLAUDE.md'nin "Kavram tanımları" bölümündeki manuel çizim / otomatik katalog ayrımına uygun. `CandlePattern` kendi tipi; M4'ün `Detection` birleşimine karışmıyor.

## 1. dilimde ne yapıldı
- `packages/engine/src/patterns/candle-classify.ts`: TA-Lib'in resmi mum sınıflandırma eşikleri (https://ta-lib.org/api/candle-settings/, 2026-10-07'de kontrol edildi) — `bodyLong`, `bodyDoji`, `shadowVeryShort` vb.
- `packages/engine/src/patterns/candlestick.ts`: `detectDoji`, `detectEngulfing`, `detectMarubozu`. Her tespit `formedAt/Index` + `confirmedAt/Index` (known_at = son mumun kapanışı) + `direction` taşır.
- **Neden yalnızca bu 3'ü:** Trend bağlamı gerektirmeyen, tanımı nesnel ve tam emin olduğum formasyonlar. Örn. Çekiç (Hammer) ailesi TA-Lib'de bir trend-tespiti alt yordamı kullanıyor; bunu ezbere hatasız yeniden üretebileceğime emin olmadığım için **denemedim** — yanlış "doğrulandı" demektense kapsam dışı bıraktım (kural 8).
- **Oracle doğrulama:** `tools/oracle/talib_candles.py` (TA-Lib, BSD) ile üretilen 85 barlık sentetik örnek (`packages/engine/test/fixtures/SYNTHETIC_candlestick_oracle.json`) + ayrıca **20.000 gerçek EURUSD 1 dakikalık bar** (MT5 köprüsünden, bu oturumda) üzerinde test edildi. İkisinde de **birebir eşleşme** (8.585 tespit, real veri).
- **Süreçte bulunan 3 hata** (oracle sayesinde): (1) `direction` alanı hiç sonuca eklenmemişti; (2) Engulfing'in renk kontrolü düz (doji) mumu yanlış sınıflandırıyordu — TA-Lib düz mumu "beyaz" sayıyor; (3) Engulfing TA-Lib'de ±80 (kenar tam çakışık) / ±100 (kenar aşılmış) diye iki güç seviyesi kullanıyor — biz yalnızca varlık + yön tutuyoruz (diğer tüm motor dedektörleriyle aynı sözleşme).
- **Gerçek veride sıklık** (20.000 EURUSD 1m bar, 2026-09-24 → 2026-10-07): Doji %15,3, Engulfing %20,8, Marubozu %6,8 (1000 mumda). Bu üçü 1 dakikalık forex verisinde **nadir değil** — "özel" bir sinyal olarak değil, sık görülen bir mum şekli olarak okunmalı.
- Katalogda `cdldoji`/`cdlengulfing`/`cdlmarubozu` durumu `VERIFIED` yapıldı, doğrulama notu eklendi. Diğer 58 mum formasyonu hâlâ `TO_IMPLEMENT`.

## 2. dilimde ne yapıldı (2026-10-08, D49)
- `packages/engine/src/features/displacement.ts`: `detectDisplacement` — gövdesi, önceki `atrPeriod` mumun ortalama true range'inin `minBodyAtr` katından büyük mum. `Detection` birleşimine dahil değil (bkz. gerekçe D49/`docs/definitions/displacement-v1.md`).
- `packages/engine/src/features/order-block.ts`: `detectOrderBlocks` — bir BOS/CHoCH'un kırılım mumu aynı yönde bir displacement'sa, geriye `lookbackBars` içindeki ilk ters renkli mum order block. `Detection` birleşimine dahil, `features/outcomes.ts`'e başarısızlık çizgisi eklendi.

## 3. dilimde ne yapıldı (2026-10-08, D50) — SMC'nin kalanı
- `ifvg.ts`/`breaker.ts`: kaynak FVG/order block kapanışla tamamen geçersizleşince ters yönde zon. `Detection`'a dahil.
- `equal-levels.ts`: her swing, aynı türden en yakın önceki swing ile ATR toleransı içinde ikili eşleşme. `Detection`'a dahil değil.
- `premium-discount.ts`: en son onaylı swing tepe/dip aralığının %50'si; düz, `validUntil`'siz kayıt listesi (basitleştirme). `Detection`'a dahil değil.
- `ote.ts`: ardışık ters yönlü swing çiftleri arasındaki impuls'un 0.62-0.79 geri çekilme bölgesi. `Detection`'a dahil.
- `candidate-sr.ts`: tepe+dip birlikte ATR toleranslı kümeleniyor, `min_touches`'a ilk eriştiğinde bir kez kayıt. `Detection`'a dahil değil.
- **SMC'nin eksik 8 alt kavramının hepsi artık motorda.** Hiçbiri `features/compute.ts`'in `FeatureSet`'ine ya da grafiğe henüz bağlı değil (M8'deki gibi: önce motor, sonra ayrı adımda bağlama).

## Sonraki dilimler (onay bekliyor, sırayla değil)
1. Kalan mum formasyonları (ikili/üçlü, trend bağlamı gerektirmeyenlerden devam).
2. Grafik formasyonları (21) — pivot tabanlı, swing v1'e bağlı.
3. Harmonikler (9) — kaynağa göre farklı oran setleri, `unverified` olanlar kullanılmadan önce doğrulanmalı.
4. SMC'nin 8 kavramının (displacement, order_block, ifvg, breaker, equal_highs_lows, premium_discount, ote, candidate_sr) `FeatureSet`'e ve grafiğe bağlanması (M8'deki indikatör-grafik bağlama adımıyla aynı iş türü); strateji şemasına (`EventStep`) bağlanması ayrı bir iş.
5. Olay deposu, canlı mod, grafik entegrasyonu, strateji kataloğu, "en iyi aday" sıralaması (görev dosyasının Adım 4-8'i).
