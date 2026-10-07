# Karar Kayıtları (DECISIONS)

Her karar kısa ADR biçimindedir: bağlam, karar, sonuç. Bir karar değişirse eski kayıt silinmez; "Geçersiz kılındı: Dxx" notu düşülür ve yeni kayıt eklenir. Ayrıntılı gerekçeler için bkz. `docs/PLAN.md`.

---

## D1 — Grafik kütüphanesi: TradingView Lightweight Charts™ v5.x
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi
- **Bağlam:** Kendi CSV verimizi besleyebilmemiz, kendi overlay ve çizim araçlarımızı yazabilmemiz ve kişisel projede yasal olarak kullanabilmemiz gerekiyor.
- **Karar:** Lightweight Charts (Apache 2.0). Advanced Charts ve Trading Platform, resmi dokümana göre kişisel, hobi ve öğrenim kullanımına verilmediği için elendi. Gömülü widget'lar yalnızca TradingView verisi gösterdiği için elendi.
- **Sonuç:** Çizim araçları ve aday katmanları plugin API ile (series ve pane primitive) kendimiz yazılır; resmi plugin örnekleri referans alınır. Atıf: `attributionLogo` açık kalır, NOTICE metni README'de ve Hakkında ekranında yer alır. Doküman sürümü 5.2; kurulumda npm sürümü doğrulanacak.
- **Doğrulanmadı:** primitive `hitTest` ayrıntıları (M2 başında) ve özel yatay ölçek davranışı (M1 görev 11).

## D2 — Stack: TypeScript + npm workspaces + Vite + React + Vitest
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi
- **Karar:** CLAUDE.md varsayılan stack'i korunur. Monorepo aracı olarak pnpm yerine **npm workspaces** kullanılır (makinede pnpm yok; ek araç gerekmiyor). Yapı: `packages/engine` (saf TS) ve `apps/web` (Vite + React).
- **Bağımlılıklar (lisans):** typescript (Apache-2.0), vitest (MIT), luxon (MIT), zod (MIT), @noble/hashes (MIT), vite ve @vitejs/plugin-react (MIT), react ve react-dom (MIT), lightweight-charts (Apache-2.0), papaparse (MIT), dexie (Apache-2.0), fake-indexeddb (dev, Apache-2.0), eslint, typescript-eslint ve prettier (dev, MIT).
- **Bilerek eklenmeyenler:** durum yönetimi kütüphanesi, CSS framework'ü, i18n kütüphanesi (tek `apps/web/src/i18n/tr.ts` yeter).

## D3 — Saat dilimi: Luxon, tüm zamanlar UTC ms
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi
- **Karar:** Tüm zaman damgaları `UtcMs` (Unix epoch ms) olarak saklanır. IANA dönüşümleri ve DST hesabı Luxon ile yapılır; sabit ofset yazılmaz. CSV içe aktarımında yaz/kış saati geçişi yüzünden belirsiz ya da hiç var olmayan yerel saatler **raporlanır**, tahminle çözülmez.
- **Risk:** Node ve tarayıcıdaki tzdata sürümü farklı olabilir (R4); motor sürüm kaydında not edilir.

## D4 — Depolama: dört ayrı IndexedDB veritabanı
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi
- **Karar:** `trw-market`, `trw-user`, `trw-strategy`, `trw-research`. Eğitim içeriği repoda statik dosya olarak durur. Erişim Dexie ile yapılır. Sunucu yok.

## D5 — Yalnızca taban zaman dilimi saklanır; diğerleri türetilir
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi
- **Karar:** İçe aktarılan taban seri (tercihen 1m) sütunlu parçalar halinde saklanır. 5m…1W mumları deterministik yeniden örneklemeyle üretilir ve kalıcı olarak saklanmaz. 4H ve 1D sınırları `instrument.dailyClose`'a hizalanır. Eksik dakikalar `sourceCount/expectedCount` ile, tamamlanmamış son mum `complete:false` ile işaretlenir.
- **Açık:** Günlük kapanış saati (Soru 3).

## D6 — Strateji versiyonu değişmez, durum (status) değişebilir
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi
- **Karar:** `StrategyVersion.spec` ve `specHash` kaydedildikten sonra değişmez; kural değişikliği yeni versiyon oluşturur. Yaşam döngüsü durumu (`IDEA → … → LIVE_CANDIDATE`) spec dışında tutulur, değişebilir, geçmişi ve kanıt olan backtest kayıtları (`evidenceRunIds`) saklanır.

## D7 — Lookahead engeli: onay zamanı modeli ve kesme değişmezliği testi
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi
- **Karar:** Her tespit `formedIndex` ve `confirmedIndex` taşır. Matcher, `i` mumunda yalnızca `confirmedIndex ≤ i` olan tespitleri görür; emir en erken `i+1` mumunda aktif olur. Grafik, replay ve backtest tek bir `computePipeline` fonksiyonunu tüketir. Her feature için kesme değişmezliği testi zorunludur. Motorda `Date.now`, argümansız `new Date()`, `Math.random`, DOM ve ağ global'leri lint ile yasaktır.

## D8 — Aynı mumda SL/TP: varsayılan STOP_FIRST, giriş mumu kötümser
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi
- **Karar:** Seçenekler: `STOP_FIRST` (varsayılan), `TARGET_FIRST`, `LOWER_TF_ELSE_STOP_FIRST`. Giriş mumunda stop aralıktaysa stop kabul edilir; TP o mumda sayılmaz (düşük TF verisi varsa oradan çözülür). Etkilenen işlemler `ambiguous:true` alır ve sonuçta sayıları raporlanır. Gap durumunda stop ve SL açılıştan dolar; limit emirler, açılış daha iyi fiyattaysa açılıştan dolar. Kayma yalnızca market ve stop dolumlarına uygulanır.

