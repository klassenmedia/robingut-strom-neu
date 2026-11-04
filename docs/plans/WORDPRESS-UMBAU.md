# Umbau der bestehenden WordPress-Seite (Meeting 03.11.2026)

Entscheidung: Die bestehende WordPress-Seite www.robingut-strom.de bleibt und wird umgebaut,
weil das Team Texte selbst im CMS ändern will. Der statische Entwurf unter `schlank/` ist die
Vorlage. Umgesetzt wird zuerst auf einer passwortgeschützten Kopie, danach wird umgestellt.

## Ist-Stand Live-Seite (03.11.2026)

- WordPress, Block-Theme Frost, Plugins u. a. Contact Form 7 (+ Honeypot), Essential Blocks,
  Ultimate Blocks. Hosting nach Servername bei Mittwald, DNS bei IONOS.
- Menü: Konzept / So geht's / Organisationen / Preise / Community / Über uns / FAQ
- Startseite: H1 „ROBIN GUT Energy Sharing Plattform für Deutschland.“, H2 „Die
  Strom-Community, die Menschen verbindet und Bäume pflanzt.“, Rechner als iFrame des Partners,
  Video, Kacheln Vision/Konzept/Effekt, „Die wichtigsten Vorteile auf einen Blick“, „Das sagen
  unsere Kunden“.
- Seiten (ID/Slug): 17 konzept, 19 preise, 21 community, 23 fragen-und-antworten,
  154 ueber-uns, 1045 so-gehts, 1110 organisationen-und-vereine, 71 kontakt,
  64 impressum, 66 datenschutzerklaerung. Eine Landwirte-Seite gibt es noch nicht.
- Admin-Bestand (nur gelesen): WordPress 7.1.2 (7.1.4 verfügbar), PHP 8.3, 3 Administratoren.
  Die Startseite ist das angepasste Template `home` im Website-Editor, keine Seite
  (Einstellung „Neueste Beiträge“). Angepasste Templates: home, page, single, archive,
  seiten-mit-kundenstimmen; Template-Teile header, footer, unsere-kunden; Navigationen
  „HeaderMenu“ (68) und „FooterMenu“ (4); Muster „iFrameRechner“.
- Plugins aktiv: CCM19 (Cookie-Banner), WP-Piwik, Contact Form 7 + Honeypot, Essential Blocks,
  Ultimate Blocks, Safe SVG, W3 Total Cache, WP Mail SMTP, Yoast SEO; Akismet inaktiv.
  Sieben Updates stehen aus, die automatischen Updates hängen laut WordPress seit 8 Monaten
  (WP-Cron). Ein Backup-Plugin gibt es nicht.

## Beschlüsse

Menü neu, von links nach rechts (Vorgabe Guido nach dem Meeting):
**So geht's / Preise / Organisationen / Landwirte / Privathaushalte / Über uns / FAQ**
„Konzept“ fällt weg, „Community“ wird durch „Privathaushalte“ ersetzt, Über uns und FAQ
bleiben vorerst unverändert.

Startseite:
1. Headerbild: Flyer-Motiv (Tal mit Sonne, quer), möglichst vollständig, wenig verdeckt.
2. H1 bleibt suchmaschinentauglich mit „ROBIN GUT“ und „Energy Sharing“; darf kleiner
   gesetzt sein. Groß darüber/daneben ein griffiger Claim (Dieters Richtung: „transparent,
   fair, günstig, nachhaltig“). Genau eine H1.
3. H2 „Die Strom-Community, die Menschen verbindet und Bäume pflanzt.“ bleibt.
4. Rechner bleibt vorerst. Ziel laut Dieter: monatlicher Abschlag wie bei Vergleichsportalen.
   Tendenz: unser Rechner in abgespeckter Form (nur Kosten, ohne Vergleich mit heutigem Tarif).
   Separates Thema, siehe offene Punkte.
5. Kacheln Vision/Konzept/Effekt raus, dafür die drei Zielgruppen-Karten aus dem Entwurf.
6. Video wandert von der Startseite nach „So geht's“.
7. „So funktioniert die Stromcommunity“ (Anmelden, Lesekopf aufstecken, Strom teilen) aus
   dem Entwurf übernehmen, Icons aussagekräftiger.
8. „Die wichtigsten Vorteile auf einen Blick“ bleibt, Text anpassen (Idee: je Vorteil eine
   Kundenstimme).
9. „Das sagen unsere Kunden“ bleibt.

Unterseiten:
- So geht's: Video plus das Brauchbare aus „Konzept“, kurz erklärt.
- Preise: Preisbereich aus dem Entwurf („auf einen Blick“). Posten „Allgemeine Kosten“ mit
  Zusatz „je nach Region, z. B. Netzentgelte, Steuern und Umlagen“. Optional Vergleich mit dem
  Durchschnittspreis 2025 (Quelle recherchieren und nennen).
