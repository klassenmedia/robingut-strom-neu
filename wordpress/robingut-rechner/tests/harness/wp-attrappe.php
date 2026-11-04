<?php
// Minimale WordPress-Funktionen für Tests und die lokale Testumgebung.
// Transients liegen als Einzeldateien im Temp-Ordner, GET_LOCK wird über flock nachgebildet.

declare(strict_types=1);

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__);
}
if (!defined('HOUR_IN_SECONDS')) {
    define('HOUR_IN_SECONDS', 3600);
    define('MINUTE_IN_SECONDS', 60);
}

final class WP_REST_Response
{
    public array $kopf = [];
    public function __construct(public array $daten, public int $status) {}
    public function header(string $name, string $wert): void { $this->kopf[$name] = $wert; }
}

final class WP_REST_Request
{
    public function __construct(
        private ?array $json = null,
        private array $query = [],
        private array $kopf = [],
        private string $route = '',
    ) {}
    public static function ausServer(string $route): self
    {
        $kopf = [];
        foreach ($_SERVER as $name => $wert) {
            if (str_starts_with($name, 'HTTP_')) {
                $kopf[strtolower(str_replace('_', '-', substr($name, 5)))] = (string) $wert;
            }
        }
        $json = json_decode((string) file_get_contents('php://input'), true);
        return new self(is_array($json) ? $json : null, $_GET, $kopf, $route);
    }
    public function get_json_params() { return $this->json; }
    public function get_query_params(): array { return $this->query; }
    // Wie WordPress: Groß-/Kleinschreibung und - oder _ sind egal
    public function get_header(string $name): ?string
    {
        $norm = fn(string $n) => str_replace('_', '-', strtolower($n));
        foreach ($this->kopf as $k => $w) {
            if ($norm($k) === $norm($name)) {
                return $w;
            }
        }
        return null;
    }
    public function get_route(): string { return $this->route; }
}

final class WP_Error {}

function add_action(...$a): void {}
$GLOBALS['rgr_filter'] = [];
function add_filter(string $hook, $fn, int $prio = 10, int $args = 1): void { $GLOBALS['rgr_filter'][] = compact('hook', 'fn', 'prio', 'args'); }
function add_shortcode(...$a): void {}
$GLOBALS['rgr_routen'] = [];
function register_rest_route(string $raum, string $route, array $args): void { $GLOBALS['rgr_routen']["$raum$route"] = $args; }
// Regex wörtlich aus dem WordPress-Core (wp-includes/formatting.php)
function wp_make_link_relative(string $u): string { return (string) preg_replace('|^(https?:)?//[^/]+(/?.*)|i', '$2', $u); }
function esc_url(string $u): string { return htmlspecialchars($u, ENT_QUOTES); }
function esc_attr(string $t): string { return htmlspecialchars($t, ENT_QUOTES); }
function esc_html(string $t): string { return htmlspecialchars($t, ENT_QUOTES); }
function rest_url(string $p): string { return 'http://localhost:8765/wp-json/' . $p; }
function home_url(): string { return $GLOBALS['rgr_home'] ?? 'http://localhost:8765'; }
function wp_parse_url(string $u, int $teil = -1) { return parse_url($u, $teil); }
function wp_salt(string $art): string { return 'test-salz-' . $art; }
function plugin_dir_url(string $f): string { return '/'; }
function wp_unique_id(string $p): string { static $n = 0; return $p . (++$n); }
function wp_json_encode($d) { return json_encode($d); }
function is_wp_error($x): bool { return $x instanceof WP_Error; }

$GLOBALS['rgr_dateien'] = [];
function wp_enqueue_style(string $h, string $src): void { $GLOBALS['rgr_dateien'][] = "<link rel=stylesheet href=\"$src\">"; }
function wp_enqueue_script(string $h, string $src): void { $GLOBALS['rgr_dateien'][] = "<script src=\"$src\"></script>"; }

