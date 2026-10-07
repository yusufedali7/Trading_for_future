"""One-off oracle generator (NOT part of CI, not run by `npm test`).

Builds a small SYNTHETIC OHLC fixture with hand-placed candlestick patterns, runs the real
TA-Lib (BSD licence) over it, and writes both the bars and TA-Lib's own output as one JSON file.
Our TypeScript detectors are then checked against this recorded output in
packages/engine/test/candlestick-patterns.test.ts, so `npm test` never needs Python/TA-Lib
installed - only re-running this script to refresh the fixture does.

Run: py tools/oracle/talib_candles.py
Requires: py -m pip install TA-Lib numpy
"""

import json
from pathlib import Path

import numpy as np
import talib

FUNCS = ["CDLDOJI", "CDLENGULFING", "CDLMARUBOZU"]

PIP = 0.0001


def bar(o: float, c: float, h: float | None = None, l: float | None = None) -> list[float]:
    """A bar; high/low default to the open/close extremes plus a hairline wick."""
    hi = h if h is not None else max(o, c) + 0.2 * PIP
    lo = l if l is not None else min(o, c) - 0.2 * PIP
    return [round(o, 5), round(hi, 5), round(lo, 5), round(c, 5)]


def filler(n: int, start: float, seed: int) -> list[list[float]]:
    """Deterministic small-bodied candles (LCG), just to give the rolling averages context."""
    s = seed
    out = []
    price = start
    for _ in range(n):
        s = (1103515245 * s + 12345) & 0x7FFFFFFF
        step = ((s % 1000) / 1000 - 0.5) * 6 * PIP
        o = price
        c = round(o + step, 5)
        out.append(bar(o, c, max(o, c) + 1.5 * PIP, min(o, c) - 1.5 * PIP))
        price = c
    return out


def main() -> None:
    rows: list[list[float]] = []
    rows += filler(15, 1.1000, seed=1)

    # A clean doji: body ~0.2 pip, range ~12 pip (body/range ≈ 1.7%, well under the 10% rule).
    last = rows[-1][3]
    rows.append(bar(last, last + 0.02 * PIP, last + 6 * PIP, last - 6 * PIP))
    rows += filler(12, rows[-1][3], seed=2)

    # Bearish engulfing: small bullish candle, then a larger bearish candle that engulfs it.
    o1, c1 = rows[-1][3], rows[-1][3] + 5 * PIP
    rows.append(bar(o1, c1))
    rows.append(bar(c1 + 2 * PIP, o1 - 2 * PIP))
    rows += filler(12, rows[-1][3], seed=3)

    # Bullish engulfing: small bearish candle, then a larger bullish candle that engulfs it.
    o2, c2 = rows[-1][3], rows[-1][3] - 5 * PIP
    rows.append(bar(o2, c2))
    rows.append(bar(c2 - 2 * PIP, o2 + 2 * PIP))
    rows += filler(12, rows[-1][3], seed=4)

    # Bullish marubozu: long body (30 pip vs. ~5 pip filler average), no shadows at all.
    start = rows[-1][3]
    rows.append(bar(start, start + 30 * PIP, start + 30 * PIP, start))
    rows += filler(12, rows[-1][3], seed=5)

    # Bearish marubozu.
    start = rows[-1][3]
    rows.append(bar(start, start - 30 * PIP, start, start - 30 * PIP))
    rows += filler(15, rows[-1][3], seed=6)

    o = np.array([r[0] for r in rows])
    h = np.array([r[1] for r in rows])
    l = np.array([r[2] for r in rows])
    c = np.array([r[3] for r in rows])

    oracle = {f: getattr(talib, f)(o, h, l, c).tolist() for f in FUNCS}

    out_path = Path("packages/engine/test/fixtures/SYNTHETIC_candlestick_oracle.json")
    out_path.write_text(
        json.dumps({"ohlc": rows, "oracle": oracle}, indent=0), encoding="utf-8"
    )
    print(f"wrote {len(rows)} bars x {len(FUNCS)} functions -> {out_path}")
    for f in FUNCS:
        nonzero = [i for i, v in enumerate(oracle[f]) if v != 0]
        print(f"  {f}: nonzero at {nonzero}")


if __name__ == "__main__":
    main()
