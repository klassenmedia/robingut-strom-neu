# Übergabe: Relaunch robingut-strom.de (Stand 05.11.2026)

Diese Datei ist der Einstieg für jede neue Sitzung oder einen anderen Account. Details stehen
in den Plänen unter `docs/plans/`; hier steht, was wo liegt und wie man weitermacht.

## Worum es geht

ROBIN GUT Strom (Energy-Sharing-Community, Liefer- und Abrechnungspartner WeShareEnergy, „WSE“)
bekommt eine neue Website. Nach dem Meeting am 03.11.2026 wird die **bestehende WordPress-Seite
umgebaut** (Team pflegt Texte selbst), der statische Entwurf in `schlank/` ist nur noch Vorlage.

## Wo was liegt

| Was | Wo |
|---|---|
| Live-Seite (alt, unverändert) | https://www.robingut-strom.de (WordPress 7.1, Theme Frost, Hosting Mittwald, DNS IONOS) |
| Release-Seite (neu, umgestellt) | https://release.robingut-strom.de, Basic-Auth-Passwort davor, Kopie per All-in-One WP Migration |
| Statischer Entwurf (Vorlage) | `schlank/`, als GitHub Page: https://klassenmedia.github.io/robingut-strom-neu/schlank/ |
| Preisrechner-Plugin | `wordpress/robingut-rechner/` (Shortcode `[robingut_rechner]`) |
| Pläne und Stand | `docs/plans/WORDPRESS-UMBAU.md`, `docs/plans/RECHNER-PLUGIN.md`, `docs/plans/SCHLANK.md` |
| Code-Stand | `main` (PR #9 am 05.11.2026 gemergt, 3aeccf9) |
| Potenzialrechner (Berater-Tool, separat) | privates Repo `klassenmedia/robingut-bepreisung`, läuft auf dem CX33 |

Zugänge: WordPress-Admin auf Live und Release mit den eigenen Logins (Release ist eine Kopie,
gleiche Benutzer). Das Basic-Auth-Passwort für Release kennt, wer die Release-Seite eingerichtet
hat. Keine Zugangsdaten ins Repo.

## Stand auf release.robingut-strom.de

Seit 09.11.2026 im Design **Variante A** aus der Übergabe vom 08.11. (Startseite 1241, Energy
Sharing 1355, Privathaushalte 1243, Landwirte 1230, Unternehmen 1110, Über uns 154, FAQ 23).
Stand und offene Punkte: `docs/plans/UMBAU-VARIANTE-B.md`. Rechner-Plugin **1.1.0** aktiv
(Klickstrecke): Landwirte mit `rolle="einspeisen" anrede="sie"`, Unternehmen mit
`rolle="beides" anrede="sie"`, sonst Standard (beziehen, du). Älterer Umbau und Rückweg:
`WORDPRESS-UMBAU.md`.

**Ab jetzt nur noch auf Release arbeiten.** Änderungen fließen nicht automatisch zur Live-Seite.
Go-Live später: Release als Ganzes auf die Live-Domain übertragen (All-in-One WP Migration),
vorher Vollbackup der Live-Seite.

Auf der Live-Seite liegen die neuen Seiten nur als Entwürfe, dort läuft noch Plugin 1.0.1.

## Preisrechner-Plugin

- Zeigt den Monatsbetrag genau wie der WSE-Rechner: `annual_total / 12` aus
  `POST https://weshareenergy.de/api/calculate-price` (Slug `robin-gut-strom`, Provision ist im
  Preis). Die API lässt Browser-Aufrufe fremder Domains nicht zu, deshalb fragt das Plugin
  serverseitig an.
- Erzeuger (ab 1.1.0): Grundpreis, Vermarktung und Einrichtung aus
  `POST https://weshareenergy.de/api/direktvermarktung/calculate-price` (Preismodell 77, nur PV
  und Wind; Wasserkraft und Biogas zeigen „individuelles Angebot“). Der Erlös aus Überschuss ×
  Wunschpreis rechnet der Browser.
- Sonderfälle der API: `requires_city_selection` (Ort wählen, z. B. 54636) und
  `requires_district_selection` (Straße + Hausnummer, z. B. 41812), mit eigenem Straßen-Dropdown.
- Tests:
  - `node tests/plugin-rechnung.test.mjs`
  - `node tests/plugin-oberflaeche.test.mjs` (Playwright aus `~/node_modules`, installiertes
    Chrome; REST wird nachgebaut, kein echter WSE-Aufruf)
  - `php wordpress/robingut-rechner/tests/logik-test.php`
  - `php wordpress/robingut-rechner/tests/routen-test.php`
  - `bash wordpress/robingut-rechner/tests/parallel-test.sh` (100 parallele Anfragen gegen eine
    WSE-Attrappe)
- Lokal ausprobieren: `php -S 127.0.0.1:8765 -t wordpress/robingut-rechner
  wordpress/robingut-rechner/tests/harness/router.php` (spricht die echte WSE-API, sparsam
  nutzen: WSE erlaubt 50 Anfragen pro Minute für alle seine Rechner zusammen).
- Upload-ZIP: `bash werkzeuge/rechner-plugin-zip.sh` → `werkzeuge/ausgabe/` (nicht im Repo).
  Vorher die Version in Plugin-Kopf und `RGR_VERSION` erhöhen. In WordPress: Plugins → Neues
  Plugin hinzufügen → Plugin hochladen → „Installiertes durch Hochgeladenes ersetzen“.
- Security-Reviews und angenommene Restrisiken: `RECHNER-PLUGIN.md`, Abschnitt „Stand“.

## Arbeitsweise und Regeln im Projekt

- Immer „ROBIN GUT“ schreiben, nie Robin Good/Hood.
- Den Partner auf der Website nur „unser Partner“ nennen, ohne Namen (auch nicht in JSON-LD
  oder llms.txt), bis die Frage nach § 5b UWG geklärt ist. Im Code und in den Plänen ist
  der Name in Ordnung.
- Unbestätigte Aussagen bekommen eine gestrichelte Markierung (`<mark>` mit
  `border-bottom: 3px dashed #9a5200` und `title` mit der offenen Frage). Vor dem Go-Live
  klären oder umformulieren, dann die Markierung entfernen.
- KI-Bilder tragen klein unten rechts direkt unter dem Bild „Mit KI-Unterstützung erstellt“ in 11 px
  (Vorgabe Andreas, 06.11.2026): Absatz mit Klasse `rg-ki-hinweis`, rechtsbündig. Das CSS dafür steht in den
  globalen Stilen (Kopie `wordpress/titelbild.css`). Der statische Entwurf in `schlank/` nutzt
  noch das alte „Symbolbild, KI-generiert“.
- Texte positiv formulieren, keine kleinen Zeilen über Überschriften (Eyebrows).
- Seiten in WordPress nur aus Core-Blöcken bauen (keine HTML-Blöcke), damit das Team sie
  bearbeiten kann. WP 7 speichert die Textausrichtung von Überschriften in
  `style.typography.textAlign`.
- Fallen: Das Theme legt unter jedes `<mark>` einen Textmarker (`background-image`), deshalb
  `background-image:none` und `color:inherit` setzen. Gefüllte Buttons haben im Theme 66 px
  Innenabstand links/rechts, darum ist er pro Button auf 28 px gesetzt.
- Code-Änderungen: Test zuerst, danach unabhängiges Security-Review vor Merge oder Upload;
  Commits klein, Branch und PR.

## Offen

- Datenschutzerklärung: Der Abschnitt „Preisrechner“ steht seit 05.11. auf Release (für 1.1.0 ergänzt am 09.11.) (Text in
  `docs/texte/datenschutz-preisrechner.md`). Vor dem Go-Live rechtlich prüfen lassen und
  entscheiden, ob der Partner dort mit Namen steht (markiert).
- „Über uns“ (154) nennt den Partner noch mit Namen, das gehört zu den Markierungen.
- Website-Name in Yoast lautet noch „Robin Gut Strom“ statt „ROBIN GUT Strom“ (globale
  Einstellung, nur nach Rückfrage ändern).
- Timo: Ist der Aufschlag im ROBIN-GUT-Tarif (+0,90 ct/kWh und +0,21 €/Monat netto gegenüber dem
  WSE-Standard) die Provision bzw. der Stiftungsanteil? Außerdem Plattformgebühr-Lesart,
  § 80 EEG (Landwirte-Beispiel 2), Community-Preise 5 ct vs. 10 ct.
- Dieter: Gutschein-Frage zum Rechner, Freigabe von Zitat und Foto (§ 22 KUG).
- Guido: Die H1 der Release-Startseite lautet „Die Nr.1 Energy Sharing Plattform“. Das ist eine
  Spitzenstellungsbehauptung und braucht einen Beleg (UWG).
- Energy Sharing / § 42c EnWG und „ganz Deutschland“ mit dem Partner klären.
- Alle gestrichelten Markierungen auflösen; Weiterleitungen für /konzept/ und /community/
  (Yoast Premium oder Plugin). Yoast-Titel und -Beschreibungen sind seit 05.11. auf Release
  gesetzt (`docs/texte/yoast-meta.md`).
- Bekommt die Seite IPv6, braucht der Rechner zusätzlich ein Limit je /48
  (siehe `RECHNER-PLUGIN.md`).
- Der Potenzialrechner (`robingut-bepreisung`) kennt den Ort-Fall `requires_city_selection`
  noch nicht.
