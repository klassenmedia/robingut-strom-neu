# ROBIN GUT Strom

Landingpage für die ROBIN GUT Strom-Community (Energy Sharing mit WeShareEnergy).

Neuaufbau der Inhalte von robingut-strom.de auf der Architektur der
Forschungszulage-Seite: eine Seite, klare Abfolge, eingebauter Preisrechner.

## Aufbau

Die `index.html` ist eigenständig: Schriften, Logo, Favicon und die regionalen
Preisdaten sind eingebettet, es werden keine externen Hosts angefragt (DSGVO).
Daneben liegen nur das Hero-Video und dessen Standbild.

| Datei | Zweck |
|---|---|
| `index.html` | die komplette Seite (generiert) |
| `build/` | die Bausteine, aus denen gebaut wird |
| `build/preise.json` | regionale Netzentgelte und Grundpreis-Staffeln |
| `hero-video-web.mp4` / `.webm` | Hintergrundvideo im Hero |
| `hero-poster.jpg` | Standbild, bis das Video lädt |
| `robots.txt`, `sitemap.xml` | Suchmaschinen |

## Bearbeiten

Änderungen gehören in die Bausteine unter `build/`, nicht in die generierte
`index.html` — die wird bei jedem Lauf überschrieben.

```
python3 build/gen-faq-schema.py
python3 build.py
```

Der erste Lauf erzeugt das FAQ-Schema aus dem sichtbaren FAQ-Markup, damit
strukturierte Daten und angezeigter Text nicht auseinanderlaufen.

## Vorschau

```
python3 .claude/serve.py
```

## Preisrechner

Die Rechenlogik stammt aus `robingut-potenzialrechner`, reduziert auf drei
Eingaben. Annahmen: 50 % des Verbrauchs über Energie-Links, 9,50 ct/kWh
Verkaufspreis des Einspeisers (Mitte der Empfehlung 7–11 ct), dazu 1,00 ct/kWh
netto WSE-Gebühr. Für den vollen Parametersatz verlinkt die Seite auf den
bestehenden Detailrechner.

Die Preisdaten decken 20 Postleitzahlen ab. Ist die eingegebene PLZ nicht
dabei, rechnet die Seite mit Viersen als Referenz und sagt das auch.

## Offene Punkte vor dem Go-Live

- Impressum und Datenschutz sind Platzhalter und müssen befüllt werden
- Formularversand anbinden (zeigt bislang nur die Bestätigung)
- Verbraucher-Tarifzahlen von WeShareEnergy gegenprüfen: Die konkreten
  Arbeits- und Grundpreise liegen nur im WSE-Rechner vor, nicht als Datensatz
- Preisdaten auf weitere Postleitzahlen ausweiten
- Hero-Video gegen ein Strom-Motiv tauschen (stammt aus der Forschungszulage-Seite)
- Angaben zu Preisen und Vergütungen: Stand September 2026
