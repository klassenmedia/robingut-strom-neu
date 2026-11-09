<?php
// Prüft die REST-Routen mit WordPress-Attrappe und vorgegebenen Partner-Antworten.
//
//   php wordpress/robingut-rechner/tests/routen-test.php

declare(strict_types=1);

define('RGR_WSE_BASIS', 'https://partner.test/api');
require __DIR__ . '/harness/wp-attrappe.php';
require dirname(__DIR__) . '/robingut-rechner.php';

$bestanden = 0;
$fehler = 0;
function pruefe(string $name, callable $fn): void
{
    global $bestanden, $fehler;
    $ordner = sys_get_temp_dir() . '/rgr-routen-' . getmypid() . '-' . mt_rand();
    putenv("RGR_ATTRAPPE_ORDNER=$ordner");
    $_SERVER['REMOTE_ADDR'] = '203.0.113.10';
    $GLOBALS['rgr_partner_aufrufe'] = [];
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(200, viersen(2500));
    $GLOBALS['wpdb']->sperreVerweigern = false;
    try {
        $fn();
        $bestanden++;
        echo "  ok  $name\n";
    } catch (Throwable $e) {
        $fehler++;
        echo "  FEHLER  $name\n        {$e->getMessage()}\n";
    } finally {
        array_map('unlink', glob("$ordner/*") ?: []);
        @rmdir($ordner);
    }
}
function gleich($ist, $soll, string $info = ''): void
{
    if ($ist !== $soll) {
        throw new Exception(var_export($ist, true) . ' statt ' . var_export($soll, true) . " $info");
    }
}
function viersen(int $kwh): array
{
    return [
        'price_calculation_id' => 1, 'energy_price' => 38.16449, 'transaction_fee' => 1.19,
        'base_price' => 238.13, 'monthly_base_price' => 19.84,
        'annual_total' => (38.16449 + 1.19) / 100 * $kwh + 238.13,
        'annual_consumption_kwh' => $kwh, 'raw_api_energy_price_net' => 7.21, 'city' => 'Viersen',
    ];
}
function antwort(int $code, $daten, array $kopf = []): array
{
    return ['code' => $code, 'body' => is_string($daten) ? $daten : json_encode($daten), 'headers' => $kopf];
}
function preis(array $body, array $kopf = []): WP_REST_Response
{
    return rgr_route_preis(new WP_REST_Request($body, [], $kopf, '/robingut-rechner/v1/preis'));
}
function strassen(array $body, array $kopf = [], array $query = []): WP_REST_Response
{
    return rgr_route_strassen(new WP_REST_Request($body, $query, $kopf, '/robingut-rechner/v1/strassen'));
}
function aufrufe(): int
{
    return count($GLOBALS['rgr_partner_aufrufe']);
}
function partner_kwh_aus_anfrage(): callable
{
    return function ($m, $u, $args) {
        $body = json_decode($args['body'], true);
        return antwort(200, viersen($body['annual_consumption_kwh']));
    };
}

echo "Preis-Route\n";

pruefe('Preis kommt gefiltert und ohne Caching im Browser', function () {
    $r = preis(['plz' => '41747', 'kwh' => 2500]);
    gleich($r->status, 200);
    gleich(isset($r->daten['price_calculation_id']), false);
    gleich(isset($r->daten['raw_api_energy_price_net']), false);
    gleich($r->daten['annual_consumption_kwh'], 2500);
    gleich($r->kopf['Cache-Control'], 'no-store');
    gleich($r->kopf['Expires'], '0');
});

pruefe('Anfrage an den Partner: feste URL, Slug, Zeit- und Größenlimit, keine Umleitung', function () {
    preis(['plz' => '41747', 'kwh' => 2500, 'ort' => 'Viersen']);
    $a = $GLOBALS['rgr_partner_aufrufe'][0];
    gleich($a['methode'], 'POST');
    gleich($a['url'], 'https://partner.test/api/calculate-price');
    gleich($a['args']['timeout'], 6);
    gleich($a['args']['redirection'], 0);
    gleich($a['args']['limit_response_size'], 200000);
    $body = json_decode($a['args']['body'], true);
    gleich($body['slug'], 'robin-gut-strom');
    gleich($body['city'], 'Viersen');
    gleich(isset($body['street']), false);
});

