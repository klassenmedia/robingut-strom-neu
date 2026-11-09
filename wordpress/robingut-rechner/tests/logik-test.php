<?php
// Prüft die reinen Funktionen des Plugins ohne WordPress.
//
//   php wordpress/robingut-rechner/tests/logik-test.php

declare(strict_types=1);

define('ABSPATH', __DIR__);
require __DIR__ . '/../includes/logik.php';

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

$viersen = [
    'price_calculation_id' => 34623,
    'energy_price' => 38.16449,
    'transaction_fee' => 1.19,
    'base_price' => 238.13,
    'monthly_base_price' => 19.84,
    'annual_total' => 1221.99225,
    'annual_consumption_kwh' => 2500,
    'raw_api_energy_price_net' => 7.21,
    'distributor_name' => null,
    'city' => 'Viersen',
];

echo "Preis-Anfrage\n";

pruefe('gültige Anfrage', function () {
    $r = rgr_pruefe_preis_anfrage(['plz' => '41747', 'kwh' => 2500]);
    gleich($r['ok'], true);
    gleich($r['werte'], ['plz' => '41747', 'kwh' => 2500, 'ort' => '', 'strasse' => '', 'hausnummer' => '']);
});

pruefe('Ort wird übernommen, bereinigt und gekürzt', function () {
    $r = rgr_pruefe_preis_anfrage(['plz' => '54636', 'kwh' => 2500, 'ort' => " Bicken\x01dorf "]);
    gleich($r['ok'], true);
    gleich($r['werte']['ort'], 'Bickendorf');
    gleich(mb_strlen(rgr_pruefe_preis_anfrage(['plz' => '54636', 'kwh' => 2500, 'ort' => str_repeat('a', 300)])['werte']['ort']), 100);
    gleich(rgr_pruefe_preis_anfrage(['plz' => '54636', 'kwh' => 2500, 'ort' => ['x']])['ok'], false);
});

pruefe('Straße und Hausnummer werden bereinigt und gekürzt', function () {
    $r = rgr_pruefe_preis_anfrage(['plz' => '41812', 'kwh' => 3500, 'strasse' => " Haupt\x00straße ", 'hausnummer' => str_repeat('9', 40)]);
    gleich($r['ok'], true);
    gleich($r['werte']['strasse'], 'Hauptstraße');
    gleich(strlen($r['werte']['hausnummer']), 20);
});

pruefe('falsche Typen und Werte werden abgelehnt', function () {
    $faelle = [
        [],
        ['plz' => 41747, 'kwh' => 2500],
        ['plz' => ['41747'], 'kwh' => 2500],
        ['plz' => '4174', 'kwh' => 2500],
        ['plz' => '41747a', 'kwh' => 2500],
        ['plz' => "41747\n", 'kwh' => 2500],
        ['plz' => '41747', 'kwh' => '2500'],
        ['plz' => '41747', 'kwh' => 2500.5],
        ['plz' => '41747', 'kwh' => 499],
        ['plz' => '41747', 'kwh' => 100001],
        ['plz' => '41747', 'kwh' => 2500, 'strasse' => ['x']],
        ['plz' => '41747', 'kwh' => 2500, 'hausnummer' => 7],
    ];
    foreach ($faelle as $fall) {
        gleich(rgr_pruefe_preis_anfrage($fall)['ok'], false, json_encode($fall));
    }
});

echo "Straßen-Anfrage\n";

pruefe('gültige Straßensuche', function () {
    $r = rgr_pruefe_strassen_anfrage(['plz' => '41812', 'stadt' => 'Erkelenz', 'suche' => 'Haupt']);
    gleich($r['ok'], true);
    gleich($r['werte'], ['plz' => '41812', 'stadt' => 'Erkelenz', 'suche' => 'Haupt']);
});

pruefe('Straßensuche ohne Stadt oder mit falscher PLZ', function () {
    gleich(rgr_pruefe_strassen_anfrage(['plz' => '41812', 'stadt' => ''])['ok'], false);
    gleich(rgr_pruefe_strassen_anfrage(['plz' => '418', 'stadt' => 'Erkelenz'])['ok'], false);
    gleich(rgr_pruefe_strassen_anfrage(['plz' => ['41812'], 'stadt' => 'Erkelenz'])['ok'], false);
    gleich(strlen(rgr_pruefe_strassen_anfrage(['plz' => '41812', 'stadt' => 'E', 'suche' => str_repeat('a', 99)])['werte']['suche']), 60);
});

