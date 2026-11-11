<?php
// Prüft die reinen Funktionen von robingut-geo ohne WordPress.
//
//   php wordpress/robingut-geo/tests/geo-test.php

declare(strict_types=1);

define('ABSPATH', __DIR__);
require __DIR__ . '/../includes/geo.php';

$bestanden = 0;
$fehler = 0;
function pruefe(string $name, callable $fn): void
{
    global $bestanden, $fehler;
    try {
        $fn();
        $bestanden++;
        echo "  ok  $name\n";
    } catch (Throwable $e) {
        $fehler++;
        echo "  FEHLER  $name\n        {$e->getMessage()}\n";
    }
}
function gleich($ist, $soll, string $info = ''): void
{
    if ($ist !== $soll) {
        throw new Exception(var_export($ist, true) . ' statt ' . var_export($soll, true) . " $info");
    }
}
function wahr(bool $wert, string $info = ''): void
{
    if (!$wert) {
        throw new Exception("nicht erfüllt: $info");
    }
}
// Alle Knoten eines bestimmten Typs aus dem Graphen
function knoten(array $graph, string $typ): array
{
    return array_values(array_filter($graph, fn($k) => in_array($typ, (array) ($k['@type'] ?? []), true)));
}

const BASIS = 'https://www.robingut-strom.de';
// Projektregeln: keine Preis-/Vorteilsversprechen, Partner ohne Namen (§ 5b UWG offen), keine Zertifikate,
// keine veralteten Aussagen (UEBERGABE.md, yoast-meta.md, GEO-STRUKTURDATEN.md)
const VERBOTEN = ['42c', '/preise/', 'TÜV', 'Peer-to-Peer', '2021 gegründet', 'zahlen weniger', 'bekommen mehr',
    'günstiger', 'sparen', 'Erspar', 'billig', 'Nr. 1', 'Nummer 1', 'zertifiz', 'WeShareEnergy', 'weshareenergy',
    'We Share', 'Merowinger', 'release.', '/konzept/',
    // „ganz Deutschland“ ist mit dem Partner noch offen (UEBERGABE.md)
    'bundesweit', 'deutschlandweit', 'ganz Deutschland', 'areaServed'];
// Abkürzung des Partners nur als ganzes Wort
function ohne_partnerkuerzel(string $text, string $info): void
{
    wahr(preg_match('/\bWSE\b/', $text) === 0, "$info enthält WSE");
}
const FAQ_HTML = '<div class="rgb-karte"><h2>Häufige Fragen</h2>'
    . '<details class="rgb-faq"><summary>Was ist  der <strong>Lesekopf</strong>?</summary><p>Ein Gerät am Zähler.</p><p>Er liest &amp; meldet.</p></details>'
    . '<details class="rgb-faq"><summary>Was kostet es?</summary><p>Siehe <a href="/energy-sharing/">Preise</a>.</p></details>'
    . '<details><p>Ohne Frage</p></details>'
    . '<details><summary>Ohne Antwort</summary></details></div>';

echo "FAQ aus dem Seiteninhalt\n";

pruefe('Fragen und Antworten aus details/summary, Text ohne Tags, Leerraum zusammengefasst', function () {
    gleich(rgg_faq_aus_inhalt(FAQ_HTML), [
        ['frage' => 'Was ist der Lesekopf?', 'antwort' => 'Ein Gerät am Zähler. Er liest & meldet.'],
        ['frage' => 'Was kostet es?', 'antwort' => 'Siehe Preise.'],
    ]);
});

pruefe('ohne Aufklapper keine Fragen, kaputtes HTML wirft nicht', function () {
    gleich(rgg_faq_aus_inhalt('<p>Nur Text</p>'), []);
    gleich(rgg_faq_aus_inhalt(''), []);
    gleich(count(rgg_faq_aus_inhalt('<details><summary>A?<p>B</details><details>')) <= 1, true);
});

pruefe('sehr lange Antworten werden gekürzt, höchstens 60 Fragen', function () {
    $lang = '<details><summary>F?</summary><p>' . str_repeat('Wort ', 2000) . '</p></details>';
    $faq = rgg_faq_aus_inhalt($lang);
    wahr(mb_strlen($faq[0]['antwort']) <= RGG_ANTWORT_MAX, 'Antwortlänge');
    gleich(count(rgg_faq_aus_inhalt(str_repeat('<details><summary>F?</summary><p>A</p></details>', 80))), RGG_FRAGEN_MAX);
});

