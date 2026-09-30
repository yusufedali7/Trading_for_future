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
- **Doğrulanmadı:** CSV kolon düzeni, tarih biçimi, saat dilimi seçeneği (GMT/yerel) ve hafta sonu "düz mum" (flat) davranışı. Resmi sayfa bunları açıklamıyor. M1 görev 4'te kullanıcının ilk dosyasının başlığı ve ilk satırlarına bakılarak kesinleştirilecek. Varsa dışa aktarımda **GMT** seçilmesi önerilir.
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

---

## Açık sorular (cevaplanınca buraya karar olarak işlenecek)
| # | Soru | Cevap |
|---|---|---|
| S1 | Veri kaynağı ve CSV biçimi; dosyanın saat dilimi; fiyat tipi (BID/ASK/orta) | **Dukascopy**, 1m, BID (ASK isteğe bağlı). Biçim ilk dosyadan kesinleşecek. Bkz. D12 |
| S2 | Başlangıç enstrümanları; XAUUSD pip tanımı (0.1 / 0.01); M1'de endeks gerekli mi | **EURUSD + XAUUSD**; XAUUSD pip 0.1 (ayarlanabilir); endeks yok. Bkz. D13 |
| S3 | Günlük mum kapanışı: 17:00 New York / 00:00 UTC / broker sunucu saati | **17:00 America/New_York** (kullanıcı, 2026-09-30). Bkz. D11 |
| S4 | 1m taban veriden kaç yıl yüklenecek | **Son 2 yıl**; cihaz 8 GB RAM. Bkz. D14 |
| S5 | Yalnızca yerel git mi, yoksa özel bir GitHub reposu da mı | **GitHub:** yusufedali7/Trading_for_future. Görünürlük (public/private) açık. Bkz. D15 |
