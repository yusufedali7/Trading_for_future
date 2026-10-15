"""research-note/v1 output (D79 Görev 2): turns a graph run's final state into the JSON note -
only non-empty analyst reports, the parsed bull/bear debate, and a fixed disclaimer. Nothing
from the decision layer (never run, see graph.py) is read or written here; only the specific
state keys named below are ever touched, so a stray `final_trade_decision`-shaped key on the
state - there never should be one - cannot leak into the note.
"""

import re

DISCLAIMER = (
    "Bu bir AI yorum özetidir; al/sat tavsiyesi veya ölçülmüş bir olasılık değildir. "
    "Trading Research Workstation Kural 6/9."
)

_TURN = re.compile(r"(Bull Analyst|Bear Analyst): (.*?)(?=\nBull Analyst:|\nBear Analyst:|\Z)", re.S)

_REPORT_KEYS = {
    "technical": "market_report",
    "news": "news_report",
    "sentiment": "sentiment_report",
    "fundamentals": "fundamentals_report",
}


def debate_rounds(history: str) -> list[dict]:
    """Parses a tradingagents debate history (each turn appended as "\\nSide Analyst: text")
    into `[{"bull": ..., "bear": ...}]`, pairing turns in the order they were spoken."""
    turns = [
        ("bull" if label == "Bull Analyst" else "bear", text.strip())
        for label, text in _TURN.findall(history)
    ]
    rounds = []
    i = 0
    while i + 1 < len(turns):
        if turns[i][0] == "bull" and turns[i + 1][0] == "bear":
            rounds.append({"bull": turns[i][1], "bear": turns[i + 1][1]})
            i += 2
        else:
            i += 1
    return rounds


def to_research_note(
    state: dict,
    *,
    instrument: str,
    as_of: str,
    generated_at: str,
    provider: str,
    model: str,
    usage: dict | None,
) -> dict:
    reports = {key: state[field] for key, field in _REPORT_KEYS.items() if state.get(field)}
    if not reports:
        raise ValueError("no analyst reports to write a research note from (rule 1)")

    note = {
        "schema": "research-note/v1",
        "instrument": instrument,
        "asOf": as_of,
        "generatedAt": generated_at,
        "reports": reports,
        "debate": {"rounds": debate_rounds(state["investment_debate_state"]["history"])},
        "modelInfo": {"llmProvider": provider, "quickModel": model},
    }
    if usage:
        note["usage"] = usage
    note["disclaimer"] = DISCLAIMER
    return note
