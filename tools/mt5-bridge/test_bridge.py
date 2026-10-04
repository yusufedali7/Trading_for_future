"""Tests for the MT5 bridge with a fake MetaTrader5 module (SYNTHETIC data; no terminal needed).

Run: py -m unittest tools/mt5-bridge/test_bridge.py
"""

import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(__file__))
import bridge  # noqa: E402


class FakeMt5:
    """SYNTHETIC stand-in for the MetaTrader5 package; records every call."""

    ACCOUNT_TRADE_MODE_DEMO = 0
    ACCOUNT_TRADE_MODE_CONTEST = 1
    ACCOUNT_TRADE_MODE_REAL = 2
    TIMEFRAME_M1 = 1

    def __init__(self, mode=0):
        self.mode = mode
        self.calls = []

    def account_info(self):
        self.calls.append("account_info")
        return SimpleNamespace(trade_mode=self.mode, server="MetaQuotes-Demo", currency="USD")

    def symbol_select(self, s, enable):
        self.calls.append("symbol_select")
        return s == "EURUSD"

    def symbol_info_tick(self, s):
        self.calls.append("symbol_info_tick")
        return SimpleNamespace(time=1_767_700_000)

    def copy_rates_from_pos(self, s, tf, start, count):
        self.calls.append(("copy_rates_from_pos", start, count))
        return [
            {"time": 1_767_699_900 + 60 * i, "open": 1.1, "high": 1.1002, "low": 1.0998, "close": 1.1001, "tick_volume": 5}
            for i in range(count)
        ]


class FunctionTests(unittest.TestCase):
    def test_status_reports_demo_account_and_raw_server_times(self):
        s = bridge.status(FakeMt5(), "eurusd", now=lambda: 1_767_692_800.5)
        self.assertEqual(s["account"], {"server": "MetaQuotes-Demo", "mode": "DEMO", "currency": "USD"})
        self.assertEqual(s["lastTickServerSec"], 1_767_700_000)
        self.assertEqual(s["utcNowMs"], 1_767_692_800_500)

    def test_refuses_real_and_contest_accounts(self):
        for mode in (FakeMt5.ACCOUNT_TRADE_MODE_REAL, FakeMt5.ACCOUNT_TRADE_MODE_CONTEST):
            with self.assertRaises(bridge.BridgeError) as e:
                bridge.rates(FakeMt5(mode), "EURUSD", 10)
            self.assertEqual(e.exception.code, "NOT_DEMO")

    def test_rates_skip_the_forming_bar_and_validate_input(self):
        mt5 = FakeMt5()
        r = bridge.rates(mt5, "EURUSD", 3)
        self.assertIn(("copy_rates_from_pos", 1, 3), mt5.calls)
        self.assertEqual(len(r["bars"]), 3)
        self.assertEqual(r["timeBase"], "SERVER")
        for bad_symbol in ("EUR/USD", "", "X" * 20):
            with self.assertRaises(bridge.BridgeError):
                bridge.rates(mt5, bad_symbol, 3)
        with self.assertRaises(bridge.BridgeError):
            bridge.rates(mt5, "EURUSD", 0)
        with self.assertRaises(bridge.BridgeError):
            bridge.rates(mt5, "GBPJPY", 3)

    def test_never_calls_an_order_function(self):
        mt5 = FakeMt5()
        bridge.status(mt5, "EURUSD")
        bridge.rates(mt5, "EURUSD", 2)
        names = {c if isinstance(c, str) else c[0] for c in mt5.calls}
        self.assertTrue(names <= {"account_info", "symbol_select", "symbol_info_tick", "copy_rates_from_pos"})
        with open(bridge.__file__, encoding="utf-8") as f:
            source = f.read()
        for forbidden in ("order_send", "order_check", "positions_get", "orders_get"):
            self.assertNotIn(forbidden + "(", source)


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), bridge.make_handler(FakeMt5()))
        cls.port = cls.server.server_address[1]
        bridge.ALLOWED_HOSTS.add(f"127.0.0.1:{cls.port}")
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def get(self, path, headers=None):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", headers=headers or {})
        try:
            with urllib.request.urlopen(req) as res:
                return res.status, dict(res.headers), json.loads(res.read())
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), json.loads(e.read())

    def test_allows_the_workstation_origin(self):
        code, headers, body = self.get("/rates?symbol=EURUSD&count=2", {"Origin": "http://localhost:5173"})
        self.assertEqual(code, 200)
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "http://localhost:5173")
        self.assertEqual(len(body["bars"]), 2)

    def test_rejects_other_origins_and_hosts(self):
        code, headers, body = self.get("/status", {"Origin": "https://example.com"})
        self.assertEqual((code, body["error"]), (403, "BAD_ORIGIN"))
        self.assertNotIn("Access-Control-Allow-Origin", headers)
        code, _, body = self.get("/status", {"Host": "evil.example:8765"})
        self.assertEqual((code, body["error"]), (403, "BAD_HOST"))

    def test_unknown_path_and_bad_count(self):
        self.assertEqual(self.get("/orders")[0], 404)
        self.assertEqual(self.get("/rates?count=abc")[2]["error"], "BAD_COUNT")


if __name__ == "__main__":
    unittest.main()
