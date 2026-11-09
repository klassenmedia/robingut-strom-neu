<?php
// Reine Funktionen für die Strukturdaten (schema.org) und llms.txt. Ohne WordPress testbar.
// Fakten nur aus Impressum, Kontakt und Über uns der Seite (Stand 09.11.2026); keine Preis-, Vorteils-, Rechts-
// oder Zertifikatsaussagen und den Partner ohne Namen (§ 5b UWG offen), siehe docs/plans/GEO-STRUKTURDATEN.md.

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

const RGG_BASIS = 'https://www.robingut-strom.de';
const RGG_ORG_ID = RGG_BASIS . '/#organization';
const RGG_DIETER_ID = RGG_BASIS . '/#dieter-koennes';
const RGG_TIMO_ID = RGG_BASIS . '/#timo-russell';
const RGG_STIFTUNG_ID = 'https://robin-gut.org/#organization';
const RGG_FRAGEN_MAX = 60;
const RGG_ANTWORT_MAX = 1000;
const RGG_LLMS_DATEI = __DIR__ . '/../llms.txt';
// Kein </script> und keine Anführungszeichen im Ergebnis, egal was im Seitentext steht
const RGG_JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE;

// Zielgruppen-Seiten: eigener Service. Beschreibungen wie die Meta-Beschreibungen der Seiten.
const RGG_SERVICES = [
    'privathaushalte' => [
        'name' => 'Ökostrom aus der Community für Privathaushalte',
        'beschreibung' => 'Strom von Erzeugern beziehen, die man selbst auswählt, auch aus der eigenen Region. Mit der Postleitzahl zeigt der Rechner den Monatspreis.',
        'zielgruppe' => 'Privathaushalte',
    ],
    'landwirte' => [
        'name' => 'Strom aus Hof-PV nach der EEG-Förderung teilen',
        'beschreibung' => 'Die EEG-Förderung endet, die PV-Anlage läuft weiter: den Hofstrom mit Haushalten aus der Region oder mit den eigenen Betriebsstätten teilen.',
        'zielgruppe' => 'Landwirte mit Photovoltaik-Anlage',
    ],
    'organisationen-und-vereine' => [
        'name' => 'Strom zwischen Standorten teilen',
        'beschreibung' => 'Für Unternehmen, Kommunen und Vereine: Überschüsse eines Standorts an anderen Standorten nutzen oder Strom aus der Community beziehen.',
        'zielgruppe' => 'Unternehmen, Kommunen und Vereine',
    ],
];
const RGG_ALLGEMEINE_SERVICE_SEITEN = ['startseite', 'energy-sharing'];