pruefe('fremde Website wird abgewiesen, eigene nicht', function () {
    gleich(preis(['plz' => '41747', 'kwh' => 2500], ['origin' => 'https://evil.example'])->status, 403);
    gleich(aufrufe(), 0);
    gleich(preis(['plz' => '41747', 'kwh' => 2500], ['origin' => 'http://localhost:8765'])->status, 200);
});

pruefe('ungültige Eingaben fragen den Partner nicht', function () {
    foreach ([[], ['plz' => '4174', 'kwh' => 2500], ['plz' => '41747', 'kwh' => '2500']] as $body) {
        gleich(preis($body)->status, 400, json_encode($body));
    }
    gleich(rgr_route_preis(new WP_REST_Request(null, [], [], '/robingut-rechner/v1/preis'))->status, 400);
    gleich(aufrufe(), 0);
});

pruefe('Zwischenspeicher: gleiche Anfrage fragt den Partner nur einmal', function () {
    preis(['plz' => '41747', 'kwh' => 2500]);
    $zweite = preis(['plz' => '41747', 'kwh' => 2500]);
    gleich($zweite->status, 200);
    gleich(aufrufe(), 1);
});

pruefe('adressgenaue Anfragen werden nicht gespeichert', function () {
    $body = ['plz' => '41812', 'kwh' => 2500, 'strasse' => 'Kölner Str.', 'hausnummer' => '10'];
    preis($body);
    preis($body);
    gleich(aufrufe(), 2);
    $gesendet = json_decode($GLOBALS['rgr_partner_aufrufe'][0]['args']['body'], true);
    gleich($gesendet['street'], 'Kölner Str.');
    gleich($gesendet['house_number'], '10');
});

pruefe('Limit je IP: danach 429, X-Forwarded-For ändert nichts', function () {
    set_transient(rgr_besucher_schluessel('preis'), ['n' => RGR_LIMIT_PREIS_IP_STUNDE, 'bis' => time() + 3600], 3600);
    $_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.7';
    $status = preis(['plz' => '41747', 'kwh' => 2500], ['x-forwarded-for' => '198.51.100.7'])->status;
    unset($_SERVER['HTTP_X_FORWARDED_FOR']);
    gleich($status, 429);
    gleich(aufrufe(), 0);
    $_SERVER['REMOTE_ADDR'] = '203.0.113.11';
    gleich(preis(['plz' => '41747', 'kwh' => 2500])->status, 200);
});

pruefe('Treffer im Zwischenspeicher zählen nicht gegen das IP-Limit', function () {
    preis(['plz' => '41747', 'kwh' => 2500]);
    set_transient(rgr_besucher_schluessel('preis'), ['n' => RGR_LIMIT_PREIS_IP_STUNDE, 'bis' => time() + 3600], 3600);
    gleich(preis(['plz' => '41747', 'kwh' => 2500])->status, 200);
});

pruefe('Partner-Takt: nach dem Vorrat 503 ohne Partner-Aufruf', function () {
    $GLOBALS['rgr_partner_antwort'] = partner_kwh_aus_anfrage();
    $status = [];
    for ($i = 0; $i < RGR_PARTNER_VORRAT + 3; $i++) {
        $_SERVER['REMOTE_ADDR'] = '203.0.113.' . (20 + $i);
        $status[] = preis(['plz' => '41747', 'kwh' => 1000 + $i])->status;
    }
    // Fester Wert statt Konstante: höchstens 5 Partner-Aufrufe auf einen Schlag
    gleich(count(array_filter($status, fn($s) => $s === 200)), 5);
    gleich(array_slice($status, -3), [503, 503, 503]);
    gleich(aufrufe(), 5);
});

pruefe('ohne Sperre wird abgelehnt (fail closed)', function () {
    $GLOBALS['wpdb']->sperreVerweigern = true;
    gleich(preis(['plz' => '41747', 'kwh' => 2500])->status, 429);
    gleich(aufrufe(), 0);
});

