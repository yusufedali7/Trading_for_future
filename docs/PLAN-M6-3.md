# PLAN — M6.3: Paper trading + MetaTrader 5 veri köprüsü

> Durum: kullanıcı 2026-10-04'te MT5 demo ile devam etmeyi seçti. **Görev 1–5 tamamlandı (2026-10-04).** Görev 6: köprü ve feed gerçek MT5 demo hesabıyla **2026-10-05'te doğrulandı** (gerçek 10.080 mum çekildi, sunucu saati farkı ölçüldü). Kalan: kullanıcının EURUSD için bir strateji kaydedip gerçek bir paper oturumu başlatması. Karar `docs/DECISIONS.md` D39.

## Amaç
Bir strateji versiyonunu **ileriye dönük** (forward) olarak, başladığı andan sonra gelen yeni veride kağıt üzerinde çalıştırmak. Veri, kullanıcının bilgisayarında açık olan MT5 **demo** terminalinden yerel bir köprüyle okunur. Gerçek emir yok (kural 7).

## Kurallar
- **Yalnızca okuma:** Köprü MT5'ten fiyat okur; emir fonksiyonlarını hiç çağırmaz. Hesap demo değilse (`trade_mode` ≠ DEMO) veri vermez.
- **Yalnızca yerel:** Köprü 127.0.0.1'de dinler; yalnızca uygulamanın adresinden gelen istekleri kabul eder. Şifre ve hesap bilgisi uygulamaya gelmez.
- **Saat:** MT5 mum zamanları broker sunucu saatinde gelir. Köprü ham sunucu zamanını ve son tik zamanını verir; uygulama farkı **ölçer** (15 dk'ya yuvarlar); fark ölçülemiyorsa (piyasa kapalı) veri UTC'ye çevrilmez ve uyarı verilir. Tahminle sabit ofset yazılmaz.
- **Ayrı veri kümesi:** Broker verisi Dukascopy kümesine eklenmez; kendi kümesi olur (kaynak adı "MT5: <sunucu>"). Fiyatlar birebir aynı değildir; karşılaştırmalar bunu belirtir.
- **İleriye dönük:** Paper oturumu başladığı andan (`startedAt`) sonra onaylanan kurulumları işler; geçmiş "boyanmaz". Açık işlemler oturum boyunca açık kalır (aralık sonunda kapatılmaz).
- **Aynı motor:** Kurulum ve dolum kuralları backtest ve replay ile aynıdır (D26, D32).

## Görevler
| # | Görev | Test |
|---|---|---|
| 1 | Motor: backtest'e "açık işlemleri kapatma" seçeneği (paper), açık/bekleyen işlem durumu | Açık işlem aralık sonunda açık kalır; kapalılar aynı |
| 2 | Köprü: `tools/mt5-bridge/bridge.py` (stdlib HTTP + MetaTrader5): `/status`, `/rates`; demo kontrolü, sunucu saati farkı ölçümü, CORS | Saf Python fonksiyonları için birim testi (MT5 olmadan) |
| 3 | Uygulama: MT5 adaptörü (köprüden 1m mumları çek, doğrula, kendi veri kümesine ekle) | Sahte köprüyle test |
| 4 | Depolama: paper oturumları (`trw-research` v3) | Gidiş-dönüş |
| 5 | Arayüz: "Paper" sayfası: köprü durumu, oturum başlat/durdur, açık / bekleyen / kapanan işlemler, otomatik güncelleme | App testi |
| 6 | Gerçek MT5 demo ile deneme (kullanıcı hesabı açınca), belgeler | Tarayıcı |
