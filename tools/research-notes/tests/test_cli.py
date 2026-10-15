"""Command line (D79 Görev 3): argument validation fails fast and locally (no network), and a
run never writes a file unless it actually produced a note - no partial/fabricated output.
"""

import json

import pytest

import trw_notes.cli as cli


def argv(**over):
    base = {
        "--instrument": "EURUSD",
        "--asof": "2026-10-14",  # a Wednesday
        "--out": "out.json",
    }
    base.update(over)
    out = []
    for k, v in base.items():
        out += [k, v]
    return out


def test_parse_args_defaults_to_market_and_news_with_one_round():
    args = cli.parse_args(argv())
    assert args.analysts == ["market", "news"]
    assert args.rounds == 1


def test_parse_args_splits_custom_analysts():
    args = cli.parse_args(argv(**{"--analysts": "market, news , fundamentals"}))
    assert args.analysts == ["market", "news", "fundamentals"]


def test_unknown_instrument_exits_2(capsys):
    with pytest.raises(SystemExit) as exc:
        cli.parse_args(argv(**{"--instrument": "DOGEUSD"}))
    assert exc.value.code == 2
    assert "DOGEUSD" in capsys.readouterr().err


def test_weekend_asof_exits_2_with_a_weekend_message(capsys):
    with pytest.raises(SystemExit) as exc:
        cli.parse_args(argv(**{"--asof": "2026-10-17"}))  # a Saturday
    assert exc.value.code == 2
    assert "hafta sonu" in capsys.readouterr().err


def test_future_asof_exits_2(capsys):
    from datetime import date, timedelta

    future = date.today() + timedelta(days=365)
    while future.weekday() >= 5:  # keep it a weekday so only the future-date check fires
        future += timedelta(days=1)

    with pytest.raises(SystemExit) as exc:
        cli.parse_args(argv(**{"--asof": future.isoformat()}))
    assert exc.value.code == 2
    assert "gelecek" in capsys.readouterr().err


def test_rounds_zero_exits_2(capsys):
    with pytest.raises(SystemExit) as exc:
        cli.parse_args(argv(**{"--rounds": "0"}))
    assert exc.value.code == 2
    assert capsys.readouterr().err


def test_main_without_an_api_key_fails_without_writing_a_file(tmp_path, monkeypatch, capsys):
    # load_dotenv() searches upward from cli.py's own location (trw_notes/), not from cwd, so
    # chdir alone does not hide a real tools/research-notes/.env the user has filled in per the
    # README - stub it out so this test is isolated from that ambient file either way.
    monkeypatch.setattr(cli, "load_dotenv", lambda *a, **k: False)
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    out = tmp_path / "out.json"

    code = cli.main(argv(**{"--out": str(out)}))

    assert code != 0
    assert not out.exists()
    assert "ANTHROPIC_API_KEY" in capsys.readouterr().err


def test_main_writes_nothing_when_the_graph_run_fails(tmp_path, monkeypatch, capsys):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-real")
    out = tmp_path / "out.json"

    class BoomGraph:
        def invoke(self, _state):
            raise RuntimeError("fake LLM/network failure")

    monkeypatch.setattr(cli, "build_research_graph", lambda *a, **k: BoomGraph())

    code = cli.main(argv(**{"--out": str(out)}))

    assert code != 0
    assert not out.exists()
    assert capsys.readouterr().err


def test_main_creates_a_missing_output_directory(tmp_path, monkeypatch):
    # Matches the README's own example (--out out\eurusd.json): a fresh checkout has no out/
    # directory (it's gitignored), so the write must not fail after an LLM call already ran.
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-real")
    out = tmp_path / "out" / "eurusd.json"
    assert not out.parent.exists()

    class FakeGraph:
        def invoke(self, _state):
            return {
                "market_report": "teknik rapor",
                "sentiment_report": "",
                "news_report": "",
                "fundamentals_report": "",
                "investment_debate_state": {"history": "\nBull Analyst: a\nBear Analyst: b"},
            }

    monkeypatch.setattr(cli, "build_research_graph", lambda *a, **k: FakeGraph())

    code = cli.main(argv(**{"--out": str(out)}))

    assert code == 0
    assert out.exists()


def test_main_writes_the_note_on_success(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key-not-real")
    out = tmp_path / "out.json"

    class FakeGraph:
        def invoke(self, _state):
            return {
                "market_report": "teknik rapor",
                "sentiment_report": "",
                "news_report": "",
                "fundamentals_report": "",
                "investment_debate_state": {"history": "\nBull Analyst: a\nBear Analyst: b"},
            }

    monkeypatch.setattr(cli, "build_research_graph", lambda *a, **k: FakeGraph())

    code = cli.main(argv(**{"--out": str(out)}))

    assert code == 0
    note = json.loads(out.read_text(encoding="utf-8"))
    assert note["schema"] == "research-note/v1"
    assert note["instrument"] == "EURUSD"
    assert note["reports"] == {"technical": "teknik rapor"}
    assert "usage" not in note  # the fake graph makes no real LLM call, so no tokens recorded
