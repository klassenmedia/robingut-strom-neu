# ROBIN GUT Strom – schlanke Seite (Entwurf)

Stand: 31.10.2026 · Branch `entwurf-schlank` · Entwurf in `schlank/`

Ziel: Wer die Seite öffnet, versteht in fünf Sekunden, worum es geht, und sieht
seinen eigenen Weg zum Mitmachen. Dazu maximal lesbar für Google, Bing und
KI-Suchen (ChatGPT, Perplexity, Gemini, Claude, Copilot).

Abgrenzung zum Entwurf vom September (`index.html` im Repo-Stamm): Der hatte
13 Sektionen. Dieser Entwurf hat 10 und ist rund ein Drittel kürzer. Den
eigenen Preisrechner übernimmt er unverändert in der Rechenlogik (siehe
„Preisrechner“ unten), verlinkt für den verbindlichen Preis aber auf
WeShareEnergy.

---

## 1. Analyse der Live-Seite (robingut-strom.de, gecrawlt 31.10.2026)

11 Seiten laut Sitemap, alle mit Status 200. WordPress mit Yoast.

### Was gut ist

- `robots.txt` erlaubt alle KI-Crawler ausdrücklich, Sitemap ist eingetragen.
- `llms.txt` existiert schon.
- FAQ-Seite mit gut 2.000 Wörtern und `FAQPage`-Schema – das ist die
  stärkste Seite für Suche und KI.
- YouTube läuft über `youtube-nocookie.com`.

### Was das Verstehen bremst

| # | Befund | Folge |
|---|---|---|
| 1 | Startseite hat 183 Wörter, H1 ist nur „ROBIN GUT“, Unterzeile „Energy Sharing Plattform für Deutschland“ | Wer neu ist, weiß nach dem ersten Bildschirm nicht, was er hier tun kann |
| 2 | Vision/Konzept/Effekt steht dreimal (Start, Konzept, Community), Vorteile viermal, Lesekopf dreimal, Großkunden zweimal | 8 Menüpunkte für eine Geschichte, die auf eine Seite passt |
| 3 | Fachwörter ohne Erklärung: Energie-Link, Prosumer, SML, Communitystrom, Reststrom, WSE, Zählerauge | Laien steigen aus |
| 4 | Versprechen „Verbraucher zahlen weniger“ – die FAQ sagt: Endpreis liegt 18–29 ct/kWh über dem Erzeugerpreis, „im Regelfall günstiger“ | Erwartung und Rechnung können auseinanderlaufen; Enttäuschung nach der Anmeldung |
| 5 | Der Wald ist der stärkste Grund mitzumachen, aber ohne Zahl („ein Teil der Erlöse“) | Das emotionale Argument bleibt vage |
| 6 | Seite „Preise“ heißt im Titel „Jetzt Mitglied werden“; Anmeldung steckt in einem iframe nach Cookie-Zustimmung | Der wichtigste Schritt ist versteckt |
| 7 | Kundenstimmen: nur Name und Schlagwort, Video erst nach „Bitte aktivieren Sie alle Cookies“ | Kostet Vertrauen; „Sie“ mitten im „Du“-Text |
| 8 | Du/Sie-Mix innerhalb der FAQ („erreichen Sie uns“) | wirkt unfertig |
| 9 | Tippfehler: „So geht\`s“ (Backtick), „Googel“, „freuen und über“ | wirkt unfertig |

### Was Suche und KI bremst

| # | Befund | Fix im Entwurf |
|---|---|---|
| 10 | **Kaputter Link:** FAQ „Deinen individuellen Preis kannst du hier einsehen: /reise/“ → 404 | Link auf den echten Rechner |
| 11 | Meta-Description fehlt auf 6 von 10 Seiten (Preise, Organisationen, FAQ, Über uns, Kontakt, Impressum) | jede Seite mit eigener Description |
| 12 | Zahlen auf der Organisationen-Seite (Autarkiegrad, ct/kWh, MWh/Jahr) erscheinen nur per JavaScript – im HTML stehen leere Felder | Zahlen als Text oder weglassen |
| 13 | Bilder ohne Alt-Text: 7 von 9 (Start), 14 von 16 (Community) | Alt-Texte, Illustration mit `<title>` |
| 14 | Schema nur Yoast-Standard: Organisation ohne Adresse, Gründer, `sameAs`; kein Angebot/Service | Organization + Service + FAQPage + WebPage mit `dateModified` |
| 15 | Schreibweise „Robin Gut Strom“ in allen Titeln, Site-Name „robingut-strom“ | überall „ROBIN GUT Strom“ |
| 16 | Kein sichtbares Datum („Stand“) | „Stand: Oktober 2026“ auf jeder Seite; KI-Suchen bevorzugen frische, datierte Angaben |
| 17 | Keine Security-Header (HSTS, CSP, X-Content-Type-Options) | beim Go-Live am Server setzen |
| 18 | WordPress-Ballast im Head (xmlrpc, Feeds, oEmbed, wp-json) | entfällt bei statischer Seite |

### ⚠ Rechtlicher Punkt, vor Go-Live klären

Die Seite schreibt an vielen Stellen „nach § 42c EnWG“ und gleichzeitig
„deutschlandweit“ – inklusive Beispiel „Eltern in Viersen → Tochter in Heidelberg“.

§ 42c EnWG (Energy Sharing) gilt seit 1. Juni 2026 aber nur **innerhalb eines
Bilanzierungsgebiets** eines Verteilnetzbetreibers, ab 1. Juni 2028 auch im
direkt angrenzenden Gebiet derselben Regelzone (Quellen: buzer.de/42c_EnWG.htm,
BDEW-Anwendungshilfe Energy Sharing vom 10.06.2026, Gleiss Lutz).

Meine Vermutung: WeShareEnergy läuft deutschlandweit als normaler
Energieversorger mit Zuordnung der Strommengen zwischen Mitgliedern – also
gerade **nicht** über § 42c. Dann ist „nach § 42c EnWG“ falsch und sollte raus.
Das muss WeShareEnergy bestätigen. Der Entwurf nennt § 42c deshalb nicht.

Ebenfalls ungeprüft in der heutigen `llms.txt`: „TÜV-zertifiziert“ und
„Renewable Plus“. Im Entwurf weggelassen, bis ein Nachweis vorliegt.

---

## 2. Neue Struktur

Aus 9 Inhaltsseiten werden 3. Die bestehenden URLs von Organisationen und FAQ
bleiben, damit nichts an Verlinkung verloren geht.

| Neu | Inhalt | Alt (301-Weiterleitung) |
|---|---|---|
| `/` | Alles für Haushalte: Verbraucher und Erzeuger | `/konzept/` → `/` · `/community/` → `/` · `/so-gehts/` → `/#so-gehts` · `/preise/` → `/#preis` · `/ueber-uns/` → `/#wer` · `/kontakt/` → `/#kontakt` · `/reise/` → `/#preis` |
| `/organisationen-und-vereine/` | Firmen, Vereine, Kommunen (Sie-Form) | bleibt |
| `/fragen-und-antworten/` | 25 Fragen in 3 Gruppen | bleibt |
| `/impressum/`, `/datenschutzerklaerung/` | Rechtliches | bleiben |

Menü: **So geht's · Preis · Für Organisationen · Fragen** + Button **Mitmachen**.

### Startseite, Abfolge

