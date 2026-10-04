# MT5 köprüsü (yalnız okuma, yalnız demo)

Bilgisayarında açık olan MetaTrader 5 **demo** terminalinden 1 dakikalık mumları okuyup Trading Research Workstation'a veren küçük bir yerel program (M6.3, karar D39).

## Ne yapar, ne yapmaz

- Yalnızca fiyat okur: `/status` (hesap türü, sunucu adı, son tik zamanı) ve `/rates` (kapanmış 1m mumlar).
- **Emir göndermez**; MetaTrader5 paketinin emir/pozisyon fonksiyonlarını hiç çağırmaz (testle kontrol edilir).
- Hesap **DEMO değilse** hiç veri vermez ve açılışta kendini kapatır.
- Yalnızca `127.0.0.1:8765` adresinde dinler; yalnızca uygulamanın adresinden (`localhost:5173`) gelen isteklere cevap verir.
- Şifreni ya da hesap numaranı bilmez; MT5'te zaten giriş yapmış olman yeterli.

## Kurulum (bir kez)

1. MetaTrader 5'i resmi siteden kur ve bir demo hesap aç (adımlar sohbette ve `DEVIR.md`'de).
2. Python paketini kur:
   ```
   py -m pip install MetaTrader5
   ```

## Çalıştırma

1. MT5'i aç, demo hesaba giriş yap; Piyasa Gözlemi'nde EURUSD görünsün.
2. Proje klasöründe:
   ```
   py tools/mt5-bridge/bridge.py
   ```
   "MT5 köprüsü hazır" yazısını görünce uygulamada **Paper → Şimdi güncelle**.
3. Durdurmak için pencerede `Ctrl+C`.

## Sorun giderme

- **"MetaTrader 5 terminaline bağlanılamadı":** MT5 açık değil ya da giriş yapılmamış.
- **"Hesap türü REAL":** Köprü gerçek hesapla çalışmaz; demo hesaba geç.
- **Uygulamada "Piyasa kapalı":** Sunucu saati farkı ancak piyasa açıkken ölçülür (hafta sonu güncelleme yapılmaz).
- **"Broker bu sembolü tanımıyor":** Piyasa Gözlemi'ndeki adı (ör. `EURUSD.m`) uygulamadaki "Broker sembolü" alanına yaz.

## Test

```
npm run test:bridge
```

(MT5 gerekmez; sahte bir MetaTrader5 modülüyle çalışır.)
