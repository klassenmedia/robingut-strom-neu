"""Erzeugt ein Bild mit Gemini (Vertex AI) aus Text und optionalen Referenzbildern.

Aufruf: python vertex_bild.py <modell> <ausgabe.png> <seitenverhaeltnis> <promptdatei> [referenzbild ...]
Übernommen aus der Face-Reading-Pipeline, hier mit Auflösung 2K und Prompt aus Datei.
Schlüssel nur per Pfad (~/.config/klassenmedia/vertex.json), nie ausgeben.
"""
import base64
import mimetypes
import os
import sys
import time
import requests
import google.oauth2.service_account as sa
import google.auth.transport.requests as tr

KEY_PATH = os.path.expanduser("~/.config/klassenmedia/vertex.json")
PROJECT = "eskotomic-demo"
HOST = "https://aiplatform.googleapis.com"
REQUEST_TIMEOUT_SECONDS = 240
RETRIES = 5          # bei Fehler 429 (zu viele Anfragen) mit wachsender Wartezeit wiederholen
RETRY_WAIT_SECONDS = 30
IMAGE_SIZE = "2K"
MIME_FALLBACK = {".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


def access_token() -> str:
    creds = sa.Credentials.from_service_account_file(KEY_PATH, scopes=["https://www.googleapis.com/auth/cloud-platform"])
    creds.refresh(tr.Request())
    return creds.token


def image_part(path: str) -> dict:
    suffix = os.path.splitext(path)[1].lower()
    mime = MIME_FALLBACK.get(suffix) or mimetypes.guess_type(path)[0] or "image/png"
    with open(path, "rb") as handle:
        return {"inlineData": {"mimeType": mime, "data": base64.b64encode(handle.read()).decode()}}


def generate(model: str, out_path: str, aspect: str, prompt: str, refs: list[str]) -> int:
    parts = [image_part(ref) for ref in refs] + [{"text": prompt}]
    body = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": aspect, "imageSize": IMAGE_SIZE}},
    }
    url = f"{HOST}/v1/projects/{PROJECT}/locations/global/publishers/google/models/{model}:generateContent"
    for attempt in range(1, RETRIES + 1):
        response = requests.post(url, headers={"Authorization": f"Bearer {access_token()}", "Content-Type": "application/json"},
                                 json=body, timeout=REQUEST_TIMEOUT_SECONDS)
        print(f"HTTP {response.status_code}")
        if response.status_code != 429 or attempt == RETRIES:
            break
        time.sleep(RETRY_WAIT_SECONDS * attempt)
    if response.status_code != 200:
        print(response.text[:600].replace("\n", " "))
        return 1
    for candidate in response.json().get("candidates", []):
        for part in candidate.get("content", {}).get("parts", []):
            data = (part.get("inlineData") or {}).get("data")
            if data:
                os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
                with open(out_path, "wb") as out:
                    out.write(base64.b64decode(data))
                print(f"Gespeichert: {out_path} ({os.path.getsize(out_path)} Bytes)")
                return 0
    print("Antwort ohne Bild:", response.text[:500].replace("\n", " "))
    return 2


if __name__ == "__main__":
    prompt = open(sys.argv[4], encoding="utf-8").read().strip()
    sys.exit(generate(sys.argv[1], sys.argv[2], sys.argv[3], prompt, sys.argv[5:]))
