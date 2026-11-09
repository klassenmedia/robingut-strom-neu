<?php
/**
 * Plugin Name: ROBIN GUT Strukturdaten
 * Description: schema.org-Strukturdaten (Organisation, Personen, Stiftung, Service je Zielgruppe, FAQ aus den sichtbaren Aufklappern) und /llms.txt für robingut-strom.de. Ersetzt die Schema-Funktionen im Theme Frost.
 * Version: 1.0.0
 * Requires PHP: 8.1
 * Author: KlassenMedia
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/includes/geo.php';

// Das Theme gibt veraltete Schemas aus (§ 42c, Gründung 2021, feste FAQ). Abschalten statt die Theme-Datei
// zu ändern, die ein Update überschreiben würde.
add_action('after_setup_theme', function (): void {
    remove_action('wp_head', 'robingut_schema_markup');
    remove_action('wp_head', 'robingut_schema_faq');
}, 99);

add_action('wp_head', function (): void {
    if (!is_page()) {
        return;
    }
    $seite = get_queried_object();
    if (!$seite instanceof WP_Post) {
        return;
    }
    // Geschützte oder nicht veröffentlichte Seiten: keine Fragen aus dem Inhalt verraten
    $oeffentlich = $seite->post_status === 'publish' && !post_password_required($seite);
    echo rgg_script_tag(rgg_graph([
        'slug' => is_front_page() ? 'startseite' : $seite->post_name,
        'url' => (string) get_permalink($seite),
        'inhalt' => $oeffentlich ? (string) $seite->post_content : '',
    ]));
}, 20);

// /llms.txt aus der Datei im Plugin; WordPress würde sonst 404 liefern.
add_action('init', function (): void {
    if (!rgg_ist_llms_pfad((string) ($_SERVER['REQUEST_URI'] ?? ''))) {
        return;
    }
    $text = is_readable(RGG_LLMS_DATEI) ? file_get_contents(RGG_LLMS_DATEI) : false;
    if ($text === false) {
        return;
    }
    status_header(200);
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: public, max-age=3600');
    echo $text;
    exit;
}, 0);
