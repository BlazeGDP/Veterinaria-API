#!/usr/bin/env bash
# Ejecutar en AWS CloudShell. No crea usuarios ni roles IAM: el pipeline
# reutiliza las credenciales IAM que ya están guardadas en GitHub Secrets.
set -euo pipefail

REGION="${AWS_REGION:-us-east-2}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
DEFAULT_BUCKET="tfstate-api-restful-veterinaria-${ACCOUNT_ID}"
STATE_BUCKET="${TF_STATE_BUCKET:-$DEFAULT_BUCKET}"

printf 'Cuenta AWS: %s\nRegión: %s\nBucket Terraform: %s\n' "$ACCOUNT_ID" "$REGION" "$STATE_BUCKET"

if aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
  echo "El bucket ya existe; se reutilizará."
else
  echo "Creando bucket S3 para el estado de Terraform..."
  aws s3api create-bucket \
    --bucket "$STATE_BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration "LocationConstraint=$REGION"
fi

aws s3api put-bucket-versioning \
  --bucket "$STATE_BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$STATE_BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block \
  --bucket "$STATE_BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

printf '\nBootstrap completo. Configura en GitHub:\n'
printf 'Settings > Secrets and variables > Actions > Variables\n'
printf 'TF_STATE_BUCKET=%s\n' "$STATE_BUCKET"
printf '\nNo se intentó crear OIDC porque tu cuenta usa credenciales IAM existentes y la organización puede bloquear cambios IAM.\n'
