# PLAN — M6.4: Kavram kütüphanesi

> Durum: **tamamlandı (2026-10-05)**, görev 1–5. Kullanıcı 2026-10-05'te "kaldığımız adımdan devam, önce bitirelim" dedi; yol haritasında kalan iki adım kavram kütüphanesi ve AI araştırma asistanı. Bu taş kavram kütüphanesi. Karar `docs/DECISIONS.md` D40.

## Amaç
Uygulamanın kullandığı her kavramı (swing, FVG, yapı kırılımı, likidite süpürmesi, önceki gün/hafta seviyeleri, seanslar) tek yerde öğretmek: ne olduğu, motorun tam tanımı, **gerçek veriden** örnekler, **gerçek veriden** "beklendiği gibi gitmeyen" örnekler ve sınırlar. Ürünün "eğitim" ayağının çekirdeği.

## Kurallar
- **Veri yoksa örnek yok (kural 1).** Örnekler ve sayılar yalnızca yüklü veri kümesinden; yoksa boş durum. Açıklamalar statik eğitim içeriğidir.
- **Tek motor.** Örnekler grafikteki adaylarla aynı `computeFeatures` çıktısından gelir; "grafikte göster" grafiği o ana götürür.
- **Başarısızlık ölçütü açık ve versiyonlu (`outcome-v1`).** Her kavram için tek, fiyat tabanlı bir ölçüt: onaydan sonraki N mum içinde belirli bir fiyatın gerisine **kapanış**. Bu bizim tanımımızdır, ICT/SMC'nin resmi tanımı değildir; ekranda böyle yazar.
- **İleriye bakma yok.** N mum tamamlanmadan sonuç "henüz belli değil" (bekliyor). Kesilmiş veride sonuçlanan her aday, tam verideki sonucuyla aynı (kesme değişmezliği testi).
- **Olasılık uydurma yok (kural 6).** Gösterilen oran yalnızca "bu veri kümesinde, bu zaman diliminde ölçülen sıklık"tır; 30'dan az sonuçlanmış örnekte uyarı.

## Başarısızlık ölçütü (outcome-v1, varsayılan N = 12 mum)
| Kavram | Yaygın beklenti | "Beklendiği gibi gitmedi" |
|---|---|---|
| Swing tepe / dip | Seviye direnç / destek olur | N mum içinde tepenin üstüne / dibin altına kapanış |
| FVG yükseliş / düşüş | Boşluk destek / direnç olur | N mum içinde boşluğun alt / üst kenarının gerisine kapanış (tamamen geçildi) |
| Yapı kırılımı yükseliş / düşüş | Kırılım yönünde devam | N mum içinde kırılan seviyenin tekrar gerisine kapanış (sahte kırılım) |
| Likidite süpürmesi yükseliş / düşüş | Süpürmeden sonra dönüş | N mum içinde süpürme fitilinin ucunun gerisine kapanış (dönüş olmadı) |

Önceki gün/hafta seviyeleri ve seanslar v1'de yalnızca tanım + örnek; başarısızlık ölçülmez.

## Görevler
| # | Görev | Test |
|---|---|---|
| 1 | Motor: `features/outcomes.ts` — `featureOutcomes(bars, features, { horizonBars })` → her aday için HELD / FAILED / PENDING + `failedAt`; kavram bazında özet | Elle yazılmış SYNTHETIC örnekler; bekleyen; kesme değişmezliği |
| 2 | İçerik: `apps/web/src/content/concepts.ts` — sade açıklama, grafikte nasıl okunur, parametreler, onay gecikmesi, beklenti/başarısızlık metni, sınırlar (tanım belgelerinden), sözlük terimleri | İçerik her motor kavramını kapsıyor |
| 3 | Grafik: dışarıdan "şu ana git" (`focus`) + ilgili katmanı açma | Adaptör/uygulama testi |
| 4 | Arayüz: "Kavramlar" sekmesi — liste + kavram kartı; grafikteki veri ve zaman diliminden örnek sayısı, "örnek göster ‹ ›", başarısızlık örnekleri, N ayarı, ölçülen sıklık + düşük örnek uyarısı | App testi (veri yok, örnek, başarısızlık, grafiğe gitme) |
| 5 | Belgeler: D40, sözlük, DEVIR | — |