1. **Hero** – was es ist, in einem Satz; zwei Türen: „Ich habe eine Solaranlage“ / „Ich brauche Strom“
2. **So geht's** – drei Schritte
3. **Dein Weg** – Erzeuger und Verbraucher nebeneinander
4. **Beispiel** – Familie teilt Solarstrom (macht es in zehn Sekunden greifbar)
5. **Preis** – ehrlich aufgeschlüsselt, eigener Rechner, Link zum verbindlichen Preis
6. **Wald** – wohin das Geld geht
7. **Wer dahintersteht** – GbR, WeShareEnergy, Stiftung: wer macht was
8. **Für Organisationen** – Teaser
9. **Fragen** – die 8 häufigsten, Link zu allen
10. **Mitmachen / Kontakt**

Die vollständige Copy der Startseite steht direkt in `schlank/index.html`
(eine Quelle, damit Dokument und Entwurf nicht auseinanderlaufen).

---

## 3. SEO-, GEO- und LLM-Paket

### Keyword-Cluster

Suchvolumen nicht gemessen (kein Ahrefs/Semrush-Zugang in dieser Sitzung) –
die Cluster folgen dem, was Menschen zu dem Thema fragen.

| Cluster | Begriffe | Seite |
|---|---|---|
| Energy Sharing | Energy Sharing, Strom teilen, Strom-Community, Energiegemeinschaft | `/` |
| Erzeuger | Solarstrom verkaufen, Überschussstrom verkaufen, Strom an Nachbarn verkaufen, Alternative zur Einspeisevergütung, ausgeförderte PV-Anlage | `/` + FAQ |
| Familie | Solarstrom an Kinder weitergeben, Strom an Familie verkaufen | `/` (Beispiel) |
| Verbraucher | Ökostrom von privat, regionaler Ökostrom, Ökostrom monatlich kündbar | `/` |
| Organisationen | Mitarbeiterstrom, Strom zwischen Standorten teilen, Energy Sharing Verein, Energy Sharing Kommune | `/organisationen-und-vereine/` |

### Titles und Descriptions

| Seite | Title (≤ 60) | Description (≤ 160) |
|---|---|---|
| `/` | Solarstrom teilen & Ökostrom beziehen \| ROBIN GUT Strom | Verkaufe deinen Solarstrom direkt an Familie, Freunde oder Nachbarn – oder beziehe Ökostrom aus der Community. Monatlich kündbar, mit jeder kWh wächst Wald. |
| Organisationen | Energy Sharing für Firmen, Vereine & Kommunen \| ROBIN GUT | Eigenen Solarstrom zwischen Standorten teilen, an Mitarbeitende weitergeben oder im Verein nutzen. Potenzialanalyse, Pilot, Roll-out – mit WeShareEnergy. |
| FAQ | Energy Sharing: 25 Fragen & Antworten \| ROBIN GUT Strom | Was kostet Strom aus der Community, welchen Preis setze ich als Erzeuger, welcher Zähler passt? Die 25 häufigsten Fragen, kurz beantwortet. |

### Was für KI-Suchen eingebaut ist

- **Antwort zuerst:** Der erste Absatz jeder Seite beantwortet „Was ist das?“
  vollständig – genau den Satz zitieren KI-Suchen.
- **Faktenblock** mit festen Zahlen (1,00 ct/kWh, 7–11 ct/kWh, unter 9 ct/kWh,
  monatlich kündbar, 100.000 kWh, 100 kWp) – Zahlen erhöhen die Chance,
  zitiert zu werden.
- **Wer macht was** als klare Rollen-Tabelle: KI-Modelle verwechseln sonst
  GbR, Stiftung und WeShareEnergy.
- **FAQ als echte Frage-Überschriften**, jede Antwort für sich verständlich.
- **JSON-LD:** Organization (Adresse, Gesellschafter, Kontakt), Service mit
  Gebühr als `UnitPriceSpecification`, FAQPage (gleich dem sichtbaren Text),
  WebPage mit `dateModified`. Hinweis: FAQ-Rich-Results zeigt Google seit 2023
  nur noch bei Behörden- und Gesundheitsseiten – für KI-Suchen und Bing lohnt
  das Schema trotzdem.
- **`llms.txt`** neu, kürzer, ohne ungeprüfte Behauptungen (`schlank/llms.txt`).
- **Seite ohne JavaScript lesbar:** Alles steht im HTML. Viele KI-Crawler
  führen kein JavaScript aus.
- **Bing Webmaster Tools** einrichten (Copilot und ChatGPT-Suche greifen auf
  den Bing-Index zurück) und Seite in **Brave Search** prüfen (Claude nutzt Brave).

### Außerhalb der Seite (größter Hebel für KI-Sichtbarkeit)

KI-Suchen zitieren gern Quellen, die auch anderswo erwähnt werden:
Eintrag auf weshareenergy.de (Community-Liste), Verweis von robin-gut.org und
nrw-pflanzt.de, Pressemitteilung mit Dieter Könnes, Einträge in
Energy-Sharing-Übersichten. Ein `sameAs` im Schema verknüpft das.

---

## 4. Copy: Für Organisationen (`/organisationen-und-vereine/`)

**H1:** Energy Sharing für Firmen, Vereine und Kommunen

**Lead:** Nutzen Sie Ihren eigenen Strom dort, wo er gebraucht wird: am anderen
Standort, bei Ihren Mitarbeitenden oder im Vereinsheim. Vermarktung,
Belieferung und Abrechnung laufen über unseren Partner WeShareEnergy.

**H2: Drei Wege, Strom zu teilen**

- **Standorte verbinden.** Die Solaranlage auf der Lagerhalle versorgt die
  Filiale in der Stadt. Was intern verrechnet wird, müssen Sie nicht zukaufen.
- **Mitarbeiterstrom.** Ihr Überschuss geht zu einem fairen Preis an Ihre
  Mitarbeitenden. Die Anlage arbeitet sich schneller ab, und Ihr Team spürt es
  auf der eigenen Stromrechnung.
- **Über Firmengrenzen hinweg.** Unternehmen, Vereine und Kommunen einer Region
  teilen Strom untereinander.

**H2: Für wen sich das lohnt**

Unternehmen mit mehreren Standorten, Lagerhallen oder Filialen · Betriebe mit
viel Überschuss aus Solar, Wind oder Wasserkraft · Betriebe mit hohem Bedarf
und wenig eigener Erzeugung · Unternehmensgruppen mit mehreren Gesellschaften ·
Vereine und Genossenschaften · Städte und Gemeinden

**H2: So läuft die Zusammenarbeit**

1. **Erstgespräch:** Wir besprechen Ausgangslage, Ziele und Fragen. ⚠ kostenlos? klären
2. **Potenzialanalyse (500 €):** Mit Ihren Verbrauchs- und Erzeugungsdaten
   rechnen wir aus, was sich wirtschaftlich lohnt.
3. **Pilot:** Start in der offenen Community oder in einer eigenen.
4. **Roll-out:** Weitere Standorte, Anlagen und Beteiligte kommen dazu.

**H2: Große Mengen**

Ab 100.000 kWh Jahresverbrauch erstellen wir ein individuelles Angebot.
Anlagen über 100 kWp sind willkommen; technische Voraussetzungen wie ein
Smart Meter klären wir vorab mit Ihnen.

**H2: Ein Beispiel aus der Praxis**

⚠ Fehlt. Die Live-Seite zeigt hier Zähler ohne Zahlen. Gebraucht wird ein echter
Fall mit drei Zahlen: Autarkiegrad in %, Ersparnis in ct/kWh, geteilte MWh pro Jahr.

