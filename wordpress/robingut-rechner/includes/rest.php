<?php
// REST-Routen: fragen die Preis-API des Partners serverseitig an, weil sie Browser-Aufrufe
// von fremden Domains per CORS ablehnt.

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('RGR_WSE_BASIS')) {
    define('RGR_WSE_BASIS', 'https://weshareenergy.de/api');
}
const RGR_WSE_SLUG = 'robin-gut-strom';
const RGR_NAMENSRAUM = 'robingut-rechner/v1';
const RGR_ZEITLIMIT_SEKUNDEN = 6;
const RGR_ANTWORT_MAX_BYTES = 200000;
const RGR_CACHE_SEKUNDEN = 6 * HOUR_IN_SECONDS;
const RGR_FEHLER_CACHE_SEKUNDEN = 60;
const RGR_UNBEKANNT_CACHE_SEKUNDEN = HOUR_IN_SECONDS;
const RGR_PAUSE_MAX_SEKUNDEN = 300;
const RGR_LIMIT_PREIS_IP_STUNDE = 40;
const RGR_LIMIT_STRASSEN_IP_STUNDE = 80;
const RGR_LIMIT_ERZEUGER_IP_STUNDE = 40;
const RGR_MELDUNG_ERZEUGER = 'Die Kosten für Erzeuger sind gerade nicht erreichbar.';
const RGR_SPERRE_SEKUNDEN = 2;
const RGR_MELDUNG_VIEL = 'Gerade sind es zu viele Anfragen. Bitte gleich noch einmal versuchen.';
const RGR_MELDUNG_PARTNER = 'Die Preise unseres Partners sind gerade nicht erreichbar.';
const RGR_MELDUNG_UNBEKANNT = 'Zu dieser Postleitzahl haben wir keinen Tarif gefunden. Bitte die Eingabe prüfen.';

add_action('rest_api_init', 'rgr_registriere_routen');
add_filter('rest_pre_serve_request', 'rgr_ohne_cors', 20, 3);

function rgr_registriere_routen(): void
{
    register_rest_route(RGR_NAMENSRAUM, '/preis', [
        'methods' => 'POST',
        'callback' => 'rgr_route_preis',
        'permission_callback' => '__return_true',
    ]);
    // POST auch hier: kein JSONP, keine Einbindung per <script>, keine Adressteile im Server-Log
    register_rest_route(RGR_NAMENSRAUM, '/strassen', [
        'methods' => 'POST',
        'callback' => 'rgr_route_strassen',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route(RGR_NAMENSRAUM, '/erzeuger', [
        'methods' => 'POST',
        'callback' => 'rgr_route_erzeuger',
        'permission_callback' => '__return_true',
    ]);
}

function rgr_ist_eigene_route(WP_REST_Request $anfrage): bool
{
    // WordPress findet Routen auch bei anderer Großschreibung
    return str_starts_with(strtolower($anfrage->get_route()), '/' . RGR_NAMENSRAUM . '/');
}

// Kein CORS für unsere Routen: Fremde Seiten sollen sie nicht als Proxy nutzen können.
function rgr_ohne_cors($bedient, $ergebnis, $anfrage)
{
    if ($anfrage instanceof WP_REST_Request && rgr_ist_eigene_route($anfrage)) {
        header_remove('Access-Control-Allow-Origin');
        header_remove('Access-Control-Allow-Credentials');
    }
    return $bedient;
}

function rgr_antwort(array $daten, int $status): WP_REST_Response
{
    $antwort = new WP_REST_Response($daten, $status);
    $antwort->header('Cache-Control', 'no-store');
    $antwort->header('Expires', '0');
    return $antwort;
}

// Datenbank-Sperre, damit parallele Anfragen Zähler nicht gleichzeitig lesen und schreiben.
// Ohne Sperre wird abgelehnt (fail closed).
function rgr_mit_sperre(string $name, callable $arbeit): bool
{
    global $wpdb;
    $sperre = 'rgr_' . md5($name);
    $erhalten = $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, %d)', $sperre, RGR_SPERRE_SEKUNDEN));
    if ((string) $erhalten !== '1') {
        return false;
    }
    try {
        return (bool) $arbeit();
    } finally {
        $wpdb->query($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $sperre));
    }
}

function rgr_im_limit(string $schluessel, int $max, int $sekunden): bool
{
    return rgr_mit_sperre($schluessel, fn() => rgr_unter_limit('get_transient', 'set_transient', $schluessel, $max, $sekunden));
}

// Nur die Socket-Adresse zählt; X-Forwarded-For ist vom Besucher frei wählbar.
function rgr_besucher_schluessel(string $zweck): string
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
    return rgr_ip_schluessel($ip, wp_salt('nonce')) . '_' . $zweck;
}

