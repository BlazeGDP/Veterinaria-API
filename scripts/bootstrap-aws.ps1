param(
    [string]$Region = "us-east-2",
    [string]$StateBucket = ""
)
$ErrorActionPreference = "Stop"
$AccountId = aws sts get-caller-identity --query Account --output text
if ([string]::IsNullOrWhiteSpace($StateBucket)) {
    $StateBucket = "tfstate-api-restful-veterinaria-$AccountId"
}

Write-Host "Cuenta AWS: $AccountId"
Write-Host "Bucket Terraform: $StateBucket"

aws s3api head-bucket --bucket $StateBucket 2>$null
if ($LASTEXITCODE -ne 0) {
    aws s3api create-bucket --bucket $StateBucket --region $Region --create-bucket-configuration "LocationConstraint=$Region"
}
aws s3api put-bucket-versioning --bucket $StateBucket --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket $StateBucket --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket $StateBucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

Write-Host "Bootstrap completo." -ForegroundColor Green
Write-Host "Crea la Repository Variable TF_STATE_BUCKET=$StateBucket en GitHub."
Write-Host "No se crean usuarios, roles ni proveedor OIDC."