echo "Antwort des Partners\n";

pruefe('nur freigegebene Felder werden weitergegeben', function () use ($viersen) {
    $r = rgr_filtere_preis_antwort($viersen, 2500);
    gleich(array_keys($r), ['requires_district_selection', 'energy_price', 'transaction_fee', 'base_price', 'monthly_base_price', 'annual_total', 'annual_consumption_kwh', 'city']);
    gleich($r['annual_total'], 1221.99225);
    gleich($r['requires_district_selection'], false);
});

pruefe('Antwort mit fehlenden oder falschen Zahlen wird verworfen', function () use ($viersen) {
    foreach (['energy_price', 'transaction_fee', 'base_price', 'monthly_base_price', 'annual_total'] as $feld) {
        $kaputt = $viersen;
        $kaputt[$feld] = '38';
        gleich(rgr_filtere_preis_antwort($kaputt, 2500), null, $feld);
        unset($kaputt[$feld]);
        gleich(rgr_filtere_preis_antwort($kaputt, 2500), null, $feld);
    }
    gleich(rgr_filtere_preis_antwort(array_merge($viersen, ['annual_total' => INF]), 2500), null);
    gleich(rgr_filtere_preis_antwort(array_merge($viersen, ['annual_consumption_kwh' => 3500]), 2500), null);
    gleich(rgr_filtere_preis_antwort('kaputt', 2500), null);
    gleich(rgr_filtere_preis_antwort(null, 2500), null);
});

pruefe('Stadt wird von Tags und Steuerzeichen befreit', function () use ($viersen) {
    $r = rgr_filtere_preis_antwort(array_merge($viersen, ['city' => "<img src=x onerror=alert(1)>Vier\x07sen"]), 2500);
    gleich($r['city'], 'Viersen');
    gleich(rgr_filtere_preis_antwort(array_merge($viersen, ['city' => ['x']]), 2500)['city'], '');
});

pruefe('Netzgebiets-Auswahl gibt nur die Stadt weiter, keine Straßenliste', function () {
    $r = rgr_filtere_preis_antwort([
        'requires_district_selection' => true,
        'city' => 'Erkelenz',
        'districts' => ['Nord', 'Süd'],
    ], 2500);
    gleich($r, ['requires_district_selection' => true, 'city' => 'Erkelenz']);
});

pruefe('nur echtes true löst eine Auswahl aus', function () use ($viersen) {
    gleich(rgr_filtere_preis_antwort(['requires_district_selection' => 1, 'city' => 'Erkelenz'], 2500), null);
    gleich(rgr_filtere_preis_antwort(['requires_city_selection' => '1', 'cities' => []], 2500), null);
    gleich(rgr_filtere_preis_antwort(array_merge($viersen, ['requires_district_selection' => false]), 2500)['annual_total'], 1221.99225);
});

pruefe('Aufschlüsselung muss zur Summe passen', function () use ($viersen) {
    gleich(rgr_filtere_preis_antwort(array_merge($viersen, ['monthly_base_price' => 0.01]), 2500), null);
    gleich(rgr_filtere_preis_antwort(array_merge($viersen, ['monthly_base_price' => 19.9]), 2500), null);
    // Summe jeweils passend, damit nur die Spanne des Arbeitspreises greift
    foreach ([10.0, 90.0] as $ct) {
        $stimmig = array_merge($viersen, ['energy_price' => $ct, 'annual_total' => ($ct + 1.19) / 100 * 2500 + 238.13]);
        gleich(rgr_filtere_preis_antwort($stimmig, 2500), null, "$ct ct");
    }
    gleich(rgr_filtere_preis_antwort(array_merge($viersen, ['transaction_fee' => 11.0]), 2500), null);
});