pruefe('unbestätigte (markierte) Aussagen kommen nicht in die FAQ', function () {
    $html = '<details><summary>Belegt?</summary><p>Ja.</p></details>'
        . '<details><summary>Was brauche ich technisch?</summary><p><mark class="check" title="bestätigen">Fernwirktechnik ab 25 kW</mark></p></details>';
    gleich(array_column(rgg_faq_aus_inhalt($html), 'frage'), ['Belegt?']);
    // Gestrichelte Prüf-Markierung im WordPress-Stil (style + title) ebenfalls
    $wp = '<details><summary>Offen?</summary><p><mark style="border-bottom:3px dashed #9a5200" title="Offen: klären">X</mark></p></details>';
    gleich(rgg_faq_aus_inhalt($wp), []);
    // Farbiger Text (WordPress „Textfarbe“) ist keine Prüf-Markierung
    $farbe = '<details><summary>Farbig?</summary><p><mark class="has-inline-color has-lime-color">Ja</mark></p></details>';
    gleich(rgg_faq_aus_inhalt($farbe), [['frage' => 'Farbig?', 'antwort' => 'Ja']]);
});

pruefe('Inhalt von script/style wird nicht zur Antwort, verschachtelte Aufklapper getrennt', function () {
    $html = '<details><summary>F?</summary><p>A</p><script>var geheim = "x";</script><style>.a{}</style></details>'
        . '<details><summary>Außen?</summary><p>Außen-Antwort</p><details><summary>Innen?</summary><p>Innen-Antwort</p></details></details>';
    gleich(rgg_faq_aus_inhalt($html), [
        ['frage' => 'F?', 'antwort' => 'A'],
        ['frage' => 'Außen?', 'antwort' => 'Außen-Antwort'],
        ['frage' => 'Innen?', 'antwort' => 'Innen-Antwort'],
    ]);
});

echo "Graph\n";

pruefe('Organisation mit Fakten aus dem Impressum, gleiche @id wie Yoast', function () {
    $g = rgg_graph(['slug' => 'startseite', 'url' => BASIS . '/', 'inhalt' => '']);
    $org = knoten($g, 'Organization')[0];
    gleich($org['@id'], BASIS . '/#organization');
    gleich($org['name'], 'ROBIN GUT Strom GbR');
    gleich($org['address']['streetAddress'], 'Am Schönblick 8');
    gleich($org['address']['postalCode'], '41749');
    gleich($org['telephone'], '+49 221 29282931');
    gleich($org['email'], 'info@robingut-strom.de');
    gleich($org['legalName'], 'ROBIN GUT Strom GbR');
    // Keine LocalBusiness: sonst landet die Anschrift womöglich als Ladengeschäft in Maps
    gleich((array) $org['@type'], ['Organization']);
    // Gründer nur bei der Stiftung (Dieter, laut Über uns); die GbR hat Gesellschafter, keine belegte Gründerangabe
    gleich(isset($org['founder']), false);
});

pruefe('keine veralteten oder ungedeckten Aussagen (§ 42c, /preise/, Gründung 2021, Zertifikate)', function () {
    foreach (['startseite', 'privathaushalte', 'landwirte', 'organisationen-und-vereine', 'ueber-uns', 'fragen-und-antworten'] as $slug) {
        $json = rgg_json(rgg_graph(['slug' => $slug, 'url' => BASIS . "/$slug/", 'inhalt' => FAQ_HTML]));
        foreach (VERBOTEN as $verboten) {
            wahr(stripos($json, $verboten) === false, "$slug enthält $verboten");
        }
        ohne_partnerkuerzel($json, $slug);
    }
});

pruefe('Dieter Könnes als Gründer der Stiftung, verknüpft; Timo als Gesellschafter', function () {
    $g = rgg_graph(['slug' => 'ueber-uns', 'url' => BASIS . '/ueber-uns/', 'inhalt' => '']);
    $personen = knoten($g, 'Person');
    $dieter = array_values(array_filter($personen, fn($p) => $p['name'] === 'Dieter Könnes'))[0];
    gleich($dieter['@id'], BASIS . '/#dieter-koennes');
    gleich(in_array('https://de.wikipedia.org/wiki/Dieter_K%C3%B6nnes', $dieter['sameAs'], true), true);
    $stiftung = array_values(array_filter(knoten($g, 'NGO'), fn($k) => $k['name'] === 'ROBIN GUT Stiftung'))[0];
    gleich($stiftung['founder'], ['@id' => BASIS . '/#dieter-koennes']);
    gleich($stiftung['foundingDate'], '2025');
    $timo = array_values(array_filter($personen, fn($p) => $p['name'] === 'Timo Russell'))[0];
    gleich($timo['jobTitle'], 'Gesellschafter der ROBIN GUT Strom GbR');
    wahr(stripos(json_encode($timo, JSON_UNESCAPED_UNICODE), 'Gründer') === false, 'Timo als Gründer');
});