**CTA:** Erstgespräch vereinbaren → info@robingut-strom.de · +49 221 29282931

---

## 5. Copy: Fragen und Antworten (`/fragen-und-antworten/`)

Die 8 mit ★ stehen auch auf der Startseite.

### Allgemein

**★ Was ist ROBIN GUT Strom?**
Eine Strom-Community für ganz Deutschland. Wer eine Solar-, Wind- oder
Wasserkraftanlage hat, verkauft seinen Überschuss direkt an andere Mitglieder
und vereinbart den Preis selbst. Den Liefervertrag, die Zähler-Technik und die
Abrechnung übernimmt der Energieversorger WeShareEnergy. Ein Teil der Erlöse
geht an die ROBIN GUT Stiftung, die damit Bäume in Deutschland pflanzt.

**★ Brauche ich eine eigene Solaranlage?**
Nein. Ohne Anlage bist du Verbraucher und beziehst Strom von Mitgliedern mit Anlage.

**Wer kann mitmachen?**
Haushalte mit und ohne Solaranlage, Unternehmen, Landwirte, Vereine, Kommunen
sowie Betreiber von Wind- und Wasserkraftanlagen. Voraussetzung sind ein
Standort in Deutschland und ein digitaler Stromzähler.

**Gilt das in ganz Deutschland?**
Ja, die Mitglieder können überall in Deutschland wohnen. ⚠ mit WSE klären (siehe § 42c oben)

**Muss ich die anderen Mitglieder kennen?**
Nein. Du kannst Familie und Freunde mitbringen oder in der App Partner finden.

**★ Was passiert, wenn die Sonne nicht scheint?**
Dann bekommst du automatisch 100 % Ökostrom von WeShareEnergy. Du hast immer Strom.

**★ Wie komme ich aus meinem alten Vertrag?**
Setz bei der Anmeldung ein Häkchen, dann kündigt WeShareEnergy deinen alten Vertrag für dich.

**★ Wie lange bin ich gebunden?**
Einen Monat. Du kannst monatlich kündigen.

**Kann mein Verein mitmachen?**
Ja. Wir brauchen dafür eine feste Ansprechperson, mit der wir alles klären.

### Preise und Abrechnung

**★ Was kostet eine Kilowattstunde für mich als Verbraucher?**
Drei Teile: der Preis, den du mit deinem Partner vereinbarst (empfohlen 7–11
ct/kWh), dazu Netzentgelte, Steuern, Abgaben und 1,00 ct/kWh netto für
WeShareEnergy. Diese Nebenkosten machen je nach Netzgebiet 18–29 ct/kWh aus.
Dazu kommt ein monatlicher Grundpreis. Deinen genauen Preis zeigt der Rechner
für deine Postleitzahl. ⚠ Spanne 18–29 ct von der Live-FAQ – aktuell?

**Ist das günstiger als mein jetziger Tarif?**
Meistens ja. Es hängt vom vereinbarten Preis und deinem Netzgebiet ab – leg
deine letzte Stromrechnung neben das Ergebnis des Rechners.

**★ Welchen Preis soll ich als Erzeuger verlangen?**
Wir empfehlen 7–11 ct/kWh. Deine Abnehmer zahlen zusätzlich Netzentgelte,
Steuern und Gebühr – so bleibt der Endpreis für sie attraktiv.

**Ab wann lohnt es sich für mich als Erzeuger?**
Vor allem dann, wenn deine Einspeisevergütung unter 9 ct/kWh liegt. Deine
Vergütung findest du auf der Abrechnung deines Netzbetreibers oder mit dem
EEG-Rechner auf interconnector.de.

**Ich bekomme eine hohe EEG-Vergütung. Kann ich nur als Verbraucher mitmachen?**
Ja. Dann speist du weiter wie bisher ein und beziehst deinen Strom aus der Community.

**Warum bekomme ich nicht den ganzen Betrag aus der App überwiesen?**
Viele Netzbetreiber zahlen dir die EEG-Vergütung weiter direkt. Wir zahlen dir
den Unterschied zwischen deinem Verkaufspreis und dieser Vergütung.

**Kann ich verschiedenen Mitgliedern verschiedene Preise geben?**
Ja. Du legst den Preis pro Partner fest und bestimmst die Reihenfolge, in der
dein Strom verteilt wird. Den Preis kannst du jederzeit für künftigen Strom ändern.

**Zahle ich monatliche Abschläge?**
Nein. Du bekommst jeden Monat per E-Mail eine Rechnung über den Strom, den du
tatsächlich verbraucht hast; der Betrag wird per Lastschrift eingezogen. Am
Jahresende gleichen wir mit dem offiziellen Zählerstand ab.

**Was bedeutet der Stromverkauf für meine Steuern?**
Als Kleinunternehmer fällt meist keine Umsatzsteuer an. Wir beraten nicht
steuerlich – frag im Zweifel deine Steuerberatung.

### Technik

**★ Was brauche ich technisch?**
Einen digitalen Stromzähler mit optischer Schnittstelle, einen Lesekopf von
WeShareEnergy und WLAN am Zähler. Für die meisten Zähler brauchst du außerdem eine
Zähler-PIN, die dein Netzbetreiber kostenlos herausgibt.

**Welchen Lesekopf bekomme ich?**
Den **WSE-Lesekopf**, wenn am Zähler WLAN und eine Steckdose sind. Das
**IOmeter**, wenn beides fehlt: Es läuft mit Batterie und funkt bis zu drei
Stockwerke weit zum Router. Beide kannst du kaufen oder mieten.
⚠ Preise (Sept. 2026: 89 € Kauf / 3,90 € Miete pro Monat) mit WSE bestätigen

**Reicht mein Smart Meter?**
Du brauchst trotzdem den Lesekopf. Die Community teilt den Strom in Echtzeit
zu, und diese Daten liefern Smart-Meter-Gateways heute nicht.

**Ich habe einen alten Zähler. Was nun?**
Analoge Zähler müssen getauscht werden. Wir organisieren den Tausch, meist
kostenlos. Fallen Kosten an, bekommst du vorher eine Übersicht und entscheidest
selbst. Schneller geht es oft, wenn du den Tausch direkt beim Netzbetreiber beantragst.

**Was passiert, wenn das WLAN ausfällt?**
Du bekommst weiter Ökostrom. Für die Zuordnung in der Community sollte der
Lesekopf aber möglichst immer verbunden sein.

**Ich habe mehrere Anlagen oder Zähler.**
Jeder Zähler bekommt einen eigenen Lesekopf und eine eigene Anmeldung.

**Braucht meine Familie auch einen Lesekopf, wenn ich ihr Strom verkaufe?**
Ja. Alle, die teilen, sind Mitglied und haben einen Lesekopf.

**Die Schnittstelle am Zähler ist schon belegt.**
Mitmachen geht nur mit unserem Lesekopf, weil nur er die Daten oft genug
und genau genug liefert.

---

## 6. Offen vor Go-Live

Fachlich (ROBIN GUT / WeShareEnergy):