pruefe('Partnerfehler: 502 und kurz gespeichert', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(500, ['error' => 'calculation_failed']);
    gleich(preis(['plz' => '41747', 'kwh' => 2500])->status, 502);
    gleich(preis(['plz' => '41747', 'kwh' => 2500])->status, 502);
    gleich(aufrufe(), 1);
    gleich($GLOBALS['rgr_transient_ttl'][rgr_cache_schluessel('preis', rgr_pruefe_preis_anfrage(['plz' => '41747', 'kwh' => 2500])['werte'])], 60);
});

pruefe('Zeitüberschreitung beim Partner: 502', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => new WP_Error();
    gleich(preis(['plz' => '41747', 'kwh' => 2500])->status, 502);
});

pruefe('unbekannte PLZ: 404 mit verständlicher Meldung', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(404, ['message' => 'Keine Stadt gefunden']);
    $r = preis(['plz' => '99999', 'kwh' => 2500]);
    gleich($r->status, 404);
    gleich(str_contains($r->daten['fehler'], 'keinen Tarif'), true);
});

pruefe('429 vom Partner: gemeinsame Pause, danach kein Aufruf', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(429, ['message' => 'Too Many'], ['retry-after' => '120']);
    gleich(preis(['plz' => '41747', 'kwh' => 2500])->status, 502);
    gleich(get_transient('rgr_partner_pause'), 1);
    gleich($GLOBALS['rgr_transient_ttl']['rgr_partner_pause'], 120);
    gleich(preis(['plz' => '41747', 'kwh' => 3000])->status, 503);
    gleich(aufrufe(), 1);
});

pruefe('unplausible Partner-Antwort wird nicht als Preis gespeichert', function () {
    $falsch = viersen(2500);
    $falsch['monthly_base_price'] = 0.01;
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(200, $falsch);
    gleich(preis(['plz' => '41747', 'kwh' => 2500])->status, 502);
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(200, 'kein json');
    gleich(preis(['plz' => '41747', 'kwh' => 3000])->status, 502);
});

echo "Straßen-Route\n";

pruefe('Straßen gefiltert, Werte in der URL kodiert', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(200, ['data' => ['<b>Kölner Str.</b>', 5, 'Kölner Heerweg']]);
    $r = strassen(['plz' => '41812', 'stadt' => 'Erk&x=y', 'suche' => 'Köl']);
    gleich($r->status, 200);
    gleich($r->daten['strassen'], ['Kölner Str.', 'Kölner Heerweg']);
    $url = $GLOBALS['rgr_partner_aufrufe'][0]['url'];
    gleich(str_starts_with($url, 'https://partner.test/api/streets?'), true);
    gleich(str_contains($url, 'city=Erk%26x%3Dy'), true);
});

pruefe('Straßen: fremde Website 403, fehlende Stadt 400, Partnerfehler 502', function () {
    gleich(strassen(['plz' => '41812', 'stadt' => 'Erkelenz'], ['origin' => 'https://evil.example'])->status, 403);
    gleich(strassen(['plz' => '41812'])->status, 400);
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(500, 'x');
    gleich(strassen(['plz' => '41812', 'stadt' => 'Erkelenz', 'suche' => 'Kö'])->status, 502);
});

pruefe('Straßen: Limit je IP', function () {
    set_transient(rgr_besucher_schluessel('strassen'), ['n' => RGR_LIMIT_STRASSEN_IP_STUNDE, 'bis' => time() + 3600], 3600);
    gleich(strassen(['plz' => '41812', 'stadt' => 'Erkelenz', 'suche' => 'Kö'])->status, 429);
    gleich(aufrufe(), 0);
});

pruefe('Straßen: kurze Suche fragt den Partner nicht', function () {
    $r = strassen(['plz' => '41812', 'stadt' => 'Erkelenz', 'suche' => 'K']);
    gleich($r->status, 200);
    gleich($r->daten['strassen'], []);
    gleich(aufrufe(), 0);
});

pruefe('Straßen: Werte kommen nur aus dem JSON-Body, nicht aus der URL', function () {
    gleich(strassen([], [], ['plz' => '41812', 'stadt' => 'Erkelenz', 'suche' => 'Kö'])->status, 400);
    gleich(aufrufe(), 0);
});

echo "Fremde Abrufe\n";