- Organisationen: Inhalt aus `schlank/unternehmen/`.
- Landwirte (neu): Inhalt aus `schlank/landwirte/` 1:1. **Vorrang wegen Landwirtschaftsmesse
  am Mittwoch, 11.11.2026.**
- Privathaushalte (neu, ersetzt Community): Inhalt aus der Entwurfs-Startseite, spezifischer
  für Haushalte.
- FAQ: Unterscheidung nach Zielgruppen ist gewünscht.

Wording:
- Den Hinweis „liefert die Community gerade nichts, bekommst du Ökostrom vom Partner“ nur
  einmal an passender Stelle, nicht wiederholen.
- Einstieg in Alltagssprache („Ökostromtarif“), „Strom teilen mit Menschen, die du wählst“
  holt Laien nicht ab.
- „Monatlich kündbar“: von Guido bestätigt, Hinweis bleibt.

## Vorgehen

1. Bestandsaufnahme im WP-Admin (nur lesen): Version, Plugins, Muster, Menü, Backup-Möglichkeit.
2. Vollbackup der Live-Seite.
3. Kopie anlegen (Staging), nur für Angemeldete sichtbar, nicht indexiert.
4. Umbau auf der Kopie mit Frost-Blöcken, damit alles im Editor änderbar bleibt. Reihenfolge:
   Landwirte → Menü → Startseite → Privathaushalte → Organisationen → So geht's → Preise.
5. Abnahme durch Guido, Timo, Dieter.
6. Umstellung auf live, danach Live-Prüfung; Backup bleibt als Rückweg.

## Stand

- 03.11.2026: Landwirte als Entwurf angelegt (Seite 1230, Slug `landwirte`, Template „No Title“),
  nur Core-Blöcke (Cover, Gruppen, Spalten, Details, Listen, Buttons), keine HTML-Blöcke. Bild als
  Medium 1229 mit Bildunterschrift „Symbolbild, KI-generiert“. Text und alle Zahlen automatisch
  gegen `schlank/landwirte/` abgeglichen: identisch, die 5 Prüf-Markierungen sind als gestrichelte
  `<mark>` drin (Theme-Textmarker per `background-image:none` abgeschaltet). Handy-Breite 390 px
  ohne Überlauf. Noch offen vor dem Veröffentlichen: Markierungen klären, Yoast-Titel und
  -Beschreibung setzen, Menüpunkt, Review.
