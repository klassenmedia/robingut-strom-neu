#!/usr/bin/env bash
# Schickt 100 parallele Anfragen (50 Preis, 50 Erzeuger) mit verschiedenen Werten an die Testumgebung
# (16 PHP-Prozesse) und prüft, dass höchstens der Vorrat beim Partner ankommt.
#
#   bash wordpress/robingut-rechner/tests/parallel-test.sh
set -euo pipefail

PLUGIN="$(cd "$(dirname "$0")/.." && pwd)"
ARBEIT="$(mktemp -d)"
PORT_PLUGIN="${PORT_PLUGIN:-8781}"
PORT_PARTNER="${PORT_PARTNER:-8782}"
VORRAT=5
PID_PLUGIN=""
PID_PARTNER=""

# Mit PHP_CLI_SERVER_WORKERS startet php -S Unterprozesse; die müssen mit beendet werden.
aufraeumen() {
  for pid in $PID_PLUGIN $PID_PARTNER; do
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  rm -rf "$ARBEIT"
}
trap aufraeumen EXIT

for port in "$PORT_PLUGIN" "$PORT_PARTNER"; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $port ist belegt, bitte PORT_PLUGIN/PORT_PARTNER setzen." >&2
    exit 2
  fi
done

RGR_ZAEHLER="$ARBEIT/zaehler" php -S "127.0.0.1:$PORT_PARTNER" "$PLUGIN/tests/harness/partner-attrappe.php" >/dev/null 2>&1 &
PID_PARTNER=$!
PHP_CLI_SERVER_WORKERS=16 RGR_ATTRAPPE_ORDNER="$ARBEIT/transients" RGR_PARTNER_URL="http://127.0.0.1:$PORT_PARTNER" \
  php -S "127.0.0.1:$PORT_PLUGIN" -t "$PLUGIN" "$PLUGIN/tests/harness/router.php" >/dev/null 2>&1 &
PID_PLUGIN=$!
sleep 1

# Verbraucherpreis und Erzeugerkosten gemischt: beide teilen sich den Partner-Takt.
# Nutzlasten als Dateien, weil xargs Anführungszeichen im JSON verschlucken würde.
mkdir -p "$ARBEIT/anfragen"
for n in $(seq 1000 1049); do printf '{"plz":"41747","kwh":%s}' "$n" > "$ARBEIT/anfragen/preis_$n.json"; done
for n in $(seq 60000 60049); do printf '{"art":"pv","kwp":100,"kwh":%s,"einspeisung":"teil","foerderung":false}' "$n" > "$ARBEIT/anfragen/erzeuger_$n.json"; done
find "$ARBEIT/anfragen" -name '*.json' | xargs -P 50 -I{} sh -c \
  'route=$(basename "$1" | cut -d_ -f1); curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" --data-binary @"$1" "http://127.0.0.1:$2/wp-json/robingut-rechner/v1/$route"' _ {} "$PORT_PLUGIN" > "$ARBEIT/status"

AUFRUFE=$(wc -l < "$ARBEIT/zaehler" 2>/dev/null | tr -d ' ' || echo 0)
OK=$(grep -c '^200$' "$ARBEIT/status" || true)
echo "Antworten: $(sort "$ARBEIT/status" | uniq -c | tr '\n' ' ')"
echo "Partner-Aufrufe: $AUFRUFE (erlaubt höchstens $VORRAT), Antworten mit Preis: $OK"
if [ "$AUFRUFE" -le "$VORRAT" ] && [ "$OK" -le "$VORRAT" ] && [ "$AUFRUFE" -ge 1 ]; then
  echo "  ok  parallele Anfragen halten den Partner-Takt ein"
else
  echo "  FEHLER  Partner-Takt bei parallelen Anfragen überschritten" >&2
  exit 1
fi
