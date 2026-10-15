# tradingagents Araştırma Notu Entegrasyonu — Tasarım

Tarih: 2026-10-14
Durum: Onaylandı; uygulama planı `docs/superpowers/plans/2026-10-15-tradingagents-research-notes.md`.
D79 Görev 1'de fizibilite doğrulandı (bkz. "Fizibilite sonucu" ve "Açık riskler").

## Bağlam ve motivasyon

Kullanıcı [tauricresearch/tradingagents](https://github.com/tauricresearch/tradingagents)
reposunu (Apache-2.0, multi-ajan LLM ticaret araştırma çerçevesi) projeye entegre
etmek istedi. Repo'nun mimarisi: 4 analist (temel/haber/duygu/teknik, paralel
çalışır) → boğa/ayı araştırma tartışması → **Trader** (al/sat kararı) → **Risk
Management** → **Portfolio Manager** (işlemi onaylar/reddeder). `ta.propagate(ticker,
date)` çağrısı `(state, decision)` döndürür; graph monolitik, karar katmanı her
çağrıda otomatik hesaplanır.

Bu doğrudan CLAUDE.md'nin mutlak kurallarıyla çatışıyor:

- **Kural 6:** "AI olasılık uydurmaz... hiçbir zaman ölçülmemiş bir kazanma
  olasılığı, 'kesin' sinyal ya da al/sat kararı üretmez." — hesap türünden
  (demo/gerçek) bağımsız, kararın *kaynağı* sorunu. Bir LLM'in ürettiği "AL/SAT"
  backtest edilmiş, deterministik bir kuraldan gelmiyor.
- **Kural 9:** tavsiye dili yasak.
- Projenin kendi açılış cümlesi: "Bu proje 'AI bana hangi işlemi açacağımı
  söylesin' projesi değildir."

Kullanıcıyla konuşma sonucunda üzerinde anlaşılan çözüm: **repo'nun Trader/Risk/
Portfolio Manager katmanını projeye hiç dahil etmemek** — ne çalıştırarak ne de
çalıştırıp sonucu gizleyerek. Sadece 4 analist + boğa/ayı tartışma katmanını
kullanıp, kullanıcının kendi karar verdiği sinyal taslağının yanına **yorumsuz,
olasılıksız bir bağlam notu** olarak eklemek.

## Amaç (goals)

- Kullanıcının izlediği bir stratejinin sinyal taslağı için, ilgili enstrümanda
  o tarihte ne tür temel/haber/duygu/teknik bağlam ve boğa-ayı tartışması
  olduğunu okuyabilmesi.
- Bunun **tamamen ayrı, isteğe bağlı, elle tetiklenen** bir katman olması —
  motora (packages/engine), backtest'e, SignalDraft/Setup matematiğine hiç
  karışmaması.

## Kapsam dışı (non-goals, bilerek)

- Trader/Risk Management/Portfolio Manager node'larının projede hiçbir şekilde
  import edilmesi, çağrılması ya da çıktısının (gizli de olsa) üretilmesi.
- `decision`, `probability`, `confidence`, `successChance` gibi herhangi bir
  sayısal/kategorik "al-sat kararı" alanı — şema düzeyinde yok, içe aktarma
  doğrulayıcısı buna izin vermiyor (allowlist).
- Canlı/otomatik servis (FastAPI vb.), MT5 akışına bağlı otomatik tetikleme,
  sürekli çalışan bir süreç.
- Gerçek ya da demo hesapta herhangi bir emir/otomasyon bağlantısı.
- `packages/engine`'e Python bağımlılığı ya da ağ/DOM erişimi eklenmesi (motor
  saf kalır).

## Mimari genel bakış

```
[kullanıcı, elle]                         [apps/web, yeni]
tools/research-notes/                     trw-research (Dexie)
  generate_report.py                        ├─ researchNotes tablosu
  --instrument EURUSD --asof 2026-10-14       (id = instrument:asOf)
        │ (tradingagents'tan yalnızca     ──►  İçe aktarma ekranı
        │  analist + tartışma node'ları)        (JSON seç → şema doğrula → kaydet)
        ▼                                            │
  research-note-v1.json  ─────dosya olarak───────────┘
                                                       ▼
                                          SignalsPage / StrategyPage
                                          "Araştırma notu (AI özeti)" paneli
                                          + sabit Türkçe uyarı metni
```