function rgr_attrappe_ordner(): string
{
    $ordner = getenv('RGR_ATTRAPPE_ORDNER') ?: sys_get_temp_dir() . '/rgr-attrappe';
    if (!is_dir($ordner)) {
        mkdir($ordner, 0700, true);
    }
    return $ordner;
}
function rgr_attrappe_datei(string $k): string { return rgr_attrappe_ordner() . '/t_' . md5($k) . '.json'; }
function get_transient(string $k)
{
    $datei = rgr_attrappe_datei($k);
    $inhalt = is_file($datei) ? json_decode((string) file_get_contents($datei), true) : null;
    return is_array($inhalt) && $inhalt['bis'] > time() ? $inhalt['wert'] : false;
}
function set_transient(string $k, $v, int $sek): bool
{
    $datei = rgr_attrappe_datei($k);
    $tmp = $datei . '.' . getmypid() . '.' . mt_rand();
    file_put_contents($tmp, json_encode(['wert' => $v, 'bis' => time() + $sek]));
    rename($tmp, $datei);
    $GLOBALS['rgr_transient_ttl'][$k] = $sek;
    return true;
}

// GET_LOCK/RELEASE_LOCK wie MySQL: benannte Sperre mit Wartezeit, hier über flock.
final class RGR_Attrappe_DB
{
    private array $sperren = [];
    // false: Sperre normal; sonst Rückgabewert von GET_LOCK ('0' = Zeit abgelaufen, null = Fehler)
    public $sperreVerweigern = false;
    public function prepare(string $sql, ...$werte): array { return [$sql, $werte]; }
    public function get_var(array $anfrage)
    {
        [$sql, $werte] = $anfrage;
        if ($this->sperreVerweigern !== false) {
            return $this->sperreVerweigern === true ? '0' : $this->sperreVerweigern;
        }
        $name = (string) $werte[0];
        $griff = fopen(rgr_attrappe_ordner() . '/l_' . md5($name), 'c');
        $bis = microtime(true) + (int) ($werte[1] ?? 0);
        while (!flock($griff, LOCK_EX | LOCK_NB)) {
            if (microtime(true) > $bis) {
                fclose($griff);
                return '0';
            }
            usleep(2000);
        }
        $this->sperren[$name] = $griff;
        return '1';
    }
    public function query(array $anfrage): void
    {
        $name = (string) $anfrage[1][0];
        if (isset($this->sperren[$name])) {
            flock($this->sperren[$name], LOCK_UN);
            fclose($this->sperren[$name]);
            unset($this->sperren[$name]);
        }
    }
}
$GLOBALS['wpdb'] = new RGR_Attrappe_DB();

// HTTP zum Partner: echte Aufrufe, außer ein Test hat eine Antwort vorgegeben.
$GLOBALS['rgr_partner_aufrufe'] = [];
function rgr_http(string $methode, string $url, array $args)
{
    $GLOBALS['rgr_partner_aufrufe'][] = compact('methode', 'url', 'args');
    if (isset($GLOBALS['rgr_partner_antwort'])) {
        return ($GLOBALS['rgr_partner_antwort'])($methode, $url, $args);
    }
    $kopf = [];
    foreach ($args['headers'] ?? [] as $n => $w) {
        $kopf[] = "$n: $w";
    }
    $kontext = stream_context_create(['http' => [
        'method' => $methode, 'header' => implode("\r\n", $kopf), 'content' => $args['body'] ?? '',
        'timeout' => $args['timeout'] ?? 6, 'ignore_errors' => true, 'follow_location' => 0,
    ]]);
    $body = @file_get_contents($url, false, $kontext, 0, $args['limit_response_size'] ?? null);
    if ($body === false) {
        return new WP_Error();
    }
    preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $m);
    $kopfzeilen = [];
    foreach (array_slice($http_response_header ?? [], 1) as $zeile) {
        [$n, $w] = array_pad(explode(':', $zeile, 2), 2, '');
        $kopfzeilen[strtolower(trim($n))] = trim($w);
    }
    return ['code' => (int) ($m[1] ?? 0), 'body' => $body, 'headers' => $kopfzeilen];
}
function wp_remote_post(string $url, array $args) { return rgr_http('POST', $url, $args); }
function wp_remote_get(string $url, array $args) { return rgr_http('GET', $url, $args); }
function wp_remote_retrieve_response_code($r): int { return $r['code']; }
function wp_remote_retrieve_body($r): string { return $r['body']; }
function wp_remote_retrieve_header($r, string $name): string { return $r['headers'][strtolower($name)] ?? ''; }
