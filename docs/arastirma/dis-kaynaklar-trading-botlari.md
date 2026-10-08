# Dış kaynak taraması: trading bot / algo-trading ekosistemi

> Tarih: 8 Ekim 2026. Amaç: internette (GitHub, Hugging Face, Reddit, forumlar, Discord, akademik) trading/bot ile ilgili ne var, bize ne kadar faydalı olabilir — kullanıcı tek tek inceleyecek. Bu bir **araştırma notu**; kod değişikliği yok, hiçbir bağımlılık eklenmedi.
>
> **Kapsam notu (dürüstlük):** "tüm interneti / tüm forumları tara" talebi birebir mümkün değil — bunun yerine geniş ama sınırlı bir tarama yaptım: büyük kod barındırma siteleri (GitHub, Hugging Face), 4 büyük forex/trading forumu (ForexFactory, BabyPips, EliteTrader, Trade2Win), Reddit, Discord topluluk dizinleri, QuantConnect forumu, ve genel web araması. Bazı sonuçlar arama motorunun özetlediği içerik; linkler asıl kaynağa gidiyor, oradan derinleşebilirsin.

## Nasıl okunmalı

Her kaynağa **Yüksek / Orta / Düşük** fayda etiketi verdim — "bize", yani bu projeye (deterministik, lookahead yasak, gerçek para yok, Türkçe UI/İngilizce kod, TypeScript motor + MT5 okuma-amaçlı köprü) göre:

