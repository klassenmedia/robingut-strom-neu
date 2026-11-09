# Preisrechner als WordPress-Plugin (04.11.2026)

Ziel: ROBIN GUT Strom bekommt einen eigenen Preisrechner direkt in WordPress, im Stil
eines Vergleichsportals. Der Kunde sieht sofort, was er im Monat zahlt, und auf Wunsch die
Ersparnis gegenüber seinem heutigen Abschlag. Er ersetzt das iFrame des Partners (Muster
„iFrameRechner“) in den Entwürfen.

## Warum ein Plugin

Die Preis-API des Partners (`POST https://weshareenergy.de/api/calculate-price`, Slug
`robin-gut-strom`) erlaubt Browser-Aufrufe nur von eigenen Domains (Test 04.11.2026,
`Access-Control-Allow-Origin` nur weshareenergy.de). Ein reines Skript in WordPress wird
deshalb blockiert. Das Plugin fragt serverseitig an, genau wie `wse-proxy.js` im
Potenzialrechner (Repo `robingut-bepreisung`).

## Aufbau

`wordpress/robingut-rechner/`
- `robingut-rechner.php`: Plugin-Kopf, lädt die Teile.
- `includes/logik.php`: reine Funktionen (Prüfung, Whitelist, Rate-Limit, Cache-Schlüssel),
  ohne WordPress testbar.
- `includes/rest.php`: REST-Routen `POST /wp-json/robingut-rechner/v1/preis` und
  `GET /wp-json/robingut-rechner/v1/strassen`.
- `includes/shortcode.php`: Shortcode `[robingut_rechner]`, gibt das Formular aus und lädt
  die Dateien.
- `assets/rechnung.js`: reine Rechnung (Browser und Node).
- `assets/rechner.js`, `assets/rechner.css`: Oberfläche.
- Tests: `tests/plugin-rechnung.test.mjs` (Node), `wordpress/robingut-rechner/tests/logik-test.php` (PHP-CLI).

## Rechnung

Vorgabe Andreas (04.11.2026): Der Rechner zeigt dasselbe wie der des Partners, weil dessen
Preis die Provision schon enthält. Keine eigenen Annahmen zum Community-Anteil.
- Monat = `annual_total` / 12 (Jahressumme des Partners, brutto).
- Angezeigt: `energy_price` (Arbeitspreis), `transaction_fee` (Plattformgebühr),
  `monthly_base_price` (Grundpreis im Monat), Netzgebiet (`city`).
- Plausibilität: `annual_total` muss zu (Arbeitspreis + Gebühr) × kWh + `base_price` passen
  (±0,5 %, mindestens 2 €), und `annual_consumption_kwh` muss dem angefragten Verbrauch
  entsprechen; sonst zeigt der Rechner keine Zahl.
- Lesekopf (3,90 €/Monat Miete oder 89 € Kauf) nur als Hinweis, nicht in der Summe.
- Ersparnis = heutiger Abschlag × 12 − Jahressumme; |Δ| < 12 € gilt als „etwa gleich“.
- Grenzen: 500 bis 100.000 kWh, darüber individuelles Angebot.

Beispiele (04.11.2026, live gegengeprüft): 41747 / 2.500 kWh → 1.221,99 € im Jahr, ca. 102 €
im Monat; 41747 / 3.500 kWh → 1.615,54 €, ca. 135 €; 41812 Erkelenz (Netzgebiet über Straße)
/ 3.500 kWh → 1.615,54 € (gleiche Netzkosten wie Viersen, direkt bei der API bestätigt).

Provision: Mit Slug `robin-gut-strom` liegt der Preis 0,90 ct/kWh und 0,21 €/Monat netto über
dem WSE-Standard (ohne Slug); Bedeutung mit Timo bestätigen.

## Threat Model

(a) Angreifer-Szenarien
- Skript ruft die REST-Route massenhaft auf, um das Kontingent beim Partner (50/min) für alle
  zu sprengen oder den Server zu belasten.
- Manipulierte Eingaben (Arrays statt Strings, überlange Werte, Steuerzeichen), um Fehler,
  Cache-Vergiftung oder Header-/Logeinträge zu erzeugen.
- Manipulierte oder kompromittierte Antwort des Partners mit HTML/Skript in `city` oder
  Straßennamen (XSS), absurden Zahlen oder riesigen Listen.
- Gefälschte `X-Forwarded-For`, um das Rate-Limit zu umgehen.
- Missbrauch der Route als offener Proxy (SSRF) durch frei wählbare Ziel-URL.

