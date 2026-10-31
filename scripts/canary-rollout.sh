#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${API_URL:-$(terraform -chdir="$ROOT_DIR/terraform" output -raw api_url)}"
STAGE_DURATION_SECONDS="${STAGE_DURATION_SECONDS:-120}"
METRICS_SCRAPE_GRACE_SECONDS="${METRICS_SCRAPE_GRACE_SECONDS:-15}"
CONCURRENCY="${CONCURRENCY:-10}"
REQUEST_TIMEOUT="${REQUEST_TIMEOUT:-30}"
MAX_NETWORK_ERROR_RATE_PERCENT="${MAX_NETWORK_ERROR_RATE_PERCENT:-$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["maxClientNetworkErrorRatePercent"])' "$ROOT_DIR/config/canary-slo.json")}"
MAX_SAMPLE_WAIT_SECONDS="${MAX_SAMPLE_WAIT_SECONDS:-45}"
ANALYSIS_WINDOW="${ANALYSIS_WINDOW:-2m}"
INJECT_FAILURE="${INJECT_FAILURE:-none}"
AWS_REGION="${AWS_REGION:-us-east-2}"
CANARY_SMOKE_TOKEN="${CANARY_SMOKE_TOKEN:-$(terraform -chdir="$ROOT_DIR/terraform" output -raw metrics_bearer_token)}"
export CANARY_SMOKE_TOKEN

rollback() {
  echo "QUALITY GATE FALLÓ: rollback inmediato a 0% Canary / 100% Stable."
  AWS_REGION="$AWS_REGION" bash "$ROOT_DIR/scripts/set-canary-traffic.sh" 0 || true
}

diagnose_listener_rules() {
  local listener_arn
  listener_arn="$(terraform -chdir="$ROOT_DIR/terraform" output -raw alb_listener_arn)"
  echo "Diagnóstico de todas las reglas del listener (prioridad, condiciones y acciones):"
  aws elbv2 describe-rules \
    --region "$AWS_REGION" \
    --listener-arn "$listener_arn" \
    --query 'Rules[].{Priority:Priority,IsDefault:IsDefault,Conditions:Conditions,Actions:Actions}' \
    --output json || true
}

assert_targets_healthy() {
  local label="$1" target_group="$2" healthy="0"
  for attempt in $(seq 1 10); do
    healthy="$(aws elbv2 describe-target-health \
      --region "$AWS_REGION" \
      --target-group-arn "$target_group" \
      --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])' \
      --output text 2>/dev/null || echo 0)"
    if [[ "$healthy" =~ ^[0-9]+$ ]] && (( healthy >= 1 )); then
      echo "$label: ${healthy} target(s) healthy."
      return 0
    fi
    echo "$label aún no tiene targets healthy; intento ${attempt}/10."
    sleep 5
  done
  echo "ABORT: $label no tiene ningún target healthy."
  return 1
}

wait_for_quality_gate() {
  local elapsed=0 rc=2
  while (( elapsed <= MAX_SAMPLE_WAIT_SECONDS )); do
    set +e
    python3 "$ROOT_DIR/scripts/canary-analysis.py" --window "$ANALYSIS_WINDOW"
    rc=$?
    set -e
    if [[ "$rc" -eq 0 ]]; then
      echo "Quality gate: PASS"
      return 0
    elif [[ "$rc" -eq 1 ]]; then
      echo "Quality gate: FAIL"
      rollback
      return 1
    fi
    echo "Muestra insuficiente; esperando 10s por nuevas muestras de Grafana Cloud..."
    sleep 10
    elapsed=$((elapsed + 10))
  done
  echo "ABORT: Grafana no reunió la muestra mínima dentro de ${MAX_SAMPLE_WAIT_SECONDS}s."
  rollback
  return 1
}

STABLE_TG="$(terraform -chdir="$ROOT_DIR/terraform" output -raw stable_target_group_arn)"
CANARY_TG="$(terraform -chdir="$ROOT_DIR/terraform-canary" output -raw canary_target_group_arn)"
if ! assert_targets_healthy "Stable" "$STABLE_TG"; then rollback; exit 1; fi
if ! assert_targets_healthy "Canary" "$CANARY_TG"; then rollback; exit 1; fi

FAILURE_ARG=()
if [[ "$INJECT_FAILURE" != "none" ]]; then
  FAILURE_ARG=(--failure "$INJECT_FAILURE" --canary-token "$CANARY_SMOKE_TOKEN")
fi

# Tres etapas de tráfico públicas satisfacen la rúbrica: 10%, 50% y 100%.
# Dos etapas observadas de 120s son suficientes para una demo compacta con scrape cada 60s.
for percentage in 10 50; do
  echo "=== Etapa Canary ${percentage}% (Stable $((100-percentage))%) ==="
  AWS_REGION="$AWS_REGION" bash "$ROOT_DIR/scripts/set-canary-traffic.sh" "$percentage"

  echo "Horneado: ${STAGE_DURATION_SECONDS}s | concurrencia: ${CONCURRENCY} | timeout HTTP: ${REQUEST_TIMEOUT}s"
  if ! python3 "$ROOT_DIR/scripts/load-test.py" \
    --url "$API_URL" \
    --duration-seconds "$STAGE_DURATION_SECONDS" \
    --concurrency "$CONCURRENCY" \
    --timeout "$REQUEST_TIMEOUT" \
    --max-network-error-rate-percent "$MAX_NETWORK_ERROR_RATE_PERCENT" \
    --path "/appointments" \
    "${FAILURE_ARG[@]}"; then
    echo "ABORT: la prueba de carga superó el presupuesto de errores de transporte o falló."
    rollback
    exit 1
  fi

  echo "Esperando ${METRICS_SCRAPE_GRACE_SECONDS}s para que Grafana Cloud ingiera el último scrape."
  sleep "$METRICS_SCRAPE_GRACE_SECONDS"
  if ! wait_for_quality_gate; then exit 1; fi
done

echo "=== Promoción final: 100% Canary ==="
AWS_REGION="$AWS_REGION" bash "$ROOT_DIR/scripts/set-canary-traffic.sh" 100

# Listener updates are eventually propagated; use fresh HTTP connections for the final smoke test.
sleep 12
if ! python3 "$ROOT_DIR/scripts/load-test.py" \
  --url "$API_URL" \
  --requests 40 \
  --concurrency 1 \
  --timeout 15 \
  --max-network-error-rate-percent 0 \
  --path "/appointments" \
  --expect-canary-only \
  --close-connection; then
  echo "ERROR: la verificación pública no recibió exclusivamente respuestas Canary."
  diagnose_listener_rules
  echo "Se revierte a Stable. Revisa las reglas listadas arriba; una regla de prioridad superior puede interceptar /appointments."
  rollback
  exit 1
fi

echo "Promoción completada: 100% del tráfico público a V3.1 Canary."
echo "Rollback manual: AWS_REGION=$AWS_REGION bash $ROOT_DIR/scripts/set-canary-traffic.sh 0"