- **Yüksek:** doğrudan kod okuyup fikir/algoritma/test verisi alabileceğimiz, lisansı temiz, aktif bakımlı.
- **Orta:** ilham verici ama direkt kopyalanamaz (farklı dil/mimari, lisans belirsiz, ya da konsepti var kodu yok).
- **Düşük:** bizim mutlak kurallarımızla (özellikle kural 6: AI olasılık uydurmaz, kural 7: gerçek para yok) çatışıyor, ya da kalitesi/güvenilirliği çok değişken (forum EA'leri gibi).

---

## 1. Hazır backtest/algo-trading motorları (Python, kurumsal kalite)

| Kaynak | Lisans | Fayda | Neden |
|---|---|---|---|
| [QuantConnect Lean](https://github.com/QuantConnect/Lean) | Apache 2.0 | **Yüksek** | 16k+ yıldız, forex dahil çok varlık sınıfı, backtest↔canlı aynı kod. Bizim "tek motor, iki tüketici" ilkemizin kurumsal ölçekte nasıl yapıldığını görmek için okunmaya değer — özellikle emir doldurma (fill) ve slippage modelleme kodu. |
| [nautilus_trader](https://github.com/nautechsystems/nautilus_trader) | LGPL-3.0 | **Orta** | Rust çekirdek + Python strateji katmanı; backtest-canlı tam parite. Mimari ilham için iyi, ama Rust bağımlılığı bizim "saf TS motor" ilkemizle uyuşmuyor — kopyalanmaz, okunur. |
| [backtrader](https://github.com/mementum/backtrader) | GPL-3.0 | **Orta** | Artık bakımsız (son commit yıllar önce) ama bar-bar strateji/broker kuralları çok temiz anlatılmış; `execution/` modülümüzün (aynı mumda SL/TP, kayma) tasarımını karşılaştırmak için iyi referans. |
| [vectorbt](https://github.com/polakowo/vectorbt) | Apache 2.0 (çekirdek) | **Orta** | Vektörize backtest — bizim mum-mum deterministik yaklaşımımızdan farklı felsefe (hız için toplu işlem). Doğrudan kullanılmaz ama "binlerce parametre kombinasyonunu hızlı tara" ihtiyacı doğarsa (M6.2 araştırma lab'ı) teknik referans olabilir. |
| [pysystemtrade](https://github.com/robcarver17/pysystemtrade) | GPL-3.0 | **Orta** | Rob Carver'ın "Systematic Trading" kitabının kod karşılığı — pozisyon boyutlandırma ve risk yönetimi felsefesi için okunmaya değer, forex'e özel değil. |
| [Freqtrade](https://github.com/freqtrade/freqtrade) | GPL-3.0 | **Düşük-Orta** | 54k+ yıldız, çok olgun, ama **kripto-odaklı**; forex/MT5 ile doğrudan ilgisi yok. FreqAI (otomatik ML yeniden eğitim) modülü kural 6 ile gerilimli (olasılık/sinyal üretimi) — mimari fikir için bakılabilir, kullanılmaz. |
| [Jesse](https://github.com/jesse-ai/jesse) | MIT (çekirdek) + ücretli canlı eklenti | **Düşük** | Kripto-native, forex desteği sınırlı; canlı trading ücretli katmanda — bizim "her şey açık ve ücretsiz" yaklaşımımızla uyuşmuyor. |
| vnpy, zipline, QUANTAXIS, Rqalpha, Lumibot, Blankly | çeşitli (çoğu MIT/Apache/BSD) | **Düşük-Orta** | Genel amaçlı, çoğu hisse/kripto odaklı, Çince dokümantasyonlu olanlar da var (QUANTAXIS). Tek tek derinleşmeye değmez, isim olarak not düşülüyor. |

**Özet:** Bu kategoriden bize en çok faydası olan **Lean** (mimari referans) ve **backtrader** (execution mantığı karşılaştırması) — ikisi de "nasıl yapmışlar" diye okunur, kod kopyalanmaz (biz TypeScript'iz, onlar Python/C#/Rust).

## 2. MT5/MQL5 — forex'e özel, açık kaynak Expert Advisor'lar

| Kaynak | Fayda | Neden |
|---|---|---|
| [chadneiro1/Smc_ZOB_CISD](https://github.com/chadneiro1/Smc_ZOB_CISD) | **Orta** | MT5 için SMC (order block, CISD onayı, çok zaman dilimli trend filtresi) EA'sı. MQL5 kodu okunabilir — order block / CISD **tanımının** nasıl kodlandığını görmek, kendi `catalog/patterns` referans belgelerimize kaynak olarak eklenebilir (doğrulanmamış, "KONTROL ET" etiketiyle). |
| [KVignesh122/MT5-SMC-trading-bot](https://github.com/KVignesh122/MT5-SMC-trading-bot) | **Orta** | Order Block/FVG/BOS + ATR/seans filtreleri. Aynı şekilde tanım karşılaştırması için okunur. |
| [geraked/metatrader5](https://github.com/geraked/metatrader5) | **Orta** | MQL5 ile çeşitli stratejilerin backtest implementasyonu — "MT5 native backtest nasıl yazılır" referansı. |
| [mt5_api (cross-platform MT5-Python bridge)](https://github.com) *(arama sonucunda isim geçti, repo linki doğrulanmadı)* | **Düşük** | Bizim zaten çalışan `tools/mt5-bridge/bridge.py`'mız var; alternatif bağlantı yöntemi olarak not, acil değil. |
| ForexFactory/MQL5 Market'teki "ücretsiz EA" koleksiyonları (ASSARV9, xBest EA, Ultimate Forex EA, vb.) | **Düşük** | Genelde kaynak kodu paylaşılıyor ama **kalite, test, doğruluk garantisi yok** — çoğu forum EA'sı "canlıda karlı" iddiasıyla paylaşılıyor, bizim kural 8'imiz (yetenek uydurma) ve kural 6 (AI/iddia uydurmaz) açısından **doğrulanmadan hiçbir mantık alınmamalı**. Yalnızca "popüler fikir ne" diye göz gezdirmeye değer. |

**Özet:** MT5 tarafında asıl değer, order block/CISD gibi **SMC alt kavramlarının farklı insanlar tarafından nasıl parametrik hale getirildiğini** görüp kendi `catalog/patterns/smc.json`'daki eksik 8 alt kavram (displacement, order_block, ifvg, breaker, equal_highs_lows, premium_discount, ote, candidate_sr) için **çapraz referans** toplamak — kod almak değil.

## 3. SMC/ICT'ye özel Python paketleri

| Kaynak | Lisans | Fayda | Neden |
|---|---|---|---|
| [joshyattridge/smart-money-concepts](https://github.com/joshyattridge/smart-money-concepts) | MIT | **Yüksek** | ICT kavramlarını (order block, FVG, BOS/CHoCH, likidite süpürme, premium/discount) Python/pandas ile parametrik olarak kodlamış, popüler (çatallanmış kopyaları da aramada çıktı — orijinali bu). Bizim M9'un "SMC'nin eksik 8 alt kavramı" adımı için **en iyi tek referans**: tanımları karşılaştırıp kendi v1 belgelerimizi (`docs/definitions/`) yazarken "bu da böyle yapmış" diye kıyaslanabilir. **Kod kopyalanmaz** (lookahead/onay-zamanı garantisi onlarda yok, bizdeki gibi `confirmedIndex` kavramı muhtemelen eksik) — sadece parametre/tanım fikri. |
| [GeneralTradingSarl/Smart-Money-Concepts](https://github.com/GeneralTradingSarl/Smart-Money-Concepts) | — | **Orta** | MT5 indikatör versiyonu, aynı kavramların MQL5 tarafı. |
| TradingView LuxAlgo "Smart Money Concepts" scripti | Tescilli (TradingView lisansı) | **Düşük** | Kod kapalı/korumalı; sadece görsel/kavramsal fikir için bakılabilir, hiçbir şey alınamaz (lisans). |

## 4. Mum/grafik formasyonu tespit kütüphaneleri (M9 ile doğrudan ilgili)

| Kaynak | Lisans | Fayda | Neden |
|---|---|---|---|
| [djoffrey/HarmonicPatterns](https://github.com/djoffrey/HarmonicPatterns) | — (kontrol et) | **Yüksek** | 9 harmonik formasyon (ABCD, Gartley, Bat, Alt-Bat, Butterfly, Crab, Deep Crab, Shark, Cypher) — bizim M9 Adım 4'teki (9 harmonik) **tam karşılık geliyor**. Oranları/toleransları karşılaştırıp TA-Lib'de yaptığımız gibi oracle-tarzı doğrulama için kullanılabilir — ama **lisansı doğrulanmadan** hiçbir sayısal eşik kullanılmamalı (kural 8). |
| [BennyThadikaran/stock-pattern](https://github.com/BennyThadikaran/stock-pattern) | AGPL-3.0 (kontrol et) | **Orta** | Pivot tabanlı grafik formasyonu tarayıcı (CLI) — M9 Adım 3'teki "21 grafik formasyonu, pivot tabanlı, swing v1'e bağlı" fikrine çok yakın mimari. AGPL ise kopyalama **yasak**, sadece algoritma fikrine bakılır. |
| [gilson0516/pt-lib](https://github.com/gilson0516/pt-lib) | — (kontrol et) | **Orta** | 28 formasyon (harmonik dahil), pivot çerçevesi üstüne kurulu — stock-pattern'ın bir türevi gibi görünüyor, aynı dikkatle (lisans + doğrulama) bakılmalı. |
| [pandas-ta](https://github.com/twopirllc/pandas-ta) (TA-Lib kurulduğunda 60 mum formasyonu da ekliyor) | MIT | **Orta** | Zaten TA-Lib'i oracle olarak kullanıyoruz; pandas-ta ekstra değer katmıyor ama "TA-Lib'siz de mum formasyonu nasıl kodlanır" örneği olarak saf-Python referansı var. Bakımı ~2 yıldır durağan. |

**Özet:** Bu kategori **en yüksek doğrudan fayda** — M9'un kalan 58 mum + 21 grafik + 9 harmonik formasyonunu yazarken, TA-Lib'in kapsamadığı (harmonikler, grafik formasyonları) kısımlar için `djoffrey/HarmonicPatterns` ve `stock-pattern` **referans/çapraz-kontrol** kaynağı olabilir. Lisans kontrolü yapılmadan hiçbir eşik/oran değeri doğrudan koda geçirilmeyecek (kural 8 + CLAUDE.md "yetenek uydurma").

## 5. Hugging Face — ML/AI finans modelleri ve veri setleri

| Kaynak | Fayda | Neden |
|---|---|---|
| [FinGPT (AI4Finance-Foundation)](https://github.com/ai4finance-foundation/fingpt) | **Düşük (bizim için), Orta (genel ilgi)** | Açık kaynak finans LLM'i — haber/duygu analizi odaklı. Bizim projemiz "AI olasılık uydurmaz" kuralına **tam ters** bir kategori (LLM'den sinyal/tahmin üretme); kullanılmaz ama ekosistemi anlamak için not edildi. |
| [FinRL (AI4Finance-Foundation)](https://github.com/AI4Finance-Foundation/FinRL) | **Düşük** | Pekiştirmeli öğrenme ile otomatik trading — kural 6 ve kural 7'ye (gerçek emir, AI karar) doğrudan karşıt bir felsefe. Akademik ilgi dışında projeye uygun değil. |
| [JonusNattapong/xauusd-trading-ai-smc-v2](https://huggingface.co/JonusNattapong/xauusd-trading-ai-smc-v2) | **Düşük** | XAUUSD için SMC+XGBoost "trading AI" modeli — tam olarak kaçındığımız şey: ölçülmemiş/doğrulanmamış "AI sinyali". Örnek olarak not edildi, **kullanılmayacak**. |
| foduucom/stockmarket-pattern-detection-yolov8 | **Düşük** | Ekran görüntüsünden YOLOv8 ile grafik formasyonu tespiti — ilginç teknik ama bizim "deterministik, sayısal kurallardan" yaklaşımımızla örtüşmüyor (görüntü tabanlı, kara kutu). |

**Özet:** Hugging Face tarafı bizim mutlak kurallarımızla (özellikle kural 6) en çok **gerilim** yaratan kategori — "AI tahmin/sinyal üretir" felsefesi bizim projenin tam karşıtı. Buradan hiçbir şey doğrudan kullanılmayacak; sadece "pazarda ne satılıyor, biz neden farklı bir şey yapıyoruz" diye referans değeri var.

## 6. n8n / otomasyon workflow'ları (senin ayrı araştırdığın konuyla kesişiyor)

| Kaynak | Fayda | Neden |
|---|---|---|
| [n8n.io: "Forex & gold trading signal handler for MT5 using webhooks"](https://n8n.io/workflows/11439-forex-and-gold-trading-signal-handler-for-mt5-using-webhooks-telegramdiscord/) | **Orta** | TradingView/Telegram/Discord sinyalini webhook ile MT5'e ileten hazır şablon — bizim mevcut okuma-amaçlı `bridge.py`'ımızla **aynı yönde değil** (bu şablon emir göndermeyi otomatikleştiriyor, bizim kural 7'miz "emri her zaman kullanıcı verir" diyor). Mimari fikir olarak (webhook → filtre → log) ilginç, emir gönderme kısmı **hiç kullanılmayacak**. |
| [n8n.io: "Automated cryptocurrency trading bot with ICT methodology, GPT-4o & Coinbase"](https://n8n.io/workflows/8453-automated-cryptocurrency-trading-bot-with-ict-methodology-gpt-4o-and-coinbase/) | **Düşük** | GPT-4o'dan ICT yorumuyla otomatik emir — kural 6 ve 7'nin ikisine de karşıt (AI karar verip otomatik emir). Örnek olarak not edildi, **model olarak kullanılmaz**. |
| n8n "trade log → Google Sheets" şablonları | **Orta** | İşlem günlüğünü otomatik dışa aktarma fikri — bizim M7.2 (yedek/CSV dışa aktarma) özelliğimizle **kavramsal benzer**; istersen ileride "backup'ı n8n ile otomatik bir yere yedekle" gibi bir entegrasyon fikri olabilir, ama bu senin kendi n8n araştırman kapsamına daha yakın. |

**Özet:** n8n ekosisteminde gördüklerimin çoğu "AI yorumlasın + otomatik emir gönder" şeklinde — ikisi de bizim mutlak kurallarımıza aykırı. Senin "araştırma botu" fikrine (YouTube stratejisi → şema → backtest, bkz. hafıza notu) daha yakın olanlar yok; bu yüzden n8n tarafında kendi aramanı yaparken "sinyal→otomatik emir" şablonlarını referans almamanı, "veri işleme/günlükleme" şablonlarını (webhook, Google Sheets, dosya işleme gibi) referans almanı öneririm.

## 7. Forumlar ve topluluklar (kod değil, tartışma/EA paylaşımı)

| Forum | Fayda | Not |
|---|---|---|
| [ForexFactory — EA/strateji forumları](https://www.forexfactory.com/) | **Düşük-Orta** | Binlerce "ücretsiz EA" paylaşımı var ama **kalite kontrolsüz** — çoğu kez karlılık iddiası kanıtsız (tam olarak CLAUDE.md'nin kaçındığı şey). Yalnızca "popüler strateji fikirleri ne" diye göz atmaya değer, kod/istatistik güvenilmez. |
| [BabyPips forumu](https://forums.babypips.com/) | **Orta** | Daha eğitim-odaklı, forex öğrenmek için iyi (sen de öğrenci olduğun için ilgini çekebilir), ama otomatik bot tarafı zayıf — çoğunlukla "bot API'nin üstüne nasıl eklenir" tartışması. |
| [EliteTrader forumu](https://www.elitetrader.com/) | **Düşük** | Daha çok hisse/vadeli odaklı, bahsedilen açık kaynak projeler (AlgoTrader, OpenQuant, JSystemTrader) eski/bakımsız. |
| [Trade2Win forumu](https://www.trade2win.com/) | **Düşük** | Benzer şekilde eski açık kaynak projeler (TickZoom, TradeLink, Cyan Spring) — çoğu artık aktif değil, tarihsel referans değeri var. |
| [QuantConnect forumu](https://www.quantconnect.com/forum/) | **Orta** | Lean motorunu kullananların forex-özel tartışmaları (örn. "Forex Day Trading Strategy using the Algorithm Framework") — Lean'i referans olarak okursak burası da yardımcı olur. |
| Reddit (r/algotrading, r/Forex) | **Orta** | Arama motoru doğrudan Reddit içeriğine erişemedi (site:reddit.com sonuç vermedi) — **bunu sen tarayıcıdan bakman daha güvenilir olur**, ben dolaylı kaynaklardan (TeamBlind, ikincil siteler) birkaç referans buldum ama birincil değil. |
| Discord sunucuları (Code & Candles, ChartPrime, Elite Signals, CompendiumFi, EasyTradingBots) | **Düşük** | Çoğu "ücretli sinyal servisi" pazarlaması — kural 9'daki "sinyal paylaşımı önce SPK kontrolü" uyarımızın tam karşılaştığı model. Gözlem için ilginç (pazarda talep var), **model alınmayacak**. |

---

## En faydalı 10 kaynak (hızlı liste)

1. **[joshyattridge/smart-money-concepts](https://github.com/joshyattridge/smart-money-concepts)** — SMC tanım referansı (M9 için).
2. **[djoffrey/HarmonicPatterns](https://github.com/djoffrey/HarmonicPatterns)** — 9 harmonik formasyon referansı (M9 Adım 4).
3. **[BennyThadikaran/stock-pattern](https://github.com/BennyThadikaran/stock-pattern)** — pivot tabanlı grafik formasyonu mimarisi (M9 Adım 3, lisans kontrolü gerekli — AGPL).
4. **[QuantConnect/Lean](https://github.com/QuantConnect/Lean)** — kurumsal ölçekte "tek motor, backtest+canlı" mimarisi.
5. **[chadneiro1/Smc_ZOB_CISD](https://github.com/chadneiro1/Smc_ZOB_CISD)** ve **[KVignesh122/MT5-SMC-trading-bot](https://github.com/KVignesh122/MT5-SMC-trading-bot)** — MQL5 tarafında order block/CISD tanım karşılaştırması.
6. **[backtrader](https://github.com/mementum/backtrader)** — execution/fill mantığı karşılaştırması (bizim `execution/` modülümüze benzer problem alanı).
7. **[pandas-ta](https://github.com/twopirllc/pandas-ta)** — TA-Lib'siz saf-Python mum formasyonu referansı.
8. **[GeneralTradingSarl/Smart-Money-Concepts](https://github.com/GeneralTradingSarl/Smart-Money-Concepts)** — SMC'nin MT5/MQL5 indikatör versiyonu.
9. **QuantConnect forumu** — forex'e özel pratik tartışmalar.
10. **n8n.io workflow kütüphanesi** (sinyal→otomatik emir şablonları hariç, veri/günlükleme şablonları dahil) — senin n8n araştırman için başlangıç noktası.

## CLAUDE.md ile çatışan / dikkat edilmesi gereken noktalar

- **Kural 6 (AI olasılık uydurmaz) ve kural 7 (gerçek para yok):** taranan kaynakların büyük kısmı (Hugging Face AI modelleri, n8n "AI yorumla + otomatik emir gönder" şablonları, Discord sinyal servisleri) tam bunun karşıtı bir felsefeyle çalışıyor. Bunlardan **hiçbiri model olarak kullanılmayacak** — sadece "pazarda ne var" diye not edildi.
- **Kural 8 (yetenek uydurma):** forum EA'leri ve bazı GitHub repoları (lisans belirtilmemiş, "kontrol et" etiketli) **doğrulanmadan hiçbir sayısal eşik/formül koda geçirilmeyecek** — tıpkı TA-Lib'de yaptığımız oracle-doğrulama disiplini gibi.
- **Lisans:** AGPL (stock-pattern gibi) kopyalamaya kapalı; MIT/Apache/BSD olanlar (smart-money-concepts, HarmonicPatterns'ın lisansı kontrol edilmeli, pandas-ta, Lean) daha güvenli referans.

## Önerilen kullanım

Sen bu listeye tek tek bakarken, her kaynağı incelerken şu soruyu sorman işini hızlandırır: *"Bu bana bir **tanım/algoritma fikri** mi veriyor (M9'a girer), yoksa bir **ürün/otomasyon fikri** mi (bizim kural 6/7 ile çatışıyor, kullanılmaz)?"* İlk gruptakileri bana getirirsen (örn. "HarmonicPatterns'daki Gartley oranını incele, bizimkiyle karşılaştır") somut bir sonraki M9 dilimine çevirebiliriz.
