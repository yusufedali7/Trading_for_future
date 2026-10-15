"""Proves the research graph (D79) never builds, imports, or calls the decision layer
(Research Manager / Trader / Risk debaters / Portfolio Manager) — only analysts and the
bull/bear debate, ending at the engine's own graph END instead of handing off to a decision.
"""

import pathlib
import re

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel
from langgraph.graph import END

from trw_notes.graph import FORBIDDEN_NODES, build_debate_graph, build_research_graph, route_debate

DECISION_FACTORY_NAMES = [
    "create_research_manager",
    "create_trader",
    "create_aggressive_debator",
    "create_conservative_debator",
    "create_neutral_debator",
    "create_portfolio_manager",
]


def test_research_graph_has_no_decision_nodes():
    llm = FakeListChatModel(responses=["bos rapor"])
    graph = build_research_graph(llm, ["market", "news"], rounds=1)
    nodes = set(graph.get_graph().nodes)
    assert nodes.isdisjoint(FORBIDDEN_NODES)
    assert {"Market Analyst", "News Analyst", "Bull Researcher", "Bear Researcher"} <= nodes


def test_decision_factories_are_never_called(monkeypatch):
    def boom(*_args, **_kwargs):
        raise AssertionError("decision-layer factory was called")

    for name in DECISION_FACTORY_NAMES:
        monkeypatch.setattr(f"tradingagents.agents.{name}", boom, raising=True)
        monkeypatch.setattr(f"tradingagents.graph.setup.{name}", boom, raising=True)

    llm = FakeListChatModel(responses=["bos rapor"])
    build_research_graph(llm, ["market"], rounds=1)  # must not raise


def test_our_code_never_names_the_decision_layer():
    src_dir = pathlib.Path(__file__).resolve().parent.parent / "trw_notes"
    text = "\n".join(p.read_text(encoding="utf-8") for p in src_dir.glob("*.py"))
    for name in [*DECISION_FACTORY_NAMES, "TradingAgentsGraph"]:
        assert not re.search(rf"\b{name}\b", text), f"{name} must not be named in trw_notes"


def test_debate_ends_without_research_manager():
    # The researcher nodes add their own "Bull/Bear Analyst:" prefix; the fake model only
    # supplies the raw opinion text.
    llm = FakeListChatModel(responses=["alim gorusu", "satim gorusu"])
    graph = build_debate_graph(llm, rounds=1)
    state = {
        "company_of_interest": "EURUSD",
        "asset_type": "forex",
        "instrument_context": "EURUSD (forex pair)",
        "trade_date": "2026-10-14",
        "market_report": "teknik rapor",
        "sentiment_report": "",
        "news_report": "haber raporu",
        "fundamentals_report": "",
        "investment_debate_state": {
            "bull_history": "",
            "bear_history": "",
            "history": "",
            "current_response": "",
            "count": 0,
        },
    }
    result = graph.invoke(state)
    assert result["investment_debate_state"]["count"] == 2
    assert not result.get("investment_plan")


@pytest.mark.parametrize(
    "count,current_response,rounds,expected",
    [
        (0, "", 1, "Bull Researcher"),
        (1, "Bull Analyst: ...", 1, "Bear Researcher"),
        (2, "Bear Analyst: ...", 1, END),
    ],
)
def test_route_debate(count, current_response, rounds, expected):
    state = {
        "investment_debate_state": {
            "count": count,
            "current_response": current_response,
        }
    }
    assert route_debate(state, rounds) == expected
