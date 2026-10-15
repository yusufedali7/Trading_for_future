# tradingagents Araştırma Notları — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** tradingagents'ın yalnızca analist + boğa/ayı tartışma katmanını çalıştıran bir Python aracı (`tools/research-notes/`) ve onun ürettiği `research-note/v1` JSON'unu içe aktarıp Sinyaller sayfasında uyarılı bir panelde gösteren web tarafı.

**Architecture:** Python tarafı tradingagents'ı commit'e sabitli bir pip bağımlılığı olarak kullanır; kendi küçük LangGraph'ımızı paketin dışa aktardığı fabrikalarla kurar (analistler → boğa/ayı → END). Karar katmanı (Research Manager, Trader, Risk, Portfolio Manager) hiç oluşturulmaz/çağrılmaz. Çıktı tek bir JSON dosyası; web tarafı bunu allowlist doğrulayıcıdan geçirip `trw-research` v7'ye kaydeder. Motor (`packages/engine`) hiç değişmez.

**Tech Stack:** Python 3.13 + venv, tradingagents (Apache-2.0) @ `1394a3f72aa4393e1a98f51b382434c4b4c2d972`, langgraph/langchain-core (onun bağımlılıkları), pytest; web: TypeScript, React, Dexie, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-14-tradingagents-research-notes-design.md` (Task 1'de fizibilite bulgularıyla güncellenir).

## Global Constraints

- Python 3.13 (`C:\Users\EDALI\AppData\Local\Programs\Python\Python313\python.exe`); 3.15 kullanılmaz (pandas 3 tekerleği doğrulanmadı). Sanal ortam `tools/research-notes/.venv`, git'e girmez.
- Bağımlılık: `tradingagents @ git+https://github.com/TauricResearch/TradingAgents.git@1394a3f72aa4393e1a98f51b382434c4b4c2d972` — başka sürüm yok.
- Karar katmanı fabrikaları (`create_research_manager`, `create_trader`, `create_aggressive_debator`, `create_conservative_debator`, `create_neutral_debator`, `create_portfolio_manager`) ve `TradingAgentsGraph` **çağrılmaz**; bizim kodumuzda adları geçmez (test istisna). Paket `__init__`'i bu modülleri yükler — bu belgelenir, saklanmaz.
- Şema: `"schema": "research-note/v1"`. Uyarı metni birebir: `Bu bir AI yorum özetidir; al/sat tavsiyesi veya ölçülmüş bir olasılık değildir. Trading Research Workstation Kural 6/9.`
- API anahtarı yalnızca kullanıcının kendi `tools/research-notes/.env` dosyasında (git'e girmez); kod anahtarı loglamaz/yazmaz.
- Varsayılanlar: `TRW_LLM_PROVIDER=anthropic`, `TRW_QUICK_MODEL=claude-haiku-4-5`, `TRW_OUTPUT_LANGUAGE=Turkish`, analistler `market,news`, tartışma turu `1`. Ollama: `TRW_LLM_PROVIDER=ollama` + model adı (README'de).
- Enstrümanlar: `EURUSD`, `GBPUSD`, `USDJPY`, `XAUUSD` (uygulamanın registry'si). `asset_type` = `"forex"`.
- Kural 1: herhangi bir analist/LLM hatasında JSON yazılmaz, çıkış kodu ≠ 0.
- Web: içe aktarmada bilinmeyen alan → reddet (sessiz atma yok); arayüz metinleri `tr.ts`'te.

## Review Focus

1. **Anahtar yok / geçersiz** → CLI açık Türkçe mesajla çıkar, dosya yazmaz (Task 3 testi: anahtarsız ortamda çıkış ≠ 0, dosya yok).
2. **Hafta sonu tarihi** (forex kapalı, Yahoo verisi yok → LLM boşluğu uydurabilir) → CLI cumartesi/pazar `--asof`'u reddeder (Task 3 testi).
3. **JSON'da karar benzeri ek alan** (`decision`, `rating`, `final_trade_decision`…) → içe aktarma alan adını söyleyerek reddeder (Task 4 testi).
4. **Aynı enstrüman+tarih iki kez içe aktarılır** → üzerine yazılır, çift kayıt olmaz (`id = instrument:asOf`) (Task 5 testi).
5. **Rapor metninde HTML/markdown** → `Markdown` bileşeniyle metin olarak çizilir, HTML yorumlanmaz (Task 6 testi).

---

## Dilim D79 — Python tarafı

### Task 1: Kurulum + karar katmanı olmayan araştırma graph'ı

**Files:**
- Create: `tools/research-notes/requirements.txt`, `tools/research-notes/.env.example`, `tools/research-notes/README.md`, `tools/research-notes/trw_notes/__init__.py`, `tools/research-notes/trw_notes/graph.py`, `tools/research-notes/tests/test_graph.py`
- Modify: `.gitignore` (`tools/research-notes/.venv/`, `tools/research-notes/.env`, `tools/research-notes/out/`), spec dosyası (fizibilite bulguları: pip bağımlılığı, `__init__` yükleme notu, forex'te `fundamentals` yok → raporlar "en az biri", `usage` alanı, `modelInfo = { llmProvider, quickModel }`)

**Interfaces:**
- Produces: `FORBIDDEN_NODES: frozenset[str]` (`"Research Manager", "Trader", "Aggressive Analyst", "Conservative Analyst", "Neutral Analyst", "Portfolio Manager"`); `route_debate(state, max_rounds: int) -> str` (`"Bull Researcher" | "Bear Researcher" | END`); `build_debate_graph(llm, rounds: int) -> CompiledStateGraph` (yalnız bull/bear); `build_research_graph(llm, analysts: Sequence[str], rounds: int, max_tool_rounds: int = 5) -> CompiledStateGraph` (analistler `graph.setup._analyst_graph` + `build_analyst_execution_plan` ile, sonra bull/bear, sonra END).

- [ ] **Step 1:** venv'i 3.13 ile kur, `pip install -r requirements.txt pytest`. Doğrulama: `.venv\Scripts\python -c "import tradingagents, langgraph; print('ok')"` → `ok`.
- [ ] **Step 2: Failing tests** (`tests/test_graph.py`):
  - `test_research_graph_has_no_decision_nodes`: `build_research_graph(FakeLLM, ["market","news"], 1).get_graph().nodes` ∩ `FORBIDDEN_NODES` = ∅ ve `{"Market Analyst","News Analyst","Bull Researcher","Bear Researcher"} ⊆ nodes`.
  - `test_decision_factories_are_never_called`: `monkeypatch` ile altı karar fabrikasını (hem `tradingagents.agents` hem `tradingagents.graph.setup` adlarında) çağrılınca `AssertionError` atan sahtelerle değiştir; `build_research_graph(...)` hata vermez.
  - `test_our_code_never_names_the_decision_layer`: `trw_notes/*.py` kaynaklarında altı fabrika adı ve `TradingAgentsGraph` geçmez.
  - `test_debate_ends_without_research_manager`: `langchain_core.language_models.fake_chat_models.FakeListChatModel(responses=["boğa","ayı"])` ile `build_debate_graph(llm, 1).invoke(prefilled_state)` → `investment_debate_state.count == 2`, `investment_plan` anahtarı yok ya da boş.
  - `test_route_debate`: count 0 / "Bull…" → `"Bear Researcher"`; count 2, rounds 1 → `END`.
- [ ] **Step 3:** Run `.venv\Scripts\python -m pytest tests/test_graph.py -q` → FAIL (modül yok).
- [ ] **Step 4:** `trw_notes/graph.py`'yi yaz. `route_debate`, `ConditionalLogic.should_continue_debate` mantığının aynısı ama `"Research Manager"` yerine `END` döner. Başlangıç durumu için `tradingagents.graph.propagation.Propagator.create_initial_state(company_name, trade_date, asset_type="forex")` kullanılır (Task 3'te).
- [ ] **Step 5:** Testler geçer. **Step 6:** Commit `feat(research-notes): analyst+debate graph without the decision layer`.

### Task 2: `research-note/v1` çıktısı

**Files:** Create `tools/research-notes/trw_notes/note.py`, `tools/research-notes/tests/test_note.py`

**Interfaces:**
- Consumes: Task 1'in graph son durumu (`market_report`, `sentiment_report`, `news_report`, `fundamentals_report`, `investment_debate_state`).
- Produces: `DISCLAIMER: str` (Global Constraints'teki metin); `debate_rounds(history: str) -> list[dict]` (`[{ "bull": str, "bear": str }]`, `"Bull Analyst:"`/`"Bear Analyst:"` önekleri ayrıştırılıp atılır); `to_research_note(state, *, instrument: str, as_of: str, generated_at: str, provider: str, model: str, usage: dict | None) -> dict`.
- Çıktı anahtarları tam olarak: `schema, instrument, asOf, generatedAt, reports, debate{rounds}, modelInfo{llmProvider, quickModel}, usage{inputTokens, outputTokens} (yoksa alan hiç yok), disclaimer`. `reports` yalnızca boş olmayan raporları içerir; anahtar eşlemesi `market_report→technical`, `news_report→news`, `sentiment_report→sentiment`, `fundamentals_report→fundamentals`.

- [ ] **Step 1: Failing tests:** tam anahtar kümesi; boş raporların atlanması; hiç rapor yoksa `ValueError`; iki turluk geçmişten 2 tur; `json.dumps` sonrası metinde `final_trade_decision|investment_plan|rating` yok; uyarı metni birebir.
- [ ] **Step 2:** FAIL. **Step 3:** Uygula. **Step 4:** PASS. **Step 5:** Commit.

### Task 3: Komut satırı (`python -m trw_notes`)

**Files:** Create `tools/research-notes/trw_notes/__main__.py`, `tools/research-notes/trw_notes/cli.py`, `tools/research-notes/tests/test_cli.py`

**Interfaces:**
- Consumes: `build_research_graph`, `to_research_note`.
- Produces: `parse_args(argv) -> Args` (`--instrument`, `--asof YYYY-MM-DD`, `--out`, `--analysts` (virgüllü, varsayılan `market,news`), `--rounds` (1–3)); `main(argv) -> int`.
- Akış: `.env` yükle (`python-dotenv`) → `set_config({"output_language": ...})` → `create_llm_client(provider, model, callbacks=[UsageMetadataCallbackHandler()]).get_llm()` → `build_research_graph` → `invoke(create_initial_state(...))` → `to_research_note` → JSON yaz (UTF-8, `ensure_ascii=False`). Toplam token'lar `UsageMetadataCallbackHandler.usage_metadata`'dan toplanır (varlığı kurulumda doğrulanır; yoksa `usage` alanı yazılmaz).

- [ ] **Step 1: Failing tests:** bilinmeyen enstrüman → çıkış 2; `--asof 2026-10-17` (cumartesi) → çıkış 2, "hafta sonu" mesajı; `--rounds 0` → 2; anahtarsız ortamda (`monkeypatch.delenv("ANTHROPIC_API_KEY")`, provider anthropic) `main` → ≠ 0 ve `--out` dosyası **yok**; graph `invoke` içinde istisna (monkeypatch) → ≠ 0, dosya yok.
- [ ] **Step 2:** FAIL. **Step 3:** Uygula (hata mesajları Türkçe, anahtar asla yazdırılmaz). **Step 4:** PASS.
- [ ] **Step 5:** `NOTICE`'a tradingagents (Apache-2.0) satırı, README (kurulum, `.env` doldurma, çalıştırma, Ollama'ya geçiş, maliyet notu), `docs/DECISIONS.md` D79, `DEVIR.md`. Commit + push.

---

## Dilim D80 — Web tarafı

### Task 4: İçe aktarma doğrulayıcısı

**Files:** Create `apps/web/src/features/research-notes/parse.ts`, `apps/web/test/research-note-parse.test.ts`

**Interfaces:**
- Produces: `ResearchNote` (Task 2 çıktısının TS tipi); `NOTE_DISCLAIMER` (Python'daki metnin aynısı); `parseResearchNote(text: string): ResearchNote` — hata: `NoteError` (`code: 'NOT_JSON' | 'WRONG_SCHEMA' | 'UNKNOWN_FIELD' | 'MISSING_FIELD' | 'NO_REPORTS' | 'BAD_DISCLAIMER' | 'UNKNOWN_INSTRUMENT'`, `field?: string`).

- [ ] **Step 1: Failing tests:** geçerli not; JSON değil; yanlış şema; üst seviyede ya da `reports`/`modelInfo`/`usage` altında bilinmeyen alan (örn. `decision`, `reports.rating`) → `UNKNOWN_FIELD` + alan adı; `reports` boş → `NO_REPORTS`; uyarı metni değişmiş → `BAD_DISCLAIMER`; registry'de olmayan enstrüman.
- [ ] **Step 2–4:** FAIL → uygula (`backup/backup.ts`'teki `isObj` ve hata sınıfı deseni) → PASS. **Step 5:** Commit.

### Task 5: Depolama (`trw-research` v7) ve yedek

**Files:** Modify `apps/web/src/storage/strategy-repo.ts`, `apps/web/src/backup/backup.ts`; Test `apps/web/test/db-strategy.test.ts`, `apps/web/test/backup.test.ts`

**Interfaces:**
- Produces: `StoredResearchNote { id: string /* instrument:asOf */; note: ResearchNote; importedAt: number }`; `ResearchRepo.listResearchNotes(instrument?: string): Promise<StoredResearchNote[]>` (en yeni `asOf` önce); `ResearchRepo.saveResearchNote(n: StoredResearchNote): Promise<void>` (upsert). Dexie `version(7)` önceki tüm tabloları + `researchNotes: 'id, instrument'` tekrar eder; bellek deposu da.

- [ ] **Step 1: Failing tests:** `describe.each(repos)` kaydet/listele/enstrümana göre süz; aynı id ikinci kez → tek kayıt; yedek → geri yükleme notu korur, eski (notsuz) yedek hâlâ açılır.
- [ ] **Step 2–4:** FAIL → uygula → PASS. **Step 5:** Commit.

### Task 6: Sinyaller sayfasında içe aktarma ve panel

**Files:** Create `apps/web/src/features/research-notes/ResearchNotePanel.tsx`; Modify `apps/web/src/features/live/SignalsPage.tsx`, `apps/web/src/i18n/tr.ts`, `apps/web/src/App.tsx`; Test `apps/web/test/research-notes-ui.test.tsx`

**Interfaces:**
- Consumes: `parseResearchNote`, `ResearchRepo.listResearchNotes/saveResearchNote`, `components/Markdown`.
- Produces: `ResearchNotePanel({ note }: { note: StoredResearchNote })` — katlanabilir (`<details>`), en üstte kapatılamaz uyarı (`tr.researchNotes.warning`), teknik/haber/duygu/temel bölümleri (olanlar), tartışma turları, model ve token bilgisi. Sinyaller sayfası: "Araştırma notu içe aktar (JSON)" dosya girişi + hata mesajı; her taslağın altında aynı enstrümandaki `asOf ≤ taslak tarihi` en yakın not; taslak yoksa enstrüman başına en yeni notlar listesi.

- [ ] **Step 1: Failing tests:** geçerli dosya → panel görünür, uyarı metni var; bilinmeyen alanlı dosya → hata mesajı alan adını söyler, kayıt yok; rapor metnindeki `<img onerror>` HTML olarak çizilmez; not yokken panel yok.
- [ ] **Step 2–4:** FAIL → uygula → PASS.
- [ ] **Step 5:** Tam paket + lint + typecheck; gömülü tarayıcıda canlı kontrol (gerçek bir notla — kullanıcı kendi anahtarıyla bir kez çalıştırınca; o zamana kadar test notuyla yalnızca arayüz). `docs/DECISIONS.md` D80, `DEVIR.md`, spec durum satırı. Commit + push.
