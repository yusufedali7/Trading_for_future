# PLAN — M7.2: Yedek ve dışa aktarma

> Durum: **tamamlandı (2026-10-06)**, görev 1–5. Kullanıcı 2026-10-06'da onayladı ("M8'den önce, küçük adım"; ekran görüntüleri dahil). Mutlak kural 10. Karar `docs/DECISIONS.md` D43.

## Amaç
Tarayıcıda tutulan kullanıcı, strateji ve araştırma verisinin kaybolmaması: tek dosyalık JSON yedek, güvenli geri yükleme, Excel için CSV, yedek hatırlatıcısı ve kalıcılık uyarısı.

## Kurallar
- **Yedekte:** çizimler ve seviyeler, replay işlemleri, işlem günlüğü ve ekran görüntüleri (base64), kullanıcı seansları, tercihler, stratejiler ve tüm versiyonları, backtest çalışmaları, hipotezler, paper oturumları. **Fiyat verisi yok** (büyük; CSV ya da MT5'ten yeniden alınır).
- **Geri yükleme hiçbir şeyin üzerine yazmaz.** Her kayıt kimliğiyle karşılaştırılır: yoksa eklenir, aynıysa atlanır, farklıysa "çakışma" olarak raporlanır ve mevcut korunur. Strateji versiyonları değişmez olduğu için bu kural onlar için de geçerli. Geçersiz kayıt (ör. bozuk çizim) eklenmez, sayılır.
- Önce özet (eklenecek / aynı / çakışan / geçersiz), sonra kullanıcı onayıyla yazma.
- Dosya biçimi sürümlüdür (`format: trw-backup`, `formatVersion: 1`, motor sürümü, tarih).
- **CSV:** işlem günlüğü ve backtest işlemleri. Türkçe Excel için `;` ayraç, ondalık virgül, UTF-8 BOM (varsayım: Türkçe bölge ayarları).
- **Hatırlatıcı:** kayıtlı çalışma varsa ve hiç yedek yoksa ya da son yedek 7 günden eskiyse başlıkta uyarı.
- **Kalıcılık:** `navigator.storage.persisted()` / `persist()` (MDN: Promise<boolean>, tarayıcı reddedebilir, güvenli bağlam gerekir; localhost güvenli sayılır, çalışırken `isSecureContext` kontrol edilir). Arayüzde "kalıcı kullanım için kendi tarayıcında aç" notu.

## Görevler
| # | Görev | Test |
|---|---|---|
| 1 | Depolar: tümünü listeleme ve "yoksa ekle" içe aktarma metotları (Dexie + bellek) | Gidiş-dönüş |
| 2 | `backup/`: yedek oluşturma, doğrulama, birleştirme planı, uygulama | Boş uygulamaya geri yükleme = aynı veri; ikinci yükleme hiçbir şey eklemez; çakışma korunur; bozuk dosya reddedilir |
| 3 | `backup/csv.ts`: günlük ve backtest işlemleri CSV | Ayraç, tırnak, satır sonu, ondalık virgül |
| 4 | Arayüz: başlıkta "Yedek" düğmesi ve penceresi, hatırlatıcı, kalıcılık durumu; backtest raporunda "CSV indir" | Uygulama testi, tarayıcıda deneme |
| 5 | Belgeler: D43, sözlük, DEVIR | — |
