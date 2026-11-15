#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${TF_STATE_BUCKET:?}" "${TF_VAR_chaos_token:?}"
export AWS_DEFAULT_REGION=${AWS_DEFAULT_REGION:-us-east-2}
export TF_VAR_image_tag=${TF_VAR_image_tag:-v4.0.0}
terraform -chdir=terraform init -reconfigure -backend-config="bucket=$TF_STATE_BUCKET"
# Bootstrap ECR only when starting from an empty account/state.
terraform -chdir=terraform apply -auto-approve -target=aws_ecr_repository.api
ECR=$(terraform -chdir=terraform output -raw ecr_repository_url)
aws ecr get-login-password | docker login --username AWS --password-stdin "${ECR%%/*}"
docker build --platform linux/amd64 --build-arg APP_VERSION=4.0.0 -t "$ECR:$TF_VAR_image_tag" .
docker push "$ECR:$TF_VAR_image_tag"
terraform -chdir=terraform apply -auto-approve
CLUSTER=$(terraform -chdir=terraform output -raw ecs_cluster_name)
SERVICE=$(terraform -chdir=terraform output -raw ecs_service_name)
aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment >/dev/null
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE"
terraform -chdir=terraform output api_url
