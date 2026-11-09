# Umbau release.robingut-strom.de nach Übergabe vom 08.11.2026 (Variante B)

Quelle ist das Paket `Website_Uebergabe_ROBIN_GUT_2026-11-08` (liegt bei Andreas unter Downloads;
Artifact-Link in der Mail von Timo). Verbindlich sind die Markdown-Texte im Ordner `Texte/`, darüber
steht die README. Andreas hat am 09.11. Variante B (Karten-Layout) zum Umsetzen freigegeben.

## Entscheidungen

- **Ohne Labels:** Variante B zeigt kleine graue Labels in Großbuchstaben über den Überschriften.
  Die lassen wir weg (Andreas, 09.11.: Regel „keine Eyebrows“).
- **Rechner:** Das bestehende Plugin `wordpress/robingut-rechner/` wird zur Klickstrecke
  umgebaut, kein neues Plugin.
- **Nur Core-Blöcke**, damit das Team die Seiten im Editor bearbeiten kann. Das Aussehen von
  Variante B kommt über CSS-Klassen an Gruppen (`rgb-…`) und steht im Zusätzlichen CSS der
  globalen Stile, Kopie in `wordpress/variante-b.css`.
- **Icons:** Linien-Icons als SVG-Medien (Safe SVG ist aktiv), eingebunden als Bild-Block.
- **Weiterleitungen:** Plugin „Redirection“ oder `.htaccess`. Die Entscheidung von Andreas steht
  noch aus.

## Reihenfolge

1. Grundgerüst: CSS für Variante B, Kopfzeile (neues Menü und Knopf „Preis berechnen“) und
   Fußzeile (ohne Kontakt, ohne Partner-Logo und Siegel).
2. Startseite (1241)
3. Neue Seite Energy Sharing (`/energy-sharing/`). Sie ersetzt So geht's (1045) und Preise (19).
4. Privathaushalte (1243), Landwirte (1230), Unternehmen & Organisationen (1110),
   Über ROBIN GUT (154)
5. FAQ (23) mit allen Fragen als Aufklapper. Kontakt (71) fällt weg, Impressum (64) wird
   angepasst, Suchen/Ersetzen nach `08_Kontakt_Impressum_Suchen-Ersetzen.html`.
6. Rechner-Plugin 1.1 als Klickstrecke (Test zuerst, danach Review „voll“, weil es um Preise
   geht). Bis dahin bleibt der bisherige Rechner (Verbraucher) eingebaut.
7. Weiterleitungen, Yoast-Titel und -Beschreibungen aus den IT-Hinweisen, Checkliste aus
   README §8.

## Threat Model (Rechner-Klickstrecke)

(a) Angreifer: Massenabfragen über die REST-Route, um das WSE-Kontingent zu verbrauchen.
Manipulierte Eingaben (Rolle, kWp, Überschuss, Wunschpreis, EEG-Status), um falsche Zahlen
anzuzeigen oder Fehler auszulösen. XSS über Antwortfelder. Ein offener Weiterleiter über einen
frei wählbaren Anmelde-Link.

(b) Untrusted Inputs: bisherige Felder (PLZ, kWh, Ort, Straße, Hausnummer). Neu kommen Rolle
(Enum), Anlagenart (Enum), kWp (Zahl), Überschuss kWh (Zahl), EEG-Förderung (bool) und
Wunschpreis (Zahl) dazu, außerdem der Parameter `?q=` für Kampagnen.

(c) Worst Case: ein falscher Preis oder ein falscher Erlös beim Kunden (Zusage, UWG), XSS,
Weiterleitung auf eine fremde Seite.

(d) Gegenmaßnahmen:
- Enums nur per Whitelist.
- Zahlen mit festen Grenzen: kWp 0,5–1.000, Überschuss 100–2.000.000 kWh, Wunschpreis 7–11 ct.
  Über 1.000 kWp oder ab 100.000 kWh zeigt der Rechner nur „individuelles Angebot“.
- Die Erzeugerrechnung läuft rein lokal mit festen Konstanten (Stand 08.11.2026), ohne neuen
  API-Aufruf.
- Die Anmelde-Ziel-URL ist eine feste Konstante, die Rolle wird nur als Whitelist-Wert angehängt.
- Ausgabe nur über `textContent`.
- Rate-Limits und Cache bleiben wie in 1.0.2.

## Offen (von ROBIN GUT oder WSE)

- Parameter für die vorbelegte Rolle in der Anmeldestrecke von WSE und Ziel für „individuelles
  Angebot“.
- Grundpreis-Formel nach kWp. Bekannt sind nur 4 Stützstellen (10/30/100/250 kWp), deshalb ist
  zu klären, ob dazwischen interpoliert werden darf.
- USt-ID im Impressum, Foto Nadine Büscher, Baumzahl „NRW pflanzt“.
- Netto oder brutto für 7–11 ct, Freigabe des Kundenfalls Bauunternehmen, rechtliche Prüfung.

## Stand

- 09.11.2026: Plan angelegt, Branch `umbau-variante-b`.
- 09.11.2026 Grundgerüst und Startseite auf Release:
  - Das CSS für Variante B steht in den globalen Stilen (Kopie `wordpress/variante-b.css`, liegt
    dort als letzter Block). 14 Linien-Icons aus den Vorlagen liegen als SVG-Medien
    `rg-icon-*` vor (IDs 1333–1346).
  - Kopfzeile: weiße Karte mit Logo, Menü 68 und Knopf „Preis berechnen“ (`/#rechner`).
  - Fußzeile: weiße Karte mit Copyright, Fußmenü und Logo. Partner-Logo und Siegel sind raus,
    die stecken noch in der Revision des Vorlagenteils `footer`. Im Fußmenü 4 fehlt jetzt
    „Kontakt“.
  - Vorlagenteil `unsere-kunden`: ohne Trennlinie und ohne Knopf „Mehr für Privathaushalte“.
  - Startseite 1241 ist aus `01_Startseite.md` neu gebaut: 11 Karten, 176 Blöcke, alle gültig.
    Den Yoast-Titel und die Beschreibung habe ich aus dem IT-Hinweis übernommen.
  - Das Erklärvideo ist der Essential-Blocks-Player aus 1045 (YouTube, lädt erst nach dem
    Klick).
  - Der Rechner ist vorerst der bisherige Shortcode.
  - Das Zitat von Dieter fehlt in der Markdown-Datei. Ich habe es aus der HTML-Vorlage
    übernommen: „Mit der ROBIN GUT Stromcommunity verbinden wir Menschen.“
  - Noch offen: Das Menü 68 zeigt die alten Punkte. Es wird umgestellt, sobald
    `/energy-sharing/` steht. Die Handy-Ansicht ist noch nicht geprüft.