pruefe('Sec-Fetch-Site cross-site wird bei beiden Routen abgewiesen', function () {
    gleich(preis(['plz' => '41747', 'kwh' => 2500], ['sec-fetch-site' => 'cross-site'])->status, 403);
    gleich(strassen(['plz' => '41812', 'stadt' => 'Erkelenz', 'suche' => 'Kö'], ['sec-fetch-site' => 'cross-site'])->status, 403);
    gleich(aufrufe(), 0);
    gleich(preis(['plz' => '41747', 'kwh' => 2500], ['sec-fetch-site' => 'same-origin'])->status, 200);
});

pruefe('JSONP-Parameter wird abgewiesen', function () {
    gleich(rgr_route_preis(new WP_REST_Request(['plz' => '41747', 'kwh' => 2500], ['_jsonp' => 'cb'], [], '/robingut-rechner/v1/preis'))->status, 403);
    gleich(strassen(['plz' => '41812', 'stadt' => 'Erkelenz', 'suche' => 'Kö'], [], ['_jsonp' => 'cb'])->status, 403);
    gleich(aufrufe(), 0);
});

pruefe('CORS-Entfernung hängt nach dem Core-Filter und nur an unseren Routen', function () {
    $treffer = array_values(array_filter($GLOBALS['rgr_filter'], fn($f) => $f['hook'] === 'rest_pre_serve_request' && $f['fn'] === 'rgr_ohne_cors'));
    gleich(count($treffer), 1);
    gleich($treffer[0]['prio'] > 10, true);
    gleich($treffer[0]['args'], 3);
    gleich(rgr_ist_eigene_route(new WP_REST_Request(null, [], [], '/robingut-rechner/v1/preis')), true);
    gleich(rgr_ist_eigene_route(new WP_REST_Request(null, [], [], '/wp/v2/posts')), false);
    gleich(rgr_ist_eigene_route(new WP_REST_Request(null, [], [], '/robingut-rechner/v10/preis')), false);
    gleich(rgr_ist_eigene_route(new WP_REST_Request(null, [], [], '/Robingut-Rechner/v1/preis')), true);
});

pruefe('beide Routen sind nur per POST registriert und öffentlich', function () {
    rgr_registriere_routen();
    foreach (['robingut-rechner/v1/preis', 'robingut-rechner/v1/strassen'] as $route) {
        gleich($GLOBALS['rgr_routen'][$route]['methods'] ?? null, 'POST', $route);
        gleich($GLOBALS['rgr_routen'][$route]['permission_callback'] ?? null, '__return_true', $route);
    }
});

pruefe('Rechner ruft die REST-Route relativ auf, damit es same-origin bleibt', function () {
    $html = rgr_shortcode();
    gleich(str_contains($html, 'data-rest="/wp-json/robingut-rechner/v1/"'), true);
});

pruefe('Fehler der Datenbank-Sperre (NULL) gilt als nicht gesperrt', function () {
    $GLOBALS['wpdb']->sperreVerweigern = null;
    gleich(preis(['plz' => '41747', 'kwh' => 2500])->status, 429);
    gleich(aufrufe(), 0);
});

pruefe('adressgenaue Anfrage hinterlässt keinen Eintrag im Zwischenspeicher', function () {
    $body = ['plz' => '41812', 'kwh' => 2500, 'strasse' => 'Kölner Str.', 'hausnummer' => '10'];
    preis($body);
    $schluessel = rgr_cache_schluessel('preis', rgr_pruefe_preis_anfrage($body)['werte']);
    gleich(get_transient($schluessel), false);
    gleich(isset($GLOBALS['rgr_transient_ttl'][$schluessel]), false);
});

pruefe('Pause nach 429 höchstens 5 Minuten', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(429, [], ['retry-after' => '99999']);
    preis(['plz' => '41747', 'kwh' => 2500]);
    gleich($GLOBALS['rgr_transient_ttl']['rgr_partner_pause'], 300);
});

echo "Erzeuger-Route\n";

