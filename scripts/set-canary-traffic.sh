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
need_output() { terraform -chdir="$ROOT_DIR/$1" output -raw "$2"; }

STABLE_TG="$(need_output terraform stable_target_group_arn)"
LISTENER_ARN="$(need_output terraform alb_listener_arn)"
ACTIONS_FILE="$(mktemp)"
trap 'rm -f "$ACTIONS_FILE"' EXIT

if [[ "$CANARY_PERCENT" == "stable-only" ]]; then
  jq -n --arg stable "$STABLE_TG" '[{"Type":"forward","TargetGroupArn":$stable}]' > "$ACTIONS_FILE"
else
  CANARY_TG="$(need_output terraform-canary canary_target_group_arn)"
  STABLE_PERCENT=$((100 - CANARY_PERCENT))
  jq -n \
    --arg stable "$STABLE_TG" \
    --arg canary "$CANARY_TG" \
    --argjson stableWeight "$STABLE_PERCENT" \
    --argjson canaryWeight "$CANARY_PERCENT" \
    '[{"Type":"forward","ForwardConfig":{"TargetGroups":[{"TargetGroupArn":$stable,"Weight":$stableWeight},{"TargetGroupArn":$canary,"Weight":$canaryWeight}],"TargetGroupStickinessConfig":{"Enabled":false}}}]' \
    > "$ACTIONS_FILE"
fi

aws elbv2 modify-listener \
  --region "$AWS_REGION" \
  --listener-arn "$LISTENER_ARN" \
  --default-actions "file://$ACTIONS_FILE" >/dev/null

# Read back the actual default listener action and verify it matches the requested split.
ACTUAL="$(aws elbv2 describe-listeners \
  --region "$AWS_REGION" \
  --listener-arns "$LISTENER_ARN" \
  --output json)"
echo "$ACTUAL" | jq '.Listeners[0].DefaultActions[0]'

if [[ "$CANARY_PERCENT" != "stable-only" ]]; then
  ACTUAL_STABLE="$(echo "$ACTUAL" | jq -r --arg arn "$STABLE_TG" '[.Listeners[0].DefaultActions[0].ForwardConfig.TargetGroups[] | select(.TargetGroupArn == $arn) | .Weight][0] // 0')"
  ACTUAL_CANARY="$(echo "$ACTUAL" | jq -r --arg arn "$CANARY_TG" '[.Listeners[0].DefaultActions[0].ForwardConfig.TargetGroups[] | select(.TargetGroupArn == $arn) | .Weight][0] // 0')"
  EXPECTED_STABLE=$((100 - CANARY_PERCENT))
  if [[ "$ACTUAL_STABLE" != "$EXPECTED_STABLE" || "$ACTUAL_CANARY" != "$CANARY_PERCENT" ]]; then
    echo "ERROR: Listener reportó stable=$ACTUAL_STABLE y canary=$ACTUAL_CANARY; esperado stable=$EXPECTED_STABLE y canary=$CANARY_PERCENT." >&2
    exit 1
  fi
  echo "Tráfico actualizado y verificado: stable=${ACTUAL_STABLE}% | canary=${ACTUAL_CANARY}% | stickiness=disabled"
else
  echo "Listener restaurado: 100% Stable; Target Group Canary desacoplado."
fi