function rgr_partner_frei(): bool
{
    if (get_transient('rgr_partner_pause') !== false) {
        return false;
    }
    return rgr_mit_sperre('rgr_partner', fn() => rgr_token_frei(
        'get_transient',
        'set_transient',
        'rgr_partner_takt',
        RGR_PARTNER_VORRAT,
        RGR_PARTNER_PRO_SEKUNDE
    ));
}

function rgr_fremd(WP_REST_Request $anfrage): bool
{
    $host = (string) wp_parse_url(home_url(), PHP_URL_HOST);
    return rgr_fremde_herkunft($anfrage->get_header('origin'), $host)
        || rgr_fremder_abruf($anfrage->get_header('sec_fetch_site'), $anfrage->get_query_params());
}

// Ruft den Partner auf; meldet Status und Daten, setzt bei 429 eine gemeinsame Pause.
function rgr_partner_abruf(string $methode, string $url, array $args): array
{
    $args += ['timeout' => RGR_ZEITLIMIT_SEKUNDEN, 'redirection' => 0, 'limit_response_size' => RGR_ANTWORT_MAX_BYTES];
    $antwort = $methode === 'POST' ? wp_remote_post($url, $args) : wp_remote_get($url, $args);
    if (is_wp_error($antwort)) {
        return ['status' => 0, 'daten' => null];
    }
    $status = (int) wp_remote_retrieve_response_code($antwort);
    if ($status === 429) {
        $warten = (int) wp_remote_retrieve_header($antwort, 'retry-after');
        set_transient('rgr_partner_pause', 1, max(RGR_FEHLER_CACHE_SEKUNDEN, min($warten, RGR_PAUSE_MAX_SEKUNDEN)));
    }
    $daten = json_decode((string) wp_remote_retrieve_body($antwort), true);
    return ['status' => $status, 'daten' => is_array($daten) ? $daten : null];
}

function rgr_route_preis(WP_REST_Request $anfrage): WP_REST_Response
{
    if (rgr_fremd($anfrage)) {
        return rgr_antwort(['fehler' => 'Nicht erlaubt.'], 403);
    }
    $body = $anfrage->get_json_params();
    $geprueft = rgr_pruefe_preis_anfrage(is_array($body) ? $body : []);
    if (!$geprueft['ok']) {
        return rgr_antwort(['fehler' => $geprueft['fehler']], 400);
    }
    $werte = $geprueft['werte'];
    // Adressgenaue Anfragen werden nicht gespeichert, sonst verriete die Antwortzeit frühere Abfragen.
    $mit_adresse = $werte['strasse'] !== '';
    // „preis2“ seit 1.2.0: Antworten ohne Netzkosten aus dem alten Cache nicht weiter ausliefern.
    $schluessel = rgr_cache_schluessel('preis2', $werte);
    $gespeichert = $mit_adresse ? false : get_transient($schluessel);
    if (is_array($gespeichert)) {
        return rgr_antwort($gespeichert['daten'], (int) $gespeichert['status']);
    }
    if (!rgr_im_limit(rgr_besucher_schluessel('preis'), RGR_LIMIT_PREIS_IP_STUNDE, HOUR_IN_SECONDS)) {
        return rgr_antwort(['fehler' => RGR_MELDUNG_VIEL], 429);
    }
    if (!rgr_partner_frei()) {
        return rgr_antwort(['fehler' => RGR_MELDUNG_VIEL], 503);
    }

    $nutzlast = [
        'postal_code' => $werte['plz'],
        'annual_consumption_kwh' => $werte['kwh'],
        'slug' => RGR_WSE_SLUG,
        'refcode' => null,
    ];
    if ($werte['ort'] !== '') {
        $nutzlast['city'] = $werte['ort'];
    }
    if ($mit_adresse) {
        $nutzlast['street'] = $werte['strasse'];
        $nutzlast['house_number'] = $werte['hausnummer'];
    }
    $abruf = rgr_partner_abruf('POST', RGR_WSE_BASIS . '/calculate-price', [
        'headers' => ['Content-Type' => 'application/json', 'Accept' => 'application/json'],
        'body' => wp_json_encode($nutzlast),
    ]);
    $gefiltert = $abruf['status'] === 200 ? rgr_filtere_preis_antwort($abruf['daten'], $werte['kwh']) : null;

    if ($gefiltert !== null) {
        $ergebnis = ['status' => 200, 'daten' => $gefiltert, 'dauer' => RGR_CACHE_SEKUNDEN];
    } elseif ($abruf['status'] === 404) {
        $ergebnis = ['status' => 404, 'daten' => ['fehler' => RGR_MELDUNG_UNBEKANNT], 'dauer' => RGR_UNBEKANNT_CACHE_SEKUNDEN];
    } else {
        $ergebnis = ['status' => 502, 'daten' => ['fehler' => RGR_MELDUNG_PARTNER], 'dauer' => RGR_FEHLER_CACHE_SEKUNDEN];
    }
    if (!$mit_adresse) {
        set_transient($schluessel, ['status' => $ergebnis['status'], 'daten' => $ergebnis['daten']], $ergebnis['dauer']);
    }
    return rgr_antwort($ergebnis['daten'], $ergebnis['status']);
}