- Fremde Website bindet die Routen ein (fetch, `<script>`/JSONP), um sie als Proxy zu nutzen
  und das Partner-Kontingent über die IPs ihrer Besucher zu verbrauchen.
- Ein vorgeschalteter Cache beim Hoster hält Fehlerantworten für alle Nutzer fest.

(b) Untrusted Inputs
- REST `preis` (POST, JSON): `plz`, `kwh`, `ort`, `strasse`, `hausnummer`.
- REST `strassen` (POST, JSON): `plz`, `stadt`, `suche`.
- Kopfzeilen `Origin`, `Sec-Fetch-Site`, Query `_jsonp`; `REMOTE_ADDR`.
- Antwort der Partner-API (alle Felder, auch `cities` und `requires_*`).
- Browser-Eingaben: Abschlag, Verbrauch.

(c) Worst Case
- Falsche Preise beim Kunden (Zusage, UWG) durch kaputte oder manipulierte Antwort.
- XSS auf robingut-strom.de über Felder der Partner-API.
- Sperre des Partner-Kontingents, Rechner und Anmeldung des Partners zeitweise gestört.

(d) Gegenmaßnahmen
- Strenge Typ- und Formatprüfung (`plz` 5 Ziffern als String, `kwh` Ganzzahl 500–100.000,
  Straße ≤ 100, Hausnummer ≤ 20, Stadt ≤ 100, Suche ≤ 60 Zeichen, Steuerzeichen raus).
- Feste Ziel-URL und fester Slug, kein Parameter fließt in die URL außer über
  `http_build_query` (RFC 3986) mit geprüften Werten.
- Whitelist der Antwortfelder, jede Zahl auf endlich und Plausibilitätsbereich geprüft,
  Strings gekürzt und ohne Tags; Listen ≤ 200 Einträge.
- Rate-Limit je IP (nur `REMOTE_ADDR`) und global pro Minute unter dem Partner-Limit;
  Cache je Anfrage 6 h über Transients, nur gültige Antworten.
- Ausgabe im Browser nur über `textContent` / `createElement`, nie `innerHTML`.
- Keine Speicherung oder Protokollierung von PLZ, Straße oder Abschlag.

## Stand

- 04.11.2026: Umsetzung lokal auf Branch `rechner-plugin`. Tests: 16 (Node, Rechnung) +
  13 (PHP, Logik) grün. Lokale Testumgebung `tests/harness/router.php` mit WP-Attrappe gegen die
  echte API: Ergebnis, Abschlag-Vergleich, Personen-Knöpfe, Netzgebiet per Straße, Fehleingaben,
  Cache, Handy 375 px ohne Überlauf, keine Konsolenfehler. Semgrep (php, javascript, xss,
  secrets) 0 Funde, gitleaks sauber. Security-Review (voll) läuft.
- 04.11.2026: Zweiter Sonderfall der API ergänzt (Hinweis Andreas): PLZ mit mehreren Orten
  (z. B. 54636, 43 Orte) antworten mit `requires_city_selection` und `cities` [{plz, ort}];
  der Ort geht als `city` mit. Ablauf jetzt PLZ → ggf. Ort → ggf. Straße + Hausnummer.
  Der Potenzialrechner kennt den Ort-Fall noch nicht. Live geprüft: 54636 Bickendorf
  2.500 kWh → 1.236,03 € (= API), Erkelenz und Viersen unverändert. Tests 15 PHP + 16 Node.
