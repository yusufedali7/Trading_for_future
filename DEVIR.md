# DEVIR — Oturum Devir Notu

_Son güncelleme: 2026-09-30 (M0 oturumu)_

## Durum özeti
- **Aktif kilometre taşı:** M0 tamamlandı → **M1 bekliyor** (kullanıcı "başla" demeden başlanmayacak).
- Kod yok, bağımlılık yok.
- Yerel git deposu kuruldu (`main`), uzak repo tanımlı: `origin = https://github.com/yusufedali7/Trading_for_future.git`. **Henüz push edilmedi:** repo public, kullanıcıya private yapılıp yapılmayacağı soruldu.

## Bu oturumda yapılanlar (M0)
- Repo incelendi: yalnızca `CLAUDE.md` vardı, proje boştu.
- TradingView grafik seçenekleri resmi dokümanlardan karşılaştırıldı; **Lightweight Charts** seçildi (D1).
- Plan onaylandı: `docs/PLAN.md`. Kararlar: `docs/DECISIONS.md` (D1–D15).
- Kullanıcı cevapları kararlara işlendi:
  - **Dukascopy** 1m BID (D12)
  - **EURUSD + XAUUSD**, XAUUSD pip 0.1 (D13)
  - **17:00 NY** günlük kapanış (D11)
  - **son 2 yıl** veri, cihaz 8 GB RAM (D14)
  - **GitHub** (D15)
- Öğrenme sözlüğü başlatıldı: `docs/ogrenme/sozluk.md`. Her taşta yeni kavramlar eklenecek.
- `.gitignore` (veri dosyaları repoya girmez) ve `.gitattributes` (LF satır sonu, hash determinizmi için) eklendi.

## Sırada ne var (M1: Veri ve grafik)
Ayrıntılı tablo: `docs/PLAN.md` §8. Kararlardan gelen ayarlamalar:
- Görev 1: `git init` yapıldı; kalan: npm workspaces, TS, ESLint, Prettier, Vitest, README, NOTICE.
- Görev 3: registry'de veri yüklenecek enstrümanlar EURUSD ve XAUUSD. GBPUSD, USDJPY ve EURGBP yalnızca lot hesabı testleri için.
- Görev 4: Dukascopy CSV biçimi kullanıcının ilk dosyasından doğrulanacak (kolonlar, tarih biçimi, GMT, düz mumlar).

## Kullanıcıdan beklenenler
1. GitHub reposunu private yapmak isteyip istemediği (Settings → General → Danger Zone → Change visibility).
2. Dukascopy'den EURUSD ve XAUUSD için son 2 yılın 1 dakika BID verisini indirmek; mümkünse ASK da. M1 görev 4'e kadar gerekmez; adımlar M1'de birlikte yapılacak.
3. M1 için "başla".

## Çalıştırma ve test komutları
Henüz yok; M1 görev 1'de gelecek. Planlanan komutlar:
- `npm install`: bağımlılıkları kur
- `npm run dev`: web uygulamasını başlat (Vite)
- `npm test`: tüm testler (Vitest)
- `npm run lint`: ESLint ve Prettier kontrolü

## Ortam
- Node v22.17.0, npm 11.1.0, git 2.56.0 (Windows 11), 8 GB RAM.
- pnpm ve GitHub CLI (`gh`) kurulu değil. Git kimlik doğrulaması Git Credential Manager ile yapılıyor (ilk push'ta tarayıcıda GitHub girişi açılabilir; girişi kullanıcı yapar).