pruefe('Toleranz der Jahressumme: 0,5 % oder mindestens 2 €', function () use ($viersen) {
    // erwartet 1221,99 €; 0,5 % davon sind 6,11 €
    gleich(rgr_filtere_preis_antwort(array_merge($viersen, ['annual_total' => 1221.99225 + 6.0]), 2500) !== null, true);
    gleich(rgr_filtere_preis_antwort(array_merge($viersen, ['annual_total' => 1221.99225 + 6.5]), 2500), null);
    gleich(rgr_filtere_preis_antwort(array_merge($viersen, ['annual_total' => 1221.99225 * 1.05]), 2500), null);
    // kleiner Verbrauch: die Mindesttoleranz von 2 € greift
    $klein = ['energy_price' => 38.0, 'transaction_fee' => 1.0, 'base_price' => 60.0, 'monthly_base_price' => 5.0, 'annual_consumption_kwh' => 500, 'city' => 'X'];
    gleich(rgr_filtere_preis_antwort(array_merge($klein, ['annual_total' => 255.0 + 1.9]), 500) !== null, true);
    gleich(rgr_filtere_preis_antwort(array_merge($klein, ['annual_total' => 255.0 + 2.5]), 500), null);
});

pruefe('Ortsauswahl mit geprüfter Liste', function () {
    $orte = [['plz' => '54636', 'ort' => 'Altenhof'], ['plz' => '54636', 'ort' => '<b>Baustert</b>'], ['ort' => ['x']], 'kaputt', ['plz' => '54636']];
    $r = rgr_filtere_preis_antwort(['requires_city_selection' => true, 'cities' => array_merge($orte, array_fill(0, 300, ['ort' => 'Wiersdorf'])), 'zipcode' => '54636'], 2500);
    gleich($r['requires_city_selection'], true);
    gleich($r['orte'][0], 'Altenhof');
    gleich($r['orte'][1], 'Baustert');
    gleich(count($r['orte']), 200);
    gleich(array_keys($r), ['requires_city_selection', 'orte']);
    gleich(rgr_filtere_preis_antwort(['requires_city_selection' => true, 'cities' => 'x'], 2500)['orte'], []);
});

pruefe('Straßenliste: nur Texte, gekürzt, höchstens 200', function () {
    $r = rgr_filtere_strassen_antwort(['data' => array_merge(['<b>Hauptstraße</b>', 7, ['x'], str_repeat('a', 201)], array_fill(0, 300, 'Weg'))]);
    gleich($r[0], 'Hauptstraße');
    gleich($r[1], 'Weg');
    gleich(count($r), 200);
    gleich(rgr_filtere_strassen_antwort(['data' => 'x']), []);
    gleich(rgr_filtere_strassen_antwort(null), []);
});

echo "Grenzen und Zwischenspeicher\n";

pruefe('Anfragelimit zählt je Schlüssel und sperrt danach', function () {
    $speicher = [];
    $lesen = function (string $k) use (&$speicher) { return $speicher[$k] ?? false; };
    $schreiben = function (string $k, $v, int $s) use (&$speicher) { $speicher[$k] = $v; };
    for ($i = 0; $i < 3; $i++) {
        gleich(rgr_unter_limit($lesen, $schreiben, 'a', 3, 60), true);
    }
    gleich(rgr_unter_limit($lesen, $schreiben, 'a', 3, 60), false);
    gleich(rgr_unter_limit($lesen, $schreiben, 'b', 3, 60), true);
});

pruefe('Anfragelimit öffnet erst nach Ablauf des Fensters wieder', function () {
    $speicher = [];
    $ttl = [];
    $lesen = function (string $k) use (&$speicher) { return $speicher[$k] ?? false; };
    $schreiben = function (string $k, $v, int $s) use (&$speicher, &$ttl) { $speicher[$k] = $v; $ttl[$k] = $s; };
    $start = 1_000_000;
    gleich(rgr_unter_limit($lesen, $schreiben, 'a', 1, 60, $start), true);
    gleich($ttl['a'], 60);
    gleich(rgr_unter_limit($lesen, $schreiben, 'a', 1, 60, $start + 59), false);
    gleich(rgr_unter_limit($lesen, $schreiben, 'a', 1, 60, $start + 60), true);
});

