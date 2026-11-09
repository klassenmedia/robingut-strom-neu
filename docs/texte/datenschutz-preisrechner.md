# Datenschutzerklärung: Abschnitt Preisrechner (05.11.2026, ergänzt 09.11.2026 für Rechner 1.1.0)

Seit 05.11.2026 eingebaut in Seite 66 (Datenschutzerklärung) auf release.robingut-strom.de,
direkt nach dem Abschnitt „Webhosting“. Sie-Form wie der Rest der Erklärung. Grundlage ist der Code von Plugin
1.0.2 (`wordpress/robingut-rechner/`), Stand der Fakten siehe unten.

Vor dem Go-Live rechtlich prüfen lassen (Datenschutzbeauftragter oder Anwalt). Die zwei
markierten Stellen hängen an der Frage, ob der Partner genannt werden darf (§ 5b UWG).

---

## Preisrechner

Mit unserem Preisrechner sehen Sie, was Sie bei ROBIN GUT Strom im Monat zahlen würden oder was
Ihre Anlage in der Community bringen kann. Die Preise und Kosten kommen von unserem Liefer- und Abrechnungspartner. Weil der Strompreis vom Netzgebiet
abhängt, schickt unser Webserver Ihre Angaben dorthin und zeigt Ihnen die Antwort an.

### Welche Daten werden verarbeitet?

- Postleitzahl und Jahresverbrauch in kWh
- der Ort, wenn zu Ihrer Postleitzahl mehrere Orte gehören
- Straße und Hausnummer, wenn sich das Netzgebiet erst daraus ergibt; bei der Straßensuche
  auch die Buchstaben, die Sie eintippen
- für Erzeuger: Art der Anlage, Leistung in kWp, Überschuss im Jahr in kWh, Voll- oder
  Teileinspeisung und ob die Anlage noch eine EEG-Förderung bekommt
- Ihre IP-Adresse, damit wir den Rechner vor massenhaften Abfragen schützen können

Ihren heutigen Abschlag und Ihren Wunschpreis als Erzeuger rechnet Ihr Browser selbst mit dem
Ergebnis zusammen. Diese Werte bleiben auf Ihrem Gerät. Der Rechner setzt keine Cookies.

### An wen gehen die Daten?

Postleitzahl, Verbrauch, Ort, Straße und Hausnummer sowie die Angaben zur Anlage gehen an
unseren Liefer- und Abrechnungspartner, der daraus Ihren Preis oder die Kosten der Vermarktung
berechnet. Die Anfrage stellt unser Webserver, Ihre
IP-Adresse erfährt der Partner dabei nicht. Für die Verarbeitung beim Partner gilt dessen
Datenschutzerklärung. [MARKIERT: Partner hier mit Namen, Anschrift und Link zur
Datenschutzerklärung nennen? Art. 13 DSGVO verlangt Empfänger oder Kategorien von
Empfängern; mit Namen ist es eindeutiger.]

Mit „Jetzt anmelden“, „Als Erzeuger anmelden“ oder „Weiter zur Anmeldung“ gelangen Sie auf die
Anmeldeseite des Partners. Dabei übergeben wir keine
Ihrer Eingaben.

### Wie lange werden Daten gespeichert?

- Preise zu Postleitzahl, Ort und Verbrauch speichern wir bis zu 6 Stunden zwischen, damit
  gleiche Anfragen schneller beantwortet werden. Eine Adresse oder IP-Adresse ist darin nicht
  enthalten.
- Anfragen mit Straße und Hausnummer speichern wir nicht.
- Kosten zu den Angaben einer Anlage speichern wir bis zu 6 Stunden zwischen, ohne Bezug zu
  Ihrer Person.
- Die Straßenliste zu einer Suche speichern wir bis zu 6 Stunden, ohne Bezug zu Ihrer Person.
- Aus Ihrer IP-Adresse bilden wir einen verschlüsselten Prüfwert (Hash mit geheimem Schlüssel)
  und zählen damit eine Stunde lang Ihre Abfragen. Danach verfällt der Zähler. Die IP-Adresse
  selbst speichern wir dafür nicht.

Die Angaben sind freiwillig. Ohne Postleitzahl und Verbrauch bzw. ohne Leistung und Überschuss
können wir Ihnen kein Ergebnis nennen.

### Rechtsgrundlage

Wir berechnen den Preis, weil Sie ihn anfragen. Rechtsgrundlage ist unser berechtigtes
Interesse, Ihnen vor einem möglichen Wechsel einen Preis für Ihr Netzgebiet zu nennen und den
Rechner vor Missbrauch zu schützen (Art. 6 Abs. 1 lit. f DSGVO). Soweit die Abfrage einen
Stromvertrag vorbereitet, verarbeiten wir die Daten auch zur Durchführung vorvertraglicher
Maßnahmen auf Ihre Anfrage (Art. 6 Abs. 1 lit. b DSGVO).

---

## Belege im Code (Plugin 1.0.2)

| Aussage | Stelle |
|---|---|
| Gesendet werden nur PLZ, kWh, Ort, Straße, Hausnummer | `includes/logik.php` `rgr_pruefe_preis_anfrage` |
| Abschlag bleibt im Browser | `assets/rechnung.js`, nicht im REST-Body |
| Keine Cookies, kein localStorage | `assets/rechner.js` |
| Anfrage serverseitig, ohne Besucher-IP | `includes/rest.php` `rgr_partner_abruf` (nur Content-Type/Accept) |
| Cache 6 h, ohne Adresse | `RGR_CACHE_SEKUNDEN`, `$mit_adresse` in `includes/rest.php` |
| IP als HMAC mit `wp_salt`, Fenster 1 h | `rgr_ip_schluessel` in `includes/logik.php`, `HOUR_IN_SECONDS` |
| Anmeldelink ohne Parameter, `noreferrer` | `includes/shortcode.php` |

Hinweis: Abgelaufene Transients löscht WordPress beim nächsten Lesen oder per WP-Cron. Laut
Bestandsaufnahme hängt WP-Cron auf der Live-Seite. Der Text sagt deshalb nur „verfällt“, nicht
„wird gelöscht“.