`tools/research-notes/` npm workspace'lerinin dışında, bağımsız bir Python
klasörüdür; `packages/engine` ve `apps/web`'in derlemesine/testine dahil değildir.

## Bileşen 1: Python script (`tools/research-notes/`)

- `python -m trw_notes --instrument <SYMBOL> --asof <ISO date> --out <path>.json`
- Kullanıcının kendi LLM API anahtarını kullanır (`.env`, repoya commit
  edilmez); anahtar hiç loglanmaz/yazdırılmaz.
- tradingagents'tan **yalnızca** seçili analistleri (varsayılan: `market`,
  `news` — `fundamentals` forex'te anlamlı değil, bkz. aşağıda) ve
  boğa/ayı tartışmasını çalıştırır (yapılandırılmış tur sayısı kadar).
  Karar katmanı (`create_research_manager`, `create_trader`,
  `create_aggressive_debator`, `create_conservative_debator`,
  `create_neutral_debator`, `create_portfolio_manager`,
  `TradingAgentsGraph`) **hiç import edilmez, hiç çağrılmaz, kodumuzda adı
  geçmez** — bu, `tools/research-notes/tests/test_graph.py`'de üç ayrı testle
  kanıtlanır (derlenmiş graph'ta yasak düğüm yok; fabrikalar çağrılırsa
  hata fırlatan sahtelerle değiştirildiğinde bile hata vermiyor; kaynak
  kodda isimleri hiç geçmiyor).
