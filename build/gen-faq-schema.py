#!/usr/bin/env python3
"""Erzeugt faq-schema.json aus den sichtbaren FAQ-Blöcken in 08_body4.html.

So kann das strukturierte Datenblatt nicht vom angezeigten Text abweichen.
"""

import json
import re
from html.parser import HTMLParser
from pathlib import Path

BUILD = Path(__file__).parent
QUELLE = BUILD / "08_body4.html"

# Weniger Fragen als hier erwartet heißt: Das Markup hat sich geändert und
# die Extraktion greift ins Leere — dann lieber abbrechen als still liefern.
MINDESTENS_FRAGEN = 10

MUSTER = re.compile(
    r'<button class="faq-q"[^>]*>(?P<frage>.*?)<span class="faq-icon".*?</button>\s*'
    r'<div class="faq-a"[^>]*>(?P<antwort>.*?)</div>',
    re.DOTALL,
)


class NurText(HTMLParser):
    """Sammelt den Textinhalt und löst Entities dabei korrekt auf."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.teile: list[str] = []

    def handle_data(self, data: str) -> None:
        self.teile.append(data)

    def text(self) -> str:
        return re.sub(r"\s+", " ", "".join(self.teile)).strip()


def nur_text(fragment: str) -> str:
    p = NurText()
    p.feed(fragment)
    p.close()
    return p.text()


def main() -> None:
    quelle = QUELLE.read_text(encoding="utf-8")
    treffer = list(MUSTER.finditer(quelle))
    if len(treffer) < MINDESTENS_FRAGEN:
        raise SystemExit(
            f"Nur {len(treffer)} FAQ-Blöcke gefunden, erwartet mindestens "
            f"{MINDESTENS_FRAGEN} — Markup geändert?"
        )

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

    # Der Block landet in einem <script type="application/ld+json">;
    # "</script>" im Text würde ihn sonst vorzeitig beenden.
    roh = json.dumps(schema, ensure_ascii=False, indent=2)
    for zeichen, ersatz in {"<": "\\u003c", ">": "\\u003e", "&": "\\u0026"}.items():
        roh = roh.replace(zeichen, ersatz)

    ziel = BUILD / "faq-schema.json"
    ziel.write_text(roh, encoding="utf-8")
    print(f"{ziel.name} geschrieben — {len(eintraege)} Fragen")


if __name__ == "__main__":
    main()