pruefe('Service je Zielgruppe mit Zielgruppe und Rechner-Link, sonst allgemein', function () {
    $land = knoten(rgg_graph(['slug' => 'landwirte', 'url' => BASIS . '/landwirte/', 'inhalt' => '']), 'Service');
    gleich(count($land), 1);
    gleich($land[0]['audience']['audienceType'], 'Landwirte mit Photovoltaik-Anlage');
    gleich($land[0]['url'], BASIS . '/landwirte/');
    gleich($land[0]['offers']['url'], BASIS . '/landwirte/#rechner');
    gleich($land[0]['provider'], ['@id' => BASIS . '/#organization']);
    $start = knoten(rgg_graph(['slug' => 'startseite', 'url' => BASIS . '/', 'inhalt' => '']), 'Service');
    gleich($start[0]['name'], 'ROBIN GUT Strom Community');
    gleich(knoten(rgg_graph(['slug' => 'impressum', 'url' => BASIS . '/impressum/', 'inhalt' => '']), 'Service'), []);
});

pruefe('FAQPage nur, wenn die Seite Aufklapper hat, mit genau den sichtbaren Fragen', function () {
    $mit = knoten(rgg_graph(['slug' => 'privathaushalte', 'url' => BASIS . '/privathaushalte/', 'inhalt' => FAQ_HTML]), 'FAQPage');
    gleich(count($mit), 1);
    gleich($mit[0]['mainEntity'][0]['name'], 'Was ist der Lesekopf?');
    gleich($mit[0]['mainEntity'][0]['acceptedAnswer']['text'], 'Ein Gerät am Zähler. Er liest & meldet.');
    gleich($mit[0]['@id'], BASIS . '/privathaushalte/#faq');
    gleich(knoten(rgg_graph(['slug' => 'privathaushalte', 'url' => BASIS . '/privathaushalte/', 'inhalt' => '<p>x</p>']), 'FAQPage'), []);
});

echo "Ausgabe\n";

pruefe('bösartiger Inhalt kann das Script nicht verlassen, JSON bleibt gültig', function () {
    $boese = '<details><summary>&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt; Frage?</summary>'
        . '<p>Antwort &lt;/SCRIPT&gt; mit \' und " und &amp;</p></details>';
    $json = rgg_json(rgg_graph(['slug' => 'privathaushalte', 'url' => BASIS . '/privathaushalte/', 'inhalt' => $boese]));
    wahr(stripos($json, '</script') === false, 'schließendes script im JSON');
    wahr(stripos($json, '<script') === false, 'öffnendes script im JSON');
    $zurueck = json_decode($json, true);
    gleich(json_last_error(), JSON_ERROR_NONE);
    $frage = knoten($zurueck['@graph'], 'FAQPage')[0]['mainEntity'][0]['name'];
    gleich($frage, '</script><script>alert(1)</script> Frage?');
});

pruefe('Script-Tag fertig zum Ausgeben', function () {
    $tag = rgg_script_tag(rgg_graph(['slug' => 'startseite', 'url' => BASIS . '/', 'inhalt' => '']));
    wahr(str_starts_with($tag, '<script type="application/ld+json" class="robingut-geo">'), 'Anfang');
    wahr(str_ends_with(trim($tag), '</script>'), 'Ende');
    gleich(substr_count(strtolower($tag), '</script'), 1);
});

echo "llms.txt\n";

pruefe('nur der exakte Pfad /llms.txt, Abfrage egal', function () {
    gleich(rgg_ist_llms_pfad('/llms.txt'), true);
    gleich(rgg_ist_llms_pfad('/llms.txt?x=1'), true);
    foreach (['/llms.txt/', '/foo/llms.txt', '/llms.txt.php', '/LLMS.TXT', '/llms', '', '/%2e%2e/llms.txt'] as $pfad) {
        gleich(rgg_ist_llms_pfad($pfad), false, $pfad);
    }
});

pruefe('llms.txt: Markdown, nur bestehende www-Seiten, keine ungedeckten Aussagen', function () {
    $text = (string) file_get_contents(RGG_LLMS_DATEI);
    wahr(str_starts_with($text, "# ROBIN GUT Strom\n"), 'Überschrift');
    preg_match_all('~https://www\.robingut-strom\.de(/[a-z0-9/#-]*)~', $text, $treffer);
    $erlaubt = ['/', '/energy-sharing/', '/privathaushalte/', '/landwirte/', '/organisationen-und-vereine/', '/ueber-uns/', '/fragen-und-antworten/', '/kontakt/', '/impressum/', '/datenschutzerklaerung/'];
    wahr(count($treffer[1]) >= 8, 'zu wenige Links');
    foreach ($treffer[1] as $pfad) {
        wahr(in_array($pfad, $erlaubt, true), "unbekannter Pfad $pfad");
    }
    foreach (VERBOTEN as $verboten) {
        wahr(stripos($text, $verboten) === false, "enthält $verboten");
    }
    ohne_partnerkuerzel($text, 'llms.txt');
});

echo "\n$bestanden Prüfungen bestanden\n";
exit($fehler > 0 ? 1 : 0);