## D9 — Grafik UTC ile beslenir, etiketler seçilen saat diliminde biçimlenir
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi (M1 görev 11'de deneyle teyit edilecek)
- **Bağlam:** Lightweight Charts saat dilimini desteklemiyor. Resmi öneri zaman damgasını kaydırmak, ama sonbahar DST gecesinde kaydırılmış zamanlar tekrar eder ve kütüphane kesin artan zaman bekler.
- **Karar:** Seriye UTC zaman verilir; eksen ve crosshair etiketleri `localization.timeFormatter` ve `tickMarkFormatter` ile seçilen IANA diliminde biçimlenir. Özel yatay ölçek alternatifi M1'de araştırılır.

## D10 — Strateji şeması v0
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi (taslak; M5'te kesinleşir)
- **Karar:** Tipli, sıralı adımlar; `within { after, maxBars }` pencereleri; referans sözdizimi `stepId.field` ya da `level.NAME`; birden fazla aday varsa en erken onaylanan seçilir. Tam tanım, doğrulama kuralları ve ifade edilemeyen durumlar: `docs/PLAN.md` §6.

## D11 — Günlük mum kapanışı: 17:00 New York
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi (kullanıcı kararı)
- **Karar:** FX enstrümanlarında `dailyClose = { time: "17:00", tz: "America/New_York" }`. Kapanış yaz/kış saatiyle UTC'de kayar (EDT'de 21:00 UTC, EST'de 22:00 UTC). 4H mumlar bu sınıra hizalanır (NY saatiyle 17, 21, 01, 05, 09, 13). Haftalık mum Pazar 17:00 NY'de açılır.
- **Sonuç:** "Önceki gün high/low" bu gün tanımına göre hesaplanır. Ayar enstrüman başına değiştirilebilir kalır.

## D12 — Veri kaynağı: Dukascopy (1m, BID; ASK isteğe bağlı)
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi (kullanıcı kararı)
- **Karar:** MVP verisi Dukascopy'nin geçmiş veri dışa aktarımından alınan 1 dakikalık CSV'dir. Birincil seri **BID**'dir. Aynı dönemin **ASK** dosyası da indirilebilirse ayrı bir veri kümesi olarak eşlenir; M5'te sabit spread yerine veriden gerçek spread hesaplamak için kullanılır. Kaynak adı metadata'da "Dukascopy" olarak saklanır.
- **Kullanıcının sorumluluğu:** Dukascopy hesabı ve indirme işlemi kullanıcı tarafından yapılır; kullanım koşullarını kullanıcı okur. Veri dosyaları GitHub'a **gönderilmez** (`.gitignore`).
- **Doğrulandı (2026-10-01, gerçek dosyalarla):** Web aracı (widgets.dukascopy.com/en/historical-data-export) hesap istemiyor. Timezone seçeneklerinde `UTC` var. CSV başlığı `Etc/UTC,Open,High,Low,Close,Volume`, tarih biçimi ISO 8601 ve ofset içeriyor (`2026-10-01T00:00:00+00:00`). Volume büyük tam sayılar (birimi doğrulanmadı). Motor bu biçimi `ISO_8601` olarak okur; 1m ve 1h örnek dosyalar temiz doğrulandı.
- **Kısıt:** "Minute" periyodu tek gün, "Hour" periyodu en fazla 1 ay indirir. Uzun geçmiş için bkz. DEVIR "Uzun 1m geçmişi".
- **Hâlâ doğrulanmadı:** hafta sonu "düz mum" davranışı (örnek dosyalar hafta içi).
- **Alternatif (elendi):** HistData.com (kayıtsız, yalnızca BID, sabit UTC−5). Kullanıcı daha kaliteli kaynağı tercih etti.

## D13 — Başlangıç enstrümanları: EURUSD ve XAUUSD
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi (kullanıcı seçimi Claude'a bıraktı)
- **Karar:**
  - **EURUSD:** pip 0.0001, tick 0.00001, kontrat 100 000 birim, FX 24/5.
  - **XAUUSD:** pip **0.1** (varsayılan, ayarlanabilir), kontrat 100 ons (broker'a göre değişir, ayarlanabilir), tick veri hassasiyetinden doğrulanır. İşlem saatleri 24/5, ama New York 17:00–18:00 arası günlük ara var; doğrulama bu boşluğu "beklenen" sayar.
  - Endeks yok.
- **Gerekçe:** İki enstrümanın da kote parası USD. Lot hesabı çapraz kur gerektirmez, böylece R5 riski bu aşamada yok. Registry'ye GBPUSD, USDJPY ve EURGBP de yazılabilir, ama yalnızca risk hesabı testleri için (USD baz ve çapraz parite durumları); veri yüklenmeyecek.

## D14 — Veri hacmi: son 2 yıl, 1m
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi
- **Karar:** Enstrüman başına son 2 yılın 1 dakikalık verisi. Tahmin: 2 yılda enstrüman başına ≈ 750 bin mum; 8 GB RAM'li cihaz için yeterince küçük. Performans M1 görev 11'de ölçülür; sorun yoksa ileride 5 yıla çıkılabilir.

## D15 — Sürüm kontrolü: git + GitHub
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi; repo görünürlüğü açık soru
- **Karar:** Uzak repo `https://github.com/yusufedali7/Trading_for_future.git`, dal `main`. Her görev bitip testler geçtiğinde küçük bir commit yapılır ve push edilir. Veri dosyaları (`data/`, gerçek `*.csv`) repoya girmez; yalnızca `SYNTHETIC_*.csv` test fixture'ları girer.
- **Açık:** Repo şu an **public**. Önerilen private. Public kalırsa commit'lerdeki yazar e-postası herkese görünür.

## D16 — Kurulan sürümler; TypeScript 6.0 (7 değil)
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi
- **Bağlam:** npm'de `typescript@latest` = 7.0.2, ama `typescript-eslint@8.71` yalnızca `typescript >=4.8.4 <6.1.0` destekliyor.
- **Karar:** TypeScript **6.0.3**. Diğer sürümler: vitest 5.0.3, vite 8.3.1, @vitejs/plugin-react 6.1.1, react 19.3.0, lightweight-charts 5.2.1, luxon 3.7.2, @noble/hashes 2.4.0, papaparse 5.7.0, dexie 4.4.6, eslint 10.11.0, typescript-eslint 8.71.0, prettier 3.9.9. Test için jsdom 30 ve @testing-library/react 16 (MIT) eklendi: React bileşen testleri için gerekli.
- **Ertelendi:** `zod` strateji şemasıyla (M5) birlikte eklenecek; M1'de ihtiyaç yok.
- **Sonuç:** typescript-eslint TS 7'yi desteklediğinde yükseltme ayrı bir commit'te yapılır.

## D17 — Gün içi mumlar işlem günü başlangıcından sayılır
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi (M1)
- **Karar:** 5m…4H mumları, işlem gününün başlangıcından (17:00 NY) geçen süreye göre bölünür; yani başlangıç + k × süre. Normal günlerde bu, NY duvar saatine hizalamayla aynıdır: 4H için 17, 21, 01, 05, 09, 13.
- **Gerekçe:** Yaz/kış saati geçişleri Pazar 02:00 NY'de olur ve o sırada forex ile altın kapalıdır. Böylece işlem günlerinde belirsiz ya da var olmayan saatle uğraşmak gerekmez. 7/24 işlem gören enstrümanlar (kripto) eklenirse bu karar yeniden ele alınmalı.

## D18 — Günlük/haftalık mum etiketi = işlem günü tarihi
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi (M1)
- **Karar:** Pazartesi 17:00 NY'de açılan günlük mum "Salı" olarak etiketlenir; forex geleneğinde gün kapandığı tarihle anılır. Haftalık mum, haftanın ilk işlem günüyle (Pazartesi) etiketlenir. Bu etiketler seçilen gösterim saat diliminden bağımsızdır. Gün içi etiketler seçilen saat dilimindedir.

## D19 — Doğrulama raporu ve düzeltmelerin son hali
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi (M1; PLAN §5'teki `ValidationReport` taslağının yerine geçer)
- **Karar:**
  - Hafta sonu ve günlük aradaki boşluklar "beklenen kapanış boşluğu" olarak sayılır (`closedMarketGaps`), sorun olarak listelenmez.
  - Piyasa kapalıyken oluşan mumlar `closedMarketCandles` altında nedeniyle birlikte raporlanır (`WEEKEND` ya da `DAILY_BREAK`).
  - Okunamayan satırlar ve yaz/kış saati sorunlu satırlar ayrı listelerde tutulur.
  - Düzeltme listesi: `SKIP_UNPARSEABLE_ROWS`, `SKIP_DST_ROWS`, `SORT_BY_TIME`, `DROP_IDENTICAL_DUPLICATES`, `DROP_CLOSED_MARKET_CANDLES`, `DROP_INVALID_PRICES`, `ROUND_TO_TICK`.
  - Engelleyiciler: `CONFLICTING_DUPLICATES` (aynı zamanda farklı fiyat; hangisinin doğru olduğu bilinemez) ve `NO_DATA`.
  - Boşluklar düzeltilmez; yeniden örneklenen mumda `sourceCount/expectedCount` olarak görünür.

## D20 — Hesaplama worker'ı veriyi IndexedDB'den kendisi okur
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi (M1)
- **Karar:** İçe aktarma (`import.worker`) ve yeniden örnekleme (`compute.worker`) Web Worker'da çalışır. Hesaplama worker'ı seriyi doğrudan IndexedDB'den okur ve etkin veri kümesini önbellekte tutar. Böylece ana iş parçacığı büyük dizileri kopyalamaz ve zaman dilimi değiştirmek arayüzü dondurmaz.
- **Ölçüm (sentetik 750 bin 1m mum):** doğrulama ≈ 1,0 sn; seri + hash ≈ 0,9 sn; her zaman dilimi için yeniden örnekleme ≈ 0,6 sn.

## D21 — `trw-strategy` ve `trw-research` veritabanları ertelendi
- **Tarih:** 2026-09-30 · **Durum:** Kabul edildi
- **Karar:** M1'de yalnızca `trw-market` ve `trw-user` (tercihler) oluşturuldu. Diğer iki veritabanı ilk kullanılacakları taşta (M3/M5) eklenecek. Boş şema oluşturmak şimdilik bir şey kazandırmıyor.

## D22 — Uzun geçmiş verisi dukascopy-node ile alınır (uygulamanın dışında, tek seferlik)
- **Tarih:** 2026-10-01 · **Durum:** Kabul edildi (kullanıcı onayıyla)
- **Bağlam:** Dukascopy web aracı 1m veriyi tek gün, 1h veriyi en fazla 1 ay indiriyor (D12). İncelenen GitHub veri repolarının çoğu kaynak, saat dilimi ve fiyat tipi belirtmiyor; bu yüzden elendi (kural 1–2: kaynağı bilinmeyen veri yok).
- **Karar:** `dukascopy-node@1.50.0` (MIT, npm; sürüm sabitlenmiş) kullanıcının makinesinde tek seferlik CSV üretmek için çalıştırılır: `-t m1 -p bid -v -vu units -f csv`, UTC, hafta sonu düz mumları hariç. Çıktı proje kökündeki `/data/` klasörüne yazılır; git dışıdır. Sonra normal içe aktarma sihirbazından geçer. Uygulama içinde otomatik veri adaptörü **değildir**; o ayrı bir faz olarak kalır (CLAUDE.md).
- **Doğrulama:** Aynı günler için Dukascopy web aracından indirilen resmi dosyalarla karşılaştırıldı. 2024-10-01 1h: 24/24 satır aynı. 2026-10-01 1m: 582/582 satırda OHLC birebir aynı, hacimler sayısal olarak eşit.
- **Kısıtlar:** Dukascopy hız sınırı uyguluyor (HTTP 429). İndirme düşük paralellik ve beklemeyle yapılır (`-bs 2 -bp 3000`, yeniden deneme 5 sn). Dukascopy toplu indirme hakkında açık bir koşul yazmıyor (doğrulanmadı); kullanım kişisel araştırma ile sınırlıdır ve veri paylaşılmaz.
- **Biçim:** başlık `timestamp,open,high,low,close,volume`, zaman Unix ms (UTC). Motor bunu `UNIX_MS` olarak okur.

## D23 — Seans varsayılanları ve seviyelerin kaynağı
- **Tarih:** 2026-10-01 · **Durum:** Kabul edildi (M2)
- **Karar:** Yerleşik seanslar: Asya (Tokyo) 09:00–18:00 Asia/Tokyo, Londra 08:00–17:00 Europe/London, New York 08:00–17:00 America/New_York, Pazartesi–Cuma. Seans high/low değerleri **1m taban veriden** hesaplanır; bu yüzden hangi zaman diliminde bakılırsa bakılsın aynıdır. Seans bitene kadar `complete: false` olur; grafikte daha soluk ve "devam ediyor" etiketiyle çizilir. Seans kutuları 1D/1W grafiklerde gösterilmez. Ayrıntı: `docs/definitions/session-v1.md`.
- **Arayüz:** Kutular motor çıktısıdır (ENGINE katmanı). Kesik kenar ve isim etiketiyle gösterilir; renk tek başına bilgi taşımaz. Görünür seanslar kullanıcı tercihlerinde saklanır.

## D24 — Lightweight Charts koordinat ayrıntıları (doğrulandı)
- **Tarih:** 2026-10-01 · **Durum:** Kabul edildi
- **Bulgular (5.2.1, tarayıcıda ölçüldü):** `timeScale().logicalToCoordinate()` tam sayı konumlarda doğru çalışıyor, **kesirli konumlarda 0 döndürüyor**. Primitive arayüzlerinde `hitTest(x, y)` mevcut; M0'daki "doğrulanmadı" notu kapandı.
- **Karar:** Kesirli konumlar iki komşu tam sayı konumun koordinatı arasında doğrusal olarak hesaplanır (`chart/lwc-coords.ts`). Zaman ↔ konum dönüşümü (`chart/coords.ts`) bar içinde orantılıdır, veri boşluğunda bir önceki barın sağ kenarına yaslanır, son bardan sonrası için uzatılır. Böylece çizimler ve kutular her zaman diliminde aynı zamana denk gelir.
- **Ek:** Zaman dilimi değişince grafik görünür zaman aralığını korur. Yeni veri yüklenirken eski grafik ekranda kalır; grafik bileşeni yeniden kurulmaz.

## D25 — Çizim modeli ve etkileşim
- **Tarih:** 2026-10-01 · **Durum:** Kabul edildi (M2)
- **Model:** Çizim noktaları UTC zaman + fiyat olarak saklanır (`Anchor`). Bu yüzden zaman dilimi değişince yerinde kalırlar. Fiyat tick'e yuvarlanır. Yalnızca kullanıcı çizimleri (`source: USER`) saklanır; motor katmanları (seans kutuları, ileride M4 adayları) her seferinde türetilir.
  - Pozisyon aracı 3 noktadır: giriş, stop, hedef. Stop ve hedef aynı bitiş zamanını paylaşır. Varsayılan: 20 pip stop, 2R hedef, 20 bar genişlik. Lot hesabı yok (M5).
- **Destek/direnç seviyesi:** Bir çizime bağlıdır (`drawingId`). Fiyatı ya da bölgesi o çizimden gelir; çizim silinince seviye de silinir. Durum değişiklikleri (Aktif / Kırıldı / Retest / Geçersiz) zaman ve isteğe bağlı notla geçmişe eklenir; değişiklikler değişmez kopyayla yapılır. Yeni seviye, son kapanışın altındaysa "Destek", üstündeyse "Direnç" olarak başlar; kullanıcı değiştirebilir.
- **Etkileşim:**
  - Tıklama, grafik kütüphanesinin tıklama olayıyla değil pointer olaylarıyla algılanır: fiyat paneli içinde basma ve bırakma arasında 4 pikselden az hareket. Sebep: Lightweight Charts 5.2.1, yaklaşık 500 ms içinde gelen ve ilkinden 5 pikselden uzak ikinci tıklamayı hiç bildirmiyor (kaynak kodda doğrulandı); bu yüzden hızlı çizilen ikinci nokta kayboluyordu.
  - Tutamak sürüklenirken grafiğin kaydırma ve yakınlaştırması geçici olarak kapatılır.
  - Çizim bitince araç otomatik olarak "Seç"e döner. Delete seçili çizimi siler, Esc aracı ve seçimi iptal eder.
- **Görünüm:** Kullanıcı çizimleri düz çizgilidir. Motor katmanı kesik çizgili ve etiketlidir. Yeşil ve kırmızı yalnızca fiyat aralığının yönünde ve pozisyonun kâr/zarar bölgelerinde kullanılır; her ikisi de işaretli metinle desteklenir.

## D26 — Replay ve işlem simülatörü kuralları
- **Tarih:** 2026-10-02 · **Durum:** Kabul edildi (M3)
- **Replay görünümü:** İmleç (`cursor`) her zaman grafiğin zaman dilimindeki bir mum sınırındadır. Grafik yalnızca `t + 1m ≤ cursor` olan 1m mumlardan üretilir; son mum oluşmakta olabilir ve "henüz kapanmadı" olarak işaretlenir. Bitmiş seanslar tam, devam eden seanslar imlece kadarki high/low ile gösterilir. Worker her adımda yalnızca son mumu ve devam eden seansları yeniden hesaplar; sonuç, kesilmiş veriden baştan hesaplamayla birebir aynıdır (test). İmleçten sonra başlayan kullanıcı çizimleri replay sırasında gizlenir.
- **Simülatör (`execution/trade-sim.ts`), M5 backtest ile ortak:** Hesap her zaman 1m taban veriyle ve yalnızca imlece kadar kapanmış mumlarla yapılır.
  - Piyasa emri, karar anından sonraki ilk 1m mumun açılışında dolar. Limit ve stop emirleri fiyata değince dolar; açılış emri aşmışsa (gap) açılıştan dolar.
  - Fiyatlar BID'dir. Long, ASK'tan (BID + spread) alır ve BID'den satar; short, BID'den satar ve ASK'tan geri alır. Kayma piyasa ve stop dolumlarına eklenir, limit dolumlarına eklenmez.
  - Aynı 1m mumda stop ve hedef → D8 (varsayılan önce stop) ve `ambiguous` işareti. Limit/stop emrin dolduğu mumda yalnızca stop sayılır (kötümser) ve bu da `ambiguous` sayılır.
  - Emir süresi grafikteki mum sayısıyla verilir; dolmadan süresi biten emir `EXPIRED` olur. Elle kapatma imlecin son kapanmış 1m mumunun kapanışından yapılır; dolmamış emir elle kapatılınca `CANCELLED` olur.
  - R = (çıkış − giriş) / |giriş − stop| (short için ters). MAE/MFE giriş mumundan itibaren mum uçlarıyla, çıkış mumunda yalnızca çıkış fiyatıyla hesaplanır.
  - Fiyatlar 1e-8, R değerleri 1e-9 hassasiyetle yuvarlanır (determinizm).
- **Pip girişi (`execution/order-builder.ts`):** Pip mesafesi piyasa emrinde son kapanıştan, limit/stop emrinde emir fiyatından ölçülür. Varsayılan: piyasa emri, 20 pip stop, 40 pip hedef (2R), 20 mum emir süresi. Spread ve kayma varsayılanı 0'dır; 0 iken "maliyetsiz" uyarısı gösterilir.
- **Arayüz kuralları:** Aynı anda tek replay işlemi vardır. İşlem bekliyor ya da açıkken imleç geri gidemez ve replay bitirilemez (karar anından öncesini görmek geçmişi değiştirmez ama işlemi anlamsız kılar). İşlem sonuçlanınca otomatik oynatma durur ve günlük formu bir kez açılır.

## D27 — İşlem günlüğü
- **Tarih:** 2026-10-02 · **Durum:** Kabul edildi (M3)
- **Model:** `trw-user` v3: `trades` (replay işlemleri: emir, maliyet, belirsizlik kuralı ve son simülasyon sonucu; sonuç yeniden hesaplanabilir), `journal` (karar kayıtları), `screenshots` (PNG baytları). "İşlem yok" kararları da kayıttır.
- **Otomatik alanlar:** Karar anı, zaman dilimi, karar anında açık olan seanslar, ölçülen sonuç (R, çıkış nedeni, MAE/MFE, süre, belirsizlik). Süre, giriş mumunun açılışından çıkış mumunun kapanışına kadardır. Dolmayan emirlerin sonucu yoktur.
- **Kullanıcı alanları:** Strateji (M5'e kadar serbest metin), neden, duygu + şiddet (1–5), ders, etiketler, isteğe bağlı grafik görüntüsü (`takeScreenshot` ile çizimler ve seans kutuları dahil, imleç çizgisi hariç).
- **Özet:** Filtrelenmiş kayıtlardan yalnızca ölçülen değerler gösterilir; seri ve düşüş hesapları karar sırasına göredir. 30'dan az sonuçlu işlemde uyarı, belirsiz mum sayısı ve "bu bir backtest değildir, olasılık değildir" notu her zaman görünür.

## D28 — Tespit modeli ve feature engine yapısı
- **Tarih:** 2026-10-02 · **Durum:** Kabul edildi (M4)
- **Karar:** Özellikler grafiğin zaman dilimindeki **kapanmış** mumlar (`Bars`: açılış zamanı, OHLC ve kapanış zamanı `end`) üzerinde çalışır; oluşmakta olan mum hiç kullanılmaz. Her tespit `formedAt/formedIndex` ve `confirmedAt/confirmedIndex` taşır; kimliği deterministiktir (tür, sürüm, parametre/yön, oluşum zamanı). M0 taslağındaki genel `fields` sözlüğü yerine türe özel alanlar kullanılır (`Swing.price`, `Fvg.top/bottom`, …); M5'te strateji referansları (`fvg.top` gibi) bu alanlara eşlenir.
- **Tek giriş noktası:** `computeFeatures({candles, inst, tf, periods, sessions}, params)`. Grafik, replay ve (M5) backtest aynı fonksiyonu kullanır. Tanım sürümleri `FEATURE_DEFINITIONS` içinde; sonuç kayıtlarına yazılacak.
- **Replay:** Özellikler tam veriden bir kez hesaplanır, imleçte `featuresAsOf(cursor)` ile süzülür (`confirmedAt ≤ imleç`; FVG dokunma/doldurma zamanları imleçten sonraysa `null`). Bunun kesilmiş veriden hesaplamayla birebir aynı olduğu 5m/15m/1h/4h'de test edildi. Bilinen tek istisna: piyasa kapanmadan önce kesilen ama kalan dakikaları kapalı olan bir mum (ör. hafta sonu ortasındaki imleç); bu durumda o mumdaki tespit bir sonraki açılışta görünür.
- **Performans (gerçek EURUSD, 736 bin 1m mum, tarayıcı):** 15m tüm özellikler 34 ms, 1m 0,67 sn; önceki gün/hafta seviyeleri veri kümesi başına bir kez ~1,2 sn. FVG doldurma araması segment ağacıyla O(log n).
- **ENGINE_VERSION:** 0.2.0.

## D29 — Feature tanımları v1 (varsayılanlar)
- **Tarih:** 2026-10-02 · **Durum:** Kabul edildi (M4)
- Swing: `left = right = 3`, solda kesin büyük / sağda büyük-eşit. FVG: fitil tabanlı, `minSizePips = 1`. Yapı kırılımı: son onaylı swing, `breakBy = CLOSE`, ilk kırılım BOS. Önceki gün/hafta: 17:00 NY işlem günü, bir sonraki açık döneme kadar geçerli. Süpürme: aynı mumda fitille aşma + içeride kapanış, seviye ilk aşılışta tükenir, swing seviyeleri 100 mum geçerli.
- Ayrıntılar, varsayımlar ve bilinen başarısızlık durumları: `docs/definitions/*-v1.md`. Parametreleri arayüzden değiştirmek sonraki bir adım.

## D30 — Grafikte aday katmanı
- **Tarih:** 2026-10-02 · **Durum:** Kabul edildi (M4)
- **Karar:** Motor adayları kullanıcı çizimlerinden ayrı bir primitive ile çizilir: ince, kesikli ya da yarı saydam, her zaman metin etiketli ("Aday FVG ↑", "BOS ↓", "Süpürme PDH", "PDH"). Yeşil/kırmızı yalnızca yön için. Katmanlar araç çubuğundan açılıp kapanır ve tercihlerde saklanır (varsayılan: swing, kırılım, önceki gün).
- **Görüntü kuralları (motor verisini değiştirmez):** Aynı mumdaki süpürmeler tek işarette birleşir; aynı mum ve yöndeki işaretler üst üste istiflenir; mum aralığı 3 pikselden darsa işaretler gizlenir; FVG kutusu en fazla 50 mum uzunluğunda çizilir.

## D31 — Strateji şeması v1 ve kurulum bulucu
- **Tarih:** 2026-10-02 · **Durum:** Kabul edildi (M5; D10 taslağının yerini alır)
- **Karar:** Ayrıntı `docs/schema/strategy-v1.md`. D10'dan farklar: adım türleri M4 tespitleriyle sınırlı (`LIQUIDITY_SWEEP`, `STRUCTURE_BREAK`, `FVG`, `SWING`); `within.after` yerine her adım bir öncekine bağlı (`maxBars`); `level.*` referansları yok (seviyeler süpürme filtresiyle kullanılır); tanım parametreleri spec'in içinde (sonuç her zaman tekrar üretilebilir). Kurulum bulucu en erken adayı seçer, kesme değişmezdir (test).
- **Sürüm:** `specHash` sıralı anahtarlı JSON üzerinden SHA-256. Versiyon kaydı yalnızca eklenir (aynı numara tekrar yazılamaz); durum değişikliği geçmişe eklenir.

## D32 — Backtest kuralları
- **Tarih:** 2026-10-02 · **Durum:** Kabul edildi (M5)
- **Akış:** `computeFeatures(spec.features)` → `findSetups` → `orderFor` → `positionSize` → `simulateTrade` (1m, replay ile aynı). Aynı girdi → birebir aynı sonuç (test).
- **Tek pozisyon:** Açık işlem ya da bekleyen emir varken gelen kurulum atlanır (`POSITION_OPEN`). Emir süresi dolarsa sayılır (`expiredOrders`).
- **Atlama nedenleri (hepsi raporlanır):** `DATA_GAP` (ilk adımdan 2 mum önce ile sinyal arasında, piyasa açıkken eksik veri ya da yarıdan azı dolu mum), `INVALID_ORDER`, `SIZE_TOO_SMALL`, `CROSS_PAIR`, `DAILY_LIMIT` (17:00 NY işlem günü).
- **Lot:** Hesap para birimi USD. Risk tutarı = güncel bakiye × risk %; lot = risk / (planlanan stop mesafesi × kontrat × kur), lot adımına **aşağı** yuvarlanır. USD kote ve USD baz desteklenir; çapraz pariteler v1'de atlanır.
- **Maliyetler:** Spread (alış/satış, D26), kayma (piyasa ve stop dolumları; **stop-loss ve elle/aralık sonu çıkışları dahil**), komisyon (lot × taraf × 2). İstatistikler maliyet sonrası net R (`pnl / riskAmount`) üzerindendir; fiyat R'si ayrıca saklanır.
- **Aralık:** Sinyali `[from, to)` içinde olan kurulumlar işlenir; aralık sonunda açık işlem `to` anında kapatılır (`END_OF_RANGE`), dolmamış emir sayılır.
- **Simülatör düzeltmesi:** D8 kaymanın stop dolumlarına da uygulanacağını söylüyordu; M3 simülatörü yalnızca girişte uyguluyordu. Stop-loss ve elle kapatma çıkışlarına da uygulanır. `ENGINE_VERSION` 0.3.0.

## D33 — İstatistikler, dürüstlük ve veri bölme
- **Tarih:** 2026-10-02 · **Durum:** Kabul edildi (M5)
- **İstatistik:** `tradeStats` (net R, işlem sırasına göre seriler ve R cinsinden düşüş), bakiye eğrisi, USD ve % düşüş, 0,5R'lik dağılım, aylık (girişin UTC ayı), seansa göre (sinyal anında açık seanslar; çakışmada iki seansa birden sayılır; seans dışı `NONE`), haftanın gününe göre (New York saati).
- **Dürüstlük göstergeleri sonuçlardan önce gösterilir:** 30'dan az işlem uyarısı, in-sample deneme numarası, atlanan kurulumlar nedenleriyle, belirsiz mum, süresi dolan / dolmamış emirler, toplam maliyet; maliyetler 0 iken "maliyetsiz" uyarısı; "ölçülen değerdir, olasılık değildir" notu.
- **Veri bölme:** In-sample = sınırdan önce, out-of-sample = sınırdan itibaren. Her in-sample çalışması sayılır ve kayda yazılır (`inSampleTrial`). Araç optimizasyon yapmaz; deneme sayısını görünür kılar.
- **Kayıt:** `BacktestRun` = strateji id/ad/versiyon/specHash, tanım sürümleri, veri kümesi + içerik özeti + kaynak + test edilen aralık, bölme, maliyetler, belirsizlik kuralı, başlangıç bakiyesi, lot kuralları, motor sürümü, çalışma zamanı. `trw-strategy` ve `trw-research` veritabanları açıldı (D21 ertelemesi kapandı).

## D34 — İlk gerçek veri gözlemi: yerleşik Asya seansı ve Londra penceresi
- **Tarih:** 2026-10-02 · **Durum:** Bilgi (karar değil)
- "Asya dibi süpürmesi + yükseliş MSS, Londra 08:00–11:00" stratejisi EURUSD 2024-10 → 2025-12 in-sample'da yalnızca 3 işlem üretti. Sebep tanımsal: yerleşik Asya seansı (09:00–18:00 Tokyo) 09:00 UTC'de biter, seviye ancak o zaman bilinir; Londra penceresinde süpürme + MSS için kışın 2, yazın 1 saat kalır. Süpürmelerin çoğu 09–12 UTC arasında. ICT tarzı "Asya aralığı" (20:00–00:00 New York) için özel seans tanımı gerekir (M2 iyileştirme listesi 3. madde; öncelik yükseldi).

## D35 — Kullanıcı seansları
- **Tarih:** 2026-10-04 · **Durum:** Kabul edildi (M6.1)
- **Model:** Kullanıcı seansı = seans tanımı (kimlik, ad, IANA dilimi, yerel başlangıç/bitiş, başladığı günler, sürüm) + renk; `trw-user` v4 `sessions` tablosu. Kimlik `^[A-Z][A-Z0-9_]{1,15}$`; yerleşik kimlikler, `SWING` ve `NONE` ayrılmış. Saat değişirse sürüm artar.
- **Her yerde aynı motor:** Grafik kutuları, replay (imleçte kesilir), motor adaylarındaki süpürme seviyeleri (`<KİMLİK>_HIGH/_LOW`, aynı seans yeniden başlayana kadar geçerli), günlük seans etiketleri, backtest seans kırılımı.
- **Tekrarlanabilirlik:** Strateji bir kullanıcı seansının seviyesini kullanıyorsa tanımın o anki kopyası versiyona yazılır (`spec.sessions`) ve `specHash`'e girer. Seansı sonradan değiştirmek ya da silmek eski versiyonların sonucunu değiştirmez. Önceki versiyonların özetleri değişmedi (alan yoksa hash aynı).
- **Şablonlar (yaygın kullanım, resmi değil):** ICT Asya aralığı 20:00–00:00 New York (Pazar–Perşembe akşamları), Londra kill zone 02:00–05:00 NY, New York kill zone 07:00–10:00 NY. `ENGINE_VERSION` 0.4.0.

## D36 — D34'ün devamı: ICT Asya aralığıyla aynı strateji
- **Tarih:** 2026-10-04 · **Durum:** Bilgi (karar değil)
- Aynı kurallar (15m, Londra 08–11, süpürme → 12 mum içinde yükseliş MSS, piyasa girişi, stop süpürme ucu + 1 pip, 2R, %0,5; spread 0,2 / kayma 0,1 / komisyon 3,5) yalnızca seviye "ICT Asya aralığı dibi" yapılarak in-sample (2024-10-01 → 2025-12-31) çalıştırıldı: 26 kurulum, 24 işlem (2'si açık pozisyon nedeniyle atlandı), kazanma oranı %45,8, ortalama +0,31R, profit factor 1,52, maksimum düşüş −6,37R / %3,08, toplam maliyet 80,59 USD; hesap 0,9 sn.
- **Yorum sınırı:** 30'dan az işlem ve tek in-sample denemesi; bu sonuç bir kanıt değil, yalnızca tanımın stratejiyi test edilebilir kıldığını gösterir. Out-of-sample (2026) bilerek çalıştırılmadı; kullanıcı kuralları in-sample'da kesinleştirdikten sonra bir kez çalıştırmalı.
## D37 — Araştırma laboratuvarı
- **Tarih:** 2026-10-04 · **Durum:** Kabul edildi (M6.2)
- **Hipotez:** Testten önce yazılan cümle + bir strateji versiyonu + sabit test düzeni (veri kümesi ve içerik özeti, in-sample aralığı, out-of-sample sınırı, maliyetler, bakiye, lot kuralları, belirsizlik kuralı). Hipotezin bütün çalışmaları bu düzenle yapılır. `trw-research` v2: `hypotheses`; çalışma kaydında `research` (hipotez, varyant değerleri, versiyondan farklıysa çalıştırılan kuralların tam kopyası).
- **Parametre taraması:** Yalnızca kuralların kullandığı parametreler (hedef, stop/hedef tamponu, emir süresi, adımlar arası en fazla mum, tanım parametreleri); en fazla 2 eksen ve 100 kombinasyon; sabit sıra; her kombinasyonun kendi `specHash`'i; geçersiz kombinasyonlar çalıştırılmaz. **Yalnızca in-sample**; her kombinasyon bir deneme sayılır ve sayı ekranda görünür. Araç "en iyiyi" seçmez; ızgara hücreleri ortalama R + işlem sayısıyla (renk + metin) gösterilir.
- **Out-of-sample kapısı:** Seçili ayarla onay sorularak açılır; açılan çalışmalar hipoteze yazılır, ikinci açılış kalıcı uyarı üretir.
- **Sonuç:** Desteklendi / desteklenmedi için en az bir çalışma kanıt olarak seçilmelidir (kural 6); "yetersiz veri" kanıtsız olabilir. Yeniden açmak hükmü siler, çalışma geçmişi kalır.
- **Varyanttan versiyon:** Bir tarama ayarı "yeni strateji versiyonu" olarak kaydedilebilir; değişiklik notu hipotezi ve değerleri yazar.

## D38 — İlk tarama gözlemi (ICT Asya dibi → Londra MSS)
- **Tarih:** 2026-10-04 · **Durum:** Bilgi (karar değil)
- In-sample 2024-10-01 → 2026-01-01, maliyetler 0,2 / 0,1 pip / 3,5 USD. Hedef 1,5 / 2 / 3R × MSS penceresi 6 / 12 / 24 mum = 9 deneme (1,9 sn). Ortalama R: 6 mumda +0,45…+0,55 (10 işlem), 12 mumda +0,31…+0,43 (24–25), 24 mumda +0,18…+0,32 (32–34). 2R / 12 hücresi D36 ile birebir aynı (determinizm).
- **Yorum sınırı:** Bütün hücreler pozitif ama 9 deneme yapıldı ve işlem sayıları küçük; 30'u geçen yalnız 24 mum sütunu. En iyi görünen hücre (3R / 6 mum, 10 işlem) seçilmemeli. Out-of-sample açılmadı; kullanıcının kararı.
## D39 — Paper trading ve MetaTrader 5 köprüsü
- **Tarih:** 2026-10-04 · **Durum:** Kabul edildi (M6.3); gerçek MT5 demo ile köprü ve feed 2026-10-05'te doğrulandı (bkz. not altta). Kullanıcının gerçek bir paper oturumu başlatması kaldı.
- **Kaynak seçimi (kullanıcı, 2026-10-04):** MT5 demo. Araştırma: MT5 demo hesapları ücretsiz (MetaQuotes-Demo kimlik istemiyor; SPK lisanslı kurumların demoları da ücretsiz); resmi `MetaTrader5` Python paketi MIT lisanslı, yalnız Windows x86-64, açık ve girişli bir terminal gerektiriyor. OANDA v20 API'si ücretsiz ama demo için bile kimlik doğrulaması istiyor; Türkiye'den hesap açılabilirliği kaynaklarda çelişkili (doğrulanmadı). CSV ile elle güncelleme kullanıcı tarafından istenmedi.
- **Köprü (`tools/mt5-bridge/bridge.py`):** Python standart kütüphanesi + MetaTrader5. Yalnızca `/status` ve `/rates` (kapanmış 1m mumlar, `copy_rates_from_pos` 1. konumdan). Hesap DEMO değilse 403 ve açılışta kapanış (kural 7). 127.0.0.1, izinli origin listesi, Host başlığı kontrolü. Emir fonksiyonu çağrılmadığı testle kontrol edilir. Ham sunucu zamanı + son tik zamanı + bilgisayar saati döndürür.
- **Saat:** Sunucu−UTC farkı yalnızca piyasa açıkken, taze tikten (çeyrek saate en fazla 2 dk uzaklık) ölçülür; ölçülemiyorsa veri çevrilmez (tahmin yok). Getirilen aralıkta New York / Londra / Doğu Avrupa yaz-kış saati değişimi varsa uyarı verilir (eski mumlar farklı ofsetle damgalanmış olabilir).
- **Veri:** Broker verisi kendi veri kümesinde tutulur (`mt5:<sunucu>:<sembol>`, kaynak adı "MT5: <sunucu>"); ilk senkron 7 gün, sonra yalnız eksik dakikalar; düzeltilen mumlar sayılır. Fiyat tipi BID kabul edildi (MT5 forex grafikleri bid ile çizilir; broker'a göre doğrulanmalı).
- **Paper oturumu:** Strateji versiyonu + broker veri kümesi + maliyetler; `startedAt`'ten sonra onaylanan kurulumlar, aynı motor (`runBacktest` + `keepOpenAtEnd`): açık işlem kapatılmaz, anlık R gösterilir. Durdurulunca o ana kadar değerlendirilir. `trw-research` v3 `paperSessions`.
- **Gerçek doğrulama (2026-10-05):** Kullanıcı MetaQuotes-Demo hesabı açtı, `MetaTrader5` paketini kurdu, köprüyü çalıştırdı. `/status` demo hesabı doğru bildirdi (`server: MetaQuotes-Demo`, `mode: DEMO`); uygulamadan "Şimdi güncelle" ile gerçek 10.080 adet 1m mum çekildi (ilk senkron, 7 gün), sunucu saati farkı ölçüldü (**UTC+3:00**), ayrı `mt5:MetaQuotes-Demo:EURUSD` veri kümesi oluştu. Gerçek bir paper oturumu başlatmak, o enstrüman için kayıtlı bir strateji versiyonu gerektiriyor (henüz yok).

## D40 — Kavram kütüphanesi
- **Tarih:** 2026-10-05 · **Durum:** Kabul edildi (M6.4)
- **Bağlam:** Kullanıcı yol haritasını sırayla bitirmek istiyor; ürünün eğitim ayağı. Plan `docs/PLAN-M6-4.md`.
- **İçerik yeri:** Kavram metinleri `apps/web/src/content/concepts.ts` dosyasında: CLAUDE.md'deki ayrı "eğitim içeriği" alanı. Sayfa düğmeleri ve etiketleri `i18n/tr.ts`'de. Metinler `docs/definitions/*-v1.md` ile aynı tutulur.
- **Örnekler gerçek veriden:** Grafikte seçili veri kümesi ve zaman diliminin `computeFeatures` çıktısı kullanılır (grafikle aynı adaylar). Veri yoksa örnek ve sayı gösterilmez (kural 1). "Grafikte göster" grafiği o ana götürür ve gerekli katmanı ya da seansı açar; açık replay işlemi varken kapalıdır.
- **outcome-v1:** Aday onayından sonraki N (varsayılan 12) mum içinde, belirli bir fiyatın gerisine **kapanış** = "beklendiği gibi gitmedi". Fiyatlar: swing seviyesi, FVG'nin uzak kenarı, kırılan seviye, süpürme fitilinin ucu. N mum dolmadan sonuç "bekliyor" (ileriye bakma yok; kesme değişmezliği testi). Önceki gün/hafta seviyeleri ve seanslar için v1'de ölçüt yok.
- **Dürüstlük:** Oran yalnızca "bu veride, bu zaman diliminde ölçülen sıklık" olarak sunulur; 30'dan az sonuçlanmış adayda uyarı. Ölçütün resmi bir ICT/SMC kuralı olmadığı ekranda yazar (kural 6).
- **İlk gerçek gözlem (bilgi):** MT5 MetaQuotes-Demo EURUSD, 1m, 2026-09-24 → 2026-10-05, N = 12: 1.885 swing adayından 1.884'ü sonuçlandı, %43,3'ü beklendiği gibi gitmedi. Tek veri kümesi ve tek zaman dilimi; genelleme değil.
---

## D41 — TradingView tarzı çizim araç takımı (M7.1)
- **Tarih:** 2026-10-05 · **Durum:** Kabul edildi
- **Bağlam:** Kullanıcı TradingView'in solundaki çizim araç takımını istedi. TradingView'in kendi araç çubuğu yalnızca lisanslı Advanced Charts'ta (D1), bu yüzden aynı düzen ve araçlar kendi çizim katmanımızda yazıldı. Araç adları ve gruplar TradingView'in resmi listesinden: https://www.tradingview.com/support/solutions/43000703396-drawing-tools-available-on-tradingview/
- **Araçlar (M7.1):** İmleçler (Seç, Silgi) · Çizgiler (trend, ışın, uzatılmış, yatay, yatay ışın, dikey, artı, paralel kanal) · Fibonacci (düzeltme, trend bazlı uzantı) · Şekiller (dikdörtgen, elips, ok) · Notlar (metin, yukarı/aşağı ok işareti) · Tahmin ve ölçüm (long/short pozisyon, fiyat, tarih, tarih+fiyat aralığı). Yardımcılar: mıknatıs (en yakın OHLC), çizimde kal, tümünü kilitle/gizle (bu oturum için), tümünü sil (onaylı), geri al/yinele (Ctrl+Z / Ctrl+Y, son 100 adım).
- **Veri modeli:** Yeni `DrawingKind`'ler ve çapa sayıları motorda (`ANCHOR_COUNT`); metin `Drawing.text` (boşsa geçersiz). Eski çizimler değişmedi. Çizimler hâlâ UTC + fiyat çapalarıyla saklanır.
- **Fibonacci:** Düzeltmede 0 ikinci noktada, 1 ilk noktada; seviyeler 0 · 0,236 · 0,382 · 0,5 · 0,618 · 0,786 · 1. Uzantı (A → B, C): fiyat = C + (B − A) × seviye; seviyeler 0 · 0,618 · 1 · 1,272 · 1,618 · 2 · 2,618. Bunlar bizim varsayılanımızdır; TradingView'in varsayılanlarıyla birebir aynı olduğu **doğrulanmadı** (panelde yazar).
- **Geri al:** Her değişiklikten önceki durum saklanır; geri alma yalnızca farkı depoya yazar. Çizim silinince bağlı seviye de silindiği için geri alma onu da geri yazar. İşlemler sırayla çalışır (hızlı çift Ctrl+Z aynı adımı iki kez geri almaz; testle bulunan ve düzeltilen hata).
- **Kısayollar:** Yalnızca Ctrl+Z/Ctrl+Y, Delete, Escape. TradingView'in araç kısayolları (Alt+T vb.) doğrulanmadığı için eklenmedi.
- **Sonraya (M7.2+):** pitchfork, Gann, formasyonlar, fırça/yol, balonlar, çizim stilleri, favoriler; anchored VWAP ve hacim profili indikatörlerle.
---

## D42 — Proje paketi benimsendi; yeni sıra ve push kuralı
- **Tarih:** 2026-10-06 · **Durum:** Kabul edildi (kullanıcı onayıyla)
- **Ne:** Kullanıcının hazırladığı `PROJE-PAKETI.md` projeye yerleştirildi: yeni `CLAUDE.md` (Mutlak kural 9: tavsiye dili yok, paylaşımdan önce SPK kontrolü; kural 10: veri dışa aktarılabilir olmalı), `docs/AI-BOT-TASLAK.md`, `docs/AGENT-GOREV-M9-formasyonlar.md`, `catalog/` (61 mum, 21 grafik, 9 harmonik, 16 yapı/likidite tanımı; 6 strateji hipotezi; iddia defteri; kaynak/lisans kaydı; şemalar; şematik SVG'ler). Hiçbirinin kodu yazılmadı. Katalog veri olduğu için biçimlendiricinin dışında (`.prettierignore`).
- **Sıra (kullanıcı kararı):** M7.2 yedek ve dışa aktarma → M8 indikatörler → M9 formasyon kataloğu → M10 çizim araçları 2. aşama → M11 AI/quant bot (açık sorular yanıtlanmadan kod yok).
- **Push:** Bundan sonra her oturum `git push` ile kapanır (önceden yalnızca kullanıcı push'luyordu).
- **M9'da sorulacak farklar (şimdi değiştirilmedi):** katalog swing'i 5/5, bizim v1 3/3 (eşit tepe kuralı da farklı); katalogda Asya seansı "00:00–09:00 Asia/Tokyo" (Tokyo yerel saatiyle doğrusu 09:00–18:00; muhtemelen UTC kastedildi) ve London sweep stratejisi buna dayanıyor, D36 ise ICT Asya aralığını öneriyor; katalog M4'te var olan tanımları `TO_IMPLEMENT` gösteriyor (adaptörle eşlenecek); sürüm biçimi `1.0.0` / `v1`; 13 kaynağın lisansı "KONTROL ET"; TA-Lib oracle testi Python + TA-Lib kurulumu gerektirir (ayrı onay).
---

## D43 — Yedek ve dışa aktarma (M7.2, Mutlak kural 10)
- **Tarih:** 2026-10-06 · **Durum:** Kabul edildi (kullanıcı planı onayladı; ekran görüntüleri dahil)
- **Yedek:** `apps/web/src/backup/backup.ts`. Tek JSON dosyası (`format: trw-backup`, `formatVersion: 1`, motor sürümü, tarih): kullanıcı, strateji ve araştırma alanlarının tamamı; ekran görüntüleri base64. Fiyat verisi dahil değil.
- **Geri yükleme hiçbir şeyin üzerine yazmaz:** kimlik yoksa eklenir, aynıysa atlanır, farklıysa çakışma sayılır ve mevcut korunur; geçersiz kayıt (bozuk çizim, çizimi olmayan seviye, stratejisi olmayan versiyon) eklenmez. Önce özet, sonra kullanıcı onayıyla yazma. Strateji versiyonları olduğu gibi (durum geçmişiyle) eklenir; stratejinin son versiyon numarası yükseltilir ki sonraki yeni versiyon sırayı bozmasın. Tercihler yalnızca hiç değiştirilmemiş varsayılanların yerine konur; "son yedek zamanı" karşılaştırmaya girmez.
- **CSV:** günlük ve backtest işlemleri; Türkçe Excel varsayımıyla `;` ayraç, ondalık virgül, UTF-8 BOM, CRLF. `= + - @` ile başlayan metin hücrelerinin başına `'` konur (CSV formül enjeksiyonuna karşı).
- **Hatırlatıcı:** strateji, günlük, çizim ya da paper oturumu varsa ve hiç yedek yoksa ya da son yedek 7+ gün önceyse başlıktaki "Yedek" düğmesinde uyarı.
- **Kalıcılık:** `navigator.storage.persisted()` / `persist()` (MDN: Promise<boolean>, tarayıcı reddedebilir, güvenli bağlam). Gömülü önizleme tarayıcısı isteği reddetti (2026-10-06 denendi); arayüz bunu ve "kendi tarayıcında aç" notunu gösteriyor.
- **Test sırasında bulunan:** hatırlatıcı metni iç `<span>` yüzünden ekran okuyucuya "Yedek· Yedek alınmadı" diye okunuyordu; tek metin yapıldı.
---

## D44 — İndikatörler, 1. parça: SMA, EMA, RSI, ATR (M8)
- **Tarih:** 2026-10-07 · **Durum:** Kabul edildi
- `packages/engine/src/features/indicators.ts`: saf, deterministik fonksiyonlar; yalnızca kapanmış mumlardan (`Bars`), period dolmadan `null`.
- RSI ve ATR Wilder'ın standart yöntemiyle: ilk `period` değerin basit ortalamasıyla başlar, sonra üstel düzeltme uygulanır. EMA, ilk `period` kapanışın SMA'sıyla başlar (yaygın kural).
- Testler: elle hesaplanmış küçük örnekler, period dolmadan `null`, kesme değişmezliği (rastgele yürüyüş, çoklu kesim noktası).
- Bu adımda grafiğe ya da strateji adımlarına bağlanmadı; yalnızca motor + testler. MACD, Bollinger, VWAP ve diğerleri ayrı adımlar.
---

## D45 — İndikatörler, 2. parça: MACD, Bollinger, VWAP (M8)
- **Tarih:** 2026-10-07 · **Durum:** Kabul edildi
- `Bars` tipine `v` (hacim) alanı eklendi: kaynak mumda hacim yoksa 0. Yalnızca VWAP kullanıyor; geri uyumlu (eklenen alan).
- MACD: hızlı/yavaş EMA farkı (çizgi), çizginin kendi EMA'sı (sinyal), farkları (histogram). Bollinger: SMA orta bant ± k × popülasyon standart sapması (aynı pencere). VWAP: veri başından **sabitlenmiş** (anchored), kümülatif (tipik fiyat × hacim) / kümülatif hacim; hacim hiç görülmediyse `null` (0 değil — dürüstlük).
- VWAP'ın seans bazlı sıfırlanması (ör. her gün yeniden başlaması) v1'de yok; gerekirse ayrı bir adım.
- Testler: elle hesaplanmış örnekler, period dolmadan `null`, kesme değişmezliği.
---

## D46 — İndikatörler grafiğe bağlandı (M8, görsel katman)
- **Tarih:** 2026-10-07 · **Durum:** Kabul edildi; grafikte görünümü kullanıcının kendi verisiyle doğrulanacak
- **Kapsam:** Yalnızca görsel overlay. Strateji adımlarına bağlama (ör. "RSI > 70 olunca gir") bu adıma dahil değil, ayrı bir iş.
- SMA/EMA/Bollinger/VWAP fiyat panelinde çizgi; RSI ya da MACD (ikisinden biri, aynı anda değil) ayrı bir alt panelde. ATR çizilmiyor (sizing için kullanılacak, görsel çizgi olarak eklenmedi).
- Ayarlar (`apps/web/src/chart/indicator-settings.ts`) tercihlere (`trw-user`) kaydedilir, sayfa yenilenince kalır. Araç çubuğunda "İndikatörler" açılır paneli: her biri aç/kapat + period/k/hızlı/yavaş/sinyal sayı girişleri.
- Renkler çizim araçlarıyla aynı paletten (mavi/amber/mor/bakır), yön/kâr-zarar anlamı taşımaz; MACD histogramı da nötr gri (CLAUDE.md tasarım kuralı: yeşil/kırmızı yalnızca yön/PNL).
- Hesaplama grafiğin taban serisinden (`toBars`), kapanmamış mumdan değil — ileriye bakma yok.
- **Doğrulanmadı:** Gerçek grafikte (lightweight-charts render) nasıl göründüğü bu oturumda test edilemedi; ortamda ne MT5 köprüsü ne de içe aktarılmış CSV vardı, sahte veri kurala aykırı olduğu için grafiğe yüklenmedi. Motor hesapları (D44–D45) ve araç çubuğu→tercih bağlantısı testlerle doğrulandı.
---

## Açık sorular (cevaplanınca buraya karar olarak işlenecek)
| # | Soru | Cevap |
|---|---|---|
| S1 | Veri kaynağı ve CSV biçimi; dosyanın saat dilimi; fiyat tipi (BID/ASK/orta) | **Dukascopy**, 1m, BID (ASK isteğe bağlı). Biçim ilk dosyadan kesinleşecek. Bkz. D12 |
| S2 | Başlangıç enstrümanları; XAUUSD pip tanımı (0.1 / 0.01); M1'de endeks gerekli mi | **EURUSD + XAUUSD**; XAUUSD pip 0.1 (ayarlanabilir); endeks yok. Bkz. D13 |
| S3 | Günlük mum kapanışı: 17:00 New York / 00:00 UTC / broker sunucu saati | **17:00 America/New_York** (kullanıcı, 2026-09-30). Bkz. D11 |
| S4 | 1m taban veriden kaç yıl yüklenecek | **Son 2 yıl**; cihaz 8 GB RAM. Bkz. D14 |
| S5 | Yalnızca yerel git mi, yoksa özel bir GitHub reposu da mı | **GitHub:** yusufedali7/Trading_for_future. Görünürlük (public/private) açık. Bkz. D15 |

