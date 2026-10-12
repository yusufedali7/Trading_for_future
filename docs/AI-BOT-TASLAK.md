# AI / Quant Bot taslağı

Bu bir görev değil, tartışma dokümanı. Açık sorular yanıtlanıp onaylanmadan M11'de kod yazılmaz.

## Amaç

Kaydedilmiş bir strateji versiyonunun koşullarını canlı ya da paper veride izlemek; koşullar sağlandığında yön, giriş, stop, hedef ve lot miktarını göstermek. Emri her zaman kullanıcı verir.

## Kapsam dışı (CLAUDE.md'deki kuraldan)

- Otomatik emir gönderme yok.
- "Al" / "Sat" komutu yok; yalnızca "şu koşullar sağlandı, şöyle görünüyor" bilgisi.
- Kazanma olasılığı uydurma yok; yalnızca o stratejinin kayıtlı backtest ya da paper istatistiklerine referansla.

## Nasıl çalışabilir (öneri, tartışmaya açık)

1. Kullanıcı bir strateji versiyonunu "izlemeye al" diye işaretler. Yalnızca `TESTING` ya da sonrası durumdaki stratejiler izlenebilir; `IDEA`/`RESEARCH` olanlar izlenemez.
2. Motor, M4'teki aynı dedektörleri ve M5'teki aynı strateji değerlendiricisini canlı/paper veri akışında artımlı çalıştırır. Ayrı bir "canlı kural motoru" yazılmaz; M4-M5'in kodu yeniden kullanılır.
3. Bir kural setinin tüm adımları sağlandığında bir **sinyal taslağı** oluşur: enstrüman, zaman, yön, hangi koşulların sağlandığı (ör. "sweep ✓, MSS ✓, FVG ✓"), önerilen giriş/stop/hedef, risk motorundan hesaplanan lot (kullanıcının girdiği risk % ve hesap bakiyesiyle, mevcut hesaplayıcı kullanılarak).
4. Taslak arayüzde gösterilir ve/veya dışarı bildirim gider (ör. n8n → Telegram). Kullanıcı isterse MT5/TradingView'e kendi eliyle girer.
5. Her taslak kayıt olur: zaman damgası, strateji versiyonu, koşullar, sonradan "kullanıcı aldı mı, almadıysa neden" notu. İstenirse işlem günlüğüne bağlanabilir.

## Açık sorular — önce bunlar netleşmeli

- **Hangi stratejiler bu bota bağlanabilir?** — **Açık, kullanıcı araştırıyor (2026-10-12).** Geçici/değiştirilebilir varsayım: yalnızca `TESTING` ve sonrası (`IDEA`/`RESEARCH` asla) — bu eşik kodda tek bir sabit olarak tutulacak, kullanıcı araştırmasını bitirince tek satırla değişebilir (örn. `VALIDATED_ON_SAMPLE`'a yükseltilebilir).
- **Bir strateji aynı anda birden fazla enstrümanda mı izlenecek?** — **Cevaplandı:** Hayır, gerek yok. Bunun yerine birden fazla FARKLI strateji versiyonu (her biri kendi tek enstrümanıyla, backtest'i o enstrümanda yapılmış) aynı anda izlenebilir — bu zaten motorun doğal çalışma şekli, ekstra bir mekanizma gerektirmiyor. ("Aynı kuralı başka bir enstrümanda dene" istenirse, o enstrüman için ayrı bir versiyon oluşturup kendi verisiyle yeniden backtest etmek gerekir — kural 1 gereği, hiç ölçülmemiş bir enstrümana rastgele uygulanmaz.)
- **Sinyal taslağı ne kadar süre geçerli kalır?** — **Cevaplandı (motor zaten çözüyor):** Stratejinin kendi `entry` kuralı zaten bunu taşıyor — `LIMIT_AT`/`STOP_AT` girişlerin `expireBars`'ı taslağın geçerlilik süresi; `MARKET` girişte taslak sinyal barının kapanışından hemen sonraki bar için geçerlidir (ek bir "taslak TTL" kavramı icat edilmedi).
- **Bildirim kanalı** — **Cevaplandı:** Kullanıcı n8n → Telegram kurguluyor (kendi tarafında). Uygulama tarafı: her yeni sinyal taslağında kullanıcının verdiği bir URL'e JSON POST eden basit bir webhook.
- **İki strateji aynı anda çakışan (farklı yönde) sinyal verirse arayüzde nasıl gösterilir?** — **Cevaplandı:** Hiçbir taslak gizlenmez/bastırılmaz (kural 6'nın ruhu — sistem "hangisi doğru" demez). Çakışma tanımı: aynı enstrüman + aynı anda aktif (süresi dolmamış) iki taslak + zıt yön. Her ikisine de "Çakışan sinyal" uyarısı + kısa açıklama eklenir; bu bilgi webhook'a da taşınır.
- **MT5 köprüsü salt okunur mu kalacak?** — **Cevaplandı:** Evet, değişmiyor; yarı otomatik MT5 gönderimi gündemde değil ("otomatik emir gönderme işine daha çok var").

Bu liste tam değil; başka soru çıkarsa buraya eklenir. **2026-10-12:** kullanıcı "1. soruyu araştıracağım, diğerlerine başla, sinyal taslağını istediğin gibi tasarla" dedi — bu yüzden aşağıdaki ilk dilim bu cevaplarla, 1. sorunun geçici varsayımıyla kuruldu (bkz. D68).
