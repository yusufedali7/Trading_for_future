# tradingagents Araştırma Notu Entegrasyonu — Tasarım

Tarih: 2026-10-14
Durum: Onaylandı (kullanıcı, bu tasarım metnini "uygun" dedi), uygulama planı bekleniyor.

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

- `generate_report.py --instrument <SYMBOL> --asof <ISO date> --out <path>.json`
- Kullanıcının kendi LLM API anahtarını kullanır (ortam değişkeni); anahtar
  projeye hiç girmez, repoya commit edilmez.
- tradingagents'tan **yalnızca** şu node'ları çağırır: fundamentals_analyst,
  sentiment_analyst, news_analyst, technical_analyst, bull_researcher,
  bear_researcher (yapılandırılmış `max_debate_rounds` kadar tur).
  `trader_node`, `risk_manager_node`, `portfolio_manager_node` ve
  `TradingAgentsGraph.propagate()` (tam graph) **hiç import edilmez, hiç
  çağrılmaz.**
- **Açık fizibilite riski:** tradingagents'ın analist/tartışma node'larının
  tam graph'tan bağımsız, tek tek import edilip çağrılabilir fonksiyonlar
  olup olmadığı kaynak koddan doğrulanmadı (yalnızca README/doküman okundu).
  Uygulama planının ilk adımı bu kontrol olmalı:
  - Eğer node'lar bağımsız çağrılabiliyorsa: tradingagents'ı pip bağımlılığı
    olarak ekleyip o fonksiyonları doğrudan import ederiz.
  - Eğer değilse: yalnızca ilgili node fonksiyonlarının kaynak kodunu
    `tools/research-notes/vendor/` altına, Apache-2.0 atıf notuyla kopyalarız
    (trader/risk/pm kodunu hiç kopyalamadan) ve kendi küçük LangGraph akışımızı
    kurarız.
- Çıktı: tek bir `research-note/v1` şemalı JSON dosyası (bkz. aşağıda).

### Şema: `research-note/v1`

```json
{
  "schema": "research-note/v1",
  "instrument": "EURUSD",
  "asOf": "2026-10-14T00:00:00Z",
  "generatedAt": "2026-10-14T09:12:00Z",
  "reports": {
    "fundamentals": "string (serbest metin)",
    "sentiment": "string",
    "news": "string",
    "technical": "string"
  },
  "debate": {
    "rounds": [
      { "bull": "string", "bear": "string" }
    ]
  },
  "modelInfo": {
    "llmProvider": "string",
    "deepThinkModel": "string",
    "quickThinkModel": "string"
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
| `reports.*` | string | evet (4'ü de) | serbest metin, modelin ürettiği |
| `debate.rounds[]` | dizi | evet, en az 1 | boğa/ayı turları |
| `modelInfo.*` | string | evet | şeffaflık: hangi model, determinizm yok |
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

- tradingagents: Apache-2.0 — vendor edilirse kaynak dosyalarda orijinal
  lisans/atıf başlığı korunur, `NOTICE`'a bir satır eklenir.
- Yeni bağımlılık: `tools/research-notes/` için Python 3.11+ ve (vendor
  edilmezse) `tradingagents` pip paketi. `packages/engine`/`apps/web`'in
  `package.json`'ına hiçbir şey eklenmez.
- LLM API maliyeti kullanıcıya aittir, kendi anahtarıyla çalışır.

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

1. **Analist node ayrıştırma fizibilitesi** (yukarıda detaylı) — planın ilk
   adımı bir spike olmalı.
2. tradingagents'ın güncellemeleri node imzalarını değiştirebilir — vendor
   edilirse bu risk daha kontrollü (biz ne zaman güncelleyeceğimize karar
   veririz), pip bağımlılığı olarak kullanılırsa sürüm sabitlenmeli
   (`tradingagents==<pinned>`).
