# ROBIN GUT Strom — Landingpage

## Ziel

Die Inhalte von robingut-strom.de liegen auf sieben Unterseiten verteilt; der
Nutzen der Community erschließt sich dadurch erst nach mehreren Klicks. Diese
Seite bringt sie auf eine Seite in einer Abfolge, die den USP zuerst zeigt:
Herkunft des Stroms, selbst gewählter Preis, Wald aus den Erlösen.

Architektur, Layout und Gestaltung stammen von der Forschungszulage-Seite
(`~/forschungszulage`), die sich als übersichtlich bewährt hat.

## Stand

Gerüst fertig und lokal geprüft. Diskussionsgrundlage, noch nicht live-fähig —
siehe „Offen" unten.

## Aufbau

Statische Seite, aus Bausteinen in `build/` zu einer `index.html` gebaut.
Schriften, Logo, Favicon und die regionalen Preisdaten sind eingebettet; die
Seite fragt beim Aufruf keinen fremden Host an.

Sektionen in dieser Reihenfolge: Hero, Kennzahlen, Prinzip (Energie-Link),
Wald, Vorteile, Preisrechner, Ablauf, Für Erzeuger, Für Organisationen,
Partner, Stimmen, FAQ, Formular.

## Inhaltliche Grundlage

- robingut-strom.de, alle sieben Unterseiten
- weshareenergy.de/stromcommunitys/organisationen (Business Energy Sharing)
- `~/robingut-potenzialrechner` (Rechenlogik, regionale Preisdaten)

Kernmechanik ist der Energie-Link: Mitglieder wählen ihre Partner selbst und
vereinbaren den Preis direkt (Empfehlung 7–11 ct/kWh). Auf Community-Strom
fallen 1,00 ct/kWh netto für WeShareEnergy an. Voraussetzung ist ein Lesekopf
(89 € Kauf, 3,90 €/Monat Miete).

Rollen: Die **ROBIN GUT Strom GbR** betreibt die Community und ist
Ansprechpartner. **WeShareEnergy** ist Energieversorger und Plattformbetreiber
— dort liegt der Stromliefervertrag. Die **Robin Gut Stiftung gUG**
verantwortet die Aufforstung.

## Threat Model

### Angreifer-Szenarien

