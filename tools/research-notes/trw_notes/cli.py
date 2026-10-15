"""Command line (D79 Görev 3): `python -m trw_notes --instrument EURUSD --asof 2026-10-14
--out report.json`. Argument errors fail fast locally (exit 2, no network). A run that cannot
produce a note - missing key, LLM/network failure, no analyst report came back - writes
nothing and exits non-zero (rule 1: no data, no result).
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from langchain_core.callbacks.usage import UsageMetadataCallbackHandler
from tradingagents.dataflows.config import set_config
from tradingagents.graph.propagation import Propagator
from tradingagents.llm_clients.factory import create_llm_client

from .graph import build_research_graph
from .note import to_research_note

# packages/engine/src/instruments/registry.ts is the single source of truth for the app; this
# tool is a standalone Python process and keeps its own copy of just the symbols.
VALID_INSTRUMENTS = frozenset({"EURUSD", "GBPUSD", "USDJPY", "XAUUSD"})

_PROVIDER_KEY_ENV = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "google": "GOOGLE_API_KEY",
    "ollama": None,  # local, no key
}


@dataclass
class Args:
    instrument: str
    as_of: str
    out: Path
    analysts: list[str]
    rounds: int


def parse_args(argv: list[str]) -> Args:
    import argparse

    parser = argparse.ArgumentParser(prog="python -m trw_notes")
    parser.add_argument("--instrument", required=True)
    parser.add_argument("--asof", required=True, help="YYYY-MM-DD")
    parser.add_argument("--out", required=True)
    parser.add_argument("--analysts", default="market,news")
    parser.add_argument("--rounds", type=int, default=1)
    ns = parser.parse_args(argv)

    if ns.instrument not in VALID_INSTRUMENTS:
        parser.error(
            f"bilinmeyen enstrüman: {ns.instrument} "
            f"(desteklenenler: {', '.join(sorted(VALID_INSTRUMENTS))})"
        )

    try:
        as_of_date = date.fromisoformat(ns.asof)
    except ValueError:
        parser.error(f"--asof tarih biçimi geçersiz, YYYY-MM-DD bekleniyor: {ns.asof}")
        raise  # unreachable, parser.error exits; keeps the type checker happy

    if as_of_date.weekday() >= 5:
        parser.error(f"--asof bir hafta sonu tarihi ({ns.asof}): forex kapalı, veri yok")

    if as_of_date > date.today():
        parser.error(f"--asof gelecekteki bir tarih ({ns.asof}): henüz veri yok (kural 1)")

    if not (1 <= ns.rounds <= 3):
        parser.error(f"--rounds 1 ile 3 arasında olmalı: {ns.rounds}")

    analysts = [a.strip() for a in ns.analysts.split(",") if a.strip()]

    return Args(instrument=ns.instrument, as_of=ns.asof, out=Path(ns.out), analysts=analysts, rounds=ns.rounds)


def main(argv: list[str] | None = None) -> int:
    import os

    try:
        args = parse_args(sys.argv[1:] if argv is None else argv)
    except SystemExit as exc:
        return exc.code if isinstance(exc.code, int) else 2

    # Fail before any LLM call (and its cost), not after: an unwritable --out would otherwise
    # lose a note that real tokens were just spent producing.
    try:
        args.out.parent.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        print(f"Hata: çıktı klasörü oluşturulamadı ({args.out.parent}): {exc}", file=sys.stderr)
        return 1

    load_dotenv()
    provider = os.environ.get("TRW_LLM_PROVIDER", "anthropic")
    model = os.environ.get("TRW_QUICK_MODEL", "claude-haiku-4-5")
    output_language = os.environ.get("TRW_OUTPUT_LANGUAGE", "Turkish")

    key_env = _PROVIDER_KEY_ENV.get(provider)
    if key_env and not os.environ.get(key_env):
        print(
            f"Hata: {key_env} ortam değişkeni ayarlı değil. "
            "tools/research-notes/.env dosyasını doldur (bkz. .env.example).",
            file=sys.stderr,
        )
        return 1

    try:
        set_config({"output_language": output_language})
        usage_handler = UsageMetadataCallbackHandler()
        llm = create_llm_client(provider, model, callbacks=[usage_handler]).get_llm()
        graph = build_research_graph(llm, args.analysts, args.rounds)
        initial_state = Propagator().create_initial_state(
            args.instrument,
            args.as_of,
            asset_type="forex",
            instrument_context=f"{args.instrument} (forex pair)",
        )
        result = graph.invoke(initial_state)

        usage = None
        if usage_handler.usage_metadata:
            usage = {
                "inputTokens": sum(m["input_tokens"] for m in usage_handler.usage_metadata.values()),
                "outputTokens": sum(m["output_tokens"] for m in usage_handler.usage_metadata.values()),
            }

        note = to_research_note(
            result,
            instrument=args.instrument,
            as_of=args.as_of,
            generated_at=datetime.now(timezone.utc).isoformat(),
            provider=provider,
            model=model,
            usage=usage,
        )
    except Exception as exc:  # noqa: BLE001 - any failure here means "no note", not a crash report
        print(f"Hata: araştırma notu oluşturulamadı ({type(exc).__name__}): {exc}", file=sys.stderr)
        return 1

    args.out.write_text(json.dumps(note, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0
