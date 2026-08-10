# VOICE_DUB_V5 Server - Static File Server + Edge TTS API Endpoint

import os
import sys
import io
import json
import asyncio
import http.server
import socketserver

if hasattr(sys, 'stdout') and hasattr(sys.stdout, 'buffer') and getattr(sys.stdout, 'encoding', '') != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    except Exception:
        pass

try:
    import edge_tts
except ImportError:
    print("Installing edge-tts...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "edge-tts"])
    import edge_tts

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class VoiceDubHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/tts':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
                text = data.get('text', '').strip()
                voice = data.get('voice', 'ru-RU-DmitryNeural')
                rate = data.get('rate', '+0%')

                if not text:
                    self.send_error(400, "Text parameter is empty")
                    return

                async def generate():
                    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
                    mp3_data = bytearray()
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            mp3_data.extend(chunk["data"])
                    return bytes(mp3_data)

                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                mp3_bytes = loop.run_until_complete(generate())
                loop.close()

                self.send_response(200)
                self.send_header('Content-Type', 'audio/mpeg')
                self.send_header('Content-Length', str(len(mp3_bytes)))
                self.end_headers()
                self.wfile.write(mp3_bytes)

            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                err_msg = json.dumps({'error': str(e)}).encode('utf-8')
                self.wfile.write(err_msg)
        else:
            self.send_error(404, "Endpoint not found")


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    server = None
    for try_port in [8080, 8081, 8082, 8083]:
        try:
            server = socketserver.TCPServer(("", try_port), VoiceDubHandler)
            PORT = try_port
            break
        except OSError:
            continue

    if server:
        print(f"🚀 VOICE_DUB_V5 Server running on http://localhost:{PORT}")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")
            server.server_close()
    else:
        print("❌ Could not bind server to port 8080-8083.")
