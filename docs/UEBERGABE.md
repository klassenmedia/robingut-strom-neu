# Übergabe: Relaunch robingut-strom.de (Stand 11.11.2026)

Einstieg für jede neue Sitzung, auch in einem anderen Account. Die Details stehen in den Plänen unter
`docs/plans/`. Hier steht, was wo liegt, wie man Änderungen einspielt und welche Regeln gelten.
**Das Repo ist öffentlich** (wegen GitHub Pages): keine Zugangsdaten, Schlüssel oder Kundendaten hinein.

## Kurzstand

- Die neue Seite ist **seit 09.11.2026 ~22:45 live** auf https://www.robingut-strom.de. Sie war vorher die
  Release-Seite. Gebaut ist sie in WordPress 7.1 mit Theme Frost, Design „Variante A“.
- **Die Wahrheit liegt in WordPress, nicht im Repo.** Seiteninhalte pflegen Dieter, Timo und Guido selbst im
  Editor. Im Repo liegen nur Kopien:
  - das globale CSS (`wordpress/variante-a.css`)
  - die HTML-Blöcke (`wordpress/*.html`)
  - die Plugins
  - die Tests
- Es gibt kein CI/CD. „Deployen“ heißt: Änderung per WordPress-REST im angemeldeten Browser speichern, danach den
  Cache leeren (siehe „So spielt man Änderungen ein“).
- Git: Arbeitsbranch `umbau-variante-b` mit PR https://github.com/klassenmedia/robingut-strom-neu/pull/13. Der PR
  ist **noch nicht gemergt**, `main` hängt hinterher. Jeder Commit ist gepusht und war einzeln im Review.
- Letzte Änderung (11.11., Commit cda2733): Auf der Landwirte-Seite steht statt des Rechenbeispiels der
  Flyer-Kasten mit + 7.000 € und + 9.000 €.

## Wo was liegt

| Was | Wo |
|---|---|
| Live-Seite | www.robingut-strom.de = Mittwald-Ordner `/html/wordpress-release-robingut-strom/` (Hosting Mittwald, Projekt p709435, alter Kundencenter login.mittwald.de; DNS IONOS) |
| Archiv alte Seite | Mittwald-Ordner `/html/wordpress-robingut-strom/` (eigene DB, keine Domain), Wiederherstellungspunkt 09.11.2026 22:37 |
| release.robingut-strom.de | leitet auf www um (Verzeichnisschutz entfernt); nicht mehr zum Arbeiten |
| Seiten-IDs | Startseite 1241, Energy Sharing 1355, Privathaushalte 1243, Landwirte 1230, Unternehmen & Organisationen 1110, Über uns 154, FAQ 23 |
| Globales CSS | WordPress → Website-Editor → Stile → Zusätzliches CSS (REST: `/wp-json/wp/v2/global-styles/12`); Kopie ab `/* Variante A` in `wordpress/variante-a.css` |
| Preisrechner auf den Seiten | Original-iframe von WeShareEnergy als HTML-Block, `wordpress/wse-rechner.html` (Test `tests/wse-rechner.test.mjs`); lädt direkt, ohne Zwei-Klick |
| Kundenfall Unternehmen | `wordpress/kundenfall-unternehmen.html` (Test `tests/kundenfall-unternehmen.test.mjs`) |
| Flyer-Kasten Landwirte | `wordpress/landwirte-flyer.html` (Test `tests/landwirte-flyer.test.mjs`) |
| Strukturdaten + llms.txt | Plugin `wordpress/robingut-geo/` 1.0.0, **aktiv auf Live**; Plan `docs/plans/GEO-STRUKTURDATEN.md`, Test `php wordpress/robingut-geo/tests/geo-test.php` |
| Eigenes Rechner-Plugin | `wordpress/robingut-rechner/`: 1.1.2 auf Live **deaktiviert**, 1.2.0 im Repo gebaut und getestet, aber **nicht hochgeladen** (geparkt, `docs/plans/RECHNER-PLUGIN.md`) |
| Pläne und Verlauf | `docs/plans/UMBAU-VARIANTE-B.md` (Hauptplan, Abschnitt „Stand“ = Tagebuch, Go-Live-Block mit Rückweg), `WORDPRESS-UMBAU.md` (älter) |
| Rechtstexte-Entwürfe | `docs/texte/datenschutz-wse-rechner.md` (aktuell), `datenschutz-preisrechner.md` (veraltet), `yoast-meta.md` |
| KI-Bilder (Kopfbilder) | `werkzeuge/vertex_bild.py` + `werkzeuge/prompts/`; braucht ein eigenes Google-Vertex-Dienstkonto, Schlüsseldatei nur lokal, nie ins Repo |
| Statischer Entwurf (nur Vorlage) | `schlank/`, als GitHub Page |
| Potenzialrechner (separat) | privates Repo `klassenmedia/robingut-bepreisung` |

