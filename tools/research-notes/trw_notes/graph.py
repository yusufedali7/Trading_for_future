"""The research graph (D79): analysts (parallel) -> bull/bear debate -> END.

The decision layer - Research Manager, Trader, the three risk debaters, Portfolio Manager -
is never imported, built, or named anywhere in this module. See tests/test_graph.py for the
tests that prove it (no forbidden node in the compiled graph, the six decision factories raise
if called, and their names never appear in this package's source).
"""

from collections.abc import Sequence
from typing import Any

from langgraph.graph import END, START, StateGraph
from tradingagents.agents import (
    create_bear_researcher,
    create_bull_researcher,
    create_fundamentals_analyst,
    create_market_analyst,
    create_news_analyst,
    create_sentiment_analyst,
)
from tradingagents.agents.state import AgentState
from tradingagents.graph.analyst_execution import build_analyst_execution_plan
from tradingagents.graph.setup import _analyst_graph

FORBIDDEN_NODES = frozenset(
    {
        "Research Manager",
        "Trader",
        "Aggressive Analyst",
        "Conservative Analyst",
        "Neutral Analyst",
        "Portfolio Manager",
    }
)

# Mirrors GraphSetup's own DEBATE_PATH_MAP (tradingagents/graph/setup.py) minus the
# "Research Manager" branch, which this tool never builds.
_DEBATE_PATH_MAP = {
    "Bull Researcher": "Bull Researcher",
    "Bear Researcher": "Bear Researcher",
    END: END,
}

_ANALYST_FACTORIES = {
    "market": create_market_analyst,
    "social": create_sentiment_analyst,
    "news": create_news_analyst,
    "fundamentals": create_fundamentals_analyst,
}


def route_debate(state: dict, max_rounds: int) -> str:
    """Same rule as ``ConditionalLogic.should_continue_debate``, but the debate ends at the
    graph's own END once both sides have spoken `max_rounds` times each - there is no Research
    Manager to hand off to.
    """
    debate = state["investment_debate_state"]
    if debate["count"] >= 2 * max_rounds:
        return END
    if debate["current_response"].startswith("Bull"):
        return "Bear Researcher"
    return "Bull Researcher"


def build_debate_graph(llm: Any, rounds: int) -> Any:
    """Just the bull/bear debate, starting at Bull Researcher and ending at END."""
    workflow = StateGraph(AgentState)
    workflow.add_node("Bull Researcher", create_bull_researcher(llm))
    workflow.add_node("Bear Researcher", create_bear_researcher(llm))
    workflow.add_edge(START, "Bull Researcher")
    for node in ("Bull Researcher", "Bear Researcher"):
        workflow.add_conditional_edges(
            node, lambda state: route_debate(state, rounds), _DEBATE_PATH_MAP
        )
    return workflow.compile()


def build_research_graph(
    llm: Any, analysts: Sequence[str], rounds: int, max_tool_rounds: int = 5
) -> Any:
    """Selected analysts (run in parallel, each with its own tool-calling sub-graph) -> the
    bull/bear debate -> END.
    """
    plan = build_analyst_execution_plan(analysts)

    workflow = StateGraph(AgentState)
    for spec in plan.specs:
        agent = _ANALYST_FACTORIES[spec.key](llm)
        workflow.add_node(spec.agent_node, _analyst_graph(spec, agent, max_tool_rounds))
    workflow.add_node("Bull Researcher", create_bull_researcher(llm))
    workflow.add_node("Bear Researcher", create_bear_researcher(llm))

    analyst_nodes = [spec.agent_node for spec in plan.specs]
    for node in analyst_nodes:
        workflow.add_edge(START, node)
    workflow.add_edge(analyst_nodes, "Bull Researcher")

    for node in ("Bull Researcher", "Bear Researcher"):
        workflow.add_conditional_edges(
            node, lambda state: route_debate(state, rounds), _DEBATE_PATH_MAP
        )
    return workflow.compile()
