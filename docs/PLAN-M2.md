# PLAN — M2: Session ve manuel analiz

> Durum: kullanıcı 2026-10-01'de "M2'ye başla, hız kesme" dedi; plan bu belgeyle kaydedildi ve uygulamaya geçildi. Görev 1–9 tamamlandı (2026-10-01). Kararlar `docs/DECISIONS.md` (D23–D25).

## Amaç
Grafikte Asya, Londra ve New York seanslarını, her birinin en yüksek ve en düşük seviyesiyle kutu olarak görmek. Elle çizim yapmak: yatay çizgi, trend çizgisi, bölge, fiyat aralığı ve long/short pozisyon aracı. Destek/direnç seviyelerini meta verileriyle (tür, zaman dilimi, not, durum) kaydetmek. Bunların hepsi kalıcı olacak.

## Kapsam
1. **Session engine (motor, saf):** seans tanımları yerel saatle yapılır. Örneğin "Londra 08:00–17:00 Europe/London". Seans örnekleri UTC'ye DST'ye uygun olarak çevrilir. Gece yarısını aşan seanslar desteklenir. Piyasanın kapalı olduğu günlerde seans oluşmaz.
2. **Session high/low (motor):** 1m taban veriden hesaplanır, hangi zaman diliminde bakılırsa bakılsın aynıdır. `complete` ve `knownAt` alanları taşır. Seans bitmeden high/low "kesin" değildir; grafik bunu ayrı bir görünümle gösterir (lookahead kuralı).
3. **Seans kutuları (arayüz):** Lightweight Charts series primitive ile çizilir. Seanslar açılıp kapatılabilir. Motor çıktısı olduğu için (`source: ENGINE`) kesik kenarlı ve etiketli gösterilir.
4. **Koordinat yardımcıları:** UTC zaman ↔ grafik x koordinatı dönüşümü. Kesirli "logical index" kullanılır, böylece bir çizim farklı zaman dilimlerinde de doğru yerde durur ve son mumun ötesine taşabilir. Fiyat ↔ y dönüşümü.
5. **Çizim modeli ve depolama:** `trw-user` veritabanına sürüm 2 şeması eklenir (`drawings`, `levels` tabloları). Çizimler enstrümana bağlıdır, tüm zaman dilimlerinde görünür.
6. **Çizim araçları:** araç çubuğu modları (seç, yatay çizgi, trend, dikdörtgen/bölge, fiyat aralığı, long, short). Çizimler tıklamayla oluşturulur. Seçme saf geometri hesabıyla yapılır; Delete tuşu siler. Özellik paneli: renk ve not.
7. **Destek/direnç seviyeleri:** yatay çizgi ya da bölgeden oluşturulur. Meta veri: tür (destek / direnç / rol değişimi), zaman dilimi, not, durum (aktif / kırıldı / retest / geçersiz), durum geçmişi. Seviyeler bir panelde listelenir.
8. **Sürükleme tutamakları:** seçili çizimin noktaları sürüklenerek taşınabilir.
9. Sözlük, DEVIR ve kararlar güncellenir.

## Kapsam dışı (M2)
Tatil takvimi (iyileştirme listesinde), otomatik tespitler (M4), replay (M3), lot hesabı (M5). Pozisyon aracı yalnızca R:R oranını ve pip mesafelerini gösterir.

## Görevler ve testler
| # | Görev | Testler |
|---|---|---|
| 1 | `session/definitions.ts`, `session/instances.ts` | DST haftaları (ABD/İngiltere farklı haftalar), gece yarısını aşan seans, hafta sonu atlama, belirsiz/olmayan yerel saat |
| 2 | `session/levels.ts`: high/low, complete, knownAt | Kesme değişmezliği (lookahead yok), seans içinde "devam eden" high/low, veri boşluğunda `barCount` |
| 3 | Hesaplama worker'ı seansları da döndürür; seans kutusu primitive'i; açma/kapama | Worker protokol testi; tarayıcıda görsel kontrol |
| 4 | `chart/coords.ts`: zaman ↔ x, fiyat ↔ y | Saf fonksiyon testleri (bucket içi kesir, son mumdan sonrası) |
| 5 | Çizim modeli + Dexie v2 + depo | Gidiş-dönüş, sürüm yükseltme (v1 tercihleri korunur) |
| 6 | Çizim araçları ve seçim | Geometri isabet testleri; App seviyesinde oluşturma ve silme |
| 7 | Destek/direnç paneli | Durum geçmişi, kalıcılık |
| 8 | Sürükleme tutamakları | Geometri testleri; tarayıcıda kontrol |
| 9 | Belgeler | — |

## Bitti kriteri
Gerçek EURUSD verisinde Londra ve New York kutuları DST geçişlerinde doğru saatte görünür. Çizimler ve seviyeler sayfa yenilenince korunur. Çizimler 15m ↔ 4H geçişinde aynı fiyat ve zamanda kalır. Tüm testler yeşildir.
