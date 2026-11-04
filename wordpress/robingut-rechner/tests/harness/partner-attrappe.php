<?php
// Attrappe der Partner-API für den Paralleltest: antwortet stimmig und zählt jeden Aufruf.

declare(strict_types=1);

$zaehler = getenv('RGR_ZAEHLER') ?: sys_get_temp_dir() . '/rgr-partner-zaehler';
file_put_contents($zaehler, "1\n", FILE_APPEND | LOCK_EX);

$body = json_decode((string) file_get_contents('php://input'), true);
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
