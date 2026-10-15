# Araştırma notları (tradingagents entegrasyonu)

Bu araç, `tradingagents` (TauricResearch, Apache-2.0) kütüphanesinin yalnızca **analist +
boğa/ayı tartışma** katmanını çalıştırıp yorumsuz, olasılıksız bir araştırma notu (JSON) üretir.
Tasarım: `docs/superpowers/specs/2026-10-14-tradingagents-research-notes-design.md`.

## Neden karar katmanı yok

`tradingagents`'ın asıl ürünü bir al/sat kararı (Trader → Risk → Portfolio Manager). Bu, projenin
Kural 6'sına ("AI olasılık/karar üretmez") doğrudan aykırı. Bu yüzden `trw_notes/graph.py` o
katmanı **hiç import etmiyor, hiç çağırmıyor, kodunda adını hiç geçirmiyor** — bu,
`tests/test_graph.py`'deki üç testle kanıtlanıyor:

- derlenmiş graph'ta "Research Manager", "Trader" gibi yasak bir düğüm yok,
- altı karar fabrikası hata fırlatan sahtelerle değiştirildiğinde bile hiçbir hata çıkmıyor
  (demek ki hiç çağrılmıyorlar),
- `trw_notes/` kaynak kodunda bu fabrikaların/`TradingAgentsGraph`'ın adı hiç geçmiyor.

## Kurulum

```bash
cd tools/research-notes
py -3.13 -m venv .venv
.venv\Scripts\python -m pip install --upgrade pip setuptools wheel
.venv\Scripts\python -m pip install -r requirements.txt pytest
```

Kurulum büyük paketler (pandas, numpy, langchain ailesi) indirdiği için yavaş bir bağlantıda
uzun sürebilir; kopma olursa yeniden çalıştırmak genelde yeterli (pip indirilenleri önbellekte
tutar).

Testleri çalıştırmak için: `.venv\Scripts\python -m pytest -q`

## .env

```bash
cp .env.example .env
```

Doldurman gereken: `ANTHROPIC_API_KEY` (varsayılan sağlayıcı). `.env` asla commit edilmez
(`.gitignore`'da). Ollama'ya (yerel, ücretsiz, anahtar gerekmez) geçmek için `.env.example`
içindeki yorumlu satırları aç.

## Çalıştırma

```bash
cd tools/research-notes
.venv\Scripts\python -m trw_notes --instrument EURUSD --asof 2026-10-14 --out out\eurusd.json
```

- `--instrument`: `EURUSD`, `GBPUSD`, `USDJPY`, `XAUUSD`.
- `--asof`: `YYYY-MM-DD`, hafta içi (forex hafta sonu kapalı — hafta sonu tarihi reddedilir).
- `--out`: yazılacak JSON dosyası. Yalnızca araştırma notu gerçekten üretilebilirse yazılır;
  anahtar eksikse ya da bir analist/LLM çağrısı başarısız olursa **hiçbir dosya yazılmaz**
  (Kural 1 — veri yoksa sonuç yok) ve komut sıfırdan farklı bir çıkış koduyla biter.
- `--analysts` (virgüllü, varsayılan `market,news`): `market`, `social`, `news`,
  `fundamentals` arasından seçilir. `fundamentals` forex'te genelde anlamlı değil (şirket
  bilançosu/kazanç verisi yok), bu yüzden varsayılanda yok; istersen `--analysts
market,news,fundamentals,social` ile hepsini açabilirsin.
- `--rounds` (1–3, varsayılan 1): boğa/ayı tartışmasının kaç tur süreceği.

Çıktı, Sinyaller sayfasına içe aktarılabilecek `research-note/v1` şemalı bir JSON dosyasıdır
(bkz. tasarım belgesi). Çıktıda hiçbir al/sat kararı, olasılık ya da güven skoru yoktur —
yalnızca analist raporları ve tartışma metni.

## Ollama'ya geçiş (yerel, ücretsiz)

`.env` dosyanda:

```bash
TRW_LLM_PROVIDER=ollama
TRW_QUICK_MODEL=llama3.1:8b
```

Ollama'nın kendisi ayrıca kurulu ve çalışır olmalı (`ollama serve`, varsayılan
`http://localhost:11434`). API anahtarı gerekmez. 6–8 GB RAM'de küçük modeller
çalışabilir ama rapor kalitesi Claude/GPT ailesine göre belirgin biçimde daha zayıf ve
daha yavaş olur — ilk denemede bunu gözlemleyeceksin, normal.

## Maliyet notu

Her çalıştırma, seçtiğin analist sayısı kadar LLM çağrısı yapar (+ boğa/ayı turları). Varsayılan
ayarla (2 analist, 1 tur, Claude Haiku 4.5) tek bir çalıştırma birkaç bin token civarındadır —
Haiku 4.5'in güncel fiyatıyla (girdi/çıktı token başına, bkz. Anthropic'in fiyat sayfası) tek
seferlik maliyet kuruşluk mertebededir; günde bir kez çalıştırırsan aylık maliyet birkaç dolar
seviyesinde kalır (kesin rakam modelin güncel fiyatına ve rapor uzunluğuna göre değişir —
doğrulamak için Anthropic konsolundaki kullanım sayfana bak). `--out` dosyası yazıldıktan sonra,
çalıştırmanın gerçek token sayısı notun `usage` alanında (varsa) görünür.
