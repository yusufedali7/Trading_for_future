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

- Hangi stratejiler bu bota bağlanabilir? Yalnızca `VALIDATED_ON_SAMPLE` ve sonrası mı, yoksa `TESTING` de olur mu?
- Bir strateji aynı anda birden fazla enstrümanda mı izlenecek?
- Sinyal taslağı ne kadar süre geçerli kalır (stratejideki `expireBars` gibi)?
- Bildirim kanalı yalnızca uygulama içi mi, yoksa n8n/Telegram gibi dışarı da mı?
- İki strateji aynı anda çakışan (farklı yönde) sinyal verirse arayüzde nasıl gösterilir?
- MT5 köprüsü salt okunur kalmaya devam mı edecek, yoksa ileride "bu taslağı MT5'e emir taslağı olarak gönder, kullanıcı MT5 içinde onaylamadan tetiklenmez" gibi yarı otomatik bir adım düşünülecek mi? (Bu sorunun cevabı CLAUDE.md'deki "gerçek emir yok" kuralını değiştirmez, yalnızca arayüz akışını netleştirir.)

Bu liste tam değil; başka soru çıkarsa buraya eklenir.
