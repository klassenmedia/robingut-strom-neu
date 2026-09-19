#!/usr/bin/env python3
"""Statischer Server für die Vorschau. Nimmt den Port aus der Umgebung."""
import functools, http.server, os, socketserver
from pathlib import Path

PORT = int(os.environ.get("PORT", "4317"))
ROOT = Path(__file__).resolve().parent.parent
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), handler) as srv:
    print(f"Vorschau laeuft auf http://127.0.0.1:{PORT}", flush=True)
    srv.serve_forever()