- 03.11.2026: Weitere Entwürfe, alle Template „No Title“, nur Core-Blöcke:
  - 1241 „Startseite (neu)“ (`startseite-neu`): Flyer-Bild voll sichtbar (Medium 1237), darunter
    grüne Fläche mit kleiner SEO-H1 „ROBIN GUT – Energy Sharing Plattform für Deutschland“ und
    großem Claim „Fair. Transparent. Günstig. Nachhaltig.“ („Günstig“ markiert, „Nummer 1“
    bewusst weggelassen); übernommen aus dem Template `home`: H2 Strom-Community, Rechner
    (wiederverwendbarer Block 325), Vorteile (Knopf jetzt → /privathaushalte/),
    Kundenstimmen (Template-Teil). Neu: Zielgruppen-Karten, „So funktioniert die
    Stromcommunity“ mit 3 Schritten. Vision/Konzept/Effekt und Video entfallen.
    Beim Umstellen: unter Einstellungen → Lesen als statische Startseite setzen.
  - 1243 „Privathaushalte“ (`privathaushalte`): Inhalt der Entwurfs-Startseite, H1 jetzt
    „Ökostrom für deinen Haushalt. Von Menschen, die du wählst.“, Reserve-Satz nur noch in
    der Schritte-Einleitung der Startseite und in der FAQ. „Monatlich kündbar“ ohne
    Markierung (von Guido im Meeting bestätigt). Neue FAQ zu Balkonkraftwerk/Speicher aus dem
    Hotline-Anruf (markiert). Bilder 1238 (Küche), 1240 (Wald), 1242 (Dieter).
  - 1244 „Organisationen (neu)“ (`organisationen-neu`): Inhalt aus `schlank/unternehmen/`
    (Zahlen automatisch abgeglichen, identisch), Kommunen-Abschnitt um Vereine ergänzt,
    Bild 1239.
  - 1245 So geht's (neu) (`so-gehts-neu`, Standard-Template, Titel wie Seite 1045): Inhalt von
    1045, dahinter der Video-Abschnitt aus `home` (ohne Knopf „Mehr Details“).
  - 1246 Preise (neu) (`preise-neu`, Standard-Template, Titel wie Seite 19): Inhalt von 19,
    nach dem Preisrechner neu „Dein Preis auf einen Blick“: drei Bausteine (Allgemeine Kosten
    je nach Region, Erzeugerpreis 7–11 ct, Plattformgebühr 1 ct), BDEW-Vergleich 2025 39,6 ct /
    2026 bisher 37,0 ct (markiert, gegen Originalfolien prüfen) und Tabelle „Auf einen Blick“.
  - Navigation 1247 „HeaderMenu (neu)“ (Entwurf): So geht's / Preise / Organisationen /
    Landwirte / Privathaushalte / Über uns / FAQ, Links an die Seiten-IDs gebunden.
  - Prüf-Markierungen mit `color:inherit`, damit sie auf dunklem Grund lesbar bleiben.
    Kartenbilder 16:9, Flyer-Bild 21:9.
  - Nachgebessert (Andreas): Auf der Startseite steht der Text jetzt im Flyer-Bild (Cover-Block,
    Verlauf links). Karten in Spalten haben `min-height:100%`; Karten mit Button sind
    vertikale Flex-Gruppen mit „space-between“, damit die Buttons unten bündig sitzen.
    Buttons nebeneinander haben 12 px Abstand statt der 241 px aus dem Theme. Nachgemessen
    bei 1800 px Breite: in jeder Kartenreihe gleiche Höhe, Überschriften und Buttons auf einer
    Linie; bei 390 px kein Überlauf.
  - UX-Durchgang (gemessen bei 1440/1800 und 390 px): Button-Innenabstand 14/28 px statt der
    66 px aus dem Theme, dadurch keine umbrechenden Buttons mehr; Kartenbutton „Mehr für
    Landwirte“ gekürzt. Fließtext, FAQ und Rechenbeispiele in 760 px breiten Gruppen,
    linksbündig im 1200er-Raster (vorher über 130 Zeichen pro Zeile). FAQ-Einträge mit
    Trennlinie und 14 px Innenabstand (größere Tippfläche). Kontakt-Überschriften zentriert
    (WP 7 speichert die Ausrichtung in `style.typography.textAlign`, nicht mehr in `textAlign`).
    Nicht angefasst: übernommene Altinhalte auf Preise/So geht's (dort weiter lange Zeilen)
    und der Template-Teil „unsere-kunden“ (Button „Mehr über die Community“ bricht auf dem
    Handy um und zeigt auf /community/; beim Umstellen auf /privathaushalte/ ändern).
  - Review noch nicht gelaufen; vor dem Umstellen nötig (Umfang voll, weil Zahlen und Preise).

- 04.11.2026: Eigener Preisrechner (Plugin „ROBIN GUT Preisrechner“, Shortcode
  `[robingut_rechner]`, siehe `RECHNER-PLUGIN.md`) ersetzt in 1241, 1243 und 1246 das
  WSE-Muster „iFrameRechner“. Live-Startseite und alte Seiten nutzen weiter das Muster.

## Umstellen (Checkliste)

1. Vollbackup (Mittwald oder WordPress-Export) und Stand notieren.
2. Markierte Aussagen klären oder Text anpassen, Markierungen entfernen.
3. Landwirte (1230) und Privathaushalte (1243) veröffentlichen.
4. Inhalt von 1244 → 1110, 1245 → 1045, 1246 → 19 kopieren (URLs bleiben), Entwürfe löschen.
5. 1241 in „Startseite“ umbenennen, veröffentlichen, Einstellungen → Lesen → statische
   Startseite = 1241. Template `home` bleibt unangetastet als Rückweg.
6. Header-Template-Teil: Navigation 68 durch 1247 ersetzen (oder 68 mit dem Inhalt von 1247
   überschreiben). Konzept (17) und Community (21) auf Entwurf setzen; Weiterleitung auf
   So geht's bzw. Privathaushalte klären (Yoast kann das nur in der Premium-Version).
7. Yoast-Titel/-Beschreibungen, Cache (W3 Total Cache) leeren, live prüfen.

## Offen

- Rechner: Gutschein-Thema mit dem Partner klären (Dieter), Entscheidung eigener abgespeckter
  Rechner vs. iFrame.
- „Nummer 1“, „günstigster“ o. ä. im Claim sind Spitzenstellungswerbung und nur mit Beleg
  zulässig (UWG); Alternative ohne Superlativ vorschlagen.
- Weiter offen aus `SCHLANK.md` §14: Partnername § 5b UWG, Energy Sharing/§ 42c EnWG und
  „ganz Deutschland“, Lesekopf für reine Verbraucher, Stiftungsanteil, Freigaben Zitat/Foto.
- Aus einem Hotline-Anruf: Die Frage „Geht das technisch bei mir?“ (Balkonkraftwerk, Speicher,
  digitaler Zähler) beantwortet die Seite noch nicht → FAQ-Eintrag; Vertrauen ist eine Hürde →
  Kundenstimmen und Referenzen früh zeigen.
