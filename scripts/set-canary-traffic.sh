#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Uso: $0 <porcentaje-canary: 0|5|10|25|50|100|stable-only>" >&2
  exit 2
fi

CANARY_PERCENT="$1"
case "$CANARY_PERCENT" in
  0|5|10|25|50|100|stable-only) ;;
  *) echo "Porcentaje permitido: 0, 5, 10, 25, 50, 100 o stable-only." >&2; exit 2 ;;
esac

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_REGION="${AWS_REGION:-us-east-2}"

need_output() {
  local dir="$1" name="$2"
  terraform -chdir="$ROOT_DIR/$dir" output -raw "$name"
}

STABLE_TG="$(need_output terraform stable_target_group_arn)"
LISTENER_ARN="$(need_output terraform alb_listener_arn)"
ACTIONS_FILE="$(mktemp)"
trap 'rm -f "$ACTIONS_FILE"' EXIT

if [[ "$CANARY_PERCENT" == "stable-only" ]]; then
  # Retira la referencia al Target Group Canary del listener. Es necesario
  # antes de destruirlo porque un TG referenciado no puede eliminarse.
  jq -n --arg stable "$STABLE_TG" \
    '[{"Type":"forward","TargetGroupArn":$stable}]' > "$ACTIONS_FILE"
  aws elbv2 modify-listener \
    --region "$AWS_REGION" \
    --listener-arn "$LISTENER_ARN" \
    --default-actions "file://$ACTIONS_FILE" >/dev/null
  echo "Listener restaurado: 100% Stable; Target Group Canary desacoplado."
else
  CANARY_TG="$(need_output terraform-canary canary_target_group_arn)"
  STABLE_PERCENT=$((100 - CANARY_PERCENT))
  jq -n \
    --arg stable "$STABLE_TG" \
    --arg canary "$CANARY_TG" \
    --argjson stableWeight "$STABLE_PERCENT" \
    --argjson canaryWeight "$CANARY_PERCENT" \
    '[{"Type":"forward","ForwardConfig":{"TargetGroups":[{"TargetGroupArn":$stable,"Weight":$stableWeight},{"TargetGroupArn":$canary,"Weight":$canaryWeight}]}}]' \
    > "$ACTIONS_FILE"
  aws elbv2 modify-listener \
    --region "$AWS_REGION" \
    --listener-arn "$LISTENER_ARN" \
    --default-actions "file://$ACTIONS_FILE" >/dev/null
  echo "Tráfico actualizado: stable=${STABLE_PERCENT}% | canary=${CANARY_PERCENT}%"
fi
aws elbv2 describe-listeners \
  --region "$AWS_REGION" \
  --listener-arns "$LISTENER_ARN" \
  --query 'Listeners[0].DefaultActions[0].ForwardConfig.TargetGroups[].{Weight:Weight,TargetGroupArn:TargetGroupArn}' \
  --output table
