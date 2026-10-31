#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${API_URL:-$(terraform -chdir="$ROOT_DIR/terraform" output -raw api_url)}"
STAGE_DURATION_SECONDS="${STAGE_DURATION_SECONDS:-300}"
METRICS_SCRAPE_GRACE_SECONDS="${METRICS_SCRAPE_GRACE_SECONDS:-70}"
CONCURRENCY="${CONCURRENCY:-30}"
MAX_SAMPLE_WAIT_SECONDS="${MAX_SAMPLE_WAIT_SECONDS:-360}"
INJECT_FAILURE="${INJECT_FAILURE:-none}"
AWS_REGION="${AWS_REGION:-us-east-2}"
CANARY_SMOKE_TOKEN="${CANARY_SMOKE_TOKEN:-$(terraform -chdir="$ROOT_DIR/terraform" output -raw metrics_bearer_token)}"
export CANARY_SMOKE_TOKEN

rollback() {
  echo "\nQUALITY GATE FALLÓ: rollback inmediato a 0% Canary / 100% Stable."
  AWS_REGION="$AWS_REGION" bash "$ROOT_DIR/scripts/set-canary-traffic.sh" 0 || true
}

run_analysis() {
  python3 "$ROOT_DIR/scripts/canary-analysis.py"
}

assert_targets_healthy() {
  local label="$1" target_group="$2" healthy="0"
  for attempt in $(seq 1 10); do
    healthy=$(aws elbv2 describe-target-health \
      --region "$AWS_REGION" \
      --target-group-arn "$target_group" \
      --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])' \
      --output text 2>/dev/null || echo 0)
    if [[ "$healthy" =~ ^[0-9]+$ ]] && (( healthy >= 1 )); then
      echo "$label: ${healthy} target(s) healthy."
      return 0
    fi
    echo "$label aún no tiene targets healthy; intento ${attempt}/10."
    sleep 15
  done
  echo "ABORT: $label no tiene ningún target healthy."
  return 1
}

STABLE_TG="$(terraform -chdir="$ROOT_DIR/terraform" output -raw stable_target_group_arn)"
CANARY_TG="$(terraform -chdir="$ROOT_DIR/terraform-canary" output -raw canary_target_group_arn)"
if ! assert_targets_healthy "Stable" "$STABLE_TG"; then
  rollback
  exit 1
fi
if ! assert_targets_healthy "Canary" "$CANARY_TG"; then
  rollback
  exit 1
fi

wait_for_quality_gate() {
  local elapsed=0 rc=2
  while (( elapsed <= MAX_SAMPLE_WAIT_SECONDS )); do
    set +e
    run_analysis
    rc=$?
    set -e
    if [[ $rc -eq 0 ]]; then
      echo "Quality gate: PASS"
      return 0
    elif [[ $rc -eq 1 ]]; then
      rollback
      return 1
    fi
    echo "Muestra insuficiente; esperando nuevas muestras de Grafana Cloud..."
    sleep 30
    elapsed=$((elapsed + 30))
  done
  echo "PAUSA: no se obtuvo una muestra suficiente. Se conserva el porcentaje actual; no se promociona."
  return 2
}

for percentage in 5 10 25 50; do
  echo "\n=== Etapa Canary ${percentage}% ==="
  AWS_REGION="$AWS_REGION" bash "$ROOT_DIR/scripts/set-canary-traffic.sh" "$percentage"

  FAILURE_ARG=()
  if [[ "$INJECT_FAILURE" != "none" ]]; then
    FAILURE_ARG=(--failure "$INJECT_FAILURE" --canary-token "$CANARY_SMOKE_TOKEN")
  fi
  echo "Horneado con carga concurrente: ${STAGE_DURATION_SECONDS}s"
  python3 "$ROOT_DIR/scripts/load-test.py" \
    --url "$API_URL" \
    --duration-seconds "$STAGE_DURATION_SECONDS" \
    --concurrency "$CONCURRENCY" \
    --path "/appointments" \
    "${FAILURE_ARG[@]}"

  echo "Esperando ${METRICS_SCRAPE_GRACE_SECONDS}s para el siguiente scrape de Grafana Cloud."
  sleep "$METRICS_SCRAPE_GRACE_SECONDS"

  set +e
  wait_for_quality_gate
  rc=$?
  set -e
  if [[ $rc -eq 1 ]]; then
    exit 1
  elif [[ $rc -eq 2 ]]; then
    exit 2
  fi
done

echo "\n=== Promoción final: 100% Canary ==="
AWS_REGION="$AWS_REGION" bash "$ROOT_DIR/scripts/set-canary-traffic.sh" 100
if ! python3 "$ROOT_DIR/scripts/load-test.py" \
  --url "$API_URL" \
  --requests 1000 \
  --concurrency "$CONCURRENCY" \
  --path "/appointments" \
  --expect-canary-only; then
  echo "La verificación posterior a la promoción falló; se revierte a Stable."
  rollback
  exit 1
fi

echo "Promoción completada: 100% del tráfico público a V3.1 Canary."
echo "Rollback manual: AWS_REGION=$AWS_REGION bash $ROOT_DIR/scripts/set-canary-traffic.sh 0"
