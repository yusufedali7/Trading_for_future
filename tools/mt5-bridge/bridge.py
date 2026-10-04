"""Read-only, demo-only bridge from a local MetaTrader 5 terminal to the workstation (M6.3, D39).

- Reads prices only. No order, position or account-changing function of the MetaTrader5 package
  is ever called (CLAUDE.md rule 7).
- Serves data only while the logged-in account is a DEMO account.
- Listens on 127.0.0.1 only and answers only the workstation's own origin; the Host header is
  checked against DNS rebinding.
- Times are returned as the terminal gives them (broker server time as epoch seconds) together
  with the server time of the last tick and the real UTC clock; the app measures the offset.

Usage (Windows, MetaTrader 5 open and logged in to a demo account):
    py -m pip install MetaTrader5
    py tools/mt5-bridge/bridge.py
"""

from __future__ import annotations

import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse

VERSION = "1"
HOST = "127.0.0.1"
PORT = 8765
ALLOWED_ORIGINS = {"http://localhost:5173", "http://127.0.0.1:5173"}
ALLOWED_HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}
MAX_BARS = 20_000
SYMBOL_OK = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._")


class BridgeError(Exception):
    def __init__(self, status: int, code: str):
        super().__init__(code)
        self.status = status
        self.code = code


def account_mode(mt5: Any) -> str:
    """'DEMO', 'CONTEST', 'REAL' or raise when the terminal is not connected."""
    info = mt5.account_info()
    if info is None:
        raise BridgeError(503, "NOT_CONNECTED")
    modes = {
        mt5.ACCOUNT_TRADE_MODE_DEMO: "DEMO",
        mt5.ACCOUNT_TRADE_MODE_CONTEST: "CONTEST",
        mt5.ACCOUNT_TRADE_MODE_REAL: "REAL",
    }
    return modes.get(info.trade_mode, "UNKNOWN")


def require_demo(mt5: Any) -> Any:
    mode = account_mode(mt5)
    if mode != "DEMO":
        # Rule 7: never serve a real-money account, not even read-only.
        raise BridgeError(403, "NOT_DEMO")
    return mt5.account_info()


def check_symbol(symbol: str) -> str:
    s = symbol.strip().upper()
    if not s or len(s) > 16 or not set(s) <= SYMBOL_OK:
        raise BridgeError(400, "BAD_SYMBOL")
    return s


def status(mt5: Any, symbol: str, now: Callable[[], float] = time.time) -> dict:
    info = require_demo(mt5)
    s = check_symbol(symbol)
    if not mt5.symbol_select(s, True):
        raise BridgeError(404, "UNKNOWN_SYMBOL")
    tick = mt5.symbol_info_tick(s)
    return {
        "bridge": VERSION,
        "account": {"server": info.server, "mode": "DEMO", "currency": info.currency},
        "symbol": s,
        "lastTickServerSec": int(tick.time) if tick is not None else None,
        "utcNowMs": int(now() * 1000),
    }


def rates(mt5: Any, symbol: str, count: int) -> dict:
    require_demo(mt5)
    s = check_symbol(symbol)
    if not 1 <= count <= MAX_BARS:
        raise BridgeError(400, "BAD_COUNT")
    if not mt5.symbol_select(s, True):
        raise BridgeError(404, "UNKNOWN_SYMBOL")
    # Position 0 is the bar still forming: start at 1 so only closed bars are sent (rule 3).
    data = mt5.copy_rates_from_pos(s, mt5.TIMEFRAME_M1, 1, count)
    if data is None:
        raise BridgeError(502, "NO_DATA")
    bars = [
        {
            "t": int(r["time"]),
            "o": float(r["open"]),
            "h": float(r["high"]),
            "l": float(r["low"]),
            "c": float(r["close"]),
            "v": int(r["tick_volume"]),
        }
        for r in data
    ]
    return {"symbol": s, "timeframe": "1m", "timeBase": "SERVER", "bars": bars}


def make_handler(mt5: Any) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args: Any) -> None:  # quieter console
            sys.stderr.write("bridge: " + (fmt % args) + "\n")

        def _send(self, status_code: int, body: dict) -> None:
            payload = json.dumps(body).encode("utf-8")
            self.send_response(status_code)
            origin = self.headers.get("Origin")
            if origin in ALLOWED_ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self) -> None:  # noqa: N802 (http.server API)
            try:
                if self.headers.get("Host") not in ALLOWED_HOSTS:
                    raise BridgeError(403, "BAD_HOST")
                origin = self.headers.get("Origin")
                if origin is not None and origin not in ALLOWED_ORIGINS:
                    raise BridgeError(403, "BAD_ORIGIN")
                url = urlparse(self.path)
                q = {k: v[0] for k, v in parse_qs(url.query).items()}
                symbol = q.get("symbol", "EURUSD")
                if url.path == "/status":
                    self._send(200, status(mt5, symbol))
                elif url.path == "/rates":
                    try:
                        count = int(q.get("count", "1000"))
                    except ValueError:
                        raise BridgeError(400, "BAD_COUNT")
                    self._send(200, rates(mt5, symbol, count))
                else:
                    raise BridgeError(404, "NOT_FOUND")
            except BridgeError as e:
                self._send(e.status, {"error": e.code})
            except Exception as e:  # unexpected: report the type only, never internals
                self._send(500, {"error": "INTERNAL", "type": type(e).__name__})

    return Handler


def main() -> int:
    try:
        import MetaTrader5 as mt5  # type: ignore[import-not-found]
    except ImportError:
        print("MetaTrader5 paketi yok. Kurulum: py -m pip install MetaTrader5", file=sys.stderr)
        return 1
    if not mt5.initialize():
        print("MetaTrader 5 terminaline bağlanılamadı. MT5 açık ve hesaba giriş yapılmış mı?", file=sys.stderr)
        return 1
    try:
        mode = account_mode(mt5)
    except BridgeError:
        mode = "UNKNOWN"
    if mode != "DEMO":
        print(f"Hesap türü {mode}: köprü yalnızca DEMO hesapla çalışır. Kapatılıyor.", file=sys.stderr)
        mt5.shutdown()
        return 2
    server = ThreadingHTTPServer((HOST, PORT), make_handler(mt5))
    print(f"MT5 köprüsü hazır: http://{HOST}:{PORT} (yalnız okuma, yalnız demo). Durdurmak için Ctrl+C.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        mt5.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main())