- [ ] **§ 42c EnWG:** Rechtsgrundlage des deutschlandweiten Modells von WSE bestätigen lassen; danach alle § 42c-Nennungen anpassen
- [ ] **Wald in Zahlen:** Wie viel geht pro kWh an die Stiftung? Wie viele Bäume bisher? (stärkster Hebel für „mitmachen wollen“)
- [ ] Spanne 18–29 ct/kWh Nebenkosten aktuell?
- [ ] Lesekopf-Preise (Kauf/Miete) bestätigen
- [ ] Erstgespräch für Organisationen kostenlos?
- [ ] Praxisbeispiel Organisationen mit echten Zahlen
- [ ] Kundenstimmen: je ein Satz als Text (Zitat) zur Video-Freigabe, Foto, Ort
- [ ] Kundenstimmen: schriftliche Einwilligung je Person (Name, Zitat, Ort)
- [ ] Laufzeit „monatlich kündbar“ gegen AGB von WeShareEnergy prüfen
- [ ] Zahl der Mitglieder/Anlagen, falls vorzeigbar
- [ ] Nachweise für „TÜV-zertifiziert“ und „Renewable Plus“ oder streichen
- [ ] Impressum: USt-IdNr. steht auf „[wird nachgereicht]“

Technisch:

- [ ] Organisationen- und FAQ-Seite im selben Stil bauen
- [ ] Detailrechner: Ersparnis-Fehler in robingut-potenzialrechner beheben, dann unter eigener Adresse verlinken
- [ ] Tarifdaten im Rechner (`schlank/preise.js`, abgerufen 26.07.2026, 20 PLZ) mit WeShareEnergy abgleichen und erweitern
- [ ] 301-Weiterleitungen laut Tabelle oben
- [ ] Security-Header am Server (HSTS, CSP, X-Content-Type-Options, frame-ancestors)
- [ ] `robots.txt` und `noindex` des Entwurfs vor Go-Live umstellen
- [ ] OG-Bild 1200×630 erstellen
- [ ] Bing Webmaster Tools + Google Search Console, Sitemap einreichen

---

## 7. Threat Model

Die Seite ist statisch; einziges Skript ist der Preisrechner (`schlank/rechner.js`).

| Untrusted Input | Worst Case | Gegenmaßnahme | Test |
|---|---|---|---|
| `r-plz` | geerbter Schlüssel (`toString`, `__proto__`) als Treffer → Rechnung mit `undefined` | 5-Ziffern-Muster **und** `hasOwnProperty` | „gilt nicht als Treffer“, „geerbte Einträge der Datenquelle zählen nicht“ |
| `r-verbrauch` | Tippfehler/Riesenzahl → Fantasiebeträge, `NaN`, `∞` | nur ganze kWh (`2500` oder `2.500`), sonst „–“ und Hinweis; unter 500 angehoben und gemeldet; über 100.000 nur Hinweis auf Angebot | „Verbrauch … gilt als ungültig“, „über 100.000 kWh …“ |
| `r-istpreis` | Euro statt ct, 0, leer → falsche Ersparnis mit falschem Vorzeichen | 0,35 wird als Euro erkannt und gemeldet; 10–80 ct geklemmt und gemeldet; leer/0 → kein Vergleich | „Preis unter 1 …“, „… geklemmt und gemeldet“ |
| `r-istgrundpreis` | fehlt → Ersparnis zu hoch (Review-Fund HOCH, 31.10.2026) | ohne Grundpreis kein Vergleich; Vergleich rechnet heutigen Grundpreis sowie neuen Grundpreis und Lesekopf-Miete ein | „Ersparnis vergleicht kompletten …“, „Mischpreis … Mehrkosten“ |
| alle Ausgaben | XSS über Eingaben | Eingaben werden nie zurückgeschrieben, Ausgabe nur per `textContent`; CSP `script-src 'self'`, kein `connect-src` | „schreibt nur per textContent“, „CSP hat genau die erwarteten Direktiven“ |

Weitere Szenarien: Eine fremde Seite bettet die Seite per iframe ein und legt einen
falschen „Jetzt anmelden“-Link darüber (Phishing). Dagegen hilft nur ein
Server-Header (`frame-ancestors 'none'`, `X-Frame-Options: DENY`, dazu HSTS und
`nosniff`), Meta-CSP reicht nicht. Manipulation beim Hoster. Ungeprüfte Zahlen,
die KI-Suchen als Tatsache übernehmen: Sie sind mit `mark.check` markiert und
werden vor dem Go-Live gesucht.

Security-Reviews am 31.10.2026: (1) kurz, statische Seite: FREIGABE für den
Entwurf. (2) voll, Preisrechner: **BLOCKIERT** wegen irreführender Ersparnis
(Vergleich ohne Grundpreis und Lesekopf; der Fehler steckte schon im Rechner vom
September). Behoben, die Funde zu stillem Klemmen, ungetesteter Anzeige und
Parser-Lücken gleich mit. 57 Prüfungen, eigene Mutationsprobe 15/15 gefangen
(die Eingabe-Verdrahtung erst mit dem neuen Seiten-Test). (3) Re-Review voll: **FREIGABE**; MITTEL-Fund Jahres-Grundpreis danach behoben, (4) Kurzprüfung: **FREIGABE** (64 Tests, 74 Mutanten, 61 gefangen, Rest gleichwertig oder harmlos). Gilt für den Entwurf; vor Go-Live Tarifdaten neu abrufen, Go-Live-grep, Server-Header, Detailrechner fixen.

(5) Kurzprüfung vor Merge nach main (GitHub Pages): **FREIGABE**. Die zwei MITTEL-Funde sind behoben: Unterseiten-, Impressum- und Datenschutz-Links zeigten mit `/…` auf github.io ins Leere und gehen jetzt auf die Live-Domain, Test prüft jeden Link. Ungeprüfte Aussagen waren nur als Tooltip markiert, jetzt steht ein sichtbarer Entwurfshinweis über der Seite. OFL-Lizenztexte liegen in `schlank/fonts/`. Für den Entwurf bewusst akzeptiert (NIEDRIG): Projekt-ID im Bildwerkzeug, Kundennamen ohne festgehaltene Einwilligung (stehen schon auf der Live-Seite), fehlende Eingabeprüfung in `vertex_bild.py` (nur lokale Kommandozeile), kein `frame-ancestors` ohne Server-Header, pip-audit für `werkzeuge/requirements.txt` nicht gelaufen (nicht installiert).
Nachprüfung der Fixes: **FREIGABE**; die drei NIEDRIG-Funde daraus (Kontrast des fetten Hinweises, Link-Test ließ Wurzelpfade, Verzeichnisse und einfache Anführungszeichen durch, Hinweis-Test ohne Sichtbarkeitsprüfung) behoben.

### Go-Live-Prüfung

Muss leer sein, bevor deployt wird:

```
grep -rn 'mark class="check"\|\[Zahl\]\|noindex\|class="entwurf"' schlank/
```

Beim Umzug auf robingut-strom.de die Links auf `https://www.robingut-strom.de/…` wieder relativ setzen.
Vor dem Go-Live außerdem: Vorschaubild (`og-bild.jpg`) ohne KI-Personen oder mit Hinweis, „Monatlich kündbar“ in `meta description`/`og:description` erst nach Bestätigung.

Die Spanne 18–29 ct/kWh steht zusätzlich in FAQ, JSON-LD und `llms.txt` – nach Bestätigung überall gleich pflegen.

---

## 8. Preisrechner

Rechenlogik aus dem Entwurf vom September (`build/09_js.html`, zweimal
reviewt), hier als Modul `schlank/rechner.js`, Daten in `schlank/preise.js`
(gleich `build/preise.json`, per Test abgesichert).

