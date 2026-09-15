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
import hashlib
import hmac
import io
import os
import sys
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 3004


BIND_HOST = os.environ.get('TTS_BIND_HOST', '127.0.0.1')

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:81').split(',')
    if o.strip()
]

JWT_SECRET = os.environ.get('JWT_SECRET', '')
JWT_ISSUER = 'axiom.app'
JWT_AUDIENCE = 'axiom.web'

if not JWT_SECRET:
    if os.environ.get('NODE_ENV') == 'production':
        print('[tts-service] FATAL: JWT_SECRET es obligatorio en produccion', file=sys.stderr)
        sys.exit(1)
    print('[tts-service] AVISO: JWT_SECRET no definido; usando el respaldo de desarrollo')
    JWT_SECRET = 'axiom-dev-secret-DO-NOT-USE-IN-PRODUCTION-32chars-min'


def _b64url_decode(segment):
    padding = '=' * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def verify_access_token(token):
    """Verifica un JWT HS256 emitido por la aplicacion. Devuelve el userId o None.

    Se valida firma, algoritmo, emisor, audiencia, tipo y expiracion. La
    comparacion de la firma es en tiempo constante.
    """
    try:
        header_b64, payload_b64, signature_b64 = token.split('.')
    except ValueError:
        return None

    try:
        header = json.loads(_b64url_decode(header_b64))
        payload = json.loads(_b64url_decode(payload_b64))
        signature = _b64url_decode(signature_b64)
    except Exception:
        return None

    # Lista blanca de algoritmo: nunca aceptar 'none' ni asimetricos.
    if header.get('alg') != 'HS256':
        return None

    expected = hmac.new(
        JWT_SECRET.encode('utf-8'),
        f'{header_b64}.{payload_b64}'.encode('ascii'),
        hashlib.sha256,
    ).digest()
    if not hmac.compare_digest(signature, expected):
        return None

    if payload.get('iss') != JWT_ISSUER:
        return None
    if payload.get('aud') != JWT_AUDIENCE:
        return None
    if payload.get('type') != 'access':
        return None

    exp = payload.get('exp')
    if not isinstance(exp, (int, float)) or exp < time.time():
        return None

    return payload.get('sub')

# Lazy-load Kokoro (heavy import)
_tts_model = None

def get_tts_model():
    global _tts_model
    if _tts_model is None:
        try:
            from kokoro import KPipeline
            # 'e' = español: fonología más cercana disponible en Kokoro (no hay voz náhuatl)
            _tts_model = KPipeline(lang_code='e')
            print(f"[tts-service] Kokoro model loaded successfully (Spanish pipeline for náhuatl)")
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

        auth_header = self.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            self._send_json(401, {"error": "Autenticacion requerida"})
            return

        user_id = verify_access_token(auth_header[7:].strip())
        if not user_id:
            self._send_json(401, {"error": "Token invalido o expirado"})
            return

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            data = json.loads(body)

            text = data.get('text', '').strip()
            voice = data.get('voice', 'ef_dora')  # default Spanish voice (closest to náhuatl phonology)
            speed = float(data.get('speed', 1.0))

            if not text:
                self._send_json(400, {"error": "Text is required"})
                return

            if len(text) > 5000:
                self._send_json(400, {"error": "Text too long (max 5000 chars)"})
                return

            model = get_tts_model()

            if model is False:
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
        origin = self.headers.get('Origin', '')
        if origin in ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('X-Content-Type-Options', 'nosniff')

    def log_message(self, format, *args):
        # Suppress default logging, use our own
        pass


if __name__ == '__main__':
    print(f"[tts-service] Starting on port {PORT}")
    print(f"[tts-service] Kokoro TTS will be loaded on first request")
    print(f"[tts-service] Bind {BIND_HOST}:{PORT}")
    server = HTTPServer((BIND_HOST, PORT), TTSHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\n[tts-service] Shutting down")
        server.shutdown()