pruefe('Partner-Takt: kleiner Vorrat, dann eine Anfrage je 2 s', function () {
    $speicher = [];
    $lesen = function (string $k) use (&$speicher) { return $speicher[$k] ?? false; };
    $schreiben = function (string $k, $v, int $s) use (&$speicher) { $speicher[$k] = $v; };
    $t = 1_000_000.0;
    $erlaubt = 0;
    for ($i = 0; $i < 10; $i++) {
        $erlaubt += rgr_token_frei($lesen, $schreiben, 'p', RGR_PARTNER_VORRAT, RGR_PARTNER_PRO_SEKUNDE, $t) ? 1 : 0;
    }
    gleich($erlaubt, RGR_PARTNER_VORRAT);
    gleich(rgr_token_frei($lesen, $schreiben, 'p', RGR_PARTNER_VORRAT, RGR_PARTNER_PRO_SEKUNDE, $t + 1.0), false);
    gleich(rgr_token_frei($lesen, $schreiben, 'p', RGR_PARTNER_VORRAT, RGR_PARTNER_PRO_SEKUNDE, $t + 2.0), true);
});

pruefe('Partner-Takt hält auch beim Fensterwechsel unter 50 pro Minute', function () {
    $speicher = [];
    $lesen = function (string $k) use (&$speicher) { return $speicher[$k] ?? false; };
    $schreiben = function (string $k, $v, int $s) use (&$speicher) { $speicher[$k] = $v; };
    $t = 1_000_000.0;
    $zeiten = [];
    for ($ms = 0; $ms < 180_000; $ms += 100) {
        if (rgr_token_frei($lesen, $schreiben, 'p', RGR_PARTNER_VORRAT, RGR_PARTNER_PRO_SEKUNDE, $t + $ms / 1000)) {
            $zeiten[] = $ms;
        }
    }
    $hoechstens = 0;
    foreach ($zeiten as $beginn) {
        $hoechstens = max($hoechstens, count(array_filter($zeiten, fn($z) => $z >= $beginn && $z < $beginn + 60_000)));
    }
    gleich($hoechstens <= 35, true, "höchstens $hoechstens in 60 s");
    gleich(RGR_PARTNER_VORRAT, 5);
    gleich(RGR_PARTNER_PRO_SEKUNDE, 0.5);
});

echo "Herkunft\n";

pruefe('fremde Websites werden erkannt, eigene und leere Herkunft nicht', function () {
    gleich(rgr_fremde_herkunft('https://evil.example', 'www.robingut-strom.de'), true);
    gleich(rgr_fremde_herkunft('https://robingut-strom.de.evil.example', 'www.robingut-strom.de'), true);
    gleich(rgr_fremde_herkunft('null', 'www.robingut-strom.de'), true);
    gleich(rgr_fremde_herkunft('https://www.robingut-strom.de', 'www.robingut-strom.de'), false);
    gleich(rgr_fremde_herkunft('https://robingut-strom.de', 'www.robingut-strom.de'), false);
    gleich(rgr_fremde_herkunft(null, 'www.robingut-strom.de'), false);
    gleich(rgr_fremde_herkunft('', 'www.robingut-strom.de'), false);
    gleich(rgr_fremde_herkunft('https://WWW.ROBINGUT-STROM.DE', 'www.robingut-strom.de'), false);
    gleich(rgr_fremde_herkunft('https://robingut-strom.www.de', 'www.robingut-strom.de'), true);
});

pruefe('Abruf-Art: nur gleiche Seite, kein JSONP', function () {
    gleich(rgr_fremder_abruf('cross-site', []), true);
    gleich(rgr_fremder_abruf('same-origin', []), false);
    gleich(rgr_fremder_abruf('same-site', []), false);
    gleich(rgr_fremder_abruf(null, []), false);
    gleich(rgr_fremder_abruf('none', []), true);
    gleich(rgr_fremder_abruf(null, ['_jsonp' => 'cb']), true);
    gleich(rgr_fremder_abruf('same-origin', ['_jsonp' => '']), true);
});

