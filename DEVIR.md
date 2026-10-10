# DEVIR — Oturum Devir Notu

_Son güncelleme: 2026-10-10 (D63: "en iyi aday" sıralamasının kıyaslama çekirdeği)_

## Durum özeti
- **M1–M5, M6.1, M6.2:** tamamlandı. Planlar `docs/PLAN-M2..M6-2.md`, kararlar D23–D38.
- **M6.3 (Paper trading + MT5 köprüsü):** görev 1–6 tamamlandı; plan `docs/PLAN-M6-3.md`, karar D39. Kullanıcı gerçek bir MetaQuotes-Demo hesabı açtı, `MetaTrader5` paketini kurdu, köprüyü çalıştırdı; uygulama **gerçek 10.080 adet 1m mum** çekti, sunucu saati farkını ölçtü (UTC+3:00). **Kalan:** kullanıcının EURUSD için bir strateji kaydedip gerçek bir paper oturumu başlatması (henüz kayıtlı strateji yok).
- **Bu oturumda ek düzeltmeler (2026-10-05):**
  - MT5 otomatik güncelleme uygulama seviyesine taşındı (`features/paper/use-mt5-feed.ts`): sekme değişince durmuyor, seçim tercihlere (`paperFeed`) kaydedildiği için yenilemede de açık kalıyor; açıkken başlıkta "● MT5 canlı" / "● MT5: sorun".
  - Grafikteki çizim aracı "Long"/"Short" isimleri **"Long taslağı"/"Short taslağı"** oldu — Replay işlem panelindeki gerçek Long/Short girişiyle karıştırılmasın diye.
  - Üst araç çubuğu kalabalıktı (~25 düğme tek sırada); Seanslar ve Katmanlar (motor adayları) artık **"Seanslar (n)" / "Katmanlar (n)"** açılır panellere toplandı.
