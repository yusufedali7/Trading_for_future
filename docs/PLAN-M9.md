# PLAN — M9: Formasyon kataloğu

> Durum: **1. dilim tamamlandı (2026-10-07)** — 3 mum formasyonu (Doji, Engulfing, Marubozu), TA-Lib ile doğrulandı. Kataloğun geri kalanı (58 mum formasyonu + 21 grafik formasyonu + 9 harmonik + SMC'nin eksik 8 alt kavramı) sonraki dilimlerde. Karar `docs/DECISIONS.md` D48.

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

## Sonraki dilimler (onay bekliyor, sırayla değil)
1. Kalan mum formasyonları (ikili/üçlü, trend bağlamı gerektirmeyenlerden devam).
2. SMC'nin eksik 8 alt kavramı (displacement, order_block, ifvg, breaker, equal_highs_lows, premium_discount, ote, candidate_sr) — mevcut swing/FVG/süpürme motoruna eklenir.
3. Grafik formasyonları (21) — pivot tabanlı, swing v1'e bağlı.
4. Harmonikler (9) — kaynağa göre farklı oran setleri, `unverified` olanlar kullanılmadan önce doğrulanmalı.
5. Olay deposu, canlı mod, grafik entegrasyonu, strateji kataloğu, "en iyi aday" sıralaması (görev dosyasının Adım 4-8'i).
