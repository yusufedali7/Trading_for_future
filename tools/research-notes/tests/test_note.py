"""research-note/v1 output (D79 Görev 2): only non-empty reports, a parsed debate history, and
nothing from the decision layer ever leaks in, even if a caller's state happens to carry it.
"""

import json

import pytest

from trw_notes.note import DISCLAIMER, debate_rounds, to_research_note


def _history(*turns: tuple[str, str]) -> str:
    """Builds a history string the way tradingagents' bull/bear nodes do: each turn appends
    "\\n" + "<Side> Analyst: <content>" to what came before."""
    history = ""
    for side, content in turns:
        label = "Bull Analyst" if side == "bull" else "Bear Analyst"
        history += f"\n{label}: {content}"
    return history


def _state(**overrides):
    base = {
        "market_report": "",
        "sentiment_report": "",
        "news_report": "",
        "fundamentals_report": "",
        "investment_debate_state": {"history": ""},
    }
    base.update(overrides)
    return base


def test_debate_rounds_pairs_bull_and_bear_turns_stripping_the_prefix():
    history = _history(
        ("bull", "alim gorusu 1"),
        ("bear", "satim gorusu 1"),
        ("bull", "alim gorusu 2"),
        ("bear", "satim gorusu 2"),
    )
    assert debate_rounds(history) == [
        {"bull": "alim gorusu 1", "bear": "satim gorusu 1"},
        {"bull": "alim gorusu 2", "bear": "satim gorusu 2"},
    ]


def test_debate_rounds_keeps_multi_line_arguments_intact():
    history = _history(("bull", "satir bir\nsatir iki"), ("bear", "karsi gorus"))
    assert debate_rounds(history) == [{"bull": "satir bir\nsatir iki", "bear": "karsi gorus"}]


def test_to_research_note_has_exactly_the_locked_key_set():
    state = _state(
        market_report="teknik rapor",
        news_report="haber raporu",
        investment_debate_state={"history": _history(("bull", "a"), ("bear", "b"))},
    )
    note = to_research_note(
        state,
        instrument="EURUSD",
        as_of="2026-10-14",
        generated_at="2026-10-14T09:12:00Z",
        provider="anthropic",
        model="claude-haiku-4-5",
        usage=None,
    )
    assert set(note.keys()) == {
        "schema",
        "instrument",
        "asOf",
        "generatedAt",
        "reports",
        "debate",
        "modelInfo",
        "disclaimer",
    }
    assert note["schema"] == "research-note/v1"
    assert set(note["reports"].keys()) == {"technical", "news"}
    assert note["debate"] == {"rounds": [{"bull": "a", "bear": "b"}]}
    assert note["modelInfo"] == {"llmProvider": "anthropic", "quickModel": "claude-haiku-4-5"}


def test_to_research_note_adds_usage_only_when_given():
    state = _state(market_report="teknik rapor")
    with_usage = to_research_note(
        state,
        instrument="EURUSD",
        as_of="2026-10-14",
        generated_at="2026-10-14T09:12:00Z",
        provider="anthropic",
        model="claude-haiku-4-5",
        usage={"inputTokens": 100, "outputTokens": 40},
    )
    assert with_usage["usage"] == {"inputTokens": 100, "outputTokens": 40}

    without_usage = to_research_note(
        state,
        instrument="EURUSD",
        as_of="2026-10-14",
        generated_at="2026-10-14T09:12:00Z",
        provider="anthropic",
        model="claude-haiku-4-5",
        usage=None,
    )
    assert "usage" not in without_usage


def test_to_research_note_skips_empty_reports():
    state = _state(news_report="haber raporu")  # market/sentiment/fundamentals left empty
    note = to_research_note(
        state,
        instrument="EURUSD",
        as_of="2026-10-14",
        generated_at="2026-10-14T09:12:00Z",
        provider="anthropic",
        model="claude-haiku-4-5",
        usage=None,
    )
    assert note["reports"] == {"news": "haber raporu"}


def test_to_research_note_requires_at_least_one_report():
    with pytest.raises(ValueError):
        to_research_note(
            _state(),
            instrument="EURUSD",
            as_of="2026-10-14",
            generated_at="2026-10-14T09:12:00Z",
            provider="anthropic",
            model="claude-haiku-4-5",
            usage=None,
        )


def test_to_research_note_never_leaks_decision_layer_fields_even_if_present_on_state():
    state = _state(
        market_report="teknik rapor",
        final_trade_decision="AL",
        investment_plan="aggressive buy",
        final_rating="Strong Buy",
    )
    note = to_research_note(
        state,
        instrument="EURUSD",
        as_of="2026-10-14",
        generated_at="2026-10-14T09:12:00Z",
        provider="anthropic",
        model="claude-haiku-4-5",
        usage=None,
    )
    text = json.dumps(note, ensure_ascii=False)
    for forbidden in ("final_trade_decision", "investment_plan", "rating", "AL", "Strong Buy"):
        assert forbidden not in text


def test_disclaimer_is_exactly_the_locked_text():
    assert DISCLAIMER == (
        "Bu bir AI yorum özetidir; al/sat tavsiyesi veya ölçülmüş bir olasılık değildir. "
        "Trading Research Workstation Kural 6/9."
    )