- **Çalışan paper oturumu (2026-10-05 20:00 İstanbul'dan beri):** "ICT Asya dibi süpürme → Londra MSS" v1 (D36 kuralları, kullanıcının kendi stratejileri gelene kadar geçici), MT5 MetaQuotes-Demo EURUSD verisinde, maliyet spread 0,2 / kayma 0,1 / komisyon 3,5, bakiye 10.000. İlk olası kurulum: Londra 08–11 (İstanbul 10–13). Gömülü tarayıcıda kuruldu; **bu tarayıcının IndexedDB'si oturumlar arasında iki kez silindi** — kalıcı kullanım için kullanıcının kendi tarayıcısına (localhost:5173) taşınması önerildi, cevap bekleniyor.
- **Paper için gerekenler:** MT5 açık + köprü + `npm run dev -w @trw/web` + uygulama açık bir sekme. Sürekli açık olması şart değil: tekrar bağlanınca son ~2 haftaya kadar (20.000 mum) eksik dakikalar doldurulur ve oturum baştan, aynı motorla yeniden değerlendirilir.
- **MT5 köprüsünü çalıştırma:** MT5'te demo hesaba giriş yap, Piyasa Gözlemi'nde EURUSD görünsün, sonra `py tools/mt5-bridge/bridge.py`. Detay: `tools/mt5-bridge/README.md`.
- **M6.4 (Kavram kütüphanesi):** tamamlandı (plan `docs/PLAN-M6-4.md`, karar D40). "Kavramlar" sekmesi: 6 kavram; sade açıklama, motor tanımı, gerçek veriden örnekler, "beklendiği gibi gitmedi" ölçümü (outcome-v1, N ayarlanabilir), sınırlar; "Grafikte göster".
- **M6.4 iyileştirme listesi:** (1) gösterilen örneği grafikte vurgulamak (şu an yalnızca o ana gidiyor); (2) önceki gün/hafta ve seanslar için ölçüt; (3) kavramdan doğrudan strateji adımı oluşturma.
- **2026-10-06 — Proje paketi (D42):** Kullanıcının `PROJE-PAKETI.md` dosyası projeye yerleştirildi (yeni CLAUDE.md, AI bot taslağı, M9 görev dosyası, `catalog/`). Onaylanan sıra: **M7.2 yedek/dışa aktarma → M8 indikatörler → M9 formasyon kataloğu → M10 çizim 2. aşama → M11 AI/quant bot.** Push artık oturum sonunda Claude tarafından yapılıyor. Kullanıcı her adımın önce birlikte onaylanmasını istiyor.
- **M8 (İndikatörler):** SMA, EMA, RSI, ATR, MACD, Bollinger, VWAP tamamlandı (karar D44–D46). `packages/engine/src/features/indicators.ts`; `Bars` tipine hacim (`v`) eklendi. **Grafiğe bağlandı (D46):** araç çubuğunda "İndikatörler" paneli (aç/kapat + period), fiyat panelinde SMA/EMA/Bollinger/VWAP, ayrı alt panelde RSI ya da MACD; tercihe kayıtlı. **Doğrulandı (2026-10-07):** Kullanıcı MT5'i açtı, gerçek EURUSD verisiyle tarayıcıda denendi — SMA/Bollinger/VWAP fiyat panelinde, RSI/MACD ayrı panelde doğru çizildi, sayfa yenilenince korundu. Strateji adımlarına bağlama henüz yok.
- **M9 1. dilim (Doji, Engulfing, Marubozu):** tamamlandı (D48, plan `docs/PLAN-M9.md`). `packages/engine/src/patterns/` — M4'ten ayrı sistem. TA-Lib kuruldu, oracle olarak kullanıldı (`tools/oracle/talib_candles.py`); 85 sentetik + **20.000 gerçek EURUSD 1m bar**'da birebir eşleşme. 3 gerçek hata bulunup düzeltildi. Gerçek veride sıklık: Doji %15,3, Engulfing %20,8, Marubozu %6,8/1000 mum — nadir değiller. Katalogda bu 3'ün durumu `VERIFIED`.
- **M9 2.–4. dilim (SMC'nin 8 alt kavramı, motorda ve grafikte):** tamamlandı (D49–D51, plan `docs/PLAN-M9.md`). `packages/engine/src/features/{displacement,order-block,ifvg,breaker,equal-levels,premium-discount,ote,candidate-sr,smc}.ts` — mevcut M4 swing/yapı-kırılımı motoruna bağlı (katalogun ayrı sistemi değil); `computeSmc()` hepsini `FeatureSet`'ten bağımsız birleştirir (gerekçe D51). Katalogda bu 8'inin durumu `IMPLEMENTED` (oracle yok, resmi tanım yok). **Grafiğe bağlandı (D51):** "Katmanlar" panelinde 7 yeni aç/kapat katmanı (Order block, Ters FVG, Breaker, Eşit seviyeler, Premium/Discount, OTE, Aday S/D); gerçek Dukascopy EURUSD 1h verisiyle (gömülü tarayıcı) doğrulandı, konsol hatasız.
- **M9 5. dilim (24 mum formasyonu daha):** tamamlandı (D52, plan `docs/PLAN-M9.md`). TA-Lib'in resmi C kaynağından (github.com/TA-Lib/ta-lib) birebir port edildi — Belt-hold, Closing Marubozu, Spinning Top, High Wave, Short/Long Line, Gravestone/Dragonfly/Long-Legged Doji, Rickshaw Man, Harami(+Cross), Doji Star, Matching Low, Counterattack, Separating Lines, Kicking(+by Length), Piercing, Dark Cloud Cover, Homing Pigeon, Stick Sandwich, Upside Gap Two Crows, Two Crows — hepsi trend bağlamı gerektirmiyor. **Gerçek 736.706 barlık EURUSD 1m veriyle** doğrulandı: 21/24 tam eşleşme, 3'ünde ("equal" toleransı kullananlar) ~%0,3 kayan-nokta farkı (mantık hatası değil, belgelendi — D52). 2 gerçek hata bulunup düzeltildi (`bodyDoji`/`bodyShort` eşiklerinde `<` yerine `<=` olmalıydı, TA-Lib kaynağıyla doğrulandı). Katalogda 27/61 formasyon artık `VERIFIED`.
- **M9 6. dilim (kalan 34 mum formasyonu — katalog tamam):** tamamlandı (D53, plan `docs/PLAN-M9.md`). **Önemli keşif:** "trend bağlamı gerektirir" sanılan Hammer/Hanging Man/Shooting Star/Morning-Evening Star/3 White Soldiers/3 Black Crows ailesi TA-Lib'in resmi kaynağında (tag v0.8.1, kurulu pakete birebir denk) **hiç gerçek trend tespiti yapmıyor** — yalnızca mum geometrisine bakıyor, "trend" yorumunu kullanıcıya bırakıyor. `packages/engine/src/patterns/candlestick-trend.ts` (yeni dosya): 34 formasyon daha. **Gerçek 736.706 barlık veride** 33/34 tam eşleşme; 1 gerçek hata bulunup düzeltildi (Hanging Man'de `min`/`max` karışıklığı); Hikkake'nin sonraki-mum "onay" sinyali bilerek modellenmedi (yalnızca varlık+yön). **Katalog: 61/61 mum formasyonu `VERIFIED` — mum formasyonu kataloğu tamamen bitti.**
- **M9 7. dilim (grafik formasyonları başladı — 6 klasik dönüş formasyonu):** tamamlandı (D54, plan `docs/PLAN-M9.md`). Yeni aile, yeni mimari: `packages/engine/src/patterns/chart-shared.ts` (`pivotWindows`, `scanBreakout`, `lineAt`) + `chart.ts` — M4'ün swing motoru üzerine kurulu (kataloğun kendi `left=right=5` ayarıyla, çağıran taraf hesaplayıp parametre olarak geçiyor). 6 formasyon: İkili Tepe, İkili Dip, Üçlü Tepe, Üçlü Dip, Omuz Baş Omuz, Ters Omuz Baş Omuz. Onay zamanı kararı `features/structure.ts`'in emsalini tekrarlıyor: bir swing kendi onay barından önce kullanılmaz. **Doğrulama farklı:** bu ailede TA-Lib gibi bir oracle yok; sentetik pozitif/negatif sabitler + ileriye-bakmama testiyle (10 test, `packages/engine/test/patterns/chart.test.ts`) doğrulandı. Katalog durumu `VERIFIED` değil **`IMPLEMENTED`**.
- **M9 8. dilim (doğru-çizgi ailesi — 9 formasyon daha):** tamamlandı (D55, plan `docs/PLAN-M9.md`). `packages/engine/src/patterns/chart-lines.ts`: Yükselen/Alçalan/Simetrik Üçgen, Yükselen/Alçalan Kama, Yükselen/Alçalan Kanal, Dikdörtgen, Genişleyen Formasyon — her biri pivotlardan iki doğru uyduruyor (eğim + yakınsama/paralellik kontrolü). Yeni yardımcılar: `lineIntersection` (Simetrik Üçgen'in "apex"i), `scanDirectionalBreakout` (iki yönlü kırılım). Bir varsayım açıkça belirtildi: `parallel_tolerance`'ın ATR-oranlı olduğu kataloğun kendisinde yazmıyor, motor öyle uyguluyor (doğrulanmadı). Sentetik fikstürler ilk denemede 5 formasyonda boş sonuç verdi — sebep motor değil, test verisinin pivot yönlerini yanlış kurması; `detectSwings` çıktısı loglanarak teşhis edildi, fikstürler düzeltildi. **Doğrulama:** sentetik pozitif/negatif + 9'unun birlikte ileriye-bakmama testi (11 test, `packages/engine/test/patterns/chart-lines.test.ts`). Katalog durumu `IMPLEMENTED`.
- **M9 9. dilim (bayrak/flama ailesi — 3 formasyon daha):** tamamlandı (D56, plan `docs/PLAN-M9.md`). `packages/engine/src/patterns/chart-continuation.ts`: Boğa Bayrağı, Ayı Bayrağı, Flama — sert bir "direk" hareketi + ardından küçük bir konsolidasyon. Açıkça yazılan varsayım: katalog yalnızca 3-4 pivot verdiği için (gerçek bir 2-çizgi kanal/üçgenin ihtiyacından 1 az), kırılım çizgisi direk ucu + konsolidasyondaki tek pivottan kuruldu, karşı taraf o pivotun fiyatında düz bir geçersizleşme seviyesi (D56'da detaylı) — resmi kaynaktan doğrulanmadı. Flama kataloğunda yalnızca boğa yönlü tanım var, motor da yalnızca onu üretiyor. **Doğrulama:** sentetik pozitif/negatif + 3'ünün birlikte ileriye-bakmama testi (6 test, `packages/engine/test/patterns/chart-continuation.test.ts`). Katalog durumu `IMPLEMENTED`.
- **M9 10. dilim (Fincan-Kulp, Çanak Dip, Elmas — grafik formasyonu kataloğu tamam):** tamamlandı (D57, plan `docs/PLAN-M9.md`). Bu 3 formasyon kataloğun kendisinde "düşük güven/öznel" diye işaretliydi, "yuvarlaklık" için somut bir formül verilmemişti; kullanıcıya soruldu (`AskUserQuestion`), **parabol uyum skoru (R²)** seçildi. `packages/engine/src/patterns/chart-shared.ts`'e `roundness(bars,i0,i1)` eklendi (en küçük kareler parabolü + R² + eğrinin işareti); `packages/engine/src/patterns/chart-curve.ts`: Fincan-Kulp, Çanak Dip, Elmas. **Doğrulama iki katmanlı:** `roundness()` doğrudan test edildi (gerçek parabol→R²>0,99; düz-ortalamalı zikzak→R²<0,3) + dedektörler sentetik pozitif/negatif + 3'ünün birlikte ileriye-bakmama testiyle (10 test, `chart-curve.test.ts`). Bu resmi doğrulanmış bir tanım değil, öznel bir ölçü için kullanıcı onaylı bir mühendislik kararı. **Kayıt hatası düzeltildi:** D55'te koda/teste giren `broadening`'in katalog durumu yanlışlıkla `TO_IMPLEMENT` kalmıştı, bu dilimde fark edilip `IMPLEMENTED` yapıldı. **Katalog: grafik formasyonlarının 21/21'i `IMPLEMENTED` — grafik formasyonu kataloğu tamamen bitti.**
- **M9 11. dilim (harmonik formasyonlar — 8/9):** tamamlandı (D58, plan `docs/PLAN-M9.md`). `packages/engine/src/patterns/harmonic.ts`: Gartley, Kelebek, Yarasa, Alternatif Yarasa, Yengeç, Derin Yengeç, Cypher, AB=CD. **Shark bilerek atlandı** — katalog `BLOCKED_NEEDS_SOURCE` diyor, güvenilir kaynak bulunmadan uygulanmayacak (kural 8). Kataloğun kendi uyarısına uyularak, "unverified" etiketli 6 formasyonun oranları web araması ile bağımsız kaynaklara (LuxAlgo, HarmonicTrader.com, HowToTrade, TradingSim, LiteFinance, TradeJini) karşı çapraz kontrol edildi — hepsi eşleşti, tek istisna Yengeç'in `CD_BC` alt sınırı (katalog 2.24, bir kaynak 2.618; çözülmedi, not eklendi `catalog/patterns/harmonic.json`'a). Harmonikler mimari olarak grafik formasyonlarından farklı: kırılım/geçersizleşme/hedef yok, formasyonun kendisi D noktasında sinyal. Test yazarken bir kod hatası yakalandı: Kelebek'in `CD_BC: null` alanını (kontrol edilmiyor) ilk yazımda fark etmeyip rastgele bir aralık icat etmiştim — düzeltildi. Cypher'in `XD_XC` alanı iki okumaya açık, projenin kendi isimlendirme kuralıyla tutarlı "harfi harfine" okuma seçildi, kodda belirtildi. **Doğrulama:** el yazımı pozitif/negatif senaryolar (`fakeSwing`, OTE'nin test yöntemi) + 8'inin birlikte ileriye-bakmama testi (13 test, `harmonic.test.ts`). Katalog durumu `IMPLEMENTED`.
- **M9 12. dilim (SMC'nin 4/8 kavramı → EventStep):** tamamlandı (D59, plan `docs/PLAN-M9.md`). Kullanıcı bu noktada otonom çalışmaya onay verdi ("bana uzun bir süre sorma... hepsini peş peşe yap... sana güveniyorum gelince kontrol ederim"). `StepType` 4 yeni değerle genişledi: `ORDER_BLOCK`, `IFVG`, `BREAKER`, `OTE` (zaten `Detection` birleşiminde olan 4 kavram — tek yön + geçersizleşme fiyatı var). Kalan 4 kavram (Displacement, Eşit Seviyeler, Premium/Discount, Aday S/D) bilerek `EventStep` yapılmadı, D50/D51 ile aynı gerekçe. `findSetups()`/`BacktestInput`'a isteğe bağlı `smc: SmcSet` parametresi eklendi, mevcut çağrılar değişmedi. Arayüzde hiçbir özel form alanı gerekmedi (yön seçici zaten genel); `candle-source.ts` artık `computeSmc()`'yi backtest/kurulum bulucuya da besliyor, yoksa yeni adım türleri seçilebilir ama sessizce boş kalırdı. **Doğrulama:** matcher/schema testleri (11 yeni test) + gömülü tarayıcıda canlı doğrulama (Strateji Oluşturucu'da 4 yeni tür görünüyor, yön seçici çalışıyor, konsol hatasız).
- **M9 13. dilim (M6.4 kavram kütüphanesine SMC'nin 8 kavramı — M9 tamamen bitti):** tamamlandı (D60, plan `docs/PLAN-M9.md`). `apps/web/src/content/concepts.ts`'e 8 yeni `Concept`: Displacement, Order block, Ters FVG, Breaker, Eşit tepeler/dipler, Premium/Discount, OTE, Aday destek/direnç — içerik `docs/definitions/*-v1.md`'den (dosyanın kendi kuralı: tanım belgeleriyle senkron kalmalı). 4'ünde (Order block/IFVG/Breaker/OTE) "beklendiği gibi gitmedi" ölçümü de eklendi: `features/outcomes.ts`'in `OutcomeConcept`/`featureOutcomes()`'u isteğe bağlı `smc` parametresiyle genişledi (`candidateOutcome()` bu 4 türü zaten D49-50'den beri destekliyordu, yalnızca toplu sarmalayıcı eksikti). Arayüzde `ConceptsPageProps.data`'ya `smc: SmcSet` eklendi (App.tsx'teki `data` zaten yapısal olarak uyumluydu, çağıran tarafta değişiklik gerekmedi). **Doğrulama:** yeni engine testleri + gömülü tarayıcıda canlı kontrol (8 kavram Kavramlar sayfasında listede, Order block kartı tüm bölümleriyle doğru render ediyor, konsol hatasız). **M9 ve ona bağlı M6.4 işi burada tamamen bitti.** **Kalan (M9'un dışında, ayrı büyük işler):** olay deposu, canlı mod, strateji kataloğu, "en iyi aday" sıralaması, Shark (kaynak bulunursa) — hepsi onay bekliyor.
- **Strateji kataloğu — başladı, çoğu engelli (D61):** tamamlandı (plan `docs/AGENT-GOREV-M9-formasyonlar.md` Adım 7-8). Kullanıcı "strateji belirsizliği olarak ne yapabiliriz, düşün" dedi; incelemede asıl engelin belirsizlik değil **eksik motor yeteneği** olduğu ortaya çıktı: `catalog/strategies/*.json`'daki 6 taslağın 5'i `PATTERN_EVENT` (M9'un 107 bağlanmamış formasyon dedektörü), gösterge tabanlı koşullar (`EMA_TREND`/`ATR_MULTIPLE`/kayan pencere) ya da `RANDOM_ENTRY` kullanıyor — hiçbiri motorda yok. Her birine `engine_status: BLOCKED` notu eklendi. **Yalnızca `london_asia_sweep` kurulabildi**, 2 versiyon olarak (`packages/engine/src/catalog/strategies.ts`): `fvg` (displacement şartsız, kataloğun yazdığı gibi) ve `order_block` (D59'un ORDER_BLOCK adımı, displacement zaten zorunlu) — kataloğun kendi iki açık sorusunu "iki versiyon olarak test et" kuralıyla çözüyor (kataloğun başka yerlerde zaten kullandığı yöntem). Üçüncü soru (Asya saat dilimi) açık değildi: kataloğun notu projenin M2'den beri kullandığı gerçek `BUILTIN_SESSIONS` tanımından (Asia/Tokyo 09:00-18:00) önce yazılmış, proje tanımı kullanıldı. Ayrıca **rastgele giriş kıyaslaması** eklendi (`packages/engine/src/backtest/random-baseline.ts`, `randomEntryBaseline()` — sabit pip mesafeli stop + R katlı hedef + sabit tohumlu rastgele zamanlama, `core/rng.ts`'nin yeni `mulberry32`'siyle) — kataloğun "her stratejinin zorunlu karşılaştırması" dediği araç, "en iyi aday" sıralamasının (Adım 8) ön koşullarından biri. Test yazarken bir tasarım hatası bulundu ve düzeltildi: ilk sürüm her girişi kalan aralığın tamamından seçiyordu ("stick-breaking" önyargısı, istenen sayıdan az işlem üretiyordu) — düzeltme her çekilişi adil bir paya sınırladı. Strateji sayfasına "Katalogdan ekle" düğmesi eklendi. **Doğrulama:** yeni engine testleri + gömülü tarayıcıda canlı kontrol (katalogdan strateji eklendi, özet doğru, veri-yok uyarısı doğru çalıştı — hiçbir sonuç uydurulmadı, kural 1). **Kalan:** diğer 5 strateji (PATTERN_EVENT/gösterge desteği gerektiriyor — ayrı, büyük bir motor genişletmesi), olay deposu, canlı mod, "en iyi aday" sıralaması.
- **Olay deposunun ölçüm çekirdeği (D62):** tamamlandı (plan `docs/AGENT-GOREV-M9-formasyonlar.md` Adım 4). Adım 4'ün yalnızca **ölçüm yöntemi** kısmı kuruldu: `packages/engine/src/research/excursion.ts`, `detectionExcursions()` — `catalog/experiments/fvg_random_walk.py`'nin mantığından esinlenilerek MFE/MAE (onay kapanışından itibaren, beklenen yönde) + rastgele bir ANdan ölçülen "kontrol" karşılaştırması. Python betiğinin "aynı mesafedeki rastgele SEVİYE" fikri MFE/MAE'ye birebir uymadığı için farklı bir yorum seçildi (kodda açıkça gerekçelendirildi). `summarizeExcursions()` birçok raporu ufuk başına ortalıyor. **Kalıcı veri modeli (yeni IndexedDB şeması, event_id/durum/motor versiyonu ile saklama) ve "Olaylar" arayüzü bilerek bu dilimde yapılmadı** — projenin her yeni veri alanında yaptığı gibi kendi küçük karar turunu hak ediyor, kullanıcıya soruldu. **Doğrulama:** 6 yeni engine testi (MFE/MAE doğru birikiyor, yön doğru ayna, ufuk kapanmadan `null`, kontrol tohuma göre belirleyici).
- **"En iyi aday" sıralamasının kıyaslama çekirdeği (D63):** tamamlandı (plan Adım 8). Adım 8'in 6 ölçütünden 3'ü kuruldu: `packages/engine/src/research/ranking.ts`, `rankCandidates()` — (1) 30'dan az işlemli adaylar sıralamadan çıkarılıp en sona konuyor (`excludedLowSample`), (2) pozitif beklenen değer adayın kendisinden bağımsız kontrol ediliyor (`positiveExpectancy`), (3) rastgele giriş tabanına (D61) karşı fark + sabit tohumlu **bootstrap %95 güven aralığı** (`edgeR`/`edgeCI`). Girdi her zaman gerçek, önceden çalıştırılmış bir backtest'in işlem başı net R listesi — hiçbir sayı üretilmiyor. **Bilerek kapsanmayan 3 ölçüt** (kodda da belirtildi): "OOS'ta ≥100 işlem" eşiği (çağıran tarafın `BacktestRun.split.role` bilgisine bağlı), komşu parametre dayanıklılığı (M6.2'nin tarama aracıyla ayrı bir iş), yıl/enstrüman tutarlılığı (`BacktestStats.monthly`/`bySession` var, birleştirme ayrı iş); deneme sayısı zaten M6.2'de izleniyor, tekrar edilmedi. **Henüz gerçek kayıtlı strateji sonuçlarına (`trw-research`) bağlanmadı, arayüzü yok** — olay deposu gibi kendi küçük karar turunu (hangi çalışmalar karşılaştırılacak, UI nerede) hak ediyor. **Doğrulama:** 5 yeni engine testi.
**M8 tamamlandı (D47):** moving min/maks/toplam, lag, diff, yüzde değişim, z-score de motorda — genel seri dönüşümleri (`Bars` değil, herhangi bir sayı dizisi alır), henüz grafiğe/stratejiye bağlı değil.
- **M7.2 (Yedek ve dışa aktarma):** tamamlandı (plan `docs/PLAN-M7-2.md`, karar D43). Başlıkta "Yedek": JSON yedek indir, yedekten geri yükle (özet → onay, hiçbir şeyin üzerine yazmaz), günlük CSV, kalıcı depolama durumu ve isteği, 7 günlük hatırlatıcı; backtest raporunda "İşlemleri CSV indir". **Sırada: M8 indikatörler** (plan → kullanıcı onayı).
- **M7.1 (TradingView tarzı çizim araç takımı):** tamamlandı (plan `docs/PLAN-M7.md`, karar D41). Sol şeritte 6 grup, 23 araç; mıknatıs, çizimde kal, tümünü kilitle/gizle/sil, geri al/yinele (Ctrl+Z/Y). Dar ekranda şerit yatay satıra döner. Çizim 2. aşama artık M10.
- **Kullanıcının ürün hedefi (2026-10-05):** Strateji seçilince uygulama canlı veride koşulları kontrol edip grafikte/tabloda gösterecek, kuralların verdiği yönü, giriş/stop/hedefi ve lot miktarını söyleyecek; alım-satımı **kullanıcı kendisi** yapacak, uygulama asla işlem açmayacak. Arkasındaki AI/quant botu kullanıcı kesinleştiriyor.
- **Yol haritasında kalan:** AI araştırma asistanı. Kullanıcının sırası: yol haritasını bitir → eklemelere karar ver → sistemi toparla → başkalarıyla kullanıcı testi. Ürün hedefi "eğitim ve tavsiye botu": "tavsiye" kural 6 ile çelişir; başkalarına yatırım tavsiyesi Türkiye'de SPK lisansı gerektirebilir (doğrulanmadı) — kullanıcı testinden önce tekrar konuşulmalı.
- **Sonra:** AI araştırma asistanı (n8n / Langflow + YouTube); küçük işler (backtest işlemlerini grafikte göstermek, kurulumdan replay, strateji/hipotez arşivleme).
- Testler: **647 test yeşil** (92 dosya) + oracle: gerçek 736.706 barlık EURUSD 1m veri üzerinde ek doğrulama (commit edilmedi, tekrarlanabilir: `py tools/oracle/talib_candles.py` + bkz. D52–D53) + **7 köprü testi** (`npm run test:bridge`, Python 3.13.2). Tip kontrolü ve ESLint temiz. `prettier --check` yalnızca kullanıcının takip dışı `AGENTS.md` dosyasında uyarı veriyor.
- Git: `main` dalı; 2026-10-06'dan itibaren oturum sonunda Claude `git push` yapar (D42).

## M6.3'te yapılanlar
| # | Görev | Sonuç |
|---|---|---|
| 1 | Motor | `runBacktest` `keepOpenAtEnd` (paper): açık işlem/emir `result.open`'da, kapatılmaz |
| 2 | Köprü | `tools/mt5-bridge/bridge.py`: yalnız okuma, yalnız demo, 127.0.0.1, origin + Host kontrolü; sahte MT5 ile 7 test |
| 3 | Veri akışı | `engine/data/broker.ts` (ofset ölçümü, DST uyarısı, birleştirme) + `features/paper/mt5-feed.ts` (kendi veri kümesi, ilk 7 gün, sonra eksik dakikalar) |
| 4 | Depolama | `trw-research` v3 `paperSessions` |
| 5 | Arayüz | "Paper" sayfası: köprü durumu, elle / dakikalık güncelleme, sorun açıklamaları, oturum başlat/durdur, açık pozisyon + anlık R, kapanan işlemler; veri yokken de üst menü görünür |

Araştırma (kaynaklar sohbette): MT5 demo ücretsiz; MetaTrader5 Python paketi MIT, yalnız Windows x86-64; OANDA v20 API ücretsiz ama KYC gerekli, Türkiye durumu çelişkili.

## M6.3 iyileştirme listesi
1. Paper oturumunda elle işlem (replay işlem panelinin canlı kenarda kullanımı).
2. Paper işlemlerini grafikte göstermek; yeni kurulumda bildirim.
3. Broker'ın gerçek spread'ini tiklerden ölçüp maliyet önerisi olarak göstermek.
4. Köprüyü Windows açılışında otomatik başlatma (isteğe bağlı).
## M6.2'de yapılanlar
| # | Görev | Sonuç |
|---|---|---|
| 1 | Tarama motoru | `research/sweep.ts`: taranabilir parametreler, `applyParam`, sabit sıralı ızgara (≤ 2 eksen, ≤ 100), kombinasyon başına `specHash` |
| 2 | Hipotez modeli | `research/hypothesis.ts`: sabit test düzeni, doğrulama, out-of-sample kapısı, kanıtlı sonuç |
| 3 | Depolama | `trw-research` v2 `hypotheses`; çalışmalar hipotez ve varyantla |
| 4 | Çalıştırma | `runAndStore` (backtest paneli ve laboratuvar ortak); tarama sıralı, özellikler aynı parametrelerde yeniden kullanılır |
| 5–6 | "Araştırma" sayfası | Hipotez oluşturma, temel in-sample, tarama + ızgara, deneme sayacı, varyantı versiyon yapma, OOS kapısı (onaylı), sonuç + kanıt |
| 7 | Belgeler | D37–D38, sözlükte M6.2 |

Gerçek EURUSD verisiyle: hipotez "ICT Asya dibi süpürmesi → Londra MSS (TEST)"; hedef 1,5 / 2 / 3R × MSS penceresi 6 / 12 / 24 mum = 9 in-sample deneme, 1,9 sn. Bütün hücreler pozitif (+0,18…+0,55R) ama işlem sayıları 10–34; 2R / 12 hücresi D36 ile birebir aynı. **Out-of-sample açılmadı** (kullanıcının kararı). Ayrıntı D38.

## M6.2 iyileştirme listesi
1. Rastgele giriş karşılaştırması (aynı sayıda, sabit tohumlu rastgele işlem) — "kurallar rastgeleden iyi mi?" sorusu için.
2. Walk-forward (kayan pencereli in-sample / out-of-sample).
3. Tarama sırasında iptal düğmesi ve tahmini süre.
4. Hipotez silme / arşivleme.
## M6.1'de yapılanlar
| # | Görev | Sonuç |
|---|---|---|
| 1 | Motor | `validateSessionDefinition`, `allSessionDefs`; süpürme seviyeleri her seans tanımıyla (`<KİMLİK>_HIGH/_LOW`, aynı seans yeniden başlayana kadar) |
| 2 | Şema | `spec.sessions` kopyası, `BAD_SESSION` / `UNKNOWN_LEVEL`; eski hash'ler değişmedi; seans kırılımı tanımlardan; `ENGINE_VERSION` 0.4.0 |
| 3 | Depolama | `trw-user` v4 `sessions` (v3 verisi korunur, test) |
| 4 | Worker | `load` / `replay` kullanıcı seanslarını alır; seviyeler tanım kümesine göre önbellekte; strateji ve backtest kopyaları kullanır |
| 5 | Seans yöneticisi | "Seanslar…": ekle/düzenle/sil, ICT Asya / Londra KZ / NY KZ şablonları, renk, gerekçeli doğrulama; araç çubuğu ve grafikte |
| 6 | Oluşturucu | Kullanıcı seansı seviyeleri süpürme filtresinde; kayıtta kopyalanır; özet seansları listeler |
| 7 | Gerçek veri | D36 (aşağıda), belgeler |

Gerçek EURUSD verisiyle (in-sample 2024-10-01 → 2025-12-31, spread 0,2 / kayma 0,1 / komisyon 3,5):
- "Asya dibi süpürmesi + yükseliş MSS, Londra 08–11" kuralları yerleşik Asya ile **3 işlem** (D34), **ICT Asya aralığıyla 24 işlem**: kazanma %45,8, ortalama +0,31R, PF 1,52, maks. düşüş −6,37R / %3,08, maliyet 80,59 USD (D36).
- 30'dan az işlem ve tek deneme: kanıt değil. **Out-of-sample (2026) bilerek çalıştırılmadı**; kurallar in-sample'da kesinleştikten sonra kullanıcı bir kez çalıştırmalı.
- Gömülü tarayıcının IndexedDB'si oturumlar arasında yine boşalmıştı; veri yeniden içe aktarıldı. Tarayıcıda "(TEST)" adlı iki deneme stratejisi var.

## M6.1 iyileştirme listesi
1. Seans kutularının kalabalıkta üst üste binen etiketleri (M2 listesinden; kill zone'larla daha görünür oldu).
2. Strateji zaman penceresini bir seansa bağlama ("yalnız Londra kill zone içinde").
3. Kullanıcı seanslarında tatil günleri (tatil takvimiyle birlikte).
## M5'te yapılanlar
| # | Görev | Sonuç |
|---|---|---|
| 1 | Şema | `strategy/schema.ts`: tipli adımlar, giriş/stop/hedef, pencere, risk, günlük sınır, tanım parametreleri; doğrulama + uyarı; `specHash`; değişmez versiyon + durum geçmişi |
| 2 | Kurulum bulucu | `strategy/matcher.ts`: en erken aday zinciri, `maxBars`, pencere; kesme değişmezliği testi |
| 3 | Lot | `risk/sizing.ts`: USD pip değeri, aşağı yuvarlama, en küçük lot, çapraz atlanır |
| 4 | Backtest | `backtest/run.ts`: tek pozisyon, atlama nedenleri, süre dolması, aralık sonu, spread/kayma/komisyon, net R; determinizm testi |
| 5 | İstatistik | `backtest/stats.ts` + `backtest/record.ts` (kayıt, in/out-of-sample) |
| 6 | Depolama | `trw-strategy` (versiyonlar yalnızca eklenir), `trw-research` (çalışmalar) |
| 7 | Worker | `backtest()`, `setups()` worker'da, stratejinin kendi parametreleriyle |
| 8 | Strateji sayfası | Liste, oluşturucu (kod yok), versiyonlar, kural özeti, durum + not + geçmiş |
| 9 | Backtest ekranı | Form, dürüstlük kutusu, istatistik, bakiye eğrisi, R dağılımı, kırılımlar, işlem tablosu, kayıtlı çalışmalar, iki çalışma karşılaştırma |
| 10 | Grafik | "Kurulumları grafikte göster": rozet + işaretler; replay'de imlece kadar |
| 11 | Belgeler | Şema belgesi, D31–D34, sözlükte M5 |

Ek düzeltme: simülatör artık kaymayı stop-loss ve elle/aralık sonu çıkışlarına da uyguluyor (D8 ile uyum; `ENGINE_VERSION` 0.3.0).

Tarayıcıda gerçek EURUSD verisiyle (2 yıl) doğrulananlar:
- "Londra Asya-dip süpürme + MSS (TEST)" stratejisi (15m, Londra 08–11, piyasa girişi, stop süpürme ucu + 1 pip, 2R, %0,5) kuruldu; versiyon özeti ve içerik özeti doğru.
- In-sample (2024-10-01 → 2025-12-31, spread 0,2 / kayma 0,1 / komisyon 3,5) backtest **0,6 sn**; 3 işlem; dürüstlük kutusu "30'dan az" ve "1. in-sample deneme" uyarılarını gösterdi; 3. işlem aralık sonunda kapandı (+0,59R).
- Az işlemin sebebi motor değil tanım: yerleşik Asya seansı 09:00 UTC'de bitiyor (D34). Pencere olmadan aynı kurallar 40 kurulum veriyor.
- Gömülü tarayıcıda veri yeniden içe aktarıldı (kaynak adı doğru: "Dukascopy"). Deneme stratejisi "(TEST)" adıyla duruyor; strateji silme özelliği henüz yok.

## M5 iyileştirme listesi
1. **Özel seans tanımları** (ICT Asya aralığı 20:00–00:00 NY, Londra kill zone vb.) ve bunların süpürme seviyesi olarak kullanılması.
2. Strateji silme / arşivleme (versiyonlar ve çalışmalar kayıt olarak kalmalı; yalnızca listeden gizleme önerilir).
3. Backtest işlemlerini grafikte giriş/SL/TP çizgileriyle gösterme; işleme tıklayınca grafikte o ana gitme.
4. Seçilen backtest çalışmasından "replay'de bu kurulumdan başla".
5. Parametre taraması (yalnızca in-sample, deneme sayısı otomatik artar) ve sonuç ısı haritası.
6. Komisyonun para birimi seçimi, çapraz paritelerde ikinci veri kümesiyle lot hesabı.
## M4'te yapılanlar
| # | Görev | Sonuç |
|---|---|---|
| 1 | Tespit modeli + swing | `features/types.ts`, `features/bars.ts` (kapanmış mumlar + kapanış zamanı, `bucketEnds`), `features/swing.ts` |
| 2 | FVG | `features/fvg.ts`: yön, minimum boyut, dokunma/doldurma zamanı (`features/first-reach.ts` segment ağacı) |
| 3 | Yapı kırılımı | `features/structure.ts`: son onaylı swing, kapanış/fitil, BOS/CHoCH |
| 4 | Önceki gün/hafta | `features/periods.ts`: 17:00 NY günü/haftası, sonraki açık döneme kadar geçerli |
| 5 | Likidite + süpürme | `features/sweep.ts`: swing, PDH/PDL, PWH/PWL, seans seviyeleri; fitil + içeride kapanış |
| 6 | Birleştirme | `features/compute.ts`: `computeFeatures`, `featuresAsOf`; uçtan uca kesme değişmezliği (5m/15m/1h/4h) |
| 7 | Worker | Grafik verisinde `features`; replay `featuresAsOf(imleç)` gösterir (test) |
| 8 | Grafik | Aday katmanı primitive'i, "Motor adayları" düğmeleri (tercihlerde), işaret birleştirme/istifleme |
| 9 | Belgeler | 5 tanım belgesi, sözlükte M4 kavramları, D28–D30 |

Tarayıcıda gerçek EURUSD verisiyle doğrulananlar:
- Hesap süreleri: 15m 34 ms, 1h 12 ms, 1m 0,67 sn (736 bin mum); önceki gün/hafta 1,2 sn (bir kez).
- 15m'de 10 Mart 2026: PDH/PDL çizgileri, FVG kutuları, BOS/CHoCH, süpürme işaretleri ("Süpürme Asya D" gibi) doğru yerlerde.
- Replay'de adaylar yalnızca onaylandıkça beliriyor.
- Gömülü tarayıcıda senin seçimin (1 günlük veri kümesi, 1W) geri yüklendi.

Ek düzeltmeler: bilgi şeridindeki "eksik mum" notu artık taban zaman dilimini yazıyor (1h veri için "eksik 1h mum") ve oluşmakta olan mumda gösterilmiyor (M3 iyileştirme listesi 1. madde kapandı).

## M4 iyileştirme listesi
1. Parametreleri (swing L/R, FVG min boyut, kırılım CLOSE/WICK, süpürme yaşı) arayüzden değiştirme; değişiklik yeni tanım parametresi olarak kaydedilmeli.
2. Süpürmede "birkaç mum içinde geri dönüş" (`maxBarsToReclaim`) ve EQH/EQL (eşit tepeler/dipler).
3. Çoklu zaman dilimi adayları (ör. 15m grafikte 1h swing).
4. Adayın üstüne gelince tanımı ve onay zamanını gösteren ipucu (tooltip).
5. 1m görünümünde çok sayıda aday (300 bin+) worker'dan aktarılıyor; görünür aralığa göre aktarım.
## M3'te yapılanlar
| # | Görev | Sonuç |
|---|---|---|
| 1 | Replay görünümü | `replay/view.ts`: imlece kadar kapanmış 1m mumlardan grafik; kesilmiş veriyle birebir aynı (test) |
| 2 | İşlem simülatörü | `execution/trade-sim.ts`: piyasa/limit/stop, gap, spread, kayma, aynı mumda SL+TP (önce stop), emir süresi, elle kapatma, R, MAE/MFE; M5 backtest ile ortak |
| 3 | Günlük modeli ve istatistik | `user/journal.ts`: `JournalEntry`, `ReplayTrade`, karar anındaki seanslar, `tradeStats`, `filterJournal`, `summarizeJournal`, `journalResultOf` |
| 4 | Depolama | `trw-user` v3: `trades`, `journal`, `screenshots` |
| 5 | Replay modu | Başlangıç tarihi, ileri/geri, oynat/duraklat, hız (1/2/5 mum/sn), klavye (→ ← boşluk); worker yalnızca son mumu ve devam eden seansları hesaplar |
| 6 | İşlem paneli | Long/short, emir tipi, stop/hedef pip ya da fiyat (`execution/order-builder.ts`), emir süresi, spread/kayma (0 iken uyarı), anlık R, elle kapatma/iptal; grafikte Giriş/Emir/SL/TP çizgileri |
| 7 | Günlük formu | İşlem sonuçlanınca açılır, oynatma durur; seans, R, süre, MAE/MFE dolu; neden, duygu + şiddet, ders, etiketler, grafik ekran görüntüsü; "işlem yok" kararı |
| 8 | Günlük sayfası | Üst menü "Grafik / Günlük"; filtreler (enstrüman, karar, seans, sonuç, duygu, tarih); özet istatistik, 30 altı uyarısı, belirsiz mum notu; ayrıntı + ekran görüntüsü; onaylı silme |
| 9 | Belgeler | Sözlükte M3 kavramları, D26–D27, PLAN-M3 durumu |

Tarayıcıda gerçek EURUSD verisiyle (2 yıl, 1m) doğrulananlar:
- 10 Mart 2026'dan replay: adım, oynatma, 15m ↔ 4H geçişi; oluşan 4H mumu "henüz kapanmadı" olarak işaretli; bitmiş/devam eden seans kutuları doğru.
- Long piyasa emri 0,2 pip spread ile doldu, stop'ta −1,00R kapandı; çizgiler etiketli.
- Short emri sonuçlanınca oynatma durdu, form açıldı ("seans dışı" doğru: 21:00–00:00 UTC arası seans yok), kayıt ve 46 KB PNG ekran görüntüsü kaydedildi; günlük sayfasında görüntü yüklendi; silme çalıştı.
- Deneme kayıtlarım (2 işlem, 1 günlük kaydı) tarayıcıdan silindi. Gömülü tarayıcıda EURUSD 2 yıllık veri kümesi duruyor; kaynak adı yanlışlıkla "DukascopyDukascopy" yazıldı (yalnızca etiket, veri doğru).

## M3 iyileştirme listesi
1. ~~Bilgi şeridinde oluşan mumun eksik mum sayısı~~ (M4'te düzeltildi).
2. Replay işlemlerini veri kümesi değişince otomatik kapatmak (şu an işlem son haliyle `trades` içinde kalıyor).
3. Günlük kaydı silinince bağlı işlemin `journalId` alanını temizlemek.
4. Birden fazla eş zamanlı işlem, breakeven, kısmi kâr (kapsam dışıydı).
5. Özetin günlüğe yazılmamış replay işlemlerini de kapsaması seçeneği.
6. Replay başlangıcında saat seçimi (şu an günün başı, görüntüleme saat diliminde).

## M2'de yapılanlar
| # | Görev | Sonuç |
|---|---|---|
| 1 | Seans motoru | `session/sessions.ts`: Asya (Tokyo), Londra, New York yerel saatle; DST'ye uygun UTC; gece yarısını aşan seanslar; kapalı günler atlanır |
| 2 | Seans seviyeleri | `session/levels.ts`: 1m'den high/low, `complete`/`knownAt`; kesme değişmezliği testi (lookahead yok) |
| 3 | Seans kutuları | Hesaplama worker'ı seansları da döndürür; ENGINE katmanı primitive'i; seans aç/kapa (tercihlerde kalıcı); 1D/1W'de gizli |
| 4 | Koordinatlar | `chart/coords.ts` (zaman ↔ konum), `chart/lwc-coords.ts` (LWC 5.2.1'in kesirli konum hatasına karşı ara değer) |
| 5 | Çizim modeli ve depo | `user/drawings.ts` (motor); `trw-user` v2 (`drawings`, `levels`); çizim silinince seviyesi de silinir |
| 6 | Çizim araçları | Yatay çizgi, trend, bölge, fiyat aralığı, long/short; tıklayarak oluşturma (önizlemeli), seçme, tutamak sürükleme, Delete/Esc |
| 7 | Destek/direnç | Yan panel: renk, not, pozisyon fiyatları, seviye türü/zaman dilimi/durum ve durum geçmişi; seviye listesi |
| 8 | Görünür aralık | Zaman dilimi değişince aynı zaman aralığı görünür kalır; ilk açılışta son 150 bar |
| 9 | Belgeler | `docs/definitions/session-v1.md`, sözlükte M2 kavramları, D23–D25 |

Tarayıcıda gerçek EURUSD verisiyle doğrulananlar:
- 16 Mart 2026 haftası (ABD yaz saatinde, İngiltere değil): kutular doğru saatlerde.
- Kutular ve çizimler 15m ↔ 1h geçişinde aynı zaman ve fiyatta kalıyor.
- Hızlı ardışık tıklamalarla beş çizim türü oluşturuluyor.
- Tutamak sürükleme kaydediliyor ve sürüklerken grafik kaymıyor.
- Seviye kaydı ve durum değişikliği çalışıyor.
- Sayfa yenilenince çizimler korunuyor.

Bulunan ve düzeltilen hatalar:
- `logicalToCoordinate` kesirli konumda 0 döndürüyordu; kutular görünmüyordu (D24).
- Grafik kütüphanesi hızlı ikinci tıklamayı yutuyordu (D25).
- Zaman dilimi değişince grafik baştan kuruluyor ve sona sıçrıyordu.
- Vite HMR'nin eski bir modülü önbellekte tutması: geliştirme sırasında sayfa boş kalırsa sunucuyu yeniden başlat.

## M2 iyileştirme listesi
1. Seans kutusu etiketleri kalabalık yerlerde üst üste biniyor; yer yoksa etiketi atla.
2. Çizimin tamamını sürükleyerek taşıma (şu an yalnızca tutamaklar).
3. Özel seans tanımları (ör. ICT Asya aralığı 20:00–00:00 NY) için arayüz.
4. Seviye durumunu fiyata göre otomatik önermek ("kırılmış olabilir"). M4'ün aday mantığıyla birlikte, öneri olarak; kesin karar değil.
5. 1m görünümünde görünür aralığa göre veri vermek (M1 listesinden).

## Veri ve ortam notları
- **Veri (git dışı, `data/`):** `eurusd_m1_bid_2024-10-01_2026-09-30.csv` (38,7 MB, 736.706 mum), `xauusd_m1_bid_2024-10-01_2026-09-30.csv` (38,1 MB, 708.763 mum), karşılaştırma için `*_h1_*` dosyaları. Gün önbelleği: `data/.dukascopy-cache/` (730/730 gün, iki enstrüman).
- **Ağ notu:** Bazı ağlarda (ör. 2026-10-01 kafe Wi-Fi) Dukascopy alan adları idari tedbirle erişime kapalı ("erişime engellenmiş" sayfası). Kalan indirme, kullanıcının kendi bağladığı VPN üzerinden tamamlandı.

## Görev 13: gerçek veriyle kabul (2026-10-01)
**Uygulamada (gömülü tarayıcı, EURUSD 2 yıl, 1m):** okuma 1,0 sn; analiz 1,8 sn; kayıt 1,3 sn; ilk grafik 1,1 sn. Zaman dilimi geçişleri: 4H ≈ 0,6 sn, 1D ≈ 0,6 sn, 1h ≈ 1,9 sn, **1m ≈ 7,6 sn** (736 bin mum tek seferde; iyileştirme listesinde).

**Sayısal kabul:** 1m'den üretilen 4H/1D mumları, Dukascopy'nin kendi 1h verisinden üretilenlerle karşılaştırıldı (OHLC birebir).
| | 4H aynı | 1D aynı |
|---|---|---|
| XAUUSD | 3078 / 3094 (%99,5) | 510 / 517 |
| EURUSD | 2872 / 3091 (%93) | 444 / 521 |
Farklar yeniden örneklemeden değil, **kaynaktan** geliyor. Örnek: XAUUSD 2025-01-16 02:00'da 1m verisinin ilk dakikası 2695,919 ile açılıyor; Dukascopy'nin kendi 1h mumu ise 2697,705 (02:02'nin açılışı) diyor. EURUSD farkları Ekim 2024'te (neredeyse her mum 1–3 puan) ve 2–6 Aralık 2024'te yoğunlaşıyor.

**Kaynak veri kalitesi bulguları (Dukascopy):**
- **EURUSD 2024-10-10:** 617 dakikada OHLC kendi içinde tutarsız. Ham JSON elle çözülerek doğrulandı; kesirli delta değerleri var. İçe aktarmada `DROP_INVALID_PRICES` kabul edilerek çıkarıldı.
- **EURUSD 2–6 Aralık 2024:** 1 dakikalık veride günde 1 mum var, 1h veride 24 saat tam. Taze indirme de aynı sonucu verdi. Gelecekte tick verisinden yeniden oluşturulabilir.
- **Tatiller** (25 Aralık, 1 Ocak, Paskalya öncesi Cuma, ABD tatillerinde altının erken kapanışı): piyasa kapalı, ama tatil takvimi henüz modelde yok; "boşluk" olarak raporlanıyor.
- **EURUSD'de 2.136 küçük boşluk:** çoğu 1 dakikalık sessiz an. Araç sıfır hacimli "düz" dakikaları dışarıda bırakıyor (`--flats` kapalı).
- **XAUUSD:** düzeltme gerektirmedi.

## İyileştirme listesi (M1 sonrası, önceliğe göre)
1. 1m görünümünde yalnızca görünür aralığı grafiğe vermek (7,6 sn → hedef < 1 sn).
2. Tatil / erken kapanış takvimi (boşluk raporunu sadeleştirir; M2 session engine ile birlikte).
3. 2–6 Aralık 2024 EURUSD boşluğunu tick verisinden doldurma (isteğe bağlı).
4. Sıfır hacimli dakikaları (flats) "beklenen" olarak ayırmak.

## M1'de yapılanlar
| # | Görev | Sonuç |
|---|---|---|
| 1 | İskelet | npm workspaces (`packages/engine`, `apps/web`), TS 6 strict, Vitest, ESLint (motor saflık kuralları testli), Prettier, README, NOTICE |
| 2 | Zaman / saat dilimi | `core/timeframe.ts`, `core/tz.ts`: DST boşluk ve çakışmaları raporlanır; ofsetler 15 dk dilimlerde önbelleklenir |
| 3 | Enstrümanlar | `instruments/registry.ts` (EURUSD, GBPUSD, USDJPY, XAUUSD); tick üzerinden kesin pip hesabı; `instruments/hours.ts` (hafta sonu, altın günlük arası) |
| 4 | CSV ayrıştırma | `data/csv-rows.ts`: tarih kalıbı ve kolon eşlemesi ayarlanabilir, başlıktan tahmin edilir; hatalı satırlar satır numarasıyla raporlanır |
| 5 | Doğrulama | `data/validate.ts`: tekrar, sıra, boşluk (beklenen / beklenmeyen), kapalı piyasa mumu, fiyat hataları, tick hassasiyeti |
| 6 | Normalizasyon | `data/normalize.ts`: yalnızca kullanıcının kabul ettiği düzeltmeler uygulanır; SHA-256 içerik özeti (`data/columnar.ts`) |
| 7 | Yeniden örnekleme | `data/resample.ts`: 1m → 5m…1W, sınırlar 17:00 NY; `sourceCount/expectedCount`, `complete` |
| 8 | Arayüz iskeleti | koyu tema, `i18n/tr.ts`, boş durum ekranı (veri yoksa sonuç yok) |
| 9 | Depolama | Dexie: `trw-market` (sütunlu parçalar), `trw-user` (tercihler) |
| 10 | İçe aktarma sihirbazı | worker'da: oku → kolon eşleme → doğrulama raporu → düzeltme onayları → kaydet |
| 11 | Grafik | Lightweight Charts 5.2.1: mum + hacim, UTC ile beslenir, etiketler seçilen saat diliminde, bilgi şeridi (eksik / kapanmamış mum uyarısı) |
| 12 | Araç çubuğu | veri kümesi, zaman dilimi (≥ taban), saat dilimi (İstanbul, Londra, New York, Tokyo, UTC), tarihe git; tercihler kalıcı |
| ek | Hesaplama worker'ı | yükleme ve yeniden örnekleme worker'da; arayüz donmaz |

Tarayıcıda doğrulananlar (sentetik test verisiyle, sonra silindi):
- içe aktarma akışı;
- 15m, 4H ve 1D görünümleri;
- 1 Kasım 2026 ABD saat değişimi hafta sonunun "beklenen boşluk" olarak tanınması;
- 4H mumlarının NY saatiyle 17/21/01… hizalanması;
- 1D mumlarında boş Pazar mumu oluşmaması;
- tarihe git;
- tercihlerin sayfa yenilemede korunması;
- 375 px telefon genişliğinde yatay kaydırma olmaması.

## Arşiv (M1): Dukascopy web aracı notları
Dukascopy web aracı 2026-09-30'da incelendi (https://widgets.dukascopy.com/en/historical-data-export).
**Kısıt (2026-10-01'de doğrulandı):** Period "Minute" iken yalnızca **tek gün** seçilebiliyor. Period "Hour" iken tarih aralığı açılıyor ama **en fazla tam 1 ay** seçtiriyor (takvimde başlangıçtan 1 ay sonrası dışındaki her gün devre dışı/gri). Yani 2 yıllık saatlik veri için ~24 aylık dosya, 2 yıllık 1 dakikalık veri için ~520 günlük dosya gerekiyor.
Alanlar: enstrüman listesi → Export → Period (sayı + Tick/Second/Minute/Hour), Date, Timezone (UTC, Local time, şehirler), Offer side (Bid/Ask) → Download.
Doğrulanmayanlar: indirmenin giriş gerektirip gerektirmediği, saat aralığının üst sınırı, CSV'nin kolon ve tarih biçimi.

Önerilen kabul yolu (kullanıcı onayı bekleniyor, D14'ü değiştirir):
1. EUR/USD, **1 Hour**, son 2 yıl, **UTC**, **Bid** → tek dosya. Taban zaman dilimi 1h olarak içe aktarılır.
2. EUR/USD, **1 Minute**, tek bir gün (örn. bir Salı), UTC, Bid → 1m biçimini ve 1m→15m/1h/4H yolunu doğrulamak için.
3. Aynısını XAU/USD için tekrarla.
4. Doğrulama raporlarının ekran görüntüleri → 4H mumları Dukascopy'nin kendi grafiğiyle karşılaştırılır.

Uzun 1m geçmişi için seçenekler (karar bekliyor):
- (a) JForex demo hesabı → Historical Data Manager: aralıkla 1m dışa aktarımı mümkün görünüyor; doğrulanmadı.
- (b) Birden çok günlük dosyayı tek veri kümesinde birleştirme özelliği.
- (c) Otomatik veri adaptörü: CLAUDE.md gereği ayrı faz; önce kullanım koşulları kontrol edilir.

## Açık konular / doğrulanmamışlar (M1'den; CSV biçimi D22 ile kesinleşti)
- **Dukascopy CSV biçimi** (kolonlar, tarih biçimi, hafta sonu düz mumları): ilk gerçek dosyayla netleşecek. Biçim tanınmazsa sihirbazdaki kolon eşlemesi elle ayarlanabilir.
- **Birden çok dosyayı birleştirme** yok. Dukascopy web aracı 1m veriyi günlük veriyor (yukarıya bak).
- **Grafik tick yerleşimi:** Lightweight Charts ana tick'leri UTC gün sınırlarına göre seçiyor. Etiketler seçilen saat diliminde doğru, ama "gün" tick'i yerel gece yarısına denk gelmeyebilir. Özel yatay ölçek alternatifi doğrulanmadı.
- **Altın (XAUUSD) tick hassasiyeti** 0.001 varsayıldı. Gerçek veride daha ince fiyat varsa doğrulama raporu gösterecek.
- **1m görünümünde çok büyük veri:** 750 bin mumu grafiğe tek seferde vermek yavaş olabilir. Gerçek veriyle ölçülecek; gerekirse görünür aralık yüklenir.
- Üretim paketi 530 kB (uyarı). Yerel uygulama için şimdilik kabul edildi.
- PLAN §5'teki `ValidationReport` taslağı değişti; güncel hali DECISIONS D19'da.

## Sonraki adım
1. Kullanıcı MT5 demo hesabını açar ve "MT5 hazır" der.
2. Onay alınınca `py -m pip install MetaTrader5`; köprü çalıştırılır; Paper → Şimdi güncelle; ölçülen ofset ve ilk veri kontrol edilir (Dukascopy ile birkaç mum karşılaştırması); bir paper oturumu başlatılır.
3. `git push` (kullanıcı).

## Çalıştırma ve test komutları
```bash
npm install        # bağımlılıkları kur (ilk seferde)
npm run dev        # uygulamayı başlat → http://localhost:5173
npm test           # tüm testler (Vitest)
npm run lint       # ESLint + Prettier kontrolü
npm run typecheck  # TypeScript kontrolü
npm run test:bridge  # MT5 köprüsü testleri (Python, MT5 gerekmez)
npm run build      # üretim derlemesi
```

## Ortam
- Node v22.17.0, npm 11.1.0, git 2.56.0 (Windows 11), 8 GB RAM.
- Veri tarayıcının IndexedDB'sinde durur (`trw-market`, `trw-user`). Tarayıcı verilerini silersen içe aktarılan veriler de silinir; CSV dosyalarını sakla.
