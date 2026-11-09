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
- 09.11.2026 **Prüfdurchgang über alle 9 Seiten** (Release, angemeldet als Andreas):
  - In Ordnung: je eine H1, alle Bilder mit Alt-Text, keine toten Sprungmarken, alle internen
    und externen Links erreichbar, keine Testdomain, Noto Sans lädt, Laptop 1.440 px ohne Überlauf.
  - **Behoben:** Datenschutz und Impressum standen auf dem Handy seitlich über (lange Web-Adressen,
    „Verbraucherstreitbeilegung/Universalschlichtungsstelle“). Zwei `overflow-wrap`-Regeln am Ende
    von `variante-a.css` bzw. der globalen Stile; geprüft auf allen Seiten bei 320 und 390 px.
  - **Impressum (Freigabe Andreas):** Absatz „EU-Streitschlichtung“ mit Link zur OS-Plattform und
    der Satz „Unsere E-Mail-Adresse finden Sie oben im Impressum.“ entfernt. Die Plattform ist laut
    EU-Kommission seit 20.07.2025 eingestellt (Verordnung (EU) 2024/3228). Der Absatz zur
    Verbraucherschlichtung (§ 36 VSBG) bleibt. Auf der Live-Seite steht der Absatz noch, er fällt
    beim Go-Live per Migration weg.
  - Offen (rechtlich, nicht geändert): Die Datenschutzerklärung beschreibt Google Analytics,
    E-Mail-Marketing (rapidmail) und Social-Media-Dienste, die auf der Seite nicht eingebunden
    sind; YouTube ist eingebunden (lädt erst nach Klick).
- 09.11.2026 Rechner 1.1.2: Beträge auf Euro und Cent, „zzgl. Lesekopf“ am Monatsbetrag, Sie-Texte im
  Vergleich. Details in `RECHNER-PLUGIN.md`.
- 09.11.2026 **Rhythmus und roter Faden** (Andreas: „sieht aus wie Einheitsbrei“):
  - Helle Abschnitte wechseln automatisch Weiß / zarter Grün-Verlauf (`:nth-child(even of …)`),
    unabhängig von `rgb-hell` im Inhalt. Neue Abschnitte von Redakteuren reihen sich von selbst ein.
    Dunkle Bänder (`rgb-dunkel`) bleiben Akzente, jetzt mit Verlauf und leichtem Lime-Schimmer.
  - Roter Faden: kurzer Lime-Strich (56 × 4 px) unter jeder Abschnittsüberschrift, bei zentrierten
    Überschriften mittig. Keine Zeile über Überschriften (siehe Regel „keine Eyebrow-Labels“).
  - `.rgb-beispiel` hebt sich je nach Hintergrund ab (hell auf Weiß, weiß auf Grün).
  - Geprüft auf 7 Seiten bei 390 und 1.440 px: nie zwei gleiche Hintergründe hintereinander, alle
    Abschnittsüberschriften mit Strich, kein Überlauf. CSS am Ende von `variante-a.css`.
