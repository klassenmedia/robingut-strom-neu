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
- **Weiterleitungen:** Plugin „Redirection“ (Andreas, 09.11.). Damit wandern sie beim Go-Live per
  All-in-One WP Migration mit.

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

## Threat Model (Rechner-Klickstrecke, Plugin 1.1.0)

(a) Angreifer und Fehlerquellen:
- **Massenabfragen** über `/preis` und `/erzeuger`, um das Kontingent des Partners zu
  verbrauchen.
- **Manipulierte Eingaben:** Rolle, Anrede, Anlagenart, kWp, Überschuss, Einspeiseart,
  EEG-Status, Wunschpreis.
- **XSS** über Shortcode-Attribute oder Antwortfelder.
- **Offener Weiterleiter** über den Anmelde-Link.
- **Cache-Vergiftung.**
- **Partner ändert Preismodell oder Felder**, sodass falsche oder fehlende Kosten angezeigt
  werden.
- **Veraltete oder gemischte Zahlen** im Browser.

(b) Untrusted Inputs:
- **Shortcode:** `rolle`, `anrede`.
- **REST `/erzeuger` (JSON):** `art`, `kwp`, `kwh`, `einspeisung`, `foerderung`.
- **Antwort des Partners:** `success`, `individual_offer`, `data.*`.
- **Browser:** Wunschpreis-Regler.
- **Unverändert aus 1.0.x:** alle Eingaben von `/preis` und `/strassen`.

(c) Worst Case:
- Ein falscher Erlös oder Preis beim Kunden (Zusage, UWG). Ein Beispiel ist ein Vergleich mit
  der Anschlussvergütung, wo es keine gibt.
- XSS.
- Kontingent des Partners gesperrt.

(d) Gegenmaßnahmen je Input:
- **`rolle`, `anrede`:** Whitelist in `rgr_shortcode_werte()`, sonst `beziehen` / `du`. Ausgabe
  über `esc_attr` / `esc_html`.
- **`art`:** Whitelist pv/wind/wasser/biogas → pv/wind/water/chp.
- **`kwp`:** endliche Zahl von 1 bis 1.000 mit einer Nachkommastelle. Darüber kommt
  „individuelles Angebot“, ohne Anfrage.
- **`kwh`:** ganze Zahl von 100 bis 10.000.000.
- **`einspeisung`:** voll/teil.
- **`foerderung`:** nur bool.
- **Partner-Antwort:**
  - Nur `success: true` wird angenommen.
  - `individual_offer` muss bool sein.
  - Whitelist auf drei Werte mit Untergrenzen über 0.
  - Die fünf Einzelposten müssen den Grundpreis ergeben (±0,01).
  - Sonst 502 ohne Fehlertext des Partners, 60 s gespeichert.
- **Wunschpreis:** 7–11 ct in halben Cent, sonst Vorbelegung 10.
- **Vergleich Anschlussvergütung:** nur bei PV ohne Förderung bis 100 kWp (§§ 21, 23b EEG).
  Bei Förderung erscheint ein Hinweis statt einer Zahl.
- **Browser:**
  - Ausgabe nur über `textContent`.
  - Laufnummer gegen veraltete Antworten.
  - Gerechnet wird nur mit den Eingaben der letzten Antwort, sonst ist das Ergebnis
    abgeblendet.
  - Getrennte Statuszeilen für Verbrauch und Erzeugung.
- **Limits:**
  - IP-Limit 40 je Stunde und Route, nur über `REMOTE_ADDR`.
  - Gemeinsamer Partner-Takt mit Token-Bucket und `GET_LOCK`.
  - Cache nach allen geprüften Werten.
  - Origin, Sec-Fetch-Site und `_jsonp` werden abgewiesen.
