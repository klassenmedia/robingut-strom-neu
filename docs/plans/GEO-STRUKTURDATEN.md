# Plan: Strukturdaten (schema.org) und llms.txt für www.robingut-strom.de (09.11.2026)

Auftrag Andreas (nach Go-Live): Sichtbarkeit in Suche und KI-Antworten verbessern, wie bei den statischen
Seiten mit JSON-LD. Search Console/Bing legen Dieter oder Timo (Inhaber der GbR) an.

## Ausgangslage (live geprüft 09.11.2026)

- Yoast gibt je Seite WebPage, WebSite, Organization (@id `#organization`), Breadcrumbs, Bilder aus.
- Im Theme Frost (`functions.php`, nicht versioniert, ein Theme-Update überschreibt es) stehen zwei eigene
  Funktionen der früheren Agentur: `robingut_schema_markup` (Organization+LocalBusiness, WebSite, Service auf
  allen Seiten) und `robingut_schema_faq` (10 fest eingetippte Fragen nur auf /fragen-und-antworten/).
- Widersprüche zur Seite: „Plattform gemäß § 42c EnWG“ (Unternehmensseite: „anders als Energy Sharing nach
  § 42c EnWG“), Stiftung „nach der Ahrtal-Flut 2021 gegründet“ (Seite: 2025 gegründet, Hilfe seit 2021),
  Angebot-Link `/preise/` (nur noch Weiterleitung). FAQ-Schema passt nicht zum sichtbaren Text (48 Fragen).
- `llms.txt` lag als Datei im alten Ordner und fehlt seit dem Go-Live (404).

## Umsetzung: Plugin `wordpress/robingut-geo`

1. Schaltet die beiden Theme-Funktionen per `remove_action` ab (Theme-Datei bleibt unangetastet).
2. Gibt einen `@graph` aus, verknüpft über dieselben @id wie Yoast:
   - Organization (`#organization`, kein LocalBusiness): Fakten nur aus Impressum/Kontakt/Über uns.
   - Person Dieter Könnes (`#dieter-koennes`), Gründer der ROBIN GUT Stiftung, sameAs Wikipedia und
     dieterkoennes.de; Person Timo Russell (Gesellschafter).
   - Service je Zielgruppen-Seite (Privathaushalte, Landwirte, Unternehmen) mit Zielgruppe, sonst allgemein.
   - FAQPage je Seite, automatisch aus den sichtbaren `<details><summary>`-Aufklappern des Seiteninhalts.
3. Liefert `/llms.txt` (text/plain) aus einer Datei im Plugin.
4. Keine Videos (VideoObject braucht Upload-Datum, später).

## Threat Model

(a) Angreifer: Redakteur oder kompromittiertes Konto schreibt präparierten Text in eine Frage/Antwort
    (z. B. `</script><script>…`); präparierte Anfrage an `/llms.txt?…`; falsche Aussagen in Strukturdaten
    (Irreführung, UWG) durch veraltete feste Texte.
(b) Untrusted Inputs: Seiteninhalt (`post_content`, von Redakteuren), Anfragepfad (`REQUEST_URI`).
(c) Worst Case: Gespeichertes XSS über JSON-LD im `<head>` jeder Seite; falsche Rechts-/Preisaussagen in
    Suchergebnissen und KI-Antworten.
(d) Gegenmaßnahmen: JSON nur mit `json_encode` und `JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT`
    (kein `</script>` möglich), Texte aus Inhalt ohne script/style und Tags (`rgg_text_aus_html`), Länge begrenzt; nur exakter Pfad
    `/llms.txt` (Query ignoriert), feste Datei, `nosniff`; Fakten nur aus den Rechtstexten der Seite, keine
    § 42c-, Preis- oder Zertifikatsaussagen. Tests: FAQ-Auslesen, Escaping mit bösartigem Inhalt,
    Seitenzuordnung, llms-Pfad.

## Stand

- 09.11.2026: Plan angelegt.
- 09.11.2026: Plugin 1.0.0 gebaut, Tests 12/12. Review: BLOCKIERT (Inhalt): Preisversprechen („bekommen mehr,
  zahlen weniger“), Partnername trotz Regel aus UEBERGABE.md (§ 5b UWG offen), „zertifiziert“, markierte
  unbestätigte FAQ, Passwortseiten, Timo als Gründer. Alles behoben: Verbotsliste in den Tests, `<mark>` in
  Aufklappern → nicht in FAQPage, nur veröffentlichte Seiten ohne Passwort, Gründer nur bei der Stiftung,
  Organization statt LocalBusiness (Anschrift nicht als Ladengeschäft in Maps), script/style-Inhalte raus,
  verschachtelte Aufklapper getrennt, JSON_INVALID_UTF8_SUBSTITUTE. Tests 14/14.
- Vorher (Go-Live-Nacharbeit, nicht Plugin): Better Search Replace release.→www. in 810 Zellen (Revisionen,
  Optionen inkl. Yoast-Logo und Ultimate-Blocks-Domain, Yoast-Links), GUIDs unverändert.
- 09.11.2026: Nach-Review FREIGABE. Danach noch gestrichen: „bundesweit/deutschlandweit“ und `areaServed`
  (mit dem Partner offen, UEBERGABE.md), Verbotsliste erweitert (WSE als Wort, Ersparnis, billig, Nr. 1 …),
  Prüf-Markierung genauer (`<mark>` mit title/check/gestrichelt; farbiger Text zählt nicht). Tests 14/14.
  Nach dem Upload prüfen: kein „42c“/LocalBusiness mehr im Quelltext (remove_action greift), /llms.txt 200.
