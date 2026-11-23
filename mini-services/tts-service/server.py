#!/usr/bin/env python3
"""
AXIOM — Kokoro TTS Service
Natural-sounding Text-to-Speech using Kokoro-82M
GitHub: https://github.com/hexgrad/kokoro

This service receives text and returns high-quality natural audio.
Runs on port 3004.

Installation:
  pip install kokoro>=0.1.0 soundfile numpy

Usage:
  POST /tts
  Body: { "text": "Hello world", "voice": "af_heart", "speed": 1.0 }
  Response: { "audio": "base64_encoded_wav", "format": "wav", "duration_sec": 2.5 }
"""

import json
import base64
import io
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 3004

# Lazy-load Kokoro (heavy import)
_tts_model = None

def get_tts_model():
    global _tts_model
    if _tts_model is None:
        try:
            from kokoro import KPipeline
            _tts_model = KPipeline(lang_code='a')  # 'a' = American English
            print(f"[tts-service] Kokoro model loaded successfully")
        except ImportError:
            print(f"[tts-service] WARNING: Kokoro not installed. Install with: pip install kokoro")
            print(f"[tts-service] Falling back to simple response.")
            _tts_model = False  # mark as unavailable
        except Exception as e:
            print(f"[tts-service] Error loading Kokoro: {e}")
            _tts_model = False
    return _tts_model


class TTSHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        if self.path != '/tts':
            self.send_error(404, "Not found")
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)

            text = data.get('text', '').strip()
            voice = data.get('voice', 'af_heart')  # default natural voice
            speed = float(data.get('speed', 1.0))

            if not text:
                self._send_json(400, {"error": "Text is required"})
                return

            if len(text) > 5000:
                self._send_json(400, {"error": "Text too long (max 5000 chars)"})
                return

            model = get_tts_model()

            if model is False:
                # Kokoro not installed — return empty audio with warning
                self._send_json(200, {
                    "audio": "",
                    "format": "wav",
                    "duration_sec": 0,
                    "warning": "Kokoro TTS not installed. Install with: pip install kokoro soundfile"
                })
                return

            # Generate audio using Kokoro
            import numpy as np

            # Kokoro returns generator of (graphemes, audio_chunks, phonemes)
            audio_chunks = []
            for _, chunk, _ in model(text, voice=voice, speed=speed):
                if chunk is not None:
                    audio_chunks.append(chunk.cpu().numpy() if hasattr(chunk, 'cpu') else np.array(chunk))

            if not audio_chunks:
                self._send_json(500, {"error": "Failed to generate audio"})
                return

            # Concatenate all audio chunks
            full_audio = np.concatenate(audio_chunks)

            # Convert to WAV bytes
            import soundfile as sf
            wav_buffer = io.BytesIO()
            sf.write(wav_buffer, full_audio, 24000, format='WAV')
            wav_bytes = wav_buffer.getvalue()

            # Base64 encode
            audio_b64 = base64.b64encode(wav_bytes).decode('utf-8')

            # Calculate duration
            duration_sec = len(full_audio) / 24000.0

            self._send_json(200, {
                "audio": audio_b64,
                "format": "wav",
                "sample_rate": 24000,
                "duration_sec": round(duration_sec, 2),
                "voice": voice,
                "text_length": len(text)
            })

            print(f"[tts-service] Generated TTS: {len(text)} chars, {duration_sec:.1f}s audio")

        except Exception as e:
            print(f"[tts-service] Error: {e}")
            self._send_json(500, {"error": f"TTS generation failed: {str(e)}"})

    def do_GET(self):
        if self.path == '/health':
            model = get_tts_model()
            available = model is not False
            self._send_json(200, {
                "status": "ok",
                "kokoro_available": available,
                "service": "axiom-tts-service",
                "version": "1.0.0"
            })
        else:
            self.send_error(404, "Not found")

    def _send_json(self, status, data):
        self.send_response(status)
        self._send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def log_message(self, format, *args):
        # Suppress default logging, use our own
        pass


if __name__ == '__main__':
    print(f"[tts-service] Starting on port {PORT}")
    print(f"[tts-service] Kokoro TTS will be loaded on first request")
    server = HTTPServer(('0.0.0.0', PORT), TTSHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\n[tts-service] Shutting down")
        server.shutdown()