function wse_erzeuger(float $grund = 95.38, bool $individuell = false): array
{
    return $individuell ? ['success' => true, 'individual_offer' => true] : ['success' => true, 'individual_offer' => false, 'data' => [
        'redispatch_fee' => 20, 'remote_control_fee' => 11, 'forecast_fee' => 15, 'balancing_risk_fee' => 24.38,
        'feeder_base_price_margin' => 25, 'grundgebuehr_monatlich' => $grund, 'marketing_fee_ct_kwh' => 0.2, 'setup_fee' => 390,
    ]];
}
function erzeuger(array $body, array $kopf = []): WP_REST_Response
{
    return rgr_route_erzeuger(new WP_REST_Request($body, [], $kopf, '/robingut-rechner/v1/erzeuger'));
}
const ANLAGE = ['art' => 'pv', 'kwp' => 100, 'kwh' => 66500, 'einspeisung' => 'teil', 'foerderung' => false];

pruefe('Erzeugerkosten kommen gefiltert und ohne Caching im Browser', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(200, wse_erzeuger());
    $r = erzeuger(ANLAGE);
    gleich($r->status, 200);
    gleich($r->daten, ['individuell' => false, 'grund_monat' => 95.38, 'vermarktung_ct' => 0.2, 'einrichtung' => 390.0]);
    gleich($r->kopf['Cache-Control'] ?? null, 'no-store');
});

pruefe('Erzeuger-Anfrage an den Partner: feste URL und festes Preismodell', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(200, wse_erzeuger());
    erzeuger(['art' => 'biogas'] + ANLAGE);
    $a = $GLOBALS['rgr_partner_aufrufe'][0];
    gleich($a['methode'], 'POST');
    gleich($a['url'], 'https://partner.test/api/direktvermarktung/calculate-price');
    gleich($a['args']['redirection'], 0);
    gleich($a['args']['limit_response_size'], 200000);
    gleich(json_decode($a['args']['body'], true), [
        'pricing_model_id' => '77', 'erzeugungsart' => 'chp', 'nennleistung_kwp' => '100',
        'einspeiseart' => 'teil', 'einspeisemenge_kwh' => '66500', 'foerderung' => '0',
    ]);
});

pruefe('Erzeuger: fremde Website 403, ungültige Eingabe 400, beides ohne Partner-Aufruf', function () {
    gleich(erzeuger(ANLAGE, ['origin' => 'https://evil.example'])->status, 403);
    gleich(erzeuger(ANLAGE, ['sec-fetch-site' => 'cross-site'])->status, 403);
    gleich(erzeuger(['kwp' => 5000] + ANLAGE)->status, 400);
    gleich(erzeuger(['art' => '<script>'] + ANLAGE)->status, 400);
    gleich(aufrufe(), 0);
});

pruefe('Erzeuger: gleiche Anfrage fragt den Partner nur einmal', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(200, wse_erzeuger());
    erzeuger(ANLAGE);
    gleich(erzeuger(ANLAGE)->status, 200);
    gleich(aufrufe(), 1);
});

pruefe('Erzeuger: Limit je IP, danach 429 ohne Partner-Aufruf', function () {
    set_transient(rgr_besucher_schluessel('erzeuger'), ['n' => RGR_LIMIT_ERZEUGER_IP_STUNDE, 'bis' => time() + 3600], 3600);
    gleich(erzeuger(ANLAGE)->status, 429);
    gleich(aufrufe(), 0);
});

pruefe('Erzeuger: teilt den Partner-Takt mit dem Verbraucherpreis', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(200, wse_erzeuger());
    $status = [];
    for ($i = 0; $i < RGR_PARTNER_VORRAT + 2; $i++) {
        $_SERVER['REMOTE_ADDR'] = '203.0.113.' . (60 + $i);
        $status[] = erzeuger(['kwh' => 60000 + $i] + ANLAGE)->status;
    }
    gleich(array_slice($status, -2), [503, 503]);
    gleich(aufrufe(), 5);
});

pruefe('Erzeuger: individuelles Angebot wird durchgereicht', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(200, wse_erzeuger(0, true));
    gleich(erzeuger(['kwp' => 1000] + ANLAGE)->daten, ['individuell' => true]);
});

pruefe('Erzeuger: Partnerfehler und unplausible Antwort ergeben 502', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(500, []);
    gleich(erzeuger(ANLAGE)->status, 502);
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(200, wse_erzeuger(99999));
    gleich(erzeuger(['kwh' => 70000] + ANLAGE)->status, 502);
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(422, ['message' => 'Der gewählte Wert ist ungültig.']);
    $r = erzeuger(['kwh' => 71000] + ANLAGE);
    gleich($r->status, 502);
    gleich(str_contains(json_encode($r->daten), 'gewählte'), false);
});

