#!/usr/bin/env bash
# ============================================================
# Bootstrap inicial para AWS. Ejecutar UNA vez desde AWS CloudShell.
# Crea el bucket S3 donde Terraform guarda su state.
# Si la cuenta permite OIDC, además crea el proveedor y el rol para GitHub Actions.
# Si una política de la organización (SCP) lo bloquea, lo omite y avisa.
#
# Uso:  bash scripts/bootstrap-aws.sh <github-owner> <github-repo>
# ============================================================
set -euo pipefail

REGION="us-east-2"
PROJECT="api-restful-veterinaria"
GITHUB_OWNER="${1:?Falta el owner de GitHub. Uso: $0 <owner> <repo>}"
GITHUB_REPO="${2:?Falta el nombre del repo. Uso: $0 <owner> <repo>}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
STATE_BUCKET="${PROJECT}-tf-state-${ACCOUNT_ID}"
ROLE_NAME="${PROJECT}-github-actions"
PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

echo "Cuenta AWS:   ${ACCOUNT_ID}"
echo "Bucket state: ${STATE_BUCKET}"
echo

# 1. Bucket S3 para el state de Terraform
if aws s3api head-bucket --bucket "${STATE_BUCKET}" 2>/dev/null; then
  echo "[1/2] Bucket ya existe, se reutiliza."
else
  echo "[1/2] Creando bucket..."
  aws s3api create-bucket \
    --bucket "${STATE_BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}"
fi

aws s3api put-bucket-versioning \
  --bucket "${STATE_BUCKET}" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "${STATE_BUCKET}" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block \
  --bucket "${STATE_BUCKET}" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 2. OIDC de GitHub (opcional: puede estar bloqueado por la organización)
if ! PROVIDERS=$(aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[].Arn' --output text 2>/dev/null); then
  echo
  echo "[2/2] OIDC NO disponible: una política de la organización lo bloquea."
  echo "      Se omite. Usa credenciales temporales como secrets de GitHub"
  echo "      (ver terraform/README.md, sección 'Autenticación del pipeline')."
  echo
  echo "Bucket del state: ${STATE_BUCKET}"
  exit 0
fi

if echo "${PROVIDERS}" | grep -q "${PROVIDER_ARN}"; then
  echo "[2/2] Proveedor OIDC ya existe."
else
  echo "[2/2] Creando proveedor OIDC de GitHub..."
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com
fi

TRUST_FILE=$(mktemp)
cat > "${TRUST_FILE}" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "${PROVIDER_ARN}" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
        "StringLike": { "token.actions.githubusercontent.com:sub": "repo:${GITHUB_OWNER}/${GITHUB_REPO}:ref:refs/heads/main" }
      }
    }
  ]
}
JSON

if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name "${ROLE_NAME}" --policy-document "file://${TRUST_FILE}"
else
  aws iam create-role --role-name "${ROLE_NAME}" \
    --assume-role-policy-document "file://${TRUST_FILE}" \
    --description "Despliegue de la API veterinaria V3 desde GitHub Actions"
fi
aws iam attach-role-policy --role-name "${ROLE_NAME}" --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

echo
echo "Bucket del state: ${STATE_BUCKET}"
echo "Role ARN OIDC   : $(aws iam get-role --role-name "${ROLE_NAME}" --query 'Role.Arn' --output text)"
echo "(Con OIDC disponible tendrías que cambiar el workflow a role-to-assume; hoy usa credenciales temporales.)"
