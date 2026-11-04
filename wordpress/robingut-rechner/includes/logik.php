<?php
// Reine Funktionen des Rechners: Prüfung der Eingaben, Whitelist der Partner-Antwort,
// Anfragelimit und Cache-Schlüssel. Ohne WordPress testbar.

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

const RGR_VERBRAUCH_MIN = 500;
const RGR_VERBRAUCH_MAX = 100000;
const RGR_STRASSE_MAX = 100;
const RGR_HAUSNUMMER_MAX = 20;
const RGR_STADT_MAX = 100;
const RGR_SUCHE_MAX = 60;
const RGR_SUCHE_MIN = 2;
const RGR_LISTE_MAX = 200;
const RGR_LISTENEINTRAG_MAX = 200;
const RGR_PREISFELDER = ['energy_price', 'transaction_fee', 'base_price', 'monthly_base_price', 'annual_total'];
// Plausible Spannen; was außerhalb liegt, deutet auf geänderte oder kaputte Felder hin.
const RGR_ARBEITSPREIS_CT = [15.0, 80.0];
const RGR_GEBUEHR_CT = [0.0, 10.0];
const RGR_GRUNDPREIS_JAHR = [0.0, 5000.0];
const RGR_GRUNDPREIS_MONAT_TOLERANZ = 0.05;
const RGR_SUMME_TOLERANZ_ANTEIL = 0.005;
const RGR_SUMME_TOLERANZ_MIN = 2.0;
// Partner-Takt: kurzer Vorrat, danach eine Anfrage je 2 s; so höchstens 35 in jeder Minute.
const RGR_PARTNER_VORRAT = 5;
const RGR_PARTNER_PRO_SEKUNDE = 0.5;
const RGR_ROHTEXT_MAX = 1000;

function rgr_text($wert, int $max): string
{
    if (!is_string($wert)) {
        return '';
    }
    $ohne_tags = strip_tags(mb_substr($wert, 0, RGR_ROHTEXT_MAX));
    // Steuer- und Formatzeichen (auch Richtungswechsel), damit nichts die Anzeige verdreht
    $sauber = (string) preg_replace('/[\p{Cc}\p{Cf}]/u', '', $ohne_tags);
    return mb_substr(trim($sauber), 0, $max);
}

function rgr_ist_plz($wert): bool
{
    return is_string($wert) && preg_match('/^\d{5}\z/', $wert) === 1;
}

function rgr_optionaler_text(array $quelle, string $feld, int $max): ?string
{
    if (!isset($quelle[$feld])) {
        return '';
    }
    return is_string($quelle[$feld]) ? rgr_text($quelle[$feld], $max) : null;
}

function rgr_pruefe_preis_anfrage(array $body): array
{
    $plz = $body['plz'] ?? null;
    $kwh = $body['kwh'] ?? null;
    if (!rgr_ist_plz($plz)) {
        return ['ok' => false, 'fehler' => 'Bitte eine 5-stellige Postleitzahl eingeben.'];
    }
    if (!is_int($kwh) || $kwh < RGR_VERBRAUCH_MIN || $kwh > RGR_VERBRAUCH_MAX) {
        return ['ok' => false, 'fehler' => 'Bitte einen Jahresverbrauch zwischen 500 und 100.000 kWh eingeben.'];
    }
    $ort = rgr_optionaler_text($body, 'ort', RGR_STADT_MAX);
    $strasse = rgr_optionaler_text($body, 'strasse', RGR_STRASSE_MAX);
    $hausnummer = rgr_optionaler_text($body, 'hausnummer', RGR_HAUSNUMMER_MAX);
    if ($ort === null || $strasse === null || $hausnummer === null) {
        return ['ok' => false, 'fehler' => 'Ort, Straße und Hausnummer bitte als Text angeben.'];
    }
    return ['ok' => true, 'werte' => compact('plz', 'kwh', 'ort', 'strasse', 'hausnummer')];
}