pruefe('Partner-Takt: Uhr zurückgestellt bringt keinen neuen Vorrat', function () {
    $speicher = [];
    $lesen = function (string $k) use (&$speicher) { return $speicher[$k] ?? false; };
    $schreiben = function (string $k, $v, int $s) use (&$speicher) { $speicher[$k] = $v; };
    $t = 1_000_000.0;
    $erlaubt = 0;
    for ($i = 0; $i < 60; $i++) {
        // zwei Knoten mit 30 s Uhrversatz im Wechsel, alle 0,1 s eine Anfrage
        $uhr = $t + $i * 0.1 + ($i % 2 === 0 ? 0.0 : -30.0);
        $erlaubt += rgr_token_frei($lesen, $schreiben, 'p', 5, 0.5, $uhr) ? 1 : 0;
    }
    gleich($erlaubt <= 8, true, "$erlaubt erlaubt");
});

pruefe('Schlüssel hängt nur an den geprüften Werten und verrät sie nicht', function () {
    $a = rgr_cache_schluessel('preis', ['plz' => '41747', 'kwh' => 2500]);
    gleich($a, rgr_cache_schluessel('preis', ['plz' => '41747', 'kwh' => 2500]));
    gleich($a === rgr_cache_schluessel('preis', ['plz' => '41747', 'kwh' => 3500]), false);
    gleich(strpos($a, '41747'), false);
    gleich(strlen($a) <= 172, true);
});

pruefe('IP-Schlüssel nur aus gültiger Adresse und mit geheimem Salz', function () {
    gleich(rgr_ip_schluessel('203.0.113.5', 's') === rgr_ip_schluessel('203.0.113.6', 's'), false);
    gleich(strpos(rgr_ip_schluessel('203.0.113.5', 's'), '203'), false);
    gleich(rgr_ip_schluessel('kein-ip', 's'), rgr_ip_schluessel('', 's'));
    gleich(rgr_ip_schluessel('203.0.113.5', 'a') === rgr_ip_schluessel('203.0.113.5', 'b'), false);
});

pruefe('IPv4 in IPv6-Schreibweise zählt wie die IPv4-Adresse', function () {
    gleich(rgr_ip_schluessel('::ffff:1.2.3.4', 's'), rgr_ip_schluessel('1.2.3.4', 's'));
    gleich(rgr_ip_schluessel('::ffff:1.2.3.4', 's') === rgr_ip_schluessel('::ffff:5.6.7.8', 's'), false);
});

pruefe('IPv6 wird je /64-Netz gezählt', function () {
    gleich(rgr_ip_schluessel('2001:db8:1:2::1', 's'), rgr_ip_schluessel('2001:db8:1:2:ffff:ffff:ffff:ffff', 's'));
    gleich(rgr_ip_schluessel('2001:db8:1:2::1', 's') === rgr_ip_schluessel('2001:db8:1:3::1', 's'), false);
});

pruefe('überlange Texte werden vor dem Bereinigen gekürzt', function () {
    gleich(mb_strlen(rgr_text(str_repeat('ä', 100000), 100)), 100);
});

pruefe('Unicode-Steuer- und Richtungszeichen werden entfernt', function () {
    gleich(rgr_text("Haupt\u{202E}straße\u{200B}", 100), 'Hauptstraße');
});

pruefe('Straßensuche braucht mindestens zwei Zeichen', function () {
    gleich(rgr_pruefe_strassen_anfrage(['plz' => '41812', 'stadt' => 'Erkelenz', 'suche' => 'K'])['werte']['suche'], 'K');
    gleich(rgr_suche_lang_genug('K'), false);
    gleich(rgr_suche_lang_genug('Kö'), true);
});

echo "Erzeuger\n";

$anlage = ['art' => 'pv', 'kwp' => 100, 'kwh' => 66500, 'einspeisung' => 'teil', 'foerderung' => false];

pruefe('gültige Erzeuger-Anfrage wird für den Partner übersetzt', function () use ($anlage) {
    $g = rgr_pruefe_erzeuger_anfrage($anlage);
    gleich($g['ok'], true);
    gleich($g['werte'], ['art' => 'pv', 'kwp' => 100.0, 'kwh' => 66500, 'einspeisung' => 'teil', 'foerderung' => false]);
    gleich(rgr_erzeuger_nutzlast($g['werte']), [
        'pricing_model_id' => '77', 'erzeugungsart' => 'pv', 'nennleistung_kwp' => '100',
        'einspeiseart' => 'teil', 'einspeisemenge_kwh' => '66500', 'foerderung' => '0',
    ]);
});