- 04.11.2026: Security-Review (voll): BLOCKIERT. HOCH: Limits nicht atomar, mit parallelen
  Anfragen und am Minutenwechsel umgehbar. Behoben:
  - Zähler unter MySQL-`GET_LOCK` (ohne Sperre wird abgelehnt), Partner-Takt als Token-Bucket
    (Vorrat 5, dann 1 je 2 s, höchstens 35 je Minute), Paralleltest `tests/parallel-test.sh`
    (100 parallel, 16 Worker: 5 beim Partner, IP-Limit exakt 40).
  - Lesekopf-Miete im Ersparnis-Vergleich (vorher bis zu 59 € zu günstig).
  - Fremde Origins 403, keine CORS-Header für den Namensraum.
  - Plausibilität serverseitig wie im Browser (Grundpreis/Monat gegen Jahresgrundpreis,
    Arbeitspreis 15–80 ct), damit nichts Falsches gecacht wird.
  - Cache-Treffer zählen nicht gegen das IP-Limit; Straße/Hausnummer lösen erst bei
    `change` und nur mit Vorschlag eine Anfrage aus; Partnerfehler 60 s, unbekannte PLZ 1 h
    gespeichert (404 → „keinen Tarif gefunden“); Partner-429 setzt eine gemeinsame Pause.
  - Adressgenaue Anfragen werden nicht gecacht, Straßenliste geht nicht mehr an den Browser,
    IP-Hash per HMAC mit `wp_salt`, `limit_response_size` 200 kB, `Expires: 0`, Laufnummer für
    die Straßensuche, URLs per `URL()` (auch `?rest_route=`), Eingaben vor dem Bereinigen gekürzt.
  - Routen-Tests `tests/routen-test.php` (18), Mutationen auf Kopie: 12 von 12 erkannt.
  Nach dem Upload zu prüfen (nur live möglich): ob `REMOTE_ADDR` bei Mittwald die echte
  Besucher-IP ist; ob `Cache-Control: no-store` erhalten bleibt (Live-Host setzt für wp-json
  sonst ein Jahr). Akzeptiert: Liefert der Partner Zahlen als Text, zeigt der Rechner keine Zahl
  (sicherer Ausfall); IPv6 wird je Adresse statt je /64 gezählt.
- 04.11.2026: Nach-Review (voll): FREIGABE für den Einsatz auf Entwurfsseiten, keine KRITISCH/
  HOCH. Die MITTEL- und NIEDRIG-Punkte sind gleich nachgezogen statt aufs Go-Live verschoben:
  - `/strassen` jetzt POST mit JSON (kein JSONP, keine Einbindung per `<script>`, keine
    Adressteile im Server-Log); beide Routen weisen `Sec-Fetch-Site` außer same-origin/same-site
    und jeden `_jsonp`-Parameter mit 403 ab.
  - IPv6 zählt je /64; Token-Bucket nimmt die Zeit nie zurück (`max(zuletzt, jetzt)`);
    `rgr_text` entfernt Unicode-Steuer- und Richtungszeichen (`\p{Cc}\p{Cf}`); Straßensuche
    unter 2 Zeichen fragt den Partner nicht; Straßenvorschläge werden bei neuer PLZ geleert.
  - Testlücken aus den 17 Mutationen geschlossen (NULL von GET_LOCK, Cache bei Adresse,
    Großschreibung/www-Regex beim Origin, CORS-Filter-Priorität, Retry-After-Grenze,
    Arbeitspreis-Spanne bei stimmiger Summe, Uhrversatz).
  - `werkzeuge/rechner-plugin-zip.sh` baut das Upload-ZIP ohne `tests/`
    (Ausgabe in `werkzeuge/ausgabe/`, nicht im Repo).
  Tests: Node 18, PHP-Logik 28, PHP-Routen 26, Paralleltest grün; Semgrep 0, gitleaks sauber.
  Bleibt offen und nur live prüfbar: `REMOTE_ADDR` bei Mittwald, `no-store` live erhalten
  (sonst HOCH, blockiert), `GET_LOCK` verfügbar (bei Galera dauerhaft 429), Ort passt nicht
  zur PLZ zeigt „nicht erreichbar“ (nur per Manipulation erreichbar, akzeptiert).
- 04.11.2026: Delta-Review: FREIGABE. Nachgezogen: IPv4 in IPv6-Schreibweise
  (`::ffff:1.2.3.4`) zählt wie IPv4 (sonst hätten sich alle IPv4-Besucher einen Topf geteilt);
  CORS-Entfernung unabhängig von der Großschreibung der Route; `data-rest` relativ
  (`wp_make_link_relative`), damit der Aufruf immer same-origin ist; ZIP aus fester Dateiliste
  mit Versionsabgleich. Tests: Node 18, Logik 29, Routen 28, Paralleltest grün.
  Akzeptiert: Springt die Uhr vor und wieder zurück, gibt der Partner-Takt bis zum Aufholen
  keine neuen Anfragen frei (begrenzt auf den Versatz). `assets/rechner.js` hat keinen
  automatischen DOM-Test; Ersatz ist die Browserprüfung in der Testumgebung (Viersen, 54636
  Bickendorf, Erkelenz mit Straße, Fehleingaben, PLZ-Wechsel leert Ort/Straße, Handy 375 px).
  Beim Live-Check von `REMOTE_ADDR` auch auf `::ffff:`-Adressen achten.