- 09.11.2026 **Nachschliff nach Andreas' Rückmeldungen** (alles CSS am Ende von `variante-a.css`):
  - Review-Funde zum Rhythmus umgesetzt: `@supports` für `:nth-child(… of S)`, Bänder mit
    Editor-Hintergrund (`has-background`) bleiben unberührt, kein Lime-Strich in Kästen.
  - Vorher-nachher-Karten (`rgb-vn`) nebeneinander gleich hoch; Überschrift und Kästen beider
    Karten auf gemeinsamer Linie per CSS-Subgrid (ab 782 px), geprüft 800–1.440 px.
  - Textspalten (`rgb-spalte` ohne Foto, z. B. „1. Erzeugen / 2. Teilen / 3. Nutzen“) als gleich
    hohe Kacheln: weiß mit Schatten auf Grün-Bändern, hellgrün auf weißen, durchscheinend auf dunklen.
  - Video: Der Play-Knopf des Essential-Blocks-Players war 0 × 0 px groß. Jetzt Lime-Kreis mit
    Dreieck mittig auf dem Vorschaubild.
  - Video-Cookies: CCM19 kennt den Dienst „YouTube Video“ (Social Media), blockiert aber den
    Essential-Blocks-Player nicht von selbst. Darum hängt hinter dem Video auf Startseite (1241) und
    Energy Sharing (1355) ein HTML-Block mit `wordpress/video-cookie-sperre.js` (Kopie im Repo):
    Ohne Zustimmung fängt es den Klick ab, zeigt einen Hinweis mit „Cookie-Einstellungen öffnen“
    und startet das Video, sobald „YouTube Video“ erlaubt ist. Das Vorschaubild liegt lokal, vor dem
    Klick geht nichts an Google. Live getestet (ohne/mit Zustimmung, Attrappe für CCM).
  - Über dem Video fett „Alles Wichtige in diesem Video“ (Absatz `rg-video-titel`), Text direkt vor
    einer Kachelreihe so breit wie die Reihe.
  - Review-Punkte: Fokusrahmen am Play-Knopf, Kachelregeln nur in `.rgb-karte`, helle Links in
    Kacheln auf dunklem Grund. Bewusst offen: Vorher-nachher-Karte hat im Raster genau zwei Teile.
- 09.11.2026 **Video-Sperre überarbeitet** (Review BLOCKIERT → Fix), Kundenstimmen eingeschlossen:
  - Liegt jetzt einmal in der Fußzeile (Vorlagenteil `footer`, HTML-Block), die Kopien auf 1241/1355
    sind entfernt. Kopie: `wordpress/video-cookie-sperre.js`, Test: `tests/video-cookie-sperre.test.mjs`
    (13 Fälle, Playwright, CCM und Player als Attrappen, jeder YouTube-Abruf wird gezählt).
  - Fängt click, keydown/keyup/keypress, pointerdown, mousedown, touchstart in der Capture-Phase auf
    `window` ab; Hinweis nur bei Klick, Enter, Leertaste. Netz darunter: MutationObserver entfernt
    jedes YouTube-iframe ohne Zustimmung (auch bei nachträglich gesetztem `src`).
  - Freigabe nur bei Dienstname genau „YouTube Video“ (am echten CCM19 abgelesen). Zustimmung über
    das Banner wird erkannt (Prüfung alle 0,5 s ab Hinweis), danach Start nach 0,6 s, weil CCM19 das
    blockierte Skript der Kundenstimmen erst freischaltet.
  - Live geprüft (echtes CCM19, YouTube nicht erlaubt): Hinweis bei Video und Kundenstimme, kein
    iframe, 0 Abrufe bei YouTube/ytimg/googlevideo, auch nicht beim Laden und Scrollen.
    Datenschutzerklärung hat einen Abschnitt „YouTube“ (Einwilligung).
  - Threat Model Video-Sperre: (a) Player lädt über anderen Eingabeweg, Player-Update ändert den Weg,
    Dienst mit ähnlichem Namen gibt frei; (b) Eingaben: Nutzerereignisse, CCM-Zustand, DOM-Änderungen
    durch Plugins; (c) Worst Case: IP-Übertragung an Google ohne Einwilligung (§ 25 TDDDG);
    (d) Abfangen aller Eingabewege + MutationObserver + exakter Dienstname; fail-closed ohne CCM.
- 09.11.2026 Weitere Wünsche: Menüpunkt „So geht's“ heißt „Energy Sharing“; KI-Kennzeichnung als
  „AI“ im Kreis unten rechts im Bild (Satz bleibt für Screenreader); 3D-Play-Knöpfe auch bei den
  Kundenstimmen (unten rechts, nicht übers Gesicht); grüne Knöpfe mit Tiefe, auch im Rechner.