- **Fizibilite sonucu (D79 Görev 1'de doğrulandı, önceden açık risk
  'analist/tartışma düğümleri tam graph'tan ayrılabilir mi' idi):**
  Ayrılabiliyor, **vendoring gerekmedi**. tradingagents (`pyproject.toml`,
  Apache-2.0) analist fabrikalarını (`create_market_analyst` vb.),
  boğa/ayı araştırmacı fabrikalarını (`create_bull_researcher`,
  `create_bear_researcher`) ve iki yardımcıyı dışa aktarıyor:
  `graph.analyst_execution.build_analyst_execution_plan` (hangi analistin
  hangi düğüm adını/rapor alanını/aracını kullandığını veren plan) ve
  `graph.setup._analyst_graph` (bir analist fabrikasını, kendi araç-çağırma
  döngüsü olan bağımsız bir alt-graph'a saran iç fonksiyon — isimdeki alt
  çizgiye rağmen modülden normal şekilde import edilebiliyor). Kendi
  `StateGraph`'ımızı bunlarla kuruyoruz: seçili analistler (paralel) →
  boğa/ayı tartışması → kendi `END`'imiz — `ConditionalLogic.
  should_continue_debate`'in aynısı ama "Research Manager"a değil `END`'e
  yönlendiren bir `route_debate` fonksiyonuyla. tradingagents
  `requirements.txt`'te commit'e sabitli bir pip bağımlılığı
  (`tradingagents @ git+https://...@1394a3f7...`). Paketin kendi
  `__init__.py`'si (dolaylı olarak) karar katmanı modüllerini de yüklüyor —
  bu kaçınılmaz (paket böyle yazılmış) ve zararsız: hiçbir fabrika
  **çağrılmıyor**, yalnızca içe aktarılıyor; yukarıdaki üç test bunu
  kanıtlıyor.
- Çıktı: tek bir `research-note/v1` şemalı JSON dosyası (bkz. aşağıda).

### Şema: `research-note/v1`

```json
{
  "schema": "research-note/v1",
  "instrument": "EURUSD",
  "asOf": "2026-10-14T00:00:00Z",
  "generatedAt": "2026-10-14T09:12:00Z",
  "reports": {
    "technical": "string (serbest metin, varsa)",
    "news": "string (varsa)",
    "sentiment": "string (varsa)",
    "fundamentals": "string (varsa — forex'te genelde yok)"
  },
  "debate": {
    "rounds": [
      { "bull": "string", "bear": "string" }
    ]
  },
  "modelInfo": {
    "llmProvider": "string",
    "quickModel": "string"
  },
  "usage": {
    "inputTokens": 0,
    "outputTokens": 0
  },
  "disclaimer": "Bu bir AI yorum özetidir; al/sat tavsiyesi veya ölçülmüş bir olasılık değildir. Trading Research Workstation Kural 6/9."
}
```

Alan tablosu:

| Alan | Tip | Zorunlu | Not |
|---|---|---|---|
| `schema` | literal `"research-note/v1"` | evet | versiyon kontrolü |
| `instrument` | string | evet | registry'deki sembol |
| `asOf` | ISO UTC | evet | hangi tarihe ait analiz |
| `generatedAt` | ISO UTC | evet | script ne zaman çalıştı |
| `reports.*` | string | **en az biri** | boş/çalıştırılmayan analistler alanı hiç taşımaz (hepsi zorunlu değil — fundamentals forex'te anlamlı değil, D79 Görev 1 kararı) |
| `debate.rounds[]` | dizi | evet, en az 1 | boğa/ayı turları |
| `modelInfo.*` | string | evet | şeffaflık: hangi sağlayıcı/model (yalnızca hızlı-düşünme modeli kullanılıyor — karar katmanının kullandığı "derin düşünme" modeli bu araçta hiç yok) |
| `usage.*` | integer | hayır | token sayısı, ölçülebiliyorsa; yoksa alan hiç yok |
| `disclaimer` | sabit string | evet | eksikse içe aktarma reddedilir |

**Şemada bilerek olmayan alanlar:** `decision`, `action`, `signal`, `buy`,
`sell`, `confidence`, `probability`, `successChance`, `score` — veya benzeri
anlama gelebilecek herhangi bir alan.

## Bileşen 2: Web tarafı içe aktarma ve depolama

- `apps/web/src/storage/strategy-repo.ts` deseniyle tutarlı: `trw-research`
  Dexie DB'sine yeni `researchNotes` tablosu (`id = instrument:asOf`).
- `ResearchRepo` += `listResearchNotes(instrument?)` / `saveResearchNote(note)`.
- İçe aktarma validasyonu (TS tarafında, CSV import'taki "sessiz düzeltme yok"
  disiplinine uygun):
  1. `schema === "research-note/v1"` değilse reddet, hata göster.
  2. Zorunlu alanların hepsi var mı kontrol et.
  3. **Allowlist:** yukarıdaki alan tablosunda olmayan herhangi bir üst-seviye
     ya da `reports`/`debate`/`modelInfo` altında olmayan bir alan varsa, o
     alanı **sessizce atma değil, içe aktarmayı tamamen reddet** ve kullanıcıya
     "beklenmeyen alan: X" diye göster (M1'deki "sorunlar raporlanır, sessizce
     düzeltilmez" ilkesiyle aynı).
  4. `disclaimer` metni tam olarak beklenen sabit metne eşit değilse reddet
     (savunma derinliği: script'in çıktısı bozulmuş/elle değiştirilmiş olabilir).

## Bileşen 3: Arayüz gösterimi

- SignalsPage'de (ve istenirse StrategyPage'de), bir sinyal taslağının
  enstrümanına göre en yakın (`asOf <= draft.createdAt`, en yakın tarih)
  araştırma notu varsa, katlanabilir bir "Araştırma notu (AI özeti)" paneli
  gösterilir.
- Panelin en üstünde, her zaman, sabit ve kapatılamaz: *"Bu yorumsal bir
  özettir; backtest edilmiş bir istatistik değildir, al/sat tavsiyesi
  değildir."* (tr.ts'te sabit metin, Kural 9 çerçevesi).
- Not yoksa panel hiç görünmez (boş durum fabrikasyonu yok — Kural 1/2 ile
  aynı disiplin).
- `tr.ts`'e yeni bölüm: `tr.researchNotes` (başlık, uyarı metni, bölüm adları:
  temel/haber/duygu/teknik/tartışma).

## Hata yönetimi

- Script tarafında: herhangi bir analist node'u hata verirse (API limiti,
  ağ hatası), script tüm çalışmayı durdurur ve kısmi/sahte bir JSON
  üretmez (Kural 1 ile aynı disiplin — "veri yoksa sonuç yok").
- Web tarafında: şema doğrulama hatası kullanıcıya açıkça gösterilir, hiçbir
  alan tahmin edilerek doldurulmaz.

## Test gereklilikleri

- **TS tarafı:** `researchNotes` import validator için birim testleri —
  geçerli not kabul edilir; eksik zorunlu alan reddedilir; bilinmeyen alan
  (`decision`, `confidence` vb. dahil) reddedilir; yanlış `schema` versiyonu
  reddedilir; `disclaimer` metni değiştirilmişse reddedilir.
- **Python tarafı:** script modülünün `trader_node`, `risk_manager_node`,
  `portfolio_manager_node`, `TradingAgentsGraph.propagate` sembollerini hiç
  import etmediğini doğrulayan statik bir test (örn. kaynak dosyada bu
  isimlerin geçmediğini doğrulayan basit bir string/AST kontrolü) — bu,
  gelecekte birisi yanlışlıkla tam graph'ı bağlarsa testin kırılmasını sağlar.

## Lisans ve bağımlılık notu

- tradingagents: Apache-2.0, vendoring yok — `NOTICE`'a pip bağımlılığı
  olarak bir satır eklendi (D79 Görev 3).
- Yeni bağımlılık: `tools/research-notes/` için Python 3.13 (venv,
  `tools/research-notes/.venv/`, git'e girmez) ve `requirements.txt`'te
  commit'e sabitli `tradingagents` pip paketi. `packages/engine`/`apps/web`'in
  `package.json`'ına hiçbir şey eklenmez.
- LLM API maliyeti kullanıcıya aittir, kendi anahtarıyla (`.env`) çalışır.
  Varsayılan sağlayıcı Anthropic `claude-haiku-4-5`; Ollama'ya (yerel,
  ücretsiz) geçiş `TRW_LLM_PROVIDER=ollama` ile desteklenir.

## CLAUDE.md kurallarıyla eşleme

| Kural | Bu tasarım nasıl uyuyor |
|---|---|
| 1 (veri yoksa sonuç yok) | Analist hata verirse script durur, kısmi JSON yok |
| 2 (sentetik yalnızca testte) | N/A, gerçek LLM çağrısı; test fixture'ları ayrı |
| 5 (determinizm) | Bu katman **bilerek deterministik değil** — motora hiç girmediği, backtest'e karışmadığı için muaf; arayüzde "yorum, istatistik değil" olarak işaretlenir |
| 6 (AI olasılık uydurmaz) | Trader/Risk/PM hiç çalıştırılmaz/import edilmez; şemada karar/olasılık alanı yok, allowlist ile korunur |
| 7 (gerçek para yok) | Bu katman emir/otomasyon'a hiç bağlı değil |
| 9 (tavsiye dili yasak) | Sabit, kapatılamaz uyarı metni her panelde |
| 10 (kalıcılık garanti yok) | JSON dosyası zaten dışa aktarılabilir kaynak; Dexie kaybolsa da script yeniden çalıştırılabilir |

## Açık riskler

1. ~~Analist node ayrıştırma fizibilitesi~~ — **kapatıldı, D79 Görev 1.**
   Yukarıdaki "Fizibilite sonucu"na bakın.
2. tradingagents'ın güncellemeleri `_analyst_graph` (alt çizgili, iç amaçlı
   bir fonksiyon) ve `build_analyst_execution_plan`'ın imzalarını
   değiştirebilir — commit'e sabitleme (`@1394a3f7...`) bu riski
   dondurdu; güncelleme yalnızca bilinçli bir kararla, yeniden test
   edilerek yapılır.
3. **Ağ kararlılığı (D79 Görev 1'de gözlendi):** Bu ortamda GitHub'a
   `git clone` ve PyPI'ye büyük paket indirmeleri (pandas, numpy) zaman
   zaman kesiliyor/çok yavaşlıyor; kullanıcının kendi makinesinde bu sorun
   olmayabilir. README'de "kurulum uzun sürerse yeniden dene" notu var.