Herkunft der Daten: WeShareEnergy-Preis-API (`POST weshareenergy.de/api/calculate-price`,
dieselbe Quelle wie der iframe-Rechner auf der Live-Seite), einmalig abgerufen mit
`~/robingut-potenzialrechner/scripts/fetch-preise.mjs` für 20 PLZ × 3 Verbrauchsstufen.
Je PLZ: `fBrutto` = Netzentgelte, Steuern, Abgaben (ct/kWh brutto),
`eReststromBrutto` = Ökostrom-Energiepreis (13,09 ct), `grundpreisStaffel` = Grundpreis
€/Monat ab 2.500 / 15.000 / 50.000 kWh. Kein Live-Abruf im Browser (CORS erlaubt nur
weshareenergy.de), deshalb Stand des Abrufs (Commit vom 26.07.2026; der alte Entwurf nennt fälschlich September) – vor Go-Live neu abrufen.

Rechnung: 50 % des Verbrauchs aus der Community zu 9,50 ct/kWh plus 1,19 ct/kWh
Gebühr (1,00 netto), 50 % WSE-Ökostrom; dazu Grundpreis laut Staffel und
3,90 €/Monat Lesekopf-Miete. Ersparnis nur, wenn heutiger Arbeitspreis (10–80 ct,
Werte unter 1 als Euro gelesen) und heutiger Grundpreis (0–30 €/Monat, darüber
Hinweis auf Jahresbetrag) eingegeben sind. Verbrauch nur ganze kWh; unter 500
angehoben und gemeldet; über 100.000 nur Hinweis auf individuelles Angebot.
Unbekannte PLZ rechnet mit Viersen und sagt das.

Der Detailrechner (46-225-63-78.sslip.io/rechner, Repo robingut-potenzialrechner)
ist **nicht verlinkt**: Er vergleicht noch ohne Grundpreis (Review 31.10.2026,
`js/engine.js`) und zeigt dadurch zu hohe Ersparnis.

Referenz: PLZ 41747, 2.500 kWh, heute 35 ct und 12 € Grundpreis → 29,45 ct,
83,28 € im Monat (inkl. Grundpreis 18,03 € und Lesekopf-Miete 3,90 €),
**20 € Ersparnis**. Der alte Rechner zeigte hier 139 €, weil er Grundpreis und
Lesekopf nicht verglich – der alte Entwurf im Repo-Stamm hat diesen Fehler noch.

Tests: `node tests/schlank-rechner.test.mjs` (prüft das ausgelieferte Modul
direkt, nicht eine Nachbildung).

Ohne JavaScript zeigt der Rechner einen Hinweis auf WeShareEnergy; alle
übrigen Inhalte bleiben lesbar.

---

## 9. Design (31.10.2026)

