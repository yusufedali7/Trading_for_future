# Trading Research Workstation

A local research desk for turning trading ideas into objective rules, viewing them on a chart,
testing them honestly on historical data and measuring the results. It is **not** a signal
service and does **not** trade real money.

Loop: manual observation → rules → backtest → statistics → comparison → paper trade.

- This repository: [github.com/yusufedali7/Trading_for_future](https://github.com/yusufedali7/Trading_for_future)
- Project rules: [`CLAUDE.md`](CLAUDE.md)
- Plan and decisions: [`docs/PLAN.md`](docs/PLAN.md), [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Session handover: [`DEVIR.md`](DEVIR.md)
- Glossary (Turkish): [`docs/ogrenme/sozluk.md`](docs/ogrenme/sozluk.md)

## Third-party repositories used by this project

- [TradingView Lightweight Charts™](https://github.com/tradingview/lightweight-charts) — chart rendering (Apache 2.0)
- [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) — used only by `tools/research-notes/` as a pip dependency (not vendored) to generate analyst/debate research notes; its decision/trading layer is never imported or called (see `docs/DECISIONS.md` D79). Apache 2.0.

## Layout

- `packages/engine`: pure, deterministic TypeScript engine (no DOM, network or clock access)
- `apps/web`: Vite + React UI

## Commands

```bash
npm install        # install dependencies
npm run dev        # start the web app (Vite)
npm test           # run all tests (Vitest)
npm run lint       # ESLint + Prettier check
npm run typecheck  # TypeScript check for engine and web
```

Requires Node.js 22+.

## Data

Market data (CSV) is imported by the user and stored locally in the browser (IndexedDB).
Data files are never committed to this repository. The data provider's terms of use are the
user's responsibility.

## Attribution

Charts are rendered with [TradingView Lightweight Charts™](https://www.tradingview.com/)
(Apache 2.0). See [`NOTICE`](NOTICE).
