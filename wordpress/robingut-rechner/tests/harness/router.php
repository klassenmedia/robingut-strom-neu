<?php
// Lokale Testumgebung mit minimalen WordPress-Funktionen; spricht die echte Partner-API,
// außer RGR_PARTNER_URL zeigt auf die Partner-Attrappe.
//
//   php -S 127.0.0.1:8765 -t wordpress/robingut-rechner wordpress/robingut-rechner/tests/harness/router.php

declare(strict_types=1);

$pfad = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (str_starts_with($pfad, '/assets/')) {
    return false;
}

if (getenv('RGR_PARTNER_URL')) {
    define('RGR_WSE_BASIS', getenv('RGR_PARTNER_URL'));
}
require __DIR__ . '/wp-attrappe.php';
require dirname(__DIR__, 2) . '/robingut-rechner.php';

if (str_starts_with($pfad, '/wp-json/robingut-rechner/v1/')) {
    $route = substr($pfad, strlen('/wp-json'));
    $anfrage = WP_REST_Request::ausServer($route);
    $antwort = match (true) {
        $route === '/robingut-rechner/v1/preis' && $_SERVER['REQUEST_METHOD'] === 'POST' => rgr_route_preis($anfrage),
        $route === '/robingut-rechner/v1/strassen' && $_SERVER['REQUEST_METHOD'] === 'POST' => rgr_route_strassen($anfrage),
        default => new WP_REST_Response(['fehler' => 'nicht gefunden'], 404),
    };
    http_response_code($antwort->status);
    header('Content-Type: application/json; charset=utf-8');
    foreach ($antwort->kopf as $n => $w) {
        header("$n: $w");
    }
    echo json_encode($antwort->daten);
    return true;
}

$rechner = rgr_shortcode();
?><!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rechner-Test</title><?php echo implode("\n", array_filter($GLOBALS['rgr_dateien'], fn($d) => str_starts_with($d, '<link'))); ?>
<style>body{margin:0;padding:40px 16px;background:#f2f8e1;font-family:system-ui,sans-serif}</style></head>
<body><?php echo $rechner; ?>
<?php echo implode("\n", array_filter($GLOBALS['rgr_dateien'], fn($d) => str_starts_with($d, '<script'))); ?>
</body></html>