- 04.11.2026: Kurz-Review der letzten Fixes: FREIGABE, 8 von 8 Mutationen erkannt.
  Akzeptiert mit Begründung:
  - MITTEL IPv6: Wer ein eigenes /56 oder /48 hat, kann mit vielen /64 den Partner-Takt leer
    halten (nur Ausfall, kein Datenabfluss). robingut-strom.de hat derzeit keinen AAAA-Eintrag
    (lokal sichtbares 64:ff9b::c135:fb6a ist NAT64 von 193.53.251.106), also nicht erreichbar.
    Bekommt die Seite IPv6, vorher ein zweites Limit je /48 ergänzen.
  - NIEDRIG: NAT64/SIIT-Adressen (64:ff9b::/96) fallen in einen Topf; beim Live-Check von
    `REMOTE_ADDR` darauf achten. `strtolower` hängt erst ab PHP 8.2 nicht mehr von der Locale ab;
    live läuft PHP 8.3. Kein eigener Test für das ZIP-Skript (prüft sich beim Bauen selbst).
  - Attrappe von `wp_make_link_relative` nutzt jetzt den Core-Regex.
- 04.11.2026: PR #9. Plugin 1.0.0 per ZIP in www.robingut-strom.de hochgeladen und aktiviert
  (WordPress hat dabei die Übersetzungen von WP Mail SMTP und Yoast selbst aktualisiert).
  Live geprüft per curl:
  - Preis 41747/2.500 → 200, 1.221,99 € (= API); `GET_LOCK` funktioniert.
  - `Cache-Control: no-store` und `Expires: 0` kommen unverändert an.
  - Fremde Origin → 403 ohne `Access-Control-Allow-Origin`, auch beim Preflight; GET → 404,
    `_jsonp` → 403.
  - Straßensuche und Ortsauswahl antworten.
  - In den Antworten keine Proxy-Hinweise (kein Via, X-Cache, Cloudflare), `REMOTE_ADDR` ist
    damit sehr wahrscheinlich die Besucher-IP; ein Beweis ist von außen nicht möglich.
  Shortcode in den Entwürfen 1241, 1243 und 1246 statt des WSE-Musters (Block 325), jeweils in
  einer Gruppe mit Anker `rechner`; Vorschau 1241 rechnet 102 €.
- 04.11.2026: Version 1.0.1 (Commit 8b624aa). Eigenes Straßen-Dropdown statt `datalist`
  (Combobox mit Liste, Maus, Pfeiltasten, Enter, Esc, Ansage für Screenreader) und Hinweis
  „Steht auf deinem Kontoauszug oder deiner letzten Stromrechnung“ beim Abschlag. Drei kurze
  Reviews, alle FREIGABE; nachgezogen:
  - Ergebnis bleibt abgeblendet, solange es zu einer geänderten Adresse gehören kann.
  - Alte Antworten verfallen, gleiche Anfragen gehen nicht doppelt raus.
  - Die Suche stoppt nach der Auswahl.
  - Genaue Meldung, ob Straße oder Hausnummer fehlt.
  - Ansage „nicht verfügbar“ bei Störung; Autofill ohne Fokus rechnet normal.
  Neuer Browser-Test `tests/plugin-oberflaeche.test.mjs` (21 Fälle, Playwright aus
  `~/node_modules` mit installiertem Chrome über `channel: "chrome"`, REST per Attrappe;
  auf anderen Rechnern Playwright installieren oder `RGR_BROWSER_CHANNEL` setzen). Mutationen
  auf Kopie: 14 von 14 erkannt. Upload von 1.0.1: Ersetzen in WordPress durch Andreas
  (der automatische Klick wurde blockiert). Live geprüft: neue `rechner.js` wird ausgeliefert,
  Routen 200/403 wie zuvor, Privathaushalte-Vorschau 41812 → „Haupt“, Pfeil + Enter →
  Hauptstr. 5 → 102 €, Hinweis beim Abschlag sichtbar, keine Konsolenfehler.
- Offen: Provision/Aufschlag mit Timo bestätigen; Gutschein-Frage mit Dieter; Lesekopf-Preise
  (Stand Sept. 2026) bestätigen; Datenschutz-Abschnitt (seit 05.11. auf Release, Text in
  `docs/texte/datenschutz-preisrechner.md`) rechtlich prüfen lassen; Plugin-Upload ins
  Live-WordPress und Einbau in die Entwürfe nur nach Freigabe. Der Harness-Ordner gehört nicht
  ins ZIP für WordPress.

## Version 1.1.0: Klickstrecke (09.11.2026, Übergabe vom 08.11.2026)

