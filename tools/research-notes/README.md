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

Komut satırı arayüzü henüz yok (sıradaki adımda ekleniyor); bu dilimde yalnızca
`trw_notes.graph` modülü ve testleri var.
