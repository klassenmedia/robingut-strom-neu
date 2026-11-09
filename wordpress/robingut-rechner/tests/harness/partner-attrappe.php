<?php
// Attrappe der Partner-API für den Paralleltest: antwortet stimmig und zählt jeden Aufruf.

declare(strict_types=1);

$zaehler = getenv('RGR_ZAEHLER') ?: sys_get_temp_dir() . '/rgr-partner-zaehler';
file_put_contents($zaehler, "1\n", FILE_APPEND | LOCK_EX);

$body = json_decode((string) file_get_contents('php://input'), true);
if (str_contains((string) ($_SERVER['REQUEST_URI'] ?? ''), '/direktvermarktung/')) {
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'individual_offer' => false, 'data' => [
        'redispatch_fee' => 20, 'remote_control_fee' => 11, 'forecast_fee' => 15, 'balancing_risk_fee' => 24.38,
        'feeder_base_price_margin' => 25, 'grundgebuehr_monatlich' => 95.38, 'marketing_fee_ct_kwh' => 0.2, 'setup_fee' => 390,
    ]]);
    return;
}
$kwh = is_array($body) && is_int($body['annual_consumption_kwh'] ?? null) ? $body['annual_consumption_kwh'] : 2500;
header('Content-Type: application/json');
echo json_encode([
    'energy_price' => 38.16449,
    'transaction_fee' => 1.19,
    'base_price' => 238.13,
    'monthly_base_price' => 19.84,
    'annual_total' => (38.16449 + 1.19) / 100 * $kwh + 238.13,
    'annual_consumption_kwh' => $kwh,
    'city' => 'Attrappe',
]);