pruefe('Anlagenarten werden auf die Werte des Partners abgebildet', function () use ($anlage) {
    foreach (['pv' => 'pv', 'wind' => 'wind', 'wasser' => 'water', 'biogas' => 'chp'] as $art => $partner) {
        $g = rgr_pruefe_erzeuger_anfrage(['art' => $art] + $anlage);
        gleich(rgr_erzeuger_nutzlast($g['werte'])['erzeugungsart'], $partner, $art);
    }
    gleich(rgr_erzeuger_nutzlast(rgr_pruefe_erzeuger_anfrage(['kwp' => 9.8, 'foerderung' => true] + $anlage)['werte'])['nennleistung_kwp'], '9.8');
    gleich(rgr_erzeuger_nutzlast(rgr_pruefe_erzeuger_anfrage(['foerderung' => true] + $anlage)['werte'])['foerderung'], '1');
});

pruefe('falsche Erzeuger-Eingaben werden abgelehnt', function () use ($anlage) {
    $falsch = [
        ['art' => 'chp'], ['art' => 'PV'], ['art' => ['pv']], ['art' => null],
        ['kwp' => '100'], ['kwp' => 0.5], ['kwp' => 1000.1], ['kwp' => NAN], ['kwp' => INF], ['kwp' => 9.85], ['kwp' => true],
        ['kwh' => 66500.5], ['kwh' => '66500'], ['kwh' => 99], ['kwh' => 10000001],
        ['einspeisung' => 'halb'], ['einspeisung' => ''],
        ['foerderung' => 'nein'], ['foerderung' => 0],
    ];
    foreach ($falsch as $aenderung) {
        gleich(rgr_pruefe_erzeuger_anfrage($aenderung + $anlage)['ok'], false, var_export($aenderung, true));
    }
    gleich(rgr_pruefe_erzeuger_anfrage([])['ok'], false);
});

$wse = ['success' => true, 'individual_offer' => false, 'data' => [
    'redispatch_fee' => 20, 'remote_control_fee' => 11, 'forecast_fee' => 15, 'balancing_risk_fee' => 24.38,
    'feeder_base_price_margin' => 25, 'grundgebuehr_monatlich' => 95.38, 'marketing_fee_ct_kwh' => 0.2, 'setup_fee' => 390,
]];

pruefe('Erzeuger-Antwort: nur Grundpreis, Vermarktung und Einrichtung', function () use ($wse) {
    gleich(rgr_filtere_erzeuger_antwort($wse), ['individuell' => false, 'grund_monat' => 95.38, 'vermarktung_ct' => 0.2, 'einrichtung' => 390.0]);
    gleich(rgr_filtere_erzeuger_antwort(['success' => true, 'individual_offer' => true]), ['individuell' => true]);
});

pruefe('Erzeuger-Antwort mit fehlenden oder unplausiblen Werten wird verworfen', function () use ($wse) {
    $kaputt = [
        null, 'x', [], ['success' => false] + $wse, ['individual_offer' => 'ja'] + $wse, ['individual_offer' => null, 'success' => true, 'data' => $wse['data']],
        array_replace_recursive($wse, ['data' => ['grundgebuehr_monatlich' => '95,38']]),
        array_replace_recursive($wse, ['data' => ['grundgebuehr_monatlich' => -1]]),
        array_replace_recursive($wse, ['data' => ['grundgebuehr_monatlich' => 2001]]),
        array_replace_recursive($wse, ['data' => ['marketing_fee_ct_kwh' => 5.5]]),
        array_replace_recursive($wse, ['data' => ['setup_fee' => 10001]]),
        ['success' => true, 'individual_offer' => false, 'data' => 'kein Feld'],
    ];
    foreach ($kaputt as $i => $daten) {
        gleich(rgr_filtere_erzeuger_antwort($daten), null, "Fall $i");
    }
});

echo "\n$bestanden Prüfungen bestanden\n";
exit($fehler > 0 ? 1 : 0);
