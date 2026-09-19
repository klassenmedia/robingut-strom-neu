#!/usr/bin/env python3
"""Prüft die Schutzregeln der Build-Skripte.

    python3 tests/build_test.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "build"))

from build import PLATZHALTER, js_literal  # noqa: E402

bestanden = 0
fehler = 0


def pruefe(name, fn):
    global bestanden, fehler
    try:
        fn()
        bestanden += 1
        print(f"  ok  {name}")
    except AssertionError as e:
        fehler += 1
        print(f"  FEHLER  {name}\n        {e}")


print("js_literal")


def script_abschluss_escaped():
    boese = {"12345": {"stadt": "</script><img src=x onerror=alert(1)>"}}
    ergebnis = js_literal(boese)
    assert "</script>" not in ergebnis, "roher Script-Abschluss im Literal"
    assert "<" not in ergebnis and ">" not in ergebnis, "spitze Klammern nicht escaped"
    assert "\\u003c" in ergebnis, "Escape-Sequenz fehlt"


def kommentar_start_escaped():
    ergebnis = js_literal({"a": "<!--"})
    assert "<!--" not in ergebnis, "HTML-Kommentarstart nicht escaped"


def zeilentrenner_escaped():
    # U+2028/U+2029 beenden in älteren Parsern das String-Literal
    ergebnis = js_literal({"a": "vor nach", "b": "vor nach"})
    assert " " not in ergebnis, "U+2028 nicht escaped"
    assert " " not in ergebnis, "U+2029 nicht escaped"
    assert "\\u2028" in ergebnis and "\\u2029" in ergebnis


def bleibt_gueltiges_json():
    daten = {"12345": {"stadt": "Köln & Umgebung <test>", "wert": 18.5}}
    zurueck = json.loads(js_literal(daten))
    assert zurueck == daten, f"Rundlauf verändert die Daten: {zurueck}"


def umlaute_bleiben_lesbar():
    assert "Köln" in js_literal({"a": "Köln"}), "ensure_ascii sollte aus bleiben"


def indent_variante_escaped_ebenso():
    ergebnis = js_literal({"a": "</script>"}, indent=2)
    assert "</script>" not in ergebnis
    assert "\n" in ergebnis, "indent sollte umbrechen"


for name, fn in [
    ("Script-Abschluss wird escaped", script_abschluss_escaped),
    ("HTML-Kommentarstart wird escaped", kommentar_start_escaped),
    ("U+2028/U+2029 werden escaped", zeilentrenner_escaped),
    ("Ergebnis bleibt gültiges JSON", bleibt_gueltiges_json),
    ("Umlaute bleiben lesbar", umlaute_bleiben_lesbar),
    ("indent-Variante escaped genauso", indent_variante_escaped_ebenso),
]:
    pruefe(name, fn)


print("\nPlatzhalter")


def erkennt_platzhalter():
    assert PLATZHALTER.findall('href="x__FOO__y"') == ["__FOO__"], \
        "Platzhalter im Attribut wird nicht gefunden"
    assert PLATZHALTER.findall("__A__ __B__") == ["__A__", "__B__"]


def keine_falschen_treffer():
    assert PLATZHALTER.findall("__klein__") == [], "Kleinschreibung ist kein Platzhalter"


for name, fn in [
    ("findet Platzhalter auch in Attributen", erkennt_platzhalter),
    ("meldet keine Kleinschreibung", keine_falschen_treffer),
]:
    pruefe(name, fn)


print("\nFAQ-Schema")


def schema_deckt_sich_mit_markup():
    schema = json.loads((ROOT / "build" / "faq-schema.json").read_text(encoding="utf-8"))
    markup = (ROOT / "build" / "08_body4.html").read_text(encoding="utf-8")
    sichtbar = markup.count('class="faq-item"')
    assert len(schema["mainEntity"]) == sichtbar, \
        f"{len(schema['mainEntity'])} Fragen im Schema, {sichtbar} im Markup"
    for frage in schema["mainEntity"]:
        assert frage["name"].strip(), "Frage ohne Text"
        assert frage["acceptedAnswer"]["text"].strip(), "Antwort ohne Text"
        assert "&" not in frage["name"] or "&amp;" not in frage["name"], \
            "Entity wurde nicht aufgelöst"


pruefe("Schema deckt sich mit dem sichtbaren FAQ", schema_deckt_sich_mit_markup)

print(f"\n{bestanden} Prüfungen bestanden" + (f", {fehler} Fehler" if fehler else ""))
sys.exit(1 if fehler else 0)