Zugänge: WordPress-Admin und Mittwald mit den eigenen Logins. Die Person meldet sich selbst im Browser an,
Passwörter gibt man nie in Chat oder Repo.

## So spielt man Änderungen ein (bewährter Ablauf)

1. **Fragen, ob gerade jemand im Editor arbeitet** (Guido, Dieter, Timo). Speichern sie danach, überschreiben
   sie per REST gespeicherte Änderungen.
2. **Im Repo:** Test zuerst, dann die Änderung. HTML-Blöcke als Datei unter `wordpress/`, CSS **nur am Ende** von
   `wordpress/variante-a.css` anhängen.
3. **Review** durch einen unabhängigen Prüfer (Subagent oder frische Sitzung, nicht der Kontext, der den Code
   geschrieben hat). Erst nach FREIGABE live.
4. **Live per REST** im angemeldeten Browser (Claude in Chrome, WordPress-Login vorhanden):
   - Nonce holen: `fetch('/wp-admin/admin-ajax.php?action=rest-nonce')`, dann Header `X-WP-Nonce`.
   - Seite lesen mit `GET /wp-json/wp/v2/pages/<id>?context=edit` (`content.raw`). Gezielt ersetzen und
     mit `POST /wp-json/wp/v2/pages/<id>` und `{content}` speichern.
   - Vor dem Speichern prüfen, dass `modified` sich seit dem Lesen nicht geändert hat.
   - Template-Teile liegen unter `/wp-json/wp/v2/template-parts/frost//<slug>`. Die Schrägstriche nicht
     kodieren.
   - CSS: `global-styles/12` lesen. **Vorher prüfen**, dass der Teil ab `/* Variante A` (SHA-256, erste 16
     Hex-Zeichen) dem Repo-Stand vor der Änderung entspricht. Dann den Zusatz anhängen und den Hash nach dem
     Speichern mit dem Repo vergleichen.
   - **Aktueller CSS-Hash: `32baeb78fbb55788`**
   - Medien hochladen mit FormData an `/wp-json/wp/v2/media`.
5. **Cache leeren:** Den Link `w3tc_flush_all` aus der Admin-Leiste aufrufen (Plugin W3 Total Cache).
6. **Live prüfen:** Desktop und Handy (390 px).
   - Für Vorschauen `?vorschau=x` anhängen, nie `?m=`. Das ist in WordPress der Monatsarchiv-Parameter und
     führt zu 404.
   - Handybreite gelingt zuverlässig in einem iframe mit 390 px Breite auf derselben Domain.
7. Committen, pushen, im Plan unter „Stand“ eintragen. Andreas per Mail benachrichtigen, wenn etwas live ist.

## Regeln im Projekt (verbindlich)

- **Vorhandene Texte nie umformulieren.** Andreas am 10.11. sinngemäß: Die Kunden wollen ihren Wortlaut genau so,
  auch wenn er gegen etwas verstößt. Bedenken (UWG, Logik) nur als Hinweis an Andreas melden. Neue Texte von
  Dieter oder Timo (z. B. Flyer) **1:1** übernehmen.
- Immer „ROBIN GUT“ schreiben, nie Robin Good/Hood.
- Den Partner (WeShareEnergy) auf der Website nur „unser Partner“ nennen, auch in JSON-LD und llms.txt, bis
  § 5b UWG geklärt ist. Das iframe-`title` und die Rechtstexte nennen ihn bisher. In Code und Plänen ist der
  Name in Ordnung.