function rgr_pruefe_strassen_anfrage(array $query): array
{
    $plz = $query['plz'] ?? null;
    if (!rgr_ist_plz($plz)) {
        return ['ok' => false, 'fehler' => 'Bitte eine 5-stellige Postleitzahl eingeben.'];
    }
    $stadt = rgr_text($query['stadt'] ?? null, RGR_STADT_MAX);
    if ($stadt === '') {
        return ['ok' => false, 'fehler' => 'Die Stadt fehlt.'];
    }
    $suche = rgr_text($query['suche'] ?? '', RGR_SUCHE_MAX);
    return ['ok' => true, 'werte' => compact('plz', 'stadt', 'suche')];
}

function rgr_suche_lang_genug(string $suche): bool
{
    return mb_strlen($suche) >= RGR_SUCHE_MIN;
}

function rgr_textliste($liste): array
{
    if (!is_array($liste)) {
        return [];
    }
    $texte = array_filter($liste, fn($eintrag) => is_string($eintrag) && strlen($eintrag) <= RGR_LISTENEINTRAG_MAX);
    $sauber = array_filter(array_map(fn($eintrag) => rgr_text($eintrag, RGR_LISTENEINTRAG_MAX), $texte), 'strlen');
    return array_slice(array_values($sauber), 0, RGR_LISTE_MAX);
}

function rgr_ist_endliche_zahl($wert): bool
{
    return (is_int($wert) || is_float($wert)) && is_finite((float) $wert);
}

// Nur Felder, die der Rechner braucht; alles andere (IDs, Rohpreise) bleibt beim Server.
function rgr_filtere_preis_antwort($daten, int $kwh): ?array
{
    if (!is_array($daten)) {
        return null;
    }
    // Eine PLZ mit mehreren Orten: erst den Ort wählen, dann gibt es Preise.
    if (($daten['requires_city_selection'] ?? false) === true) {
        $orte = is_array($daten['cities'] ?? null) ? $daten['cities'] : [];
        $namen = array_map(fn($eintrag) => is_array($eintrag) ? ($eintrag['ort'] ?? null) : null, $orte);
        return ['requires_city_selection' => true, 'orte' => rgr_textliste($namen)];
    }
    $stadt = rgr_text($daten['city'] ?? null, RGR_STADT_MAX);
    // Ein Ort mit mehreren Netzgebieten: die Straße entscheidet.
    if (($daten['requires_district_selection'] ?? false) === true) {
        return ['requires_district_selection' => true, 'city' => $stadt];
    }
    $antwort = ['requires_district_selection' => false];
    foreach (RGR_PREISFELDER as $feld) {
        if (!rgr_ist_endliche_zahl($daten[$feld] ?? null)) {
            return null;
        }
        $antwort[$feld] = (float) $daten[$feld];
    }
    if (($daten['annual_consumption_kwh'] ?? null) !== $kwh || !rgr_preise_plausibel($antwort, $kwh)) {
        return null;
    }
    $antwort['annual_consumption_kwh'] = $kwh;
    $antwort['city'] = $stadt;
    return $antwort;
}

function rgr_in_spanne(float $wert, array $spanne): bool
{
    return $wert >= $spanne[0] && $wert <= $spanne[1];
}

// Gleiche Prüfung wie pruefePreise() in rechnung.js, damit nichts Unplausibles gecacht wird.
function rgr_preise_plausibel(array $p, int $kwh): bool
{
    if (!rgr_in_spanne($p['energy_price'], RGR_ARBEITSPREIS_CT) || !rgr_in_spanne($p['transaction_fee'], RGR_GEBUEHR_CT)) {
        return false;
    }
    if (!rgr_in_spanne($p['base_price'], RGR_GRUNDPREIS_JAHR)) {
        return false;
    }
    if (abs($p['monthly_base_price'] - $p['base_price'] / 12) > RGR_GRUNDPREIS_MONAT_TOLERANZ) {
        return false;
    }
    $erwartet = ($p['energy_price'] + $p['transaction_fee']) / 100 * $kwh + $p['base_price'];
    $toleranz = max(RGR_SUMME_TOLERANZ_MIN, $erwartet * RGR_SUMME_TOLERANZ_ANTEIL);
    return abs($p['annual_total'] - $erwartet) <= $toleranz;
}

