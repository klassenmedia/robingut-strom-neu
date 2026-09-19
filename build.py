#!/usr/bin/env python3
"""Setzt die Landingpage aus den Bausteinen in build/ zu einer index.html zusammen."""

import datetime
import json
from pathlib import Path

ROOT = Path(__file__).parent
BUILD = ROOT / "build"

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
        "__PREISE__": json.dumps(preise, ensure_ascii=False, separators=(",", ":")),
        "__DATEMODIFIED__": datetime.date.today().isoformat(),
    }
    for marke, wert in ersetzungen.items():
        html = html.replace(marke, wert)

    offen = {w for w in html.split() if w.startswith("__") and w.endswith("__")}
    if offen:
        raise SystemExit(f"Nicht ersetzte Platzhalter: {offen}")

    ziel = ROOT / "index.html"
    ziel.write_text(html, encoding="utf-8")
    print(f"{ziel} geschrieben — {len(html):,} Zeichen".replace(",", "."))


if __name__ == "__main__":
    main()