- 09.11.2026 Re-Review Video-Sperre: FREIGABE. Offen (MITTEL, vor dem nächsten Player-/Plugin-Update):
  Netz prüft nur iframes mit „youtube“ im `src` (nicht script/link, nicht youtu.be,
  nicht `contentWindow.location`); Tests fangen Touch-Weg und Leertaste nicht getrennt ab, nur
  Chromium getestet. NIEDRIG: weitere Ereignisse (pointerup, mouseover …), `passive` für touchstart,
  Auto-Start bis 5 min, toter Knopf ohne CCM, Button in `role=button`, keine package.json.
- 09.11.2026 **Kopfbereich**: Titelbild 55 % (ab 1.200 px 56 %) der Breite, volle Proportion ohne
  Beschnitt (Seitenformat aus dem Bildblock aufgehoben), Kopfband näher am Rand (max. 1.600 px),
  H1 dort clamp(34px, 3,3vw, 54px). KI-Kennzeichnung für das Titelbild 1237 (Startseite, Energy
  Sharing) nachgetragen; Titelbild 733 (Über uns) weiter ungeklärt.
- 09.11.2026 **Fußzeile** aus der Live-Fassung (Revision vom 08.05.2026) wiederhergestellt: Copyright,
  Fußmenü, Logos ROBIN GUT Strom und WeShare Energy, Siegel Renewable Plus und TÜV. Darunter der
  HTML-Block mit der Video-Sperre.
- 09.11.2026 **Kontakt zurück** (Andreas: „das brauchen wir“): Kontaktseite 71 veröffentlicht,
  Weiterleitung 5 (/kontakt/ → FAQ) in Redirection deaktiviert (nicht gelöscht), „Kontakt“ im
  Fußmenü 4. /kontakt/ liefert 200 mit Kontaktdaten und CF7-Formular. Formular nicht abgeschickt
  (würde eine Mail auslösen). Offen: Seite ist noch im alten Look, nicht in Bändern.
- 09.11.2026 **Dieter alleiniger Gründer** (Andreas): Nadine Büscher von Startseite, Privathaushalte,
  Über uns entfernt (Text und Team-Karte). Korrektur Andreas: „Gründer“ bleibt, nur „Mit-“ fällt
  weg → „Dieter Könnes, Gründer der ROBIN GUT Stiftung“ (Startseite, Privathaushalte, Über uns),
  Team-Karte „Journalist und TV-Moderator, Gründer der ROBIN GUT Stiftung.“, im Fließtext
  „gegründet von TV-Moderator Dieter Könnes“. Entwürfe 1244 und 25 nicht geändert.
  Dieter-Karte als Querkarte (Foto links, Text rechts). Besseres Foto: Mediathek hat nur 1242
  (480 × 480); auf robin-gut.org gibt es ein Porträt (dieter-koennes-wdr-02.jpg, 1.200 × 800,
  vermutlich WDR-Rechte) und ein Aktionsfoto Müsch (1.920 × 1.280, © Jan Odenthal) → Rechte klären.
- 09.11.2026 Kurz-Review Kopfbild/Personenkarte: FREIGABE; Härtung umgesetzt (Kopfbild-Regel nur für
  das Bild direkt in der Spalte, Spalte darf schrumpfen, Höhengrenze min(80vh, 760px), runde Bilder
  ausgenommen; Personenkarte zählt Absätze ohne `rg-ki-hinweis`, Foto vertikal mittig). Regel: Jede
  Seite beginnt mit dem Kopfband (`:first-child`). Vorher-nachher-Kästen mit Tiefe wie die Knöpfe.
- 09.11.2026 Kopfbilder Landwirte (1229) und Unternehmen (1239) per CSS auf das Format der Startseite
  (1743:1126 ≈ 1,55) gebracht, links beschnitten (`object-position: right`). Privathaushalte bleibt
  1,34 (4:3, Andreas nannte es mit der Startseite als Vorbild).
