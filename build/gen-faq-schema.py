#!/usr/bin/env python3
"""Erzeugt faq-schema.json aus den sichtbaren FAQ-Blöcken in 08_body4.html.

So kann das strukturierte Datenblatt nicht vom angezeigten Text abweichen.
"""

import html as html_mod
import json
import re
from pathlib import Path

BUILD = Path(__file__).parent
QUELLE = BUILD / "08_body4.html"

MUSTER = re.compile(
    r'<button class="faq-q"[^>]*>(?P<frage>.*?)<span class="faq-icon".*?</button>\s*'
    r'<div class="faq-a"[^>]*>(?P<antwort>.*?)</div>',
    re.DOTALL,
)


def nur_text(fragment: str) -> str:
    ohne_tags = re.sub(r"<[^>]+>", "", fragment)
    return html_mod.unescape(ohne_tags).strip()


def main() -> None:
    quelle = QUELLE.read_text(encoding="utf-8")
    treffer = list(MUSTER.finditer(quelle))
    if not treffer:
        raise SystemExit("Keine FAQ-Blöcke gefunden — Markup geändert?")

    eintraege = [
        {
            "@type": "Question",
            "name": nur_text(t.group("frage")),
            "acceptedAnswer": {"@type": "Answer", "text": nur_text(t.group("antwort"))},
        }
        for t in treffer
    ]

    schema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": "https://robingut-strom.de/#faq",
        "mainEntity": eintraege,
    }

    ziel = BUILD / "faq-schema.json"
    ziel.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{ziel.name} geschrieben — {len(eintraege)} Fragen")


if __name__ == "__main__":
    main()
