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

import subprocess
try:
    import edge_tts
    from importlib.metadata import version
    ver = version("edge-tts")
    print(f"Loaded edge-tts v{ver}")
    # Microsoft recently enforced new token handshakes; versions < 7.2 get 403 Forbidden
    parts = ver.split('.')
    major_ver = int(parts[0]) if len(parts) > 0 and parts[0].isdigit() else 0
    minor_ver = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    if major_ver < 7 or (major_ver == 7 and minor_ver < 2):
        print(f"Upgrading edge-tts (v{ver} -> latest) to resolve 403 Forbidden...")
        subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "edge-tts"])
        import importlib
        importlib.reload(edge_tts)
except Exception:
    print("Installing/upgrading latest edge-tts...")
    subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "edge-tts"])
    import edge_tts

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


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

                print(f"🎙️ [Server /api/tts] Synthesizing '{text[:35]}...' ({voice}, {rate})", flush=True)

                async def generate():
                    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
                    mp3_data = bytearray()
                    async for chunk in communicate.stream():
                        if chunk.get("type") == "audio":
                            mp3_data.extend(chunk.get("data", b""))
                    return bytes(mp3_data)

                async def generate_with_retry():
                    last_err = None
                    for attempt in range(3):
                        try:
                            res = await asyncio.wait_for(generate(), timeout=20.0)
                            if res and len(res) > 0:
                                return res
                        except Exception as e:
                            last_err = e
                            print(f"⚠️ [Server /api/tts] Attempt {attempt + 1} failed: {e}. Retrying in 1s...", flush=True)
                            await asyncio.sleep(1.0)
                    raise last_err or Exception("Empty audio received from Edge TTS")

                mp3_bytes = asyncio.run(generate_with_retry())

                self.send_response(200)
                self.send_header('Content-Type', 'audio/mpeg')
                self.send_header('Content-Length', str(len(mp3_bytes)))
                self.end_headers()
                self.wfile.write(mp3_bytes)
                print(f"✅ [Server /api/tts] Successfully generated {len(mp3_bytes)} bytes", flush=True)

            except Exception as e:
                err_msg_str = str(e)
                print(f"❌ [Server /api/tts] Error: {err_msg_str}", flush=True)
                import traceback
                traceback.print_exc()

                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                err_msg = json.dumps({'error': err_msg_str}).encode('utf-8')
                self.wfile.write(err_msg)
        else:
            self.send_error(404, "Endpoint not found")


if __name__ == '__main__':
    server = None
    for try_port in [8080, 8081, 8082, 8083]:
        try:
            server = ThreadedTCPServer(("", try_port), VoiceDubHandler)
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