Erst „Dunkel & premium“, am 31.10.2026 auf Wunsch von Andreas umgestellt auf **hell und
sonnig**: warmes Weiß (#fffdf5) als Grund, dunkles Waldgrün (#17301c) als Schrift,
Akzentgrün #356a0c für Links und Zahlen, Limette für Buttons, Sonnengelb (#ffc83d) für
Entwurfsleiste, Kicker-Striche und Icon-Kacheln, weiße Karten mit weichem Schatten,
Footer dunkelgrün. Text-Kontraste auf den Vollton-Flächen ≥ 4,5:1, Akzentgrün ≥ 5:1 und Entwurfsmarkierung (#9a5200, 3 px) ≥ 4,5:1 per Test; über Foto und Verläufen nur geschätzt. Jedes Foto mit Menschen trägt direkt „Symbolbild, KI-generiert“ (Art. 50 AI Act, UWG). `og:image` zeigt bis zum Go-Live bewusst auf die Live-Domain. Security-Review helles Design (31.10.2026, kurz, zweimal): **FREIGABE**; Markierung, KI-Hinweise und Akzentgrün behoben. Akzeptiert (NIEDRIG): Vertrauensleiste im Hero am rechten Rand knapp (geschätzt ~4,1:1 Grau), zweite `mark.check`-Regel könnte die Markierung aufheben, ohne dass ein Test greift. Schrift seit 01.11.2026 **Miriam Libre** wie im Flyer (Headlines fett in Versalien, Fließtext regulär). Hero-Grafik und Familienbeispiel als SVG mit fließender
Energie-Linie, Puls-Linie aus dem Logo als Bodenlinie, Waldsilhouette am Ende
des Wald-Abschnitts. Scroll-Einblendung nur per CSS (animation-timeline: view()),
bei prefers-reduced-motion aus.

Schriften liegen lokal in schlank/fonts/ (kein Abruf bei Google beim
Seitenbesuch): Miriam Libre 400/600/700, Latin-Subset aus @fontsource/miriam-libre 5.3.0
(Schrift laut pdffonts im Flyer RG-Flyer-15-09-2026). SIL Open Font License 1.1, Lizenztext
`OFL-MiriamLibre.txt` daneben (aus google/fonts).

Logo: schlank/logo-strom.png aus ~/Downloads/robin_gut_strom_transparent.png
(480 px, 32 Farben). Besser vor Go-Live: das SVG-Logo der Live-Seite.

Offen: echte Fotos von Pflanzaktionen und Solardächern (liegen lokal nicht vor),
Maskottchen Robin (~/robin-gut-maskottchen) als mögliche Ergänzung.

### Bilder (31.10.2026)

KI-generiert über Vertex AI, Modell gemini-3-pro-image (Nano Banana Pro), 2K,
Projekt eskotomic-demo, Dienstkonto-Schlüssel per Pfad (~/.config/klassenmedia/vertex.json).
Skript werkzeuge/vertex_bild.py, Prompts in werkzeuge/prompts/*.txt; 4 Bilder,
ca. 0,13 $ je Bild.

| Datei | Motiv | Einsatz |
|---|---|---|
| bilder/hero-familie-2400.webp, hero-familie-1200.webp | Familie vor dem Haus zeigt aufs Solardach in der Mittagssonne, Oma winkt, Blumenwiese, junger Wald | Hero-Hintergrund |
| bilder/erzeuger-sonne.webp | Solarmodule auf Ziegeldach, Sonnenstern, blauer Himmel | Karte Erzeuger |
| bilder/verbraucher-sonne.webp | junge Frau am sonnigen Küchenfenster einer Altbauwohnung | Karte Verbraucher |
| bilder/wald-sonne.webp | Hände pflanzen junge Buche, Familien mit Setzlingen im sonnigen Wald | Wald-Abschnitt |
| og-bild.jpg | Zuschnitt aus dem Hero, 1200 × 630 | Vorschau beim Teilen |

Alle Fotos sind KI-generiert: Sammelhinweis im Footer („Fotos: KI-generierte
Symbolbilder“), das Waldbild zeigt Menschen bei einer Pflanzaktion und trägt zusätzlich
direkt „Symbolbild, KI-generiert“, damit es nicht als echte ROBIN-GUT-Aktion gelesen wird.
Offen: Kosten laufen über das Google-Cloud-Projekt eskotomic-demo – klären, ob das so bleiben soll. Vor Go-Live besser durch
echte Fotos von Pflanzaktionen ersetzen (Freigabe der abgebildeten Personen einholen).

---

## 10. Landwirte-Seite `/landwirte/` (01.11.2026)

Grundlage: Briefing Website vom 01.11.2026 (für den Agenturtermin am 05.11.), Zielgruppe B.
Vorrang, weil Sonnenernte auf der Messe mit einem Flyer an rund 5.000 Landwirte wirbt.

Abnahme:
- Sie-Form, Kernaussage „Ihre EEG-Förderung läuft aus. Ihre PV-Anlage läuft weiter.“
- nächster Schritt „Technik-Check anfragen“ oder Rückruf, per Mail oder Telefon
- Code je Aktion über `?code=…` (Flyer, Messe, Brief), landet im Betreff der Anfrage
- Rechenbeispiele nur mit sichtbarem „Annahme“; bis der Messeflyer v13b vorliegt, Platzhalter
- Leitplanken aus dem Briefing: „gemeinsam mit unserem Partner“ ohne Firmennamen, kein
  „günstiger als“, kein „klimaneutral“, Umweltaussagen konkret oder markiert
- keine Eyebrow-Zeilen über Überschriften

Fakten zum Förderende: Ausgeförderte Anlagen erhalten bis 31.12.2032 eine Anschlussvergütung
in Höhe des Jahresmarktwerts Solar abzüglich Vermarktungskosten (§ 23b EEG 2023,
gesetze-im-internet.de/eeg_2014/__23b.html). Konkrete Cent-Werte stehen nur markiert auf der Seite.

### Threat Model

| Untrusted Input | Worst Case | Gegenmaßnahme | Test |
|---|---|---|---|
| `?code=` in der Adresse (`schlank/anfrage.js`) | Header-Injection in den Mail-Link (`%0D%0ABcc:`), HTML/Skript im Text, Code fremder Kampagnen vorgetäuscht | nur `[A-Za-z0-9-]`, 2–24 Zeichen, sonst verworfen; Ausgabe per `encodeURIComponent` in `href` und `textContent`; Code ist nur Statistik, gibt keine Rechte | Negativ-Tests mit CRLF, `<script>`, Überlänge, Umlauten, mehrfachem Parameter |
| Inhalt der Anfrage | Personendaten ohne Einwilligung beim Partner | Seite verarbeitet nichts: Anfrage geht als Mail aus dem eigenen Postfach. Weitergabe an den Partner fragt der Mailtext ausdrücklich ab | Test auf Einwilligungssatz im Mailtext |

Worst Case insgesamt: gefälschter Link mit Schadcode im Parameter. Gegenmaßnahme oben plus
Meta-CSP wie auf der Startseite (`script-src 'self'`, `form-action 'none'`).

Aktionscodes (nur Statistik, nie Abrechnungsgrundlage, weil jeder sie an Links hängen kann):
`MESSE`, `FLYER`, `BRIEF`, `NEWSLETTER`, `PARTNER`, z. B. `/landwirte/?code=messe`. Neue Codes in
`BEKANNTE_CODES` (schlank/anfrage.js) eintragen; unbekannte werden verworfen.

Stand 01.11.2026: Seite gebaut, 27 Tests (Code-Prüfung, Seitenanbindung, Sie-Form, Leitplanken,
Links, KI-Hinweis), Desktop und Handy im Browser geprüft. Titelbild `bilder/hof-sonne-*.webp`
aus `werkzeuge/prompts/landwirte.txt`. Security-Review kurz am 01.11.2026: **FREIGABE**, Nachprüfung der Fixes ebenfalls **FREIGABE**; die MITTEL-Funde
(beliebiger Text als „Aktionscode“, mehrdeutige Einwilligung) und die NIEDRIG-Funde Testlücke
`verbindeSeite`, Rechtszitat und unmarkierte Zusagen sind behoben.

Offen:
- Rechenbeispiele aus dem Messeflyer v13b einsetzen (liegt nicht vor), von Timo freigeben lassen
- Jahresmarktwert Solar 2025 gegen netztransparenz.de prüfen
- Go-Live: Partner in der Datenschutzerklärung nennen, Widerruf erklären; Anfragen ohne klares
  „ja“ gelten als „nein“ (Weitergabe nur mit klarer Zustimmung)
- Go-Live: canonical/og:url erst setzen, wenn `/landwirte/` auf der Domain existiert
- Auf dem Handy ist die Landwirte-Seite von der Startseite aus nur über die Kacheln erreichbar,
  die mit dem Umbau der Startseite kommen (Navigation ist dort ausgeblendet)

---

## 11. Unternehmen-Seite `/unternehmen/` und Quellen für Landwirte (01.11.2026)

Quellen: Unternehmenspräsentation „ROBIN GUT Stromcommunity für Unternehmen“ (17 Folien) und
Flyer „RG-Flyer-15-09-2026_Korrekturen2“. Der Flyer ist **nicht** der Messeflyer v13b: Er
enthält keine Rechenbeispiele für Landwirte, die Platzhalter bleiben. „Günstiger Ökostrom“ und
„Mehr Erlös“ aus dem Flyer stehen bewusst nicht auf der Seite (Briefing: keine Preisversprechen).

Übernommen auf `/landwirte/` (ROBIN GUTs eigenes Material, daher ohne Markierung): Preis selbst
vereinbaren (Folie 9), Betriebsstätten nutzen oder deutschlandweit teilen (Flyer), Technik:
viertelstündliche Messung, Fernwirktechnik ab 25 kW, Lesekopf für den Bezug, Anschluss bleibt
(Folie 10), Erzeugung aus PV, Wind, Wasserkraft, Biogas (Folie 9). Neuer dritter Weg „An Unternehmen“.

`/unternehmen/` nach Briefing C: Botschaft „gespart wird beim Energiepreis, Netzentgelte, Umlagen
und Stromsteuer fallen je Entnahmestelle an“, drei Säulen, Bilanzkreis, Technik, beide
Rechnungen aus der Präsentation (Kundenfall Bauunternehmen, Modellrechnung Logistik; jede Zahl per Test abgeglichen), Absatz für Kommunen und
Stadtwerke ohne Pilot-Stadtwerk, nächster Schritt „Lastgang-Analyse anfragen“. Sie-Form, obwohl
die Präsentation duzt. Überschrift „Kosten senken“ aus der Präsentation bewusst nicht übernommen.

| Risiko | Worst Case | Gegenmaßnahme | Test |
|---|---|---|---|
| Zahlen, Ersparnis, Erlös | Abmahnung (UWG, irreführende Werbung), Kunde fordert versprochene Ersparnis ein | Kundenfall vs. „Modellrechnung (Annahme)“ getrennt; Annahmen und Netzentgelte unter jeder Rechnung; Ergebnisse der Modellrechnung markiert; kein „günstiger“, „sparen X“, „% weniger“ außerhalb der Rechnungen | exakter Zahlenabgleich je Beispiel (Reihenfolge und Einheit), Verbotslisten inkl. Meta-Angaben |
| `data-anfrage` | Prototype-Schlüssel wählen eine fremde Vorlage | `Object.hasOwn`, sonst `hof` | „unbekannte Vorlage gilt die Hof-Vorlage“ |

Security-Review voll (01.11.2026): **BLOCKIERT** – Logistik-Beispiel war eine Modellrechnung (PV erst zu bauen, 5 ct angenommen) als „Praxisbeispiel“ mit 44 %; Zahlentests fingen Tippfehler kaum (18/20 Mutanten überlebt); Stromsteuer als befreit lesbar; „Autarkie“; „übernehmen wir“ beim Bilanzkreis. Alles behoben: Modellrechnung gekennzeichnet und Ergebnis markiert, Zahlen werden jetzt vollständig in Reihenfolge abgeglichen, Netzentgelt- und Partnerregeln als Test.

Markiert, bis bestätigt: Veröffentlichung der Kundenfälle, „bundesweit, anders als § 42c EnWG“
(offene § 42c-Frage), Stiftungsanteil (UWG).

Anfrage-Link liegt jetzt gemeinsam in `schlank/anfrage.js` mit Vorlagen `hof` und `firma`
(`data-anfrage="…"`); unbekannte Vorlagen fallen auf `hof` zurück. Gemeinsame Seitenprüfungen in
`tests/seiten-hilfen.mjs`; Tests `tests/landwirte.test.mjs`, `tests/unternehmen.test.mjs`.
Startseite: „Für Organisationen“ zeigt jetzt auf `/unternehmen/`. Vereine haben dort noch keinen
eigenen Abschnitt – beim Umbau der Startseite klären.

### Nachtrag 01.11.2026: Präsentation für Landwirte und Schrift

Quelle: „Die ROBIN GUT Stromcommunity für Landwirte“ (17 Folien, April 2026). Daraus auf `/landwirte/`:
die drei Säulen (Betriebsvernetzung, erst selbst nutzen, Überschuss vermarkten) und beide
Praxisbeispiele als „(Annahme)“, Zahlen per Test nachgerechnet:
1. 100 kWp, 95.000 kWh, 30 % Eigenverbrauch, 66.500 kWh × 5 ct → 10 ct: 3.325 € → 6.650 €.
2. 200 kWp Bestandsanlage, 190.000 kWh: 5 ct + 25 ct Marktprämie = 57.000 € → 10 ct + 25 ct = 66.500 €;
   nach dem Förderende 19.000 € statt 9.500 €.

Bewusst nicht übernommen oder entschärft:
- „Netzentgelte & Umlagen werden reduziert“ / „Energiekosten sinken auf null“ (Folie 5) widerspricht der
  Unternehmenspräsentation („fallen je Entnahmestelle wie gewohnt an“) – auf der Seite steht die vorsichtige Fassung.
- „ohne Investition“ / „ohne zusätzliche Investition“ – ab 25 kW ist Fernwirktechnik nötig; auf der Seite
  steht „Kosten für Messung, Fernwirktechnik und Vermarktung sind nicht eingerechnet“.
- Annahme, dass die Community die ganze Menge abnimmt, steht sichtbar unter jedem Beispiel.
- Beispiel 2 (Marktprämie bleibt beim Verkauf in die Community) ist mit `mark.check` markiert:
  **rechtlich prüfen**, u. a. Doppelvermarktungsverbot § 80 EEG. Vor der Messe von Timo klären lassen.
- Die Folie zu Beispiel 2 bucht 50.000 kWh „Lieferung an eigene Betriebsbereiche“ als Erlös. Das ist eher
  eingesparter Zukauf als Erlös; auf der Seite nicht aufgeschlüsselt.

Schrift: Miriam Libre wie im Flyer (siehe Abschnitt 9), ersetzt Stardos Stencil und Inter.

Nachprüfung (voll, 01.11.2026): **FREIGABE** – HOCH und alle MITTEL behoben und per Mutation bestätigt
(Reviewer 16/23, eigene Runde 34/35; Rest gleichwertig oder unten). Akzeptiert (NIEDRIG), vor Go-Live erledigen:
- Verbotslisten erweitern (`halbier`, `doppelt so viel`, `liefern wir`, `bilanzieren wir`), Netzentgelt-Sätze je Kachel/FAQ einzeln prüfen
- `/landwirte/` „Aus der Region … Menschen in Ihrer Nähe“ passt nicht zu „deutschlandweit“ → „Sie entscheiden, ob Ihr Strom in der Region bleibt“
- `/landwirte/` Beispiel 2 „am Spotmarkt“ → „angenommene Anschlussvergütung“ wie in Beispiel 1
- `/unternehmen/` „Vergleichsbasis laut Präsentation“ → „Vergleichsbasis (zu bestätigen)“
- Threat Model: Worst Case „Landwirt verliert die Marktprämie“ ergänzen
- „bundesweit/deutschlandweit“ unmarkiert (Kernaussage; § 42c-Frage bei Timo)

Vor der Messe von Timo/Dieter klären: § 80 EEG (Marktprämie bei Community-Verkauf), Community-Preis 5 ct
(Unternehmen) vs. 10 ct (Landwirte), Freigabe der Kundenfälle, Stiftungsanteil je kWh.

---

## 12. Startseite als Trichter nach Briefing (01.11.2026)

Reihenfolge (Briefing Abschnitt 4, Preis als Vertiefung für Privathaushalte nach „Für wen“):
Einstieg (Kernaussage, Bild, „So funktioniert's“ + „Tarif prüfen“) → So funktioniert's (Schaubild
Erzeuger → Community → Verbraucher, Ökostrom als Reserve, drei Schritte) → Warum ROBIN GUT
(Stiftung, Region, Partner, monatlich kündbar) → Wald → Für wen (Privathaushalte, Landwirte,
Unternehmen; Kommunen-Hinweis) → Preis/Rechner → Fragen (Wechsel, Lesekopf, Kosten, ohne Sonne,
Kündigung, Datenschutz) → Kontakt und Rückruf.

Leitplanken: Partner ohne Namen (auch JSON-LD, `llms.txt`; die Anmelde-URL des Partners bleibt als
Link), keine Eyebrow-/Kicker-Zeilen, „Wald pflanzen“/„mit jeder kWh wächst Wald“ raus, Stiftungsanteil
markiert. „Monatlich kündbar“ ohne Markierung: steht so im Briefing und in der Unternehmenspräsentation.
Entfallen: Kennzahlen-Leiste („lohnt sich besonders“), Familienbeispiel Viersen–Heidelberg (war wegen
zwei Netzgebieten markiert), „Viele Netzbetreiber zahlen deine EEG-Vergütung weiter“ (gleiche offene
Rechtsfrage wie § 80 EEG), Kundenzitate ohne Einwilligung, „Wer macht was“ mit Partnernamen.

Rechner: Logik unverändert. **Frage an Timo:** Darf der Vergleich mit dem heutigen Tarif
(„Ersparnis/Mehrkosten im Jahr“) bleiben? Er rechnet ehrlich in beide Richtungen, ist aber ein
Preisvergleich.

Rückruf: neue Mailvorlage `rueckruf` in `schlank/anfrage.js` (Du-Form), Aktionscode wie auf den Unterseiten.

### Threat Model

| Untrusted Input | Worst Case | Gegenmaßnahme | Test |
|---|---|---|---|
| `?code=` auf der Startseite | wie §10 (mailto-Injection, Spoofing) | gleiches Modul `schlank/anfrage.js`, Allowlist | Tests in `tests/landwirte.test.mjs` plus Vorlage `rueckruf` |
| Rechner-Eingaben | wie §7 | unverändert | unverändert |
| Aussagen auf der Seite | UWG (Umwelt, Preis), Partner wirkt wie ROBIN GUT als Lieferant | Leitplanken-Tests: kein Partnername, Verbotslisten inkl. Meta und JSON-LD, Stiftung markiert | `tests/startseite.test.mjs` |

Security-Review voll (01.11.2026): **BLOCKIERT** – „Strom teilen, Wald stärken“ war die entfernte Wald-Aussage in neuen
Worten. Behoben, zusammen mit den MITTEL-Funden:
- Wald-H2 jetzt „Strom teilen, Stiftung unterstützen“; „klimaresilient“ raus.
- „In deiner Region“ als Zusage raus: H1 „Mit Menschen, die du wählst“, Region nur als Möglichkeit;
  „Energy Sharing“ → „Stromcommunity“ (die Unternehmensseite grenzt sich von § 42c ab).
- „Monatlich kündbar“ wieder markiert („gegen AGB des Partners prüfen“), „nicht länger als einen Monat gebunden“ raus.
- Datenschutz-FAQ verweist nicht mehr auf die Stiftungs-Datenschutzerklärung als Quelle; Einwilligung nennt
  den Lieferpartner als Empfänger, den Zweck und das Widerrufsrecht (alle drei Vorlagen).
- `llms.txt` mit Entwurfshinweis, ohne markierte Aussagen (Gebiet, 18–29 ct, Kündigung, Stiftungsanteil).
- „Partner“ nur noch für den Lieferpartner; das Gegenüber heißt „Erzeuger“, der Preis „Community-Preis“.
- JSON-LD-FAQ enthält nur geprüfte Antworten, Wortlaut gleich der Seite; Partnername auch aus `preise.js`.
- `Object.hasOwn` für die Einwilligung.
Tests: Leitplanken jetzt auch über Meta, JSON-LD, `llms.txt` und Skripte; Markierungspflicht je Aussage;
alle 19 Mutationen aus dem Review und eigene werden erkannt.

Go-Live-Punkte dazu:
- `robots.txt` im Repo wirkt auf der Projektseite (github.io/robingut-strom-neu/) nicht; Schutz nur über `noindex`
  im HTML. `llms.txt` hat keinen Schutz, daher Entwurfshinweis.
- Eigene Datenschutzerklärung der GbR (die verlinkte nennt die Stiftung als Verantwortliche), Rechtsgrundlage
  der Weitergabe (Einwilligung vs. Art. 6 Abs. 1 lit. b) einheitlich festlegen.
- „100 % Ökostrom“ mit Stromkennzeichnung/Herkunftsnachweis des Partners belegen.
- `/landwirte/` und `/unternehmen/` gibt es auf der Live-Domain noch nicht (Sitemap, llms.txt).

Nachprüfung (voll, 01.11.2026): **FREIGABE**. Akzeptiert für den Entwurf:
- MITTEL: Footer aller drei Seiten verlinkt die Live-Datenschutzerklärung (Stiftung als Verantwortliche, ohne
  Weitergabe an den Lieferpartner); Einwilligung nennt den Lieferpartner ohne Namen. **Vor jeder echten Nutzung
  (Messe, Flyer, Newsletter) beheben**, nicht erst beim Go-Live: eigene Erklärung der GbR mit Partnernennung verlinken.
- NIEDRIG: Verbotslisten erkennen Umformulierungen nicht („wächst der Wald“, „Wald fördern“, „nachhaltig“,
  „klimaschonend“, „200 € weniger“, „aus deiner Region“ ohne „auch“, `areaServed`) – bei der nächsten Änderung ergänzen.
- NIEDRIG: #wald „Sie pflanzt davon Mischwälder …“ knüpft an den markierten Anteil an; „davon“ streichen oder mitmarkieren.

## 13. Startseite nach dem Meeting „Wirtschaftsplan ROBIN GUT Strom“ (01.11.2026)

Quelle: Teams-Transkript (Timo, Dieter, Guido, Andreas). Umgesetzt:
- Titelbild = Flyer-Motiv (Häuser, Halle, Windräder, Lichtbögen), `bilder/hero-community-*.webp`, aus dem
  Flyer-PDF extrahiert (CMYK invertiert, `-negate`). Familienfoto raus (Guido: zu sehr Privatkunde; Dateien
  `hero-familie-*` bleiben für eine spätere Privatkunden-Unterseite).
- Dieter im Einstieg: Porträt (`bilder/dieter-koennes-*.webp`, aus `~/dieterkoennes-website`), Zitat aus dem
  Meeting markiert („freigeben lassen“), Bildnachweis im Footer markiert.
- „Sonne, Wind und Wasser“ statt „Solarstrom“ in Titel, Meta und Einstieg (Dieter: sonst irreführend).
- `#fuer-wen` direkt unter den Einstieg (Guido/Dieter: Kopfbild, darunter die Zielgruppen); je Kachel markierter
  Platzhalter für ein Statement. Echte Namen (Landwirt, Privatkunde, Solarteur) erst mit schriftlicher Einwilligung.
- Platzhalter für das 30-s-Erklärvideo mit Dieter unter den drei Schritten.
- Preis in Dieters Reihenfolge: Netz/Steuern/Abgaben → Erzeugerpreis → 1 ct Vermittlung (Leiste, FAQ, JSON-LD).

Bewusst nicht übernommen:
- „Verbraucher zahlen weniger“, „Bäume ohne Mehrkosten“ (Preis-/Umweltversprechen, Briefing verbietet das) –
  jetzt auch in der Verbotsliste der Tests.
- Timos „17 ct Netz, Steuern, Abgaben im Schnitt 2025“: BDEW 05/2025 nennt brutto 10,95 ct Netzentgelte +
  12,71 ct Steuern/Abgaben/Umlagen = 23,66 ct; 17 ct passt nur ohne Mehrwertsteuer. Seite behält die markierte
  regionale Spanne 18–29 ct, bis Timo die Zahl bestätigt.
- Potenzialrechner bleibt von der Seite weg (Go-to-Market-Gutschein, nur im Vertriebsgespräch).

Offen aus dem Meeting:
- Erklärvideo drehen (8–10 s Dieter im Bild, dann Off über Schaubild); Statements mit Einwilligung einholen.
- Decks Landwirte/Unternehmen im neuen Look als PDF-Download auf den Unterseiten (Timo liefert).
- Blog für Sichtbarkeit (später); Energiemakler/Partner als Zielgruppe nachgelagert.
- Zeitplan: Zwischenlösung Ende nächster Woche wegen Wechselwelle im November.
- Spenderadressen der Stiftung (~2.000–2.400) nur mit passender Einwilligung für Strom-Werbung nutzen.
- Herkunft des Flyer-Motivs (KI?) und Nutzungsrecht des Porträts bestätigen.

Review (voll, 01.11.2026): **FREIGABE**, behoben danach:
- M2: KI-Etikett des Titelbilds oben rechts, weit weg vom echten Porträt; Test, dass der Dieter-Block kein KI-Etikett trägt.
- M3: Gebühr heißt überall „Plattformgebühr“ (Dieter sagte „Vermittlungsgebühr“, Partner und Live-Seite „Plattformgebühr“).
- M4: Test gleicht Erzeugerspanne und Gebühr über Leiste, FAQ, JSON-LD, Tabelle, Rechner-Hinweis und llms.txt
  sowie mit `E_COMMUNITY_CT` / `WSE_GEBUEHR_CT` ab.
- N1/N2: Statement-Platzhalter fest formuliert, `object`/`embed` verboten, Solarstrom auch im JSON-LD,
  Preisversprechen-Test inkl. `<title>`; `figure.dieter` mit `figcaption` als direktem Kind.
Akzeptiert: N3 (Titelbild nur 1749 px breit, Play-Symbol ohne Funktion), N4 (Wind/Wasser im Titel, mit Partner
bestätigen), überlebende Mutation „falsche Bildmaße“ (nur Layout-Sprung).
**Bedingung vor dem Veröffentlichen (M1):** Fotograf und Nutzungsrecht des Dieter-Porträts für ROBIN GUT Strom
schriftlich klären, Namen in den Footer; bis dahin nur lokal. Ebenso Herkunft/Lizenz des Flyer-Motivs.
