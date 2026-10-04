# PLAN — M6.1: Özel seanslar

> Durum: kullanıcı 2026-10-04'te "devam edelim" dedi; plan kaydedildi ve uygulandı. **Görev 1–7 tamamlandı (2026-10-04).** Gerekçe: D34 (yerleşik Asya seansı Londra penceresiyle çakışıyor). Kararlar `docs/DECISIONS.md` D35–D36.

## Amaç
Kullanıcının kendi seanslarını tanımlayabilmesi (ör. ICT Asya aralığı 20:00–00:00 New York, Londra / New York kill zone) ve bu seansların her yerde yerleşik seanslar gibi çalışması: grafikte kutu, motor adaylarında süpürme seviyesi, strateji kurallarında seviye filtresi, backtest ve günlükte seans etiketi.

## Kurallar
- Seans tanımı yerel duvar saatiyle (IANA dilimi, başlangıç, bitiş, günler) yapılır; yaz/kış saati motor tarafından hesaplanır (D23 ile aynı motor).
- **Tekrarlanabilirlik:** Bir strateji özel bir seansın seviyesini kullanıyorsa, seansın o anki tanımı versiyonun içine kopyalanır (`spec.sessions`). Seans sonradan değiştirilse ya da silinse bile eski versiyonların backtest'i aynı sonucu verir.
- Seans kimliği büyük harf ve rakamlardan oluşur (`ICT_ASIA`); yerleşik kimlikler ve `SWING` kullanılamaz. Seviye adları `KİMLİK_HIGH` / `KİMLİK_LOW`.
- Hazır şablonlar (kullanıcı seçer, değiştirebilir): ICT Asya aralığı (20:00–00:00 New York, Pazar–Perşembe akşamları), Londra kill zone (02:00–05:00 New York), New York kill zone (07:00–10:00 New York). Bunlar yaygın kullanımdır, resmi tanım değildir.

## Görevler
| # | Görev | Test |
|---|---|---|
| 1 | Motor: seans tanımı doğrulama; süpürme seviyeleri her seans tanımıyla çalışır (sonraki oturum hesabı tanımdan) | Doğrulama, gece yarısını aşan seans, DST, kesme değişmezliği |
| 2 | Motor: strateji şemasında `sessions` (kopya) ve seviye referans kontrolü; istatistiklerde seans kırılımı tanımlardan | Şema doğrulama, hash geriye uyum |
| 3 | Depolama: `trw-user` v4 `sessions` | Gidiş-dönüş, sürüm yükseltme |
| 4 | Worker: grafik, replay, kurulum ve backtest seans tanımlarını alır | candle-source testleri |
| 5 | Arayüz: seans yöneticisi (ekle/düzenle/sil, şablonlar, renk), araç çubuğunda aç/kapa | App testi |
| 6 | Arayüz: strateji oluşturucuda özel seans seviyeleri; kayıtta kopyalama | App testi |
| 7 | Gerçek veriyle D34 stratejisini ICT Asya aralığıyla tekrar dene; belgeler | Tarayıcı |