function rgr_filtere_strassen_antwort($daten): array
{
    return is_array($daten) ? rgr_textliste($daten['data'] ?? []) : [];
}

// Festes Zeitfenster je Schlüssel; Lesen/Schreiben kommen von außen (Transients),
// die Sperre gegen parallele Anfragen setzt der Aufrufer.
function rgr_unter_limit(callable $lesen, callable $schreiben, string $schluessel, int $max, int $sekunden, ?int $jetzt = null): bool
{
    $jetzt ??= time();
    $stand = $lesen($schluessel);
    if (!is_array($stand) || ($stand['bis'] ?? 0) <= $jetzt) {
        $stand = ['n' => 0, 'bis' => $jetzt + $sekunden];
    }
    if ($stand['n'] >= $max) {
        return false;
    }
    $stand['n']++;
    $schreiben($schluessel, $stand, max(1, $stand['bis'] - $jetzt));
    return true;
}

// Token-Bucket: glättet Spitzen, auch über Minutengrenzen hinweg.
function rgr_token_frei(callable $lesen, callable $schreiben, string $schluessel, int $vorrat, float $proSekunde, ?float $jetzt = null): bool
{
    $jetzt ??= microtime(true);
    $stand = $lesen($schluessel);
    $marken = is_array($stand) ? (float) ($stand['m'] ?? 0) : (float) $vorrat;
    $zuletzt = is_array($stand) ? (float) ($stand['z'] ?? $jetzt) : $jetzt;
    $marken = min((float) $vorrat, $marken + max(0.0, $jetzt - $zuletzt) * $proSekunde);
    $frei = $marken >= 1.0;
    if ($frei) {
        $marken -= 1.0;
    }
    // Die Zeit läuft nie zurück, sonst brächte eine nachgehende Uhr neuen Vorrat.
    $schreiben($schluessel, ['m' => $marken, 'z' => max($zuletzt, $jetzt)], (int) ceil($vorrat / $proSekunde) + 60);
    return $frei;
}

function rgr_fremde_herkunft(?string $origin, string $eigener_host): bool
{
    if ($origin === null || $origin === '') {
        return false;
    }
    $host = parse_url($origin, PHP_URL_HOST);
    if (!is_string($host)) {
        return true;
    }
    $ohne_www = fn(string $h) => preg_replace('/^www\./', '', strtolower($h));
    return $ohne_www($host) !== $ohne_www($eigener_host);
}

// Browser schicken bei Skript- oder Bild-Einbindungen keinen Origin, wohl aber Sec-Fetch-Site.
function rgr_fremder_abruf(?string $sec_fetch_site, array $query): bool
{
    if (array_key_exists('_jsonp', $query)) {
        return true;
    }
    return $sec_fetch_site !== null && !in_array($sec_fetch_site, ['same-origin', 'same-site'], true);
}

function rgr_cache_schluessel(string $art, array $werte): string
{
    return 'rgr_' . $art . '_' . md5((string) json_encode($werte, JSON_UNESCAPED_UNICODE));
}

// HMAC mit geheimem Salz, sonst ließe sich der IPv4-Raum in Minuten zurückrechnen.
// IPv6 zählt je /64-Netz: Ein Anschluss bekommt meist ein ganzes /64.
function rgr_ip_schluessel(string $ip, string $salz): string
{
    $gueltig = filter_var($ip, FILTER_VALIDATE_IP) !== false ? $ip : '';
    if (filter_var($gueltig, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) !== false) {
        $binaer = (string) inet_pton($gueltig);
        // ::ffff:1.2.3.4 ist eine IPv4-Adresse und zählt auch so
        $gueltig = str_starts_with($binaer, str_repeat("\0", 10) . "\xff\xff")
            ? (string) inet_ntop(substr($binaer, 12))
            : 'v6:' . bin2hex(substr($binaer, 0, 8));
    }
    return 'rgr_ip_' . substr(hash_hmac('sha256', $gueltig, 'robingut-rechner|' . $salz), 0, 32);
}