// Kosten der Direktvermarktung für Erzeuger; Werte des Partners hängen von Leistung und Menge ab.
function rgr_route_erzeuger(WP_REST_Request $anfrage): WP_REST_Response
{
    if (rgr_fremd($anfrage)) {
        return rgr_antwort(['fehler' => 'Nicht erlaubt.'], 403);
    }
    $body = $anfrage->get_json_params();
    $geprueft = rgr_pruefe_erzeuger_anfrage(is_array($body) ? $body : []);
    if (!$geprueft['ok']) {
        return rgr_antwort(['fehler' => $geprueft['fehler']], 400);
    }
    $werte = $geprueft['werte'];
    $schluessel = rgr_cache_schluessel('erzeuger', $werte);
    $gespeichert = get_transient($schluessel);
    if (is_array($gespeichert)) {
        return rgr_antwort($gespeichert['daten'], (int) $gespeichert['status']);
    }
    if (!rgr_im_limit(rgr_besucher_schluessel('erzeuger'), RGR_LIMIT_ERZEUGER_IP_STUNDE, HOUR_IN_SECONDS)) {
        return rgr_antwort(['fehler' => RGR_MELDUNG_VIEL], 429);
    }
    if (!rgr_partner_frei()) {
        return rgr_antwort(['fehler' => RGR_MELDUNG_VIEL], 503);
    }
    $abruf = rgr_partner_abruf('POST', RGR_WSE_BASIS . '/direktvermarktung/calculate-price', [
        'headers' => ['Content-Type' => 'application/json', 'Accept' => 'application/json'],
        'body' => wp_json_encode(rgr_erzeuger_nutzlast($werte)),
    ]);
    $gefiltert = $abruf['status'] === 200 ? rgr_filtere_erzeuger_antwort($abruf['daten']) : null;
    // Fehlertexte des Partners gehen nicht an den Browser.
    $ergebnis = $gefiltert !== null
        ? ['status' => 200, 'daten' => $gefiltert, 'dauer' => RGR_CACHE_SEKUNDEN]
        : ['status' => 502, 'daten' => ['fehler' => RGR_MELDUNG_ERZEUGER], 'dauer' => RGR_FEHLER_CACHE_SEKUNDEN];
    set_transient($schluessel, ['status' => $ergebnis['status'], 'daten' => $ergebnis['daten']], $ergebnis['dauer']);
    return rgr_antwort($ergebnis['daten'], $ergebnis['status']);
}

function rgr_route_strassen(WP_REST_Request $anfrage): WP_REST_Response
{
    if (rgr_fremd($anfrage)) {
        return rgr_antwort(['fehler' => 'Nicht erlaubt.', 'strassen' => []], 403);
    }
    $body = $anfrage->get_json_params();
    $geprueft = rgr_pruefe_strassen_anfrage(is_array($body) ? $body : []);
    if (!$geprueft['ok']) {
        return rgr_antwort(['fehler' => $geprueft['fehler'], 'strassen' => []], 400);
    }
    $werte = $geprueft['werte'];
    if (!rgr_suche_lang_genug($werte['suche'])) {
        return rgr_antwort(['strassen' => []], 200);
    }
    $schluessel = rgr_cache_schluessel('strassen', $werte);
    $gespeichert = get_transient($schluessel);
    if (is_array($gespeichert)) {
        return rgr_antwort(['strassen' => $gespeichert], 200);
    }
    if (!rgr_im_limit(rgr_besucher_schluessel('strassen'), RGR_LIMIT_STRASSEN_IP_STUNDE, HOUR_IN_SECONDS)) {
        return rgr_antwort(['fehler' => RGR_MELDUNG_VIEL, 'strassen' => []], 429);
    }
    if (!rgr_partner_frei()) {
        return rgr_antwort(['fehler' => RGR_MELDUNG_VIEL, 'strassen' => []], 503);
    }
    $abfrage = http_build_query(
        ['postal_code' => $werte['plz'], 'city' => $werte['stadt'], 'search_term' => $werte['suche']],
        '',
        '&',
        PHP_QUERY_RFC3986
    );
    $abruf = rgr_partner_abruf('GET', RGR_WSE_BASIS . '/streets?' . $abfrage, ['headers' => ['Accept' => 'application/json']]);
    if ($abruf['status'] !== 200 || $abruf['daten'] === null) {
        return rgr_antwort(['fehler' => 'Die Straßensuche ist gerade nicht erreichbar.', 'strassen' => []], 502);
    }
    $strassen = rgr_filtere_strassen_antwort($abruf['daten']);
    set_transient($schluessel, $strassen, RGR_CACHE_SEKUNDEN);
    return rgr_antwort(['strassen' => $strassen], 200);
}
