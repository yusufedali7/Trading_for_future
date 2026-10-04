# Tanım: Session (seans) — v1

Kod: `packages/engine/src/session/sessions.ts`, `packages/engine/src/session/levels.ts`

## Tanım
Seans, yerel duvar saatiyle tanımlanmış bir zaman aralığıdır (`tz`, `start`, `end`, `days`). Her işlem günü için bir **seans örneği** üretilir; örneğin "2026-03-16 Londra seansı". Örneğin UTC başlangıç ve bitişi, IANA saat dilimi verisiyle hesaplanır, yani yaz saati otomatik uygulanır.

| Parametre | Anlam |
|---|---|
| `tz` | IANA saat dilimi (`Europe/London`) |
| `start`, `end` | Yerel `HH:mm`. `end <= start` ise seans ertesi yerel günde biter. |
| `days` | Yerel başlangıç gününün ISO hafta günleri (1 = Pazartesi … 7 = Pazar) |
| `version` | Tanım değişirse artırılır; sonuçlar sürüme bağlıdır. |

## Yerleşik varsayılanlar (v1)
| id | Ad | Yerel saat | UTC (kış / yaz) |
|---|---|---|---|
| `ASIA` | Asya (Tokyo) | 09:00–18:00 Asia/Tokyo | 00:00–09:00 (Japonya yaz saati uygulamaz) |
| `LONDON` | Londra | 08:00–17:00 Europe/London | 08:00–17:00 / 07:00–16:00 |
| `NEW_YORK` | New York | 08:00–17:00 America/New_York | 13:00–22:00 / 12:00–21:00 |

**Varsayım:** Bu saatler yaygın kullanımdır ama resmi bir tanım değildir. ICT tarzı "Asya aralığı" (20:00–00:00 New York) gibi farklı tanımlar kullanıcı seansı olarak eklenebilir (M6.1, D35). Aynı motorla hesaplanırlar; seviyeleri `<KİMLİK>_HIGH` / `<KİMLİK>_LOW` adıyla süpürme seviyesi olur.

## Seans seviyeleri (high/low)
- 1 dakikalık taban veriden hesaplanır. Bu yüzden grafikte hangi zaman dilimine bakılırsa bakılsın sonuç aynıdır.
- Hesaba yalnızca `asOf` anına kadar **kapanmış** mumlar girer.
- **Onay gecikmesi:** high ve low, seans bitene kadar "devam eden" değerdir (`complete: false`, `knownAt = asOf`). Seans bitince kesinleşir (`complete: true`, `knownAt = endUtc`). Strateji ve backtest ancak `knownAt` sonrasında bu seviyeleri kullanabilir.
- **Kanıt:** Her kesme noktası için, veri o noktada kesildiğinde elde edilen sonuç tam veriyle aynı çıkıyor (kesme değişmezliği testi).

## Kenar durumları ve bilinen sınırlar
- **Yaz saati boşluğu ve çakışması:** Başlangıç saati olmayan bir saate denk gelirse boşluk kadar ileri kaydırılır. İki kez yaşanan bir saate denk gelirse ilk an seçilir. FX'te DST değişimleri hafta sonu olduğu için pratikte görülmez.
- **Kapalı piyasa:** Piyasanın tamamen kapalı olduğu günlerde (hafta sonu) seans oluşmaz.
- **Tatiller:** Tatil takvimi henüz yok. Tatil gününde seans oluşur ama `barCount = 0` ya da düşük olur. Arayüz bunu "veri yok" ya da "eksik" olarak gösterir.
- **Veri boşluğu:** Seans içinde eksik dakikalar varsa high/low yalnızca mevcut mumlardan hesaplanır. `barCount` bu durumu görünür kılar.
- Seanslar birbiriyle çakışabilir (Londra–New York). Her biri bağımsız hesaplanır.
