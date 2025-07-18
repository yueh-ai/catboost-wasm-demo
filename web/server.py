#!/usr/bin/env python3
"""
Simple HTTP server with CORS headers for testing WebAssembly
"""
import http.server
import socketserver
import sys

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

PORT = 8000
if len(sys.argv) > 1:
    PORT = int(sys.argv[1])

with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
    print(f"Server running at http://localhost:{PORT}/")
    print("Press Ctrl+C to stop")
    httpd.serve_forever()