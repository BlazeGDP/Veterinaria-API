$ErrorActionPreference = "Stop"

# ============================================================
# Bootstrap inicial para la cuenta AWS nueva de V3
# Ejecutar una sola vez con permisos administrativos.
# ============================================================

$Region = "us-east-2"
$Project = "api-restful-veterinaria"
$GithubOwner = Read-Host "GitHub owner/usuario u organización"
$GithubRepo = Read-Host "Nombre exacto del repositorio"

Write-Host "Verificando identidad AWS..." -ForegroundColor Cyan
$AccountId = aws sts get-caller-identity --query Account --output text
if (-not $AccountId) {
    throw "No se pudo obtener el Account ID. Configura AWS CLI primero."
}

$StateBucket = "$Project-tf-state-$AccountId"
$RoleName = "$Project-github-actions"

Write-Host "Cuenta AWS: $AccountId" -ForegroundColor Green
Write-Host "Bucket Terraform: $StateBucket" -ForegroundColor Green
Write-Host "Role GitHub Actions: $RoleName" -ForegroundColor Green

# ------------------------------------------------------------
# 1. Bucket S3 para Terraform State
# ------------------------------------------------------------
$bucketExists = aws s3api head-bucket --bucket $StateBucket 2>$null
if ($LASTEXITCODE -ne 0) {
    aws s3api create-bucket `
        --bucket $StateBucket `
        --region $Region `
        --create-bucket-configuration LocationConstraint=$Region
}

aws s3api put-bucket-versioning `
    --bucket $StateBucket `
    --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption `
    --bucket $StateBucket `
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

aws s3api put-public-access-block `
    --bucket $StateBucket `
    --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# ------------------------------------------------------------
# 2. GitHub OIDC provider
# ------------------------------------------------------------
$providerArn = "arn:aws:iam::$AccountId:oidc-provider/token.actions.githubusercontent.com"
$providers = aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[].Arn' --output text

if ($providers -notcontains $providerArn) {
    aws iam create-open-id-connect-provider `
        --url https://token.actions.githubusercontent.com `
        --client-id-list sts.amazonaws.com
}

# ------------------------------------------------------------
# 3. Trust policy para GitHub Actions
# ------------------------------------------------------------
$trustPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "$providerArn"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:$GithubOwner/$GithubRepo:ref:refs/heads/main",
            "repo:$GithubOwner@*/$GithubRepo@*:ref:refs/heads/main"
          ]
        }
      }
    }
  ]
}
"@

$TrustFile = Join-Path $env:TEMP "github-oidc-trust.json"
$trustPolicy | Set-Content -Path $TrustFile -Encoding utf8

$existingRole = aws iam get-role --role-name $RoleName 2>$null
if ($LASTEXITCODE -ne 0) {
    aws iam create-role `
        --role-name $RoleName `
        --assume-role-policy-document file://$TrustFile `
        --description "Terraform and deployment role for the V3 veterinary API GitHub Actions pipeline"
} else {
    aws iam update-assume-role-policy `
        --role-name $RoleName `
        --policy-document file://$TrustFile
}

aws iam attach-role-policy `
    --role-name $RoleName `
    --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

$RoleArn = aws iam get-role --role-name $RoleName --query 'Role.Arn' --output text

Write-Host "" 
Write-Host "==============================================" -ForegroundColor Green
Write-Host "BOOTSTRAP COMPLETADO" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host "Account ID: $AccountId"
Write-Host "State bucket: $StateBucket"
Write-Host "GitHub role ARN: $RoleArn"
Write-Host "" 
Write-Host "Ahora configura terraform/backend.tf con:" -ForegroundColor Yellow
Write-Host "bucket = `"$StateBucket`""
Write-Host "" 
Write-Host "Y crea en GitHub el secret:" -ForegroundColor Yellow
Write-Host "AWS_GITHUB_ACTIONS_ROLE_ARN = $RoleArn"
Write-Host "" 
Write-Host "El role usa OIDC y no requiere guardar Access Keys de AWS en GitHub." -ForegroundColor Cyan
