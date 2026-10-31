# Terraform — V3.1 Canary

Este stack crea solamente los recursos exclusivos de la versión Canary: un ECS Cluster separado, Task Definition, Service Fargate, Target Group y reglas ALB para prueba interna y scrape de métricas.

Consume los outputs del stack estable mediante `terraform_remote_state`; por eso Stable debe existir primero.

Estado S3: `api-restful-veterinaria/v3-canary/terraform.tfstate`.

## Inicializar y validar

```bash
export AWS_REGION=us-east-2
export TF_STATE_BUCKET=NOMBRE-DEL-BUCKET-EXISTENTE
terraform init -backend-config="bucket=$TF_STATE_BUCKET"
terraform fmt -recursive
terraform validate
terraform plan \
  -var="tf_state_bucket=$TF_STATE_BUCKET" \
  -var="image_tag=<TAG-INMUTABLE-EN-ECR>"
```

## Aplicar

```bash
terraform apply \
  -var="tf_state_bucket=$TF_STATE_BUCKET" \
  -var="image_tag=<TAG-INMUTABLE-EN-ECR>" \
  -var="api_version=3.1.0"
```

## Destruir únicamente Canary

Primero establece el listener en Stable 100% / Canary 0% usando `scripts/set-canary-traffic.sh stable-only`; después:

```bash
terraform destroy \
  -var="tf_state_bucket=$TF_STATE_BUCKET" \
  -var="image_tag=<ULTIMO-TAG-CANARY>"
```

El workflow `destroy-canary.yml` realiza estos pasos y elimina también la imagen Canary. No destruye el ALB, RDS, VPC, ECR ni ECS Stable.