1. **Besucher mit manipulierten Eingaben** — gibt im Preisrechner absichtlich
   unsinnige Werte ein, um falsche oder absurde Zahlen zu erzeugen und als
   Screenshot zu verbreiten („ROBIN GUT verspricht unendliche Ersparnis").
2. **Angreifer mit Schreibzugriff auf die Datenquelle** — schleust über
   `preise.json` oder das FAQ-Markup Inhalt ein, der aus dem `<script>`-Block
   ausbricht (Stored XSS). Heute nur bei Repo-Zugriff möglich, relevant wird es,
   sobald `preise.json` aus einem Import erzeugt wird.
3. **Fremde Seite bettet die Seite ein** — Clickjacking oder Weiterverwendung
   in fremdem Rahmen.
4. **Besucher, der das Formular ausfüllt** — verlässt sich darauf, dass seine
   Anfrage ankommt. Eine vorgetäuschte Bestätigung ist ein Schaden für ihn und
   für das Geschäft.

### Untrusted Inputs

| Input | Herkunft | Worst Case | Gegenmaßnahme |
|---|---|---|---|
| Postleitzahl (Rechner) | Nutzer | Prototype-Key wie `toString` liefert scheinbaren Treffer, Rechnung läuft mit `undefined` weiter und friert bei einem Fehler auf alten Werten ein | Prüfung gegen `/^[0-9]{5}$/` plus `hasOwnProperty`; Test deckt fünf geerbte Namen ab |
| Jahresverbrauch (Rechner) | Nutzer | Beträge in Billionenhöhe, `∞ €` in der Ersparnis | Hart geklemmt auf 500–500.000 kWh; über 100.000 kWh Hinweis auf individuelles Angebot |
| Heutiger Preis (Rechner) | Nutzer | `∞ €` Ersparnis | Hart geklemmt auf 10–80 ct/kWh |
| Formularfelder | Nutzer | Überlange Eingaben, ungültige Adressen; Daten gehen verloren; Header-Injection in die `mailto:`-URL | `maxlength` auf allen Eingabefeldern, Pflichtfeld- und Formatprüfung; alle Werte laufen durch `encodeURIComponent`, damit Zeilenumbrüche und `&` keine neuen Parameter oder Mailheader erzeugen; das Formular bleibt nach dem Absenden stehen, damit die Eingaben erhalten bleiben, falls sich kein Mailprogramm öffnet |
| `preise.json` | Repo, künftig ggf. Import | Ausbruch aus `<script>` → beliebiges JS im Seitenkontext | `js_literal()` in `build.py` escaped `<`, `>`, `&`, U+2028/2029; Test prüft das Ergebnis |
| FAQ-Markup | Repo | Ausbruch aus dem `ld+json`-Block | Text wird über `HTMLParser` extrahiert (Entities werden nicht nachträglich zurückverwandelt), beim Schreiben escaped; Mindestanzahl Fragen erzwungen |
| Platzhalterwerte im Build | Repo-Dateien | Ein eingesetzter Wert enthält einen späteren Platzhalter → reihenfolgeabhängiges Ergebnis | Prüfung vor der Ersetzung, Endprüfung per Regex über den gesamten Text |

### Weitere Maßnahmen

- CSP als Meta-Tag (`connect-src 'none'`, `form-action 'none'`,
  `base-uri 'none'`, `object-src 'none'`) — gegen Datenabfluss und
  Formular-Hijacking. **Offene Lücke:** `frame-ancestors` wirkt nur als
  HTTP-Header, den GitHub Pages nicht setzt. Szenario 3 (Einbettung durch
  Fremde) bleibt damit ungedeckt, solange dort gehostet wird; bei einem
  Hosting mit eigenen Headern ist es nachzuziehen.
- `referrer`-Policy `strict-origin-when-cross-origin`, externe Links mit
  `rel="noopener noreferrer"`.
- Ausgaben des Rechners ausschließlich über `textContent`; kein `innerHTML`
  in der ganzen Seite (per Test abgesichert).
- Keine externen Hosts beim Aufruf, keine Cookies; `localStorage` nur für die
  Hell-/Dunkel-Einstellung.

## Prüfungen

```
python3 build/gen-faq-schema.py && python3 build.py
node tests/rechner.test.mjs
python3 tests/build_test.py
gitleaks detect --no-git --source .
```

Die JS-Suite liest Konstanten und Preisdaten aus der gebauten `index.html`,
bildet den Kontrollfluss von `rechne()` aber nach. Eine Umstellung der
Reihenfolge im Skript fiele dort nicht auf; die Prüfungen gegen den
ausgelieferten Text (Header, Formular, Escaping, Platzhalter) gehen deshalb
direkt gegen `index.html`.

Security-Review durch `security-reviewer`: erster Durchlauf BLOCKIERT, die
Findings sind eingearbeitet (Formular, Rechtstexte, Prototype-Key, Klemmung,
Escaping in beiden Build-Skripten, Platzhalterprüfung, `innerHTML`, CSP,
`noreferrer`, Testsuite, dieser Threat-Model-Block).

Zweiter Durchlauf: **FREIGABE**. Die dort genannten Restpunkte sind ebenfalls
erledigt — `js_literal` wird jetzt von beiden Build-Skripten genutzt (auch für
U+2028/2029), `script-src` und `style-src` tragen `'self'`, der CSP-Kommentar
benennt die tatsächliche Wirkung, das Formular bleibt nach dem Absenden
sichtbar, das Verbrauchsfeld hat `maxlength`, und Tests decken nun auch
mailto, CSP, Rechtstexte und `js_literal` ab.

## Offen

- [ ] Verbraucher-Tarifzahlen von WeShareEnergy gegenprüfen. Die konkreten
      Arbeits- und Grundpreise liegen nur im WSE-Rechner vor; der eingebaute
      Rechner arbeitet mit 9,50 ct/kWh Verkaufspreis (Mitte der Empfehlung),
      1,00 ct/kWh netto Gebühr und den Netzentgelten aus dem Potenzialrechner.
- [ ] Formularversand an einen Dienst anbinden; bis dahin `mailto:`.
      Danach die Datenschutzerklärung anpassen.
- [ ] Impressum: Registergericht, Registernummer und USt-IdNr. ergänzen.
      Beides ist auch auf der Live-Seite offen.
- [ ] Datenschutzerklärung rechtlich prüfen lassen.
- [ ] Preisdaten über die 20 hinterlegten Postleitzahlen hinaus ausweiten.
- [ ] Hero-Video gegen ein Strom-Motiv tauschen (stammt aus der
      Forschungszulage-Seite).
- [ ] Vor dem Go-Live unter der echten Domain die Indexierung wieder
      freigeben: `robots.txt`, `noindex` im Head, `sitemap.xml` und die
      auskommentierte canonical-URL in `build/01_head.html`.
- [x] Security-Review mit Urteil FREIGABE (zweiter Durchlauf).

Für den Vorschau-Stand auf GitHub Pages ist die Seite bewusst von der
Indexierung ausgenommen — sie enthält noch ungeprüfte Tarifzahlen und ein
unvollständiges Impressum.

Angaben zu Preisen und Vergütungen: Stand September 2026.
