#!/usr/bin/env python3
"""Setzt die Landingpage aus den Bausteinen in build/ zu einer index.html zusammen."""

import datetime
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
BUILD = ROOT / "build"

PLATZHALTER = re.compile(r"__[A-Z0-9_]+__")


def js_literal(daten, indent: int | None = None) -> str:
    """JSON für die Einbettung in einen <script>-Block.

    json.dumps lässt "</script>" unberührt; der HTML-Parser würde den Block
    dort beenden und alles Folgende als Markup lesen. U+2028 und U+2029
    beenden in älteren Parsern zusätzlich das String-Literal.
    """
    if indent is None:
        roh = json.dumps(daten, ensure_ascii=False, separators=(",", ":"))
    else:
        roh = json.dumps(daten, ensure_ascii=False, indent=indent)
    ersetzungen = {"<": "\\u003c", ">": "\\u003e", "&": "\\u0026",
                   " ": "\\u2028", " ": "\\u2029"}
    for zeichen, ersatz in ersetzungen.items():
        roh = roh.replace(zeichen, ersatz)
    return roh

TEILE = [
    "01_head.html", "02_css.html", "03_css2.html", "04_css3.html",
    "04b_css_rechner.html",
    "05_body1.html", "06_body2.html", "07_body3.html", "08_body4.html",
    "09_js.html",
]


def main() -> None:
    html = "\n".join((BUILD / t).read_text(encoding="utf-8") for t in TEILE)

    # Preistabelle kompakt einbetten, damit der Rechner ohne Netzwerkanfrage läuft
    preise = json.loads((BUILD / "preise.json").read_text(encoding="utf-8"))

    ersetzungen = {
        "__LOGO__": (ROOT / "logo.b64").read_text().strip(),
        "__FAVICON__": (ROOT / "fav.b64").read_text().strip(),
        "__FONTS__": (BUILD / "fonts.css").read_text(encoding="utf-8"),
        "__FAQSCHEMA__": (BUILD / "faq-schema.json").read_text(encoding="utf-8"),
        "__PREISE__": js_literal(preise),
        "__DATEMODIFIED__": datetime.date.today().isoformat(),
    }

    # Ein eingesetzter Wert darf keinen späteren Platzhalter enthalten,
    # sonst hängt das Ergebnis an der Reihenfolge der Ersetzungen
    for marke, wert in ersetzungen.items():
        treffer = PLATZHALTER.findall(wert)
        if treffer:
            raise SystemExit(f"{marke} enthält selbst Platzhalter: {set(treffer)}")
        html = html.replace(marke, wert)

    offen = set(PLATZHALTER.findall(html))
    if offen:
        raise SystemExit(f"Nicht ersetzte Platzhalter: {offen}")

    ziel = ROOT / "index.html"
    ziel.write_text(html, encoding="utf-8")
    print(f"{ziel} geschrieben — {len(html):,} Zeichen".replace(",", "."))


if __name__ == "__main__":
    main()