- KI-Bilder bekommen darunter „Mit KI-Unterstützung erstellt“: 11 px, rechtsbündig, Klasse `rg-ki-hinweis`.
- Texte positiv formulieren. Keine kleinen Zeilen über Überschriften (Eyebrows).
- Sonst nur Core-Blöcke, damit das Team selbst bearbeiten kann. HTML-Blöcke nur für Dinge, die Core nicht
  kann: Rechner-iframe, Schaubild Kundenfall, Flyer-Kasten.
- Fallen im Theme:
  - Jedes `<mark>` bekommt einen Textmarker (`background-image:none` setzen).
  - Gefüllte Knöpfe haben 66 px Innenabstand (pro Knopf auf 28 px gesetzt).
  - `.rgb-karte .wp-block-columns` setzt `gap` mit `!important`.
- Mittwald fragt immer wieder per Fenster nach einer Projekt-E-Mail. Nicht ausfüllen, mit Abbrechen schließen
  (Andreas entscheidet).
- Code: Test zuerst. Unabhängiges Review vor Live-Gang. gitleaks auf dem Diff. Kleine Commits, die das Warum
  beschreiben.

## Offen

**Inhalt und Recht (Entscheidung ROBIN GUT):**
- **Rechner lädt direkt** (Entscheidung Andreas). Die IP geht beim Seitenaufruf an den Partner. Der Abschnitt
  „Preisrechner“ in der Datenschutzerklärung (berechtigtes Interesse) muss rechtlich geprüft werden.
- **Flyer-Kasten Landwirte:**
  - „Ihr Plus“ ist vor Kosten gerechnet.
  - Flyer 5 ct/12 ct, das Band weiter oben 4,5 ct/7–11 ct.
  - „50 % autark“.
  - „Marktwert“ und „entgangene Einspeisevergütung“ stehen für dieselben 5 ct.
  - Ist an Andreas gemeldet, Text bleibt wie vorgegeben.
- **Kundenfall Unternehmen bestätigen lassen** (viertelstündlich, bilanziell). Andreas wurde gefragt, ob drei
  selbst formulierte Stellen zurückgesetzt werden sollen; die Antwort steht aus:
  - Schaubild-Texte („bilanziell“, „weiter vom Stromlieferanten aus dem Netz“, „Ihren Strom kauften die
    Standorte komplett zu“)
  - Datenschutz-Abschnitt „Preisrechner“
  - Theme-Schema/llms.txt, ersetzt durch das Plugin robingut-geo
- **Partnername** auf Kontakt, FAQ, Datenschutz und im iframe-Titel gegen die „unser Partner“-Regel.
- **Yoast:** Der Organisationsname lautet „Robin Gut Strom“ (nur nach Rückfrage ändern).

**Technik:**
- Google Search Console und Bing legen Dieter oder Timo an (Yoast-Verifizierung), danach die Sitemap einreichen.
- WSE:
  - Einspeiser-Direktlink und Vorbelegung der Rolle
  - Einspeiser-Community (2,90 €/Monat) gegenüber den Kosten der Direktvermarktung klären
  - release.… freigeben, falls je wieder eine Testumgebung nötig ist
- Unbenutztes CSS `.rg-wse-start`/`.rg-wse-laden` (Zwei-Klick) kann raus.
- Rechner-Plugin 1.2.0 ist geparkt. Ob es je live geht, entscheidet ROBIN GUT.
- PR #13 nach `main` mergen, wenn Andreas das will.
- Browser-Tests (`plugin-oberflaeche`, `video-cookie-sperre`, `wse-rechner`) brauchen Playwright und ein lokales
  Chrome. Im letzten Review liefen sie nicht durch, Grund ist die Umgebung, nicht der Code.

## Tests (lokal)

```
node tests/landwirte-flyer.test.mjs
node tests/kundenfall-unternehmen.test.mjs
node tests/wse-rechner.test.mjs
php wordpress/robingut-geo/tests/geo-test.php
node tests/plugin-rechnung.test.mjs
php wordpress/robingut-rechner/tests/logik-test.php
php wordpress/robingut-rechner/tests/routen-test.php
```