- **Anmelde-URL:** feste Konstante, nur der Knopftext hängt von der Rolle ab.

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
- 09.11.2026 alle Seiten auf Release (Chrome als Andreas):
  - Plugin „Redirection“ 5.10.1 ist installiert (Freigabe Andreas). Permalink-Überwachung ist
    an (Gruppe „Geänderte Beiträge“), Protokoll und IP-Speicherung sind aus. Es gibt 5
    Weiterleitungen (301) nach README §6, alle geprüft. Die alten Seiten So geht's (1045),
    Preise (19) und Kontakt (71) stehen auf Entwurf.
  - Neue Seite „Energy Sharing einfach erklärt“ (1355, `/energy-sharing/`) mit Tabelle „Auf
    einen Blick“.
  - Neu gebaut sind außerdem Privathaushalte (1243), Landwirte (1230), Unternehmen &
    Organisationen (1110, mit Kundenfall-Grafik) und Über ROBIN GUT (154, mit Partner-Logo
    und Siegeln auf dunkler Kachel).
  - Alle Seiten nutzen jetzt die Vorlage `no-title`, alle Blöcke sind gültig. Die Texte
    stammen wörtlich aus `Texte/*.md`.
  - Menü 68: So geht's · Privathaushalte · Landwirte · Unternehmen & Organisationen ·
    Über ROBIN GUT · FAQ.
  - FAQ (23): 6 Gruppen mit Sprungmarken und 48 Fragen als Aufklapper. Die Fragen „neu“ und
    „geändert“ kommen aus `07_FAQ_Aenderungsliste.html`, die Antworten „bleibt“ sind
    unverändert übernommen, die zwei doppelten Fragen sind gelöscht und der Link `/reise/`
    ist korrigiert.
  - Impressum (64) ohne die Zeile zur USt-ID. Impressum und Datenschutzerklärung stehen in je
    einer Karte.
  - Andreas wollte die volle Bildschirmbreite: Karten, Kopf- und Fußzeile laufen jetzt mit
    24 px Rand über die ganze Breite und sind bündig. Die Schrift wächst bis 64 px (H1) mit,
    Fließtext ist auf 90 Zeichen pro Zeile begrenzt, Bilder auf 560 px Höhe.
  - Den Pfeil „↗“ in den Knöpfen hat Andreas als hässlich abgelehnt, er ist entfernt. Die
    Markdown-Texte enthalten ihn noch, das ist bewusst.
  - Geprüft: keine toten Links und keine fehlenden Anker (25 Ziele). Handy 390 px ohne
    Überlauf. Die Suche nach „Nr. 1“, „unser Partner“, „Rückruf“, Telefon und Mail außerhalb
    von Impressum, FAQ und Über uns findet nur die Entwurfsseiten 19 und 71 (die werden
    umgeleitet).
  - Platzhalter (gestrichelt markiert): Rechner auf Landwirte und Unternehmen (Klickstrecke
    folgt), Foto Nadine Büscher, Teamfoto Mitarbeiterstrom. Auf Startseite, Energy Sharing
    und Privathaushalte läuft vorerst der bisherige Verbraucher-Rechner.
  - Selbst gesehen, nicht in der Übergabe:
    - Das Impressum nennt Timo Russell als Gesellschafter. Das ist Pflichtangabe und bleibt,
      obwohl Timo laut Übergabe nicht als Person genannt wird.
    - Das Impressum verweist noch auf die OS-Plattform der EU. Die wurde nach meinem
      Kenntnisstand im Juli 2025 eingestellt, das sollte geprüft werden.
    - Ob das Bild 733 (Schriftzug aus Bäumen) KI-generiert ist, ist unklar. Es ist nicht
      gekennzeichnet.
    - Der Knopf „Jetzt wechseln ↗“ im Rechner-Plugin hat noch den Pfeil. Der fällt mit
      dem Umbau des Plugins weg.
- 09.11.2026 Wechsel auf **Variante A** (Andreas: „das mit den Kästchen ist nicht so cool“):
  - Das CSS für Variante A ersetzt den Block für Variante B in den globalen Stilen (Kopie
    `wordpress/variante-a.css`). `variante-b.css` bleibt als Rückweg im Repo und ist als nicht
    aktiv markiert.
  - Klassen und Inhalte bleiben gleich. Neu ist nur die Optik: Bänder über die volle Breite,
    Inhalt mittig auf höchstens 1.320 px, Noto Sans, dunkle Kopfzeile (#353535) und Fußzeile
    (#003D00). Spalten haben keine Kästen und keine Icons. Gerahmt sind nur Kacheln mit Bild,
    die Vorher-nachher-Kästen und die Kundenfall-Kacheln.
  - Die Hintergründe aller Abschnitte auf den 6 Seiten richten sich jetzt nach „Hintergrund:“ in
    `Texte/*.md` (weiß / hellgrünes Band / dunkelgrünes Band). Alle Blöcke sind gültig.
  - **Schrift repariert:** Die 18 Noto-Sans-Schnitte zeigten in den globalen Stilen auf
    `http://wordpress-robingut-strom.p709435.webspaceconfig.de/…`. Jetzt nutzen sie den relativen
    Pfad `/wp-content/uploads/fonts/…`, die Schrift lädt. Auf der Live-Seite ist der Fehler noch
    da, er fällt beim Go-Live per Migration weg. In der Font-Bibliothek (Familie 75) steht die
    alte Adresse noch, das betrifft nur die Schriftverwaltung im Editor.
  - **Geprüft:** Laptop 1.440 px und Handy 390 px, kein Überlauf.
- 09.11.2026 **Abgestufter Preisrechner eingebaut** (Plugin 1.1.0, Klickstrecke in 3 Schritten):
  - Startseite, Energy Sharing, Privathaushalte: Standard (Strom beziehen, du).
  - Landwirte: `[robingut_rechner rolle="einspeisen" anrede="sie"]`.
  - Unternehmen: `[robingut_rechner rolle="beides" anrede="sie"]`.
  - Personen-Knöpfe klein in einer Reihe, kein Pfeil mehr im Anmelde-Knopf.
  - Offen bei WSE/Timo: Rolle in der Anmelde-URL, Ziel für „individuelles Angebot“, Wasserkraft
    und Biogas fehlen im öffentlichen Preismodell (die Landwirte-Seite nennt Biogas).
  - Offen (Inhalt): Kleine Anlagen mit wenig Überschuss rechnen sich in der Direktvermarktung nicht.
    Beispiel 30 kWp / 5.000 kWh / 9 ct: 450 € Erlös − 515 € Grundpreis − 10 € Vermarktung = „rund -25 €“.
    Die Rechnung stimmt. Klären: Hinweis oder Mindestmenge zeigen, Minus als „−“ setzen?
  - 1.1.1 auf Release (Zeitlimit auch für iOS 14/15).