function rgg_text_aus_html(string $html): string
{
    // Inhalte, die nicht sichtbar sind, gar nicht erst übernehmen
    $html = (string) preg_replace('#<(script|style|template|noscript)\b[^>]*>.*?</\1\s*>#is', ' ', $html);
    // Blockenden als Leerzeichen, damit Absätze nicht aneinanderkleben
    $mit_luecken = (string) preg_replace('#</(p|li|div|h[1-6]|tr|td|th)>|<br\s*/?>#i', ' ', $html);
    $text = html_entity_decode(strip_tags($mit_luecken), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim((string) preg_replace('/\s+/u', ' ', $text));
}

function rgg_kuerzen(string $text, int $max): string
{
    if (mb_strlen($text) <= $max) {
        return $text;
    }
    $teil = mb_substr($text, 0, $max - 1);
    $leer = mb_strrpos($teil, ' ');
    return rtrim($leer !== false ? mb_substr($teil, 0, $leer) : $teil) . '…';
}

function rgg_hat_pruefmarkierung(DOMElement $element): bool
{
    foreach ($element->getElementsByTagName('mark') as $mark) {
        $klasse = ' ' . $mark->getAttribute('class') . ' ';
        if ($mark->hasAttribute('title') || str_contains($klasse, ' check ') || stripos($mark->getAttribute('style'), 'dashed') !== false) {
            return true;
        }
    }
    return false;
}

function rgg_inneres_html(DOMNode $knoten): string
{
    $html = '';
    foreach ($knoten->childNodes as $kind) {
        $html .= (string) $knoten->ownerDocument->saveHTML($kind);
    }
    return $html;
}

// Sichtbare Aufklapper <details><summary>Frage</summary>Antwort</details> des Seiteninhalts.
function rgg_faq_aus_inhalt(string $html): array
{
    if (stripos($html, '<details') === false) {
        return [];
    }
    $dom = new DOMDocument();
    $alt = libxml_use_internal_errors(true);
    $dom->loadHTML('<?xml encoding="utf-8"?><div>' . $html . '</div>', LIBXML_NONET);
    libxml_clear_errors();
    libxml_use_internal_errors($alt);
    $faq = [];
    foreach ($dom->getElementsByTagName('details') as $details) {
        // Unbestätigte Aussagen sind auf der Seite gestrichelt markiert (<mark> mit title, Klasse check oder
        // gestricheltem Rand): nicht als Antwort ausgeben. Farbiger Text (<mark class="has-inline-color">) zählt nicht.
        if (rgg_hat_pruefmarkierung($details)) {
            continue;
        }
        $summary = null;
        foreach ($details->childNodes as $kind) {
            if ($kind instanceof DOMElement && strtolower($kind->tagName) === 'summary') {
                $summary = $kind;
                break;
            }
        }
        if ($summary === null) {
            continue;
        }
        $frage = rgg_kuerzen(rgg_text_aus_html(rgg_inneres_html($summary)), 300);
        // Antwort ohne die Frage und ohne eingebettete Aufklapper (die zählen als eigene Fragen)
        $kopie = $details->cloneNode(true);
        foreach (iterator_to_array($kopie->getElementsByTagName('details')) as $inneres) {
            $inneres->parentNode?->removeChild($inneres);
        }
        foreach ($kopie->childNodes as $kind) {
            if ($kind instanceof DOMElement && strtolower($kind->tagName) === 'summary') {
                $kopie->removeChild($kind);
                break;
            }
        }
        $antwort_html = rgg_inneres_html($kopie);
        $antwort = rgg_kuerzen(rgg_text_aus_html($antwort_html), RGG_ANTWORT_MAX);
        if ($frage === '' || $antwort === '') {
            continue;
        }
        $faq[] = ['frage' => $frage, 'antwort' => $antwort];
        if (count($faq) >= RGG_FRAGEN_MAX) {
            break;
        }
    }
    return $faq;
}

function rgg_organisation(): array
{
    return [
        '@type' => 'Organization',
        '@id' => RGG_ORG_ID,
        'name' => 'ROBIN GUT Strom GbR',
        'legalName' => 'ROBIN GUT Strom GbR',
        'url' => RGG_BASIS . '/',
        'description' => 'ROBIN GUT Strom verbindet Menschen, die Strom erzeugen, mit Menschen, die Strom brauchen: Strom wird in einer Strom-Community über das öffentliche Netz geteilt. Lieferung, Messung und Abrechnung übernimmt unser Partner. Ein Teil der Einnahmen fließt in die ROBIN GUT Stiftung.',
        'address' => [
            '@type' => 'PostalAddress',
            'streetAddress' => 'Am Schönblick 8',
            'postalCode' => '41749',
            'addressLocality' => 'Viersen',
            'addressCountry' => 'DE',
        ],
        'telephone' => '+49 221 29282931',
        'email' => 'info@robingut-strom.de',
        'contactPoint' => [
            '@type' => 'ContactPoint',
            'telephone' => '+49 221 29282931',
            'email' => 'info@robingut-strom.de',
            'contactType' => 'customer support',
            'availableLanguage' => 'de',
        ],
        'member' => [['@id' => RGG_DIETER_ID], ['@id' => RGG_TIMO_ID]],
        'knowsAbout' => ['Energy Sharing', 'Strom teilen', 'Strom-Community', 'Ökostrom', 'Photovoltaik-Überschuss', 'Ausgeförderte PV-Anlagen nach dem EEG', 'Strom zwischen Standorten teilen'],
    ];
}

function rgg_personen_und_stiftung(): array
{
    return [
        [
            '@type' => 'Person',
            '@id' => RGG_DIETER_ID,
            'name' => 'Dieter Könnes',
            'jobTitle' => 'Gründer der ROBIN GUT Stiftung, Gesellschafter der ROBIN GUT Strom GbR',
            'description' => 'Journalist und TV-Moderator. Gründete 2025 die gemeinnützige ROBIN GUT Stiftung; begonnen hat alles 2021 mit seiner Hilfe im Ahrtal nach der Flutkatastrophe.',
            'image' => RGG_BASIS . '/wp-content/uploads/2026/11/dieter-koennes-wald-819x1024.webp',
            'sameAs' => ['https://de.wikipedia.org/wiki/Dieter_K%C3%B6nnes', 'https://dieterkoennes.de'],
            'worksFor' => ['@id' => RGG_ORG_ID],
        ],
        [
            '@type' => 'Person',
            '@id' => RGG_TIMO_ID,
            'name' => 'Timo Russell',
            'jobTitle' => 'Gesellschafter der ROBIN GUT Strom GbR',
            'worksFor' => ['@id' => RGG_ORG_ID],
        ],
        [
            '@type' => ['Organization', 'NGO'],
            '@id' => RGG_STIFTUNG_ID,
            'name' => 'ROBIN GUT Stiftung',
            'url' => 'https://robin-gut.org',
            'foundingDate' => '2025',
            'founder' => ['@id' => RGG_DIETER_ID],
            'funder' => ['@id' => RGG_ORG_ID],
            'sameAs' => [
                'https://www.facebook.com/RobinGutInitiative',
                'https://www.youtube.com/@RobinGutPodcast',
                'https://www.linkedin.com/company/robingutstiftung/',
                'https://www.instagram.com/robin_gut_stiftung/',
            ],
        ],
    ];
}

function rgg_service(string $slug, string $url): ?array
{
    $daten = RGG_SERVICES[$slug] ?? null;
    if ($daten === null && !in_array($slug, RGG_ALLGEMEINE_SERVICE_SEITEN, true)) {
        return null;
    }
    $daten ??= [
        'name' => 'ROBIN GUT Strom Community',
        'beschreibung' => 'Strom-Community: Wer Strom erzeugt, teilt ihn über das öffentliche Netz mit Menschen, die Strom brauchen. Lieferung und Abrechnung übernimmt unser Partner.',
        'zielgruppe' => null,
    ];
    $service = [
        '@type' => 'Service',
        '@id' => $url . '#service',
        'name' => $daten['name'],
        'description' => $daten['beschreibung'],
        'serviceType' => 'Strom teilen in einer Strom-Community (Energy Sharing)',
        'provider' => ['@id' => RGG_ORG_ID],
        'url' => $url,
        'offers' => ['@type' => 'Offer', 'url' => $url . '#rechner', 'description' => 'Preis mit Postleitzahl und Verbrauch im Rechner berechnen'],
    ];
    if ($daten['zielgruppe'] !== null) {
        $service['audience'] = ['@type' => 'Audience', 'audienceType' => $daten['zielgruppe']];
    }
    return $service;
}

function rgg_faq_seite(string $url, array $faq): ?array
{
    if ($faq === []) {
        return null;
    }
    return [
        '@type' => 'FAQPage',
        '@id' => $url . '#faq',
        'url' => $url,
        'mainEntity' => array_map(fn($f) => [
            '@type' => 'Question',
            'name' => $f['frage'],
            'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f['antwort']],
        ], $faq),
    ];
}

// $seite: ['slug' => Seitenname, 'url' => Permalink, 'inhalt' => post_content]
function rgg_graph(array $seite): array
{
    $url = (string) ($seite['url'] ?? RGG_BASIS . '/');
    $graph = array_merge([rgg_organisation()], rgg_personen_und_stiftung());
    $service = rgg_service((string) ($seite['slug'] ?? ''), $url);
    if ($service !== null) {
        $graph[] = $service;
    }
    $faq = rgg_faq_seite($url, rgg_faq_aus_inhalt((string) ($seite['inhalt'] ?? '')));
    if ($faq !== null) {
        $graph[] = $faq;
    }
    return $graph;
}

function rgg_json(array $graph): string
{
    return (string) json_encode(['@context' => 'https://schema.org', '@graph' => $graph], RGG_JSON_FLAGS);
}

function rgg_script_tag(array $graph): string
{
    $json = rgg_json($graph);
    if ($json === '') {
        return '';
    }
    return '<script type="application/ld+json" class="robingut-geo">' . $json . "</script>\n";
}

function rgg_ist_llms_pfad(string $anfrage): bool
{
    return parse_url($anfrage, PHP_URL_PATH) === '/llms.txt';
}