pruefe('Erzeuger-Route ist nur per POST registriert und öffentlich', function () {
    rgr_registriere_routen();
    gleich($GLOBALS['rgr_routen']['robingut-rechner/v1/erzeuger']['methods'] ?? null, 'POST');
    gleich($GLOBALS['rgr_routen']['robingut-rechner/v1/erzeuger']['permission_callback'] ?? null, '__return_true');
});

pruefe('Erzeuger: IP-Limit liegt bei 40 je Stunde', function () {
    gleich(RGR_LIMIT_ERZEUGER_IP_STUNDE, 40);
});

pruefe('Erzeuger: Fehler wird nur 60 s gespeichert, Erfolg 6 h', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(500, wse_erzeuger());
    erzeuger(ANLAGE);
    $fehler_schluessel = rgr_cache_schluessel('erzeuger', rgr_pruefe_erzeuger_anfrage(ANLAGE)['werte']);
    gleich($GLOBALS['rgr_transient_ttl'][$fehler_schluessel], 60);
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(200, wse_erzeuger());
    $ok = ['kwh' => 50000] + ANLAGE;
    erzeuger($ok);
    gleich($GLOBALS['rgr_transient_ttl'][rgr_cache_schluessel('erzeuger', rgr_pruefe_erzeuger_anfrage($ok)['werte'])], 6 * 3600);
});

pruefe('Erzeuger: Status 500 mit gültigem Body ergibt 502', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(500, wse_erzeuger());
    gleich(erzeuger(ANLAGE)->status, 502);
});

pruefe('Erzeuger: Voll- und Teileinspeisung haben eigene Einträge im Zwischenspeicher', function () {
    $GLOBALS['rgr_partner_antwort'] = fn() => antwort(200, wse_erzeuger());
    erzeuger(ANLAGE);
    erzeuger(['einspeisung' => 'voll'] + ANLAGE);
    erzeuger(['foerderung' => true] + ANLAGE);
    erzeuger(['art' => 'wind'] + ANLAGE);
    gleich(aufrufe(), 4);
});

pruefe('Preis: ab 100.000 kWh lehnt der Server ab (individuelles Angebot)', function () {
    $GLOBALS['rgr_partner_antwort'] = partner_kwh_aus_anfrage();
    gleich(preis(['plz' => '41747', 'kwh' => 100000])->status, 400);
    gleich(aufrufe(), 0);
    gleich(preis(['plz' => '41747', 'kwh' => 99999])->status, 200);
});

echo "Shortcode\n";

pruefe('Shortcode: unbekannte Anrede fällt auf du zurück', function () {
    gleich(str_contains(rgr_shortcode(['anrede' => 'sie']), 'Was möchten Sie?'), true);
    gleich(str_contains(rgr_shortcode(['anrede' => 'Sie']), 'Was möchtest du?'), true);
    gleich(str_contains(rgr_shortcode(['anrede' => '<b>']), 'Was möchtest du?'), true);
});

pruefe('Shortcode: Rolle aus der Liste vorbelegt, sonst Strom beziehen', function () {
    gleich(str_contains(rgr_shortcode(['rolle' => 'einspeisen']), 'value="einspeisen" checked'), true);
    gleich(str_contains(rgr_shortcode(['rolle' => 'beides']), 'value="beides" checked'), true);
    gleich(str_contains(rgr_shortcode([]), 'value="beziehen" checked'), true);
    $boese = rgr_shortcode(['rolle' => '"><script>alert(1)</script>']);
    gleich(str_contains($boese, '<script>alert'), false);
    gleich(str_contains($boese, 'value="beziehen" checked'), true);
});

pruefe('Shortcode zeigt keine Mailadresse und keinen Pfeil im Anmeldeknopf', function () {
    $html = rgr_shortcode(['rolle' => 'beides']);
    gleich(preg_match('/@robingut-strom\.de|@robin-gut\.org/', $html), 0);
    gleich(str_contains($html, '↗'), false);
});

echo "\n$bestanden Prüfungen bestanden\n";
exit($fehler > 0 ? 1 : 0);
