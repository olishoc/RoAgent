#!/usr/bin/env python3
"""
RoAgent v3 — Mock Agent Server
Serves the same HTTP API as the real agent server for testing.

Usage: python tools/mock_agent.py [--port 8765]
"""

import argparse
import json
import sys
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

DEFAULT_PORT = 8765

# Configurable mock state
_mock_state = {
    "mode": "suggestion",  # "suggestion", "empty", "timeout", "error"
    "error_status": 500,
    "error_message": "Internal Server Error",
    "custom_suggestion": None,
}


def _get_default_suggestion():
    return {
        "targetLine": 1,
        "replacement": "-- mock suggestion",
        "additions": ["-- mock suggestion"],
        "removals": [],
        "context": [],
        "explanation": "Mock suggestion for testing",
    }


class MockHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        """Override to use our compact log format."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        status = args[1] if len(args) > 1 else "?"
        mode = ""
        if self.path == "/suggest" and _mock_state["mode"] == "suggestion":
            mode = " (suggestion)"
        elif self.path == "/suggest" and _mock_state["mode"] == "empty":
            mode = " (empty)"
        elif self.path == "/suggest" and _mock_state["mode"] == "error":
            mode = " (error)"
        print(f"[{timestamp}] {args[0]} {self.path} -> {status}{mode}")

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json({
                "ok": True,
                "model": "mock",
                "provider": "mock",
                "maxTokens": 4096,
            })
        elif parsed.path == "/ping":
            self._send_json({"ok": True})
        elif parsed.path == "/info":
            self._send_json({
                "model": "mock",
                "provider": "mock",
                "maxTokens": 4096,
            })
        elif parsed.path == "/config":
            self._send_json({
                "model": "mock",
                "maxTokens": 4096,
                "hasKey": True,
            })
        else:
            self._send_json({"error": "not found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        body = self._read_body()

        if parsed.path == "/suggest":
            mode = _mock_state["mode"]
            if mode == "suggestion":
                suggestion = _mock_state.get("custom_suggestion") or _get_default_suggestion()
                # Use cursorLine from request if provided
                if "cursorLine" in body:
                    suggestion = dict(suggestion)
                    suggestion["targetLine"] = body["cursorLine"]
                self._send_json({"suggestion": suggestion})
            elif mode == "empty":
                self._send_json({"suggestion": None})
            elif mode == "timeout":
                import time
                time.sleep(30)
                self._send_json({"suggestion": None})
            elif mode == "error":
                self._send_json(
                    {"error": _mock_state["error_message"]},
                    _mock_state["error_status"],
                )
            else:
                self._send_json({"suggestion": None})

        elif parsed.path == "/agent":
            self._send_json({
                "message": "Mock agent response.",
                "toolActions": [],
            })

        elif parsed.path == "/config":
            if "model" in body:
                pass  # Would update model
            if "maxTokens" in body:
                pass  # Would update maxTokens
            self._send_json({"ok": True})

        elif parsed.path == "/mock/set":
            # Control endpoint for tests
            new_mode = body.get("mode", "reset")
            _mock_state["mode"] = new_mode
            if new_mode == "suggestion" and "data" in body:
                _mock_state["custom_suggestion"] = body["data"]
            elif new_mode == "error":
                _mock_state["error_status"] = body.get("status", 500)
                _mock_state["error_message"] = body.get("message", "Internal Server Error")
            elif new_mode == "reset":
                _mock_state["mode"] = "suggestion"
                _mock_state["custom_suggestion"] = None
            self._send_json({"ok": True, "mode": new_mode})

        elif parsed.path == "/ping":
            self._send_json({"ok": True})

        else:
            self._send_json({"error": "not found"}, 404)

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


def main():
    parser = argparse.ArgumentParser(description="RoAgent Mock Agent Server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Port (default {DEFAULT_PORT})")
    args = parser.parse_args()

    server = HTTPServer(("127.0.0.1", args.port), MockHandler)
    print(f"RoAgent Mock Server -> 127.0.0.1:{args.port}")
    print("Endpoints: GET /health, GET /ping, POST /suggest, POST /mock/set")
    print("Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