- Shortcode `[robingut_rechner rolle="beziehen|einspeisen|beides" anrede="du|sie"]`. Beide
  Attribute laufen über eine Whitelist, Standard ist `beziehen` / `du`. Aufbau in drei Schritten:
  Rolle → Daten → Ergebnis. Die Verbraucherfelder sind unverändert, damit der bisherige Ablauf
  (Ort, Straße, Abschlag) bleibt.
- **Erzeuger:** Grundpreis, Vermarktungsentgelt und Einrichtung kommen vom öffentlichen
  Angebotsrechner Direktvermarktung des Partners: `POST /api/direktvermarktung/calculate-price`,
  `pricing_model_id` 77, Felder `erzeugungsart` (pv|wind|water|chp), `nennleistung_kwp`,
  `einspeiseart` (voll|teil), `einspeisemenge_kwh`, `foerderung` (0|1). Ein CSRF-Token ist nicht
  nötig. Eine feste Tabelle geht nicht: Der Grundpreis hängt auch von der Menge ab. Beispiel
  30 kWp: 42,93 € bei 5.000 kWh, aber 65,48 € bei 66.500 kWh. Die Übergabe nennt 48,43 €.
- **Antworten des Partners:** Über 1.000 kWp meldet er `individual_offer: true`. Die Förderung
  ändert den Preis nicht, ist aber Pflichtfeld. „Biogas“ kennt er nicht, es läuft als `chp`
  (BHKW).
- **Kontrolle:** 100 kWp / 66.500 kWh ergibt 95,38 €, genau wie im Rechenbeispiel der
  Landwirte-Seite (live geprüft am 09.11.).
- Neue Route `POST /robingut-rechner/v1/erzeuger` mit denselben Schutzmaßnahmen wie `/preis`.
  Das IP-Limit liegt bei 40 je Stunde (eigener Schlüssel), der Partner-Takt wird geteilt, der
  Cache hält 6 h. Fehlertexte des Partners gehen nicht an den Browser.
- **Rechnung im Browser:** Erlös = Überschuss × Wunschpreis (7–11 ct in halben Cent,
  vorbelegt 10). Abgezogen werden Grundpreis × 12 und das Vermarktungsentgelt. Zum Vergleich
  dient die Anschlussvergütung mit höchstens 4,5 ct. Ab 25 kW erscheint der Hinweis auf
  Fernwirktechnik.
- **Bewusste Änderung:** Ab 100.000 kWh Verbrauch gibt es jetzt ein individuelles Angebot,
  vorher galt das erst über 100.000. Die Mailadresse in dieser Meldung ist entfernt, denn
  Kontaktdaten stehen nur im Impressum. Im Anmeldeknopf steht kein Pfeil mehr.
- **Reviews:**
  - Erstes Review (voll): BLOCKIERT, weil der Vergleich mit der Anschlussvergütung auch bei
    Wind, Biogas und geförderten Anlagen erschien.
  - Nach-Review: BLOCKIERT, weil durch eine Lücke ein veralteter Erlös in voller Deckkraft stehen
    bleiben konnte.
  - Beides ist behoben, siehe Commits. Behoben sind auch: Summenprüfung der Partnerposten,
    Untergrenzen über 0, getrennte Statuszeilen, keine Doppelanfragen beim Mehrfachklick.
- **Anlagenarten:** Wasserkraft und BHKW lehnt das öffentliche Preismodell 77 ab (422, geprüft am
  09.11.). Der Rechner zeigt für Wasserkraft und Biogas deshalb ohne Anfrage „individuelles
  Angebot“, der Server nimmt nur PV und Wind an.
- **Tests:** Rechnung 34, Logik 35, Routen 45, Browser 42, Paralleltest gemischt grün. Semgrep 0
  Funde, gitleaks sauber.
- **Akzeptiert mit Begründung:**
  - Erzeugerkosten bleiben 6 h im Zwischenspeicher. Sie hängen nur von Anlagendaten ab (keine
    Person) und ändern sich beim Partner selten. Sie werden nur nach Plausibilitäts- und
    Summenprüfung gespeichert, Fehler nur 60 s.
  - Die Summenprüfung ist mit echten Antworten für PV (10/30/100 kWp) und Wind (250 kWp) belegt.
- **Offen bei WSE:** Gibt es einen Parameter, mit dem die Anmeldestrecke die Rolle vorbelegt?
  Bis das geklärt ist, führen alle drei Rollen auf dieselbe Anmelde-URL, nur der Knopftext
  unterscheidet sich. Außerdem ist offen, wohin „individuelles Angebot“ führen soll.
